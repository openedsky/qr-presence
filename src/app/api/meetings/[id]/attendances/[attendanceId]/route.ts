import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { postCloseGuard, requireMeetingApi } from "@/lib/meeting-access";
import { attendancePatchSchema } from "@/lib/validators";
import { nameKey, normalizeEmail, toTitleFirstNames, toUpperLastName } from "@/lib/identity";
import { normalizePhone } from "@/lib/phone";
import { writeAudit } from "@/lib/audit";
import { isInternalParticipant } from "@/server/services/structures";
import { scheduleOfficialRefresh } from "@/server/services/documents";
import { clearLoneHomonymFlags } from "@/server/services/duplicates";
import { expectClosed, lockMeetingContent, MeetingStateChangedError } from "@/server/services/meeting-content";
import { readJsonBody } from "@/lib/http";

class StaleAttendanceError extends Error {}

const TRACKED = ["lastName", "firstNames", "jobTitle", "organization", "email", "phone"] as const;

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string; attendanceId: string }> },
) {
  const { id, attendanceId } = await params;
  const gate = await requireMeetingApi(id, "attendances.manage");
  if (gate.error) return gate.error;
  const body = (await readJsonBody(request)) as Record<string, unknown> | null;
  const frozen = postCloseGuard(gate.meeting, body?.reason);
  if (frozen.error) return frozen.error;
  const current = await prisma.attendance.findFirst({
    where: { id: attendanceId, meetingId: id },
  });
  if (!current) return NextResponse.json({ error: "Introuvable" }, { status: 404 });

  // Validation d'un homonyme signalé : deux personnes distinctes portant le même nom.
  if (body?.resolveDuplicate === true) {
    await prisma.attendance.update({
      where: { id: attendanceId },
      data: { suspectedDuplicate: false, updatedById: gate.session.user.id },
    });
    await writeAudit({
      actorId: gate.session.user.id,
      action: "attendance.duplicate_resolved",
      entity: "Attendance",
      entityId: attendanceId,
      afterData: { meetingId: id, ...(frozen.reason ? { reason: frozen.reason } : {}) },
    });
    return NextResponse.json({ ok: true });
  }

  const parsed = attendancePatchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Données invalides" }, { status: 400 });
  }

  // Champ absent : inchangé ; champ vidé : effacé (null, pas une chaîne vide qui fausserait les doublons).
  const optional = (value: string | undefined, fallback: string | null) =>
    value === undefined ? fallback : value.trim() || null;
  const next = {
    lastName: parsed.data.lastName ? toUpperLastName(parsed.data.lastName) : current.lastName,
    firstNames: parsed.data.firstNames ? toTitleFirstNames(parsed.data.firstNames) : current.firstNames,
    jobTitle: parsed.data.jobTitle ?? current.jobTitle,
    organization: parsed.data.organization ?? current.organization,
    email: optional(parsed.data.email, current.email),
    phone: optional(parsed.data.phone, current.phone),
  };
  if (gate.meeting.emailRequired && !next.email && current.email) {
    return NextResponse.json({ error: "L'email est obligatoire pour cette réunion." }, { status: 400 });
  }

  const changed = TRACKED.filter((field) => String(current[field] ?? "") !== String(next[field] ?? ""));
  if (changed.length === 0) return NextResponse.json({ ok: true, unchanged: true });

  const emailNormalized = normalizeEmail(next.email);
  const phoneNormalized = normalizePhone(next.phone);
  const key = nameKey(next.lastName, next.firstNames);
  const isActive = current.status === "ACTIVE";

  // Mêmes règles qu'à l'enregistrement : une correction ne doit pas rendre externe une présence sur une
  // réunion réservée aux agents (sauf saisie déjà dérogatoire et motivée).
  if (
    !gate.meeting.allowGuests &&
    !current.manualReason &&
    (changed.includes("organization") || changed.includes("email")) &&
    !(await isInternalParticipant(next.organization, next.email))
  ) {
    return NextResponse.json(
      { error: "Cette réunion est réservée aux agents SODEFOR : la structure ou l'email indiqué est externe." },
      { status: 400 },
    );
  }

  let suspectedDuplicate = current.suspectedDuplicate;
  // Le contrôle d'homonyme vaut aussi quand l'email ou le téléphone est retiré : sans eux, deux présences
  // du même nom deviendraient indiscernables (situation bloquée à l'enregistrement).
  if (isActive && (key !== current.nameKey || changed.includes("email") || changed.includes("phone"))) {
    const homonym = await prisma.attendance.findFirst({
      where: { meetingId: id, status: "ACTIVE", nameKey: key, id: { not: attendanceId } },
      select: { emailNormalized: true, phoneNormalized: true },
    });
    if (homonym && !emailNormalized && !phoneNormalized && !homonym.emailNormalized && !homonym.phoneNormalized) {
      return NextResponse.json(
        { error: "Un autre participant porte déjà ce nom, sans email ni téléphone pour les distinguer." },
        { status: 409 },
      );
    }
    suspectedDuplicate = key !== current.nameKey ? Boolean(homonym) : current.suspectedDuplicate;
  }

  try {
    await prisma.$transaction(async (tx) => {
      await lockMeetingContent(tx, id, expectClosed(Boolean(frozen.reason)));
      // Conditionnée au statut lu : une annulation concurrente ne doit pas être écrasée par des clés actives.
      const updated = await tx.attendance.updateMany({
        where: { id: attendanceId, status: current.status },
        data: {
          ...next,
          emailNormalized,
          phoneNormalized,
          nameKey: key,
          activeEmailKey: isActive ? emailNormalized : null,
          activePhoneKey: isActive ? phoneNormalized : null,
          activeNameKey: isActive ? key : null,
          suspectedDuplicate,
          updatedById: gate.session.user.id,
        },
      });
      if (updated.count === 0) throw new StaleAttendanceError();
      if (isActive && key !== current.nameKey) await clearLoneHomonymFlags(tx, id, current.nameKey);
      await tx.attendanceChange.createMany({
        data: changed.map((field) => ({
          attendanceId,
          actorId: gate.session.user.id,
          field,
          oldValue: String(current[field] ?? ""),
          newValue: String(next[field] ?? ""),
        })),
      });
    });
  } catch (error) {
    if (error instanceof MeetingStateChangedError) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    if (error instanceof StaleAttendanceError) {
      return NextResponse.json({ error: "Cette présence vient d'être modifiée ou annulée : actualisez la page." }, { status: 409 });
    }
    if ((error as { code?: string }).code === "P2002") {
      return NextResponse.json(
        { error: "Cet email ou ce téléphone correspond déjà à un autre participant de cette réunion." },
        { status: 409 },
      );
    }
    throw error;
  }

  await writeAudit({
    actorId: gate.session.user.id,
    action: frozen.reason ? "attendance.post_close_update" : "attendance.update",
    entity: "Attendance",
    entityId: attendanceId,
    beforeData: Object.fromEntries(changed.map((field) => [field, current[field]])),
    afterData: {
      ...Object.fromEntries(changed.map((field) => [field, next[field]])),
      meetingId: id,
      ...(frozen.reason ? { reason: frozen.reason } : {}),
    },
  });
  if (frozen.reason) scheduleOfficialRefresh(id, gate.session.user.id);

  return NextResponse.json({ ok: true });
}
