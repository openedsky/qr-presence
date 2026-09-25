import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { meetingFormSchema } from "@/lib/validators";
import { requireApiPermission } from "@/lib/api-auth";
import { createMeeting, meetingWhereForRole } from "@/server/services/meetings";
import { getSettings } from "@/server/services/settings";

export async function GET() {
  const gate = await requireApiPermission("attendances.read");
  if (gate.error) return gate.error;
  const meetings = await prisma.meeting.findMany({
    where: meetingWhereForRole(gate.session.user.role, gate.session.user.id),
    orderBy: { startsAt: "desc" },
    take: 100,
    include: { _count: { select: { attendances: true } } },
  });
  return NextResponse.json(meetings);
}

export async function POST(request: Request) {
  const gate = await requireApiPermission("meetings.create");
  if (gate.error) return gate.error;
  const settings = await getSettings();
  const body = await request.json();
  const parsed = meetingFormSchema.safeParse({
    ...body,
    emailRequired: body.emailRequired ?? settings.emailRequiredDefault,
    signatureRequired: body.signatureRequired ?? settings.signatureRequiredDefault,
  });
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Données invalides" }, { status: 400 });
  }
  const data = parsed.data;
  const meeting = await createMeeting({
    title: data.title,
    internalRef: data.internalRef || undefined,
    description: data.description || undefined,
    type: data.type,
    location: data.location || undefined,
    videoConferenceUrl: data.videoConferenceUrl || undefined,
    startsAt: new Date(data.startsAt),
    endsAt: data.endsAt ? new Date(data.endsAt) : undefined,
    registrationOpensAt: data.registrationOpensAt ? new Date(data.registrationOpensAt) : undefined,
    registrationClosesAt: data.registrationClosesAt ? new Date(data.registrationClosesAt) : undefined,
    toleranceMinutes: data.toleranceMinutes,
    qrMode: data.qrMode,
    qrSecurityLevel: data.qrSecurityLevel,
    allowGuests: data.allowGuests,
    showPublicAttendance: data.showPublicAttendance,
    expectedParticipants: data.expectedParticipants,
    signatureRequired: data.signatureRequired,
    emailRequired: data.emailRequired,
    internalNotes: data.internalNotes || undefined,
    createdById: gate.session.user.id,
    updatedById: gate.session.user.id,
  });
  return NextResponse.json({ id: meeting.id, uuid: meeting.uuid });
}
