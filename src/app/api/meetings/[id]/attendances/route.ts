import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiPermission } from "@/lib/api-auth";
import { attendanceFormSchema } from "@/lib/validators";
import { ClosedMeetingError, DuplicateAttendanceError, registerAttendance } from "@/server/services/attendances";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const gate = await requireApiPermission("attendances.read");
  if (gate.error) return gate.error;
  const { id } = await params;
  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q") ?? "";
  const rows = await prisma.attendance.findMany({
    where: {
      meetingId: id,
      OR: q
        ? [
            { lastName: { contains: q } },
            { firstNames: { contains: q } },
            { email: { contains: q } },
            { phone: { contains: q } },
            { jobTitle: { contains: q } },
            { organization: { contains: q } },
          ]
        : undefined,
    },
    orderBy: { checkInAt: "asc" },
  });
  return NextResponse.json(rows);
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const gate = await requireApiPermission("attendances.manage");
  if (gate.error) return gate.error;
  const { id } = await params;
  const meeting = await prisma.meeting.findUnique({ where: { id } });
  if (!meeting) return NextResponse.json({ error: "Réunion introuvable" }, { status: 404 });
  const body = await request.json();
  const parsed = attendanceFormSchema.safeParse({
    token: "admin-manual-token-placeholder",
    ...body,
  });
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Données invalides" }, { status: 400 });
  }
  try {
    const attendance = await registerAttendance({
      meetingId: meeting.id,
      meetingUuid: meeting.uuid,
      meetingStatus: meeting.status,
      signatureRequired: false,
      emailRequired: meeting.emailRequired,
      allowGuests: meeting.allowGuests,
      civility: parsed.data.civility,
      lastName: parsed.data.lastName,
      firstNames: parsed.data.firstNames,
      jobTitle: parsed.data.jobTitle,
      organization: parsed.data.organization,
      email: parsed.data.email,
      phone: parsed.data.phone,
      createdById: gate.session.user.id,
      method: "ADMIN_MANUAL",
    });
    return NextResponse.json({ id: attendance.id, confirmationCode: attendance.confirmationCode });
  } catch (error) {
    if (error instanceof DuplicateAttendanceError || error instanceof ClosedMeetingError) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    return NextResponse.json({ error: error instanceof Error ? error.message : "Erreur" }, { status: 400 });
  }
}
