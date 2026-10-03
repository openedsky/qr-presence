import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { meetingFormSchema } from "@/lib/validators";
import { requireApiPermission } from "@/lib/api-auth";
import { createMeeting, isUniqueViolation, meetingWhereForRole } from "@/server/services/meetings";
import { getSettings } from "@/server/services/settings";
import { assertMeetingType } from "@/server/services/meeting-types";
import { meetingDates, resolveSecretary } from "@/server/services/meeting-input";
import { readJsonBody } from "@/lib/http";

/** Une réunion ne se crée pas a posteriori : au-delà, c'est une saisie de régularisation à tracer autrement. */
const MAX_PAST_HOURS = 24;

export async function GET() {
  const gate = await requireApiPermission("attendances.read");
  if (gate.error) return gate.error;
  const meetings = await prisma.meeting.findMany({
    where: meetingWhereForRole(gate.session.user.role, gate.session.user.id),
    orderBy: { startsAt: "desc" },
    take: 100,
    omit: { internalNotes: true },
    include: { _count: { select: { attendances: true } } },
  });
  return NextResponse.json(meetings);
}

export async function POST(request: Request) {
  const gate = await requireApiPermission("meetings.create");
  if (gate.error) return gate.error;
  const settings = await getSettings();
  const body = (await readJsonBody(request)) as Record<string, unknown> | null;
  if (!body) return NextResponse.json({ error: "Données invalides" }, { status: 400 });
  const parsed = meetingFormSchema.safeParse({
    ...body,
    emailRequired: body.emailRequired ?? settings.emailRequiredDefault,
    signatureRequired: body.signatureRequired ?? settings.signatureRequiredDefault,
  });
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Données invalides" }, { status: 400 });
  }
  const data = parsed.data;
  const dates = meetingDates(data);
  if ((dates.endsAt ?? dates.startsAt).getTime() < Date.now() - MAX_PAST_HOURS * 3600_000) {
    return NextResponse.json({ error: "Cette réunion est déjà terminée : elle ne peut plus être créée." }, { status: 400 });
  }
  const typeError = await assertMeetingType(data.type);
  if (typeError) return NextResponse.json({ error: typeError }, { status: 400 });
  const secretary = await resolveSecretary(data.secretaryId);
  if (secretary.error) return NextResponse.json({ error: secretary.error }, { status: 400 });
  try {
    const meeting = await createMeeting({
      title: data.title,
      internalRef: data.internalRef || undefined,
      description: data.description || undefined,
      type: data.type,
      location: data.location || undefined,
      videoConferenceUrl: data.videoConferenceUrl || undefined,
      ...dates,
      toleranceMinutes: data.toleranceMinutes,
      qrMode: data.qrMode,
      qrSecurityLevel: data.qrSecurityLevel,
      allowGuests: data.allowGuests,
      showPublicAttendance: data.showPublicAttendance,
      expectedParticipants: data.expectedParticipants,
      signatureRequired: data.signatureRequired,
      emailRequired: data.emailRequired,
      internalNotes: data.internalNotes || undefined,
      secretaryId: secretary.secretaryId,
      createdById: gate.session.user.id,
      updatedById: gate.session.user.id,
    });
    return NextResponse.json({ id: meeting.id, uuid: meeting.uuid });
  } catch (error) {
    if (isUniqueViolation(error)) {
      return NextResponse.json({ error: "Cette référence interne est déjà utilisée par une autre réunion." }, { status: 409 });
    }
    throw error;
  }
}
