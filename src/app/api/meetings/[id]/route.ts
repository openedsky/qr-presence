import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { meetingFormSchema } from "@/lib/validators";
import { requireApiPermission } from "@/lib/api-auth";
import { writeAudit } from "@/lib/audit";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const gate = await requireApiPermission("attendances.read");
  if (gate.error) return gate.error;
  const { id } = await params;
  const meeting = await prisma.meeting.findUnique({
    where: { id },
    include: { _count: { select: { attendances: true } } },
  });
  if (!meeting) return NextResponse.json({ error: "Introuvable" }, { status: 404 });
  return NextResponse.json(meeting);
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const gate = await requireApiPermission("meetings.manage_own");
  if (gate.error) return gate.error;
  const { id } = await params;
  const body = await request.json();
  const parsed = meetingFormSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Données invalides" }, { status: 400 });
  }
  const before = await prisma.meeting.findUnique({ where: { id } });
  if (!before) return NextResponse.json({ error: "Introuvable" }, { status: 404 });
  const data = parsed.data;
  const meeting = await prisma.meeting.update({
    where: { id },
    data: {
      title: data.title,
      internalRef: data.internalRef || before.internalRef,
      description: data.description || null,
      type: data.type,
      location: data.location || null,
      videoConferenceUrl: data.videoConferenceUrl || null,
      startsAt: new Date(data.startsAt),
      endsAt: data.endsAt ? new Date(data.endsAt) : null,
      registrationOpensAt: data.registrationOpensAt ? new Date(data.registrationOpensAt) : null,
      registrationClosesAt: data.registrationClosesAt ? new Date(data.registrationClosesAt) : null,
      toleranceMinutes: data.toleranceMinutes,
      qrMode: data.qrMode,
      qrSecurityLevel: data.qrSecurityLevel,
      allowGuests: data.allowGuests,
      showPublicAttendance: data.showPublicAttendance,
      expectedParticipants: data.expectedParticipants,
      signatureRequired: data.signatureRequired,
      emailRequired: data.emailRequired,
      internalNotes: data.internalNotes || null,
      updatedById: gate.session.user.id,
    },
  });
  await writeAudit({
    actorId: gate.session.user.id,
    action: "meeting.update",
    entity: "Meeting",
    entityId: id,
    beforeData: { title: before.title },
    afterData: { title: meeting.title },
  });
  return NextResponse.json({ id: meeting.id });
}
