import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { meetingFormSchema } from "@/lib/validators";
import { requireMeetingApi } from "@/lib/meeting-access";
import { isFrozen } from "@/lib/meeting-status";
import { writeAudit } from "@/lib/audit";
import { diffForAudit } from "@/lib/audit-format";
import { assertMeetingType } from "@/server/services/meeting-types";
import { meetingDates, resolveSecretary } from "@/server/services/meeting-input";
import { isUniqueViolation } from "@/server/services/meetings";
import { readJsonBody } from "@/lib/http";

/** Informations de la réunion imprimées sur les listes : seules elles périment la liste officielle. */
const PRINTED_FIELDS = new Set(["title", "internalRef", "startsAt", "location"]);

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const gate = await requireMeetingApi(id, "read");
  if (gate.error) return gate.error;
  const meeting = await prisma.meeting.findUnique({
    where: { id },
    include: { _count: { select: { attendances: true } } },
  });
  if (!meeting) return NextResponse.json({ error: "Réunion introuvable" }, { status: 404 });
  const canSeeNotes = gate.session.user.role !== "AUDITOR" && gate.session.user.role !== "SECRETARY";
  return NextResponse.json(canSeeNotes ? meeting : { ...meeting, internalNotes: null });
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const gate = await requireMeetingApi(id, "manage");
  if (gate.error) return gate.error;
  const before = gate.meeting;
  if (isFrozen(before.status)) {
    return NextResponse.json(
      { error: "Réunion clôturée : ses informations sont gelées. Seul un administrateur peut la rouvrir." },
      { status: 409 },
    );
  }
  const body = await readJsonBody(request);
  const parsed = meetingFormSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Données invalides" }, { status: 400 });
  }
  const data = parsed.data;
  const typeError = await assertMeetingType(data.type, before.type);
  if (typeError) return NextResponse.json({ error: typeError }, { status: 400 });
  const secretary = await resolveSecretary(data.secretaryId);
  if (secretary.error) return NextResponse.json({ error: secretary.error }, { status: 400 });
  if (data.qrMode !== before.qrMode && before.status === "OUVERTE") {
    const count = await prisma.attendance.count({ where: { meetingId: id } });
    if (count > 0) {
      return NextResponse.json(
        { error: "Des participants ont déjà émargé : le mode du QR ne peut plus changer (les affiches en circulation deviendraient invalides)." },
        { status: 409 },
      );
    }
  }
  const next = {
    title: data.title,
    internalRef: data.internalRef || before.internalRef,
    description: data.description || null,
    type: data.type,
    location: data.location || null,
    videoConferenceUrl: data.videoConferenceUrl || null,
    ...meetingDates(data),
    secretaryId: secretary.secretaryId,
    toleranceMinutes: data.toleranceMinutes,
    qrMode: data.qrMode,
    qrSecurityLevel: data.qrSecurityLevel,
    allowGuests: data.allowGuests,
    showPublicAttendance: data.showPublicAttendance,
    expectedParticipants: data.expectedParticipants ?? null,
    signatureRequired: data.signatureRequired,
    emailRequired: data.emailRequired,
    internalNotes: data.internalNotes || null,
  };
  const diff = diffForAudit(before, next);
  if (diff.changed.length === 0) return NextResponse.json({ id, unchanged: true });
  const printed = diff.changed.some((field) => PRINTED_FIELDS.has(field));
  let result;
  try {
    // Conditionnée au statut lu : une clôture concurrente ne peut pas être suivie d'une modification.
    result = await prisma.meeting.updateMany({
      where: { id, status: before.status },
      data: { ...next, updatedById: gate.session.user.id, ...(printed ? { contentVersion: { increment: 1 } } : {}) },
    });
  } catch (error) {
    if (isUniqueViolation(error)) {
      return NextResponse.json({ error: "Cette référence interne est déjà utilisée par une autre réunion." }, { status: 409 });
    }
    throw error;
  }
  if (result.count === 0) {
    return NextResponse.json({ error: "Le statut de la réunion vient de changer : actualisez la page." }, { status: 409 });
  }
  await writeAudit({
    actorId: gate.session.user.id,
    action: "meeting.update",
    entity: "Meeting",
    entityId: id,
    beforeData: diff.beforeData,
    afterData: diff.afterData,
  });
  return NextResponse.json({ id });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const gate = await requireMeetingApi(id, "delete");
  if (gate.error) return gate.error;
  const counts = await prisma.meeting.findUnique({
    where: { id },
    select: { _count: { select: { attendances: true, documents: true } } },
  });
  if ((counts?._count.attendances ?? 0) > 0 || (counts?._count.documents ?? 0) > 0) {
    return NextResponse.json(
      { error: "Cette réunion comporte des émargements ou des documents : archivez-la plutôt que de la supprimer." },
      { status: 409 },
    );
  }
  try {
    await prisma.meeting.delete({ where: { id } });
  } catch (error) {
    // Émargement ou document créé entre le contrôle et la suppression (clé étrangère).
    if ((error as { code?: string }).code === "P2003") {
      return NextResponse.json(
        { error: "Cette réunion vient de recevoir des émargements ou des documents : archivez-la plutôt." },
        { status: 409 },
      );
    }
    throw error;
  }
  await writeAudit({
    actorId: gate.session.user.id,
    action: "meeting.delete",
    entity: "Meeting",
    entityId: id,
    beforeData: {
      title: gate.meeting.title,
      internalRef: gate.meeting.internalRef,
      type: gate.meeting.type,
      startsAt: gate.meeting.startsAt,
      location: gate.meeting.location,
      status: gate.meeting.status,
    },
  });
  return NextResponse.json({ ok: true });
}
