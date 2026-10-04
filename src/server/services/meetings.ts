import { MeetingStatus, Prisma, type Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { internalRef, slugify } from "@/lib/utils";
import { writeAudit } from "@/lib/audit";
import { canTransition, isRegistrationOpen, STATUS_LABELS } from "@/lib/meeting-status";
import { ensureStaticToken, revokeDynamicTokens } from "@/lib/qr";
import { meetingScope } from "@/lib/rbac";
import { logger } from "@/lib/logger";
import { generateListDocument } from "./documents";

function uniqueSlug(title: string) {
  const base = slugify(title) || "reunion";
  return `${base}-${Math.random().toString(36).slice(2, 7)}`;
}

export function isUniqueViolation(error: unknown): error is Prisma.PrismaClientKnownRequestError {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

function uniqueTarget(error: Prisma.PrismaClientKnownRequestError) {
  const target = error.meta?.target;
  return Array.isArray(target) ? target.join(",") : String(target ?? "");
}

export class TransitionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TransitionError";
  }
}

export async function createMeeting(
  data: Omit<Prisma.MeetingUncheckedCreateInput, "slug" | "internalRef" | "createdById"> & {
    slug?: string;
    internalRef?: string;
    createdById: string;
  },
) {
  let meeting;
  for (let attempt = 0; ; attempt++) {
    try {
      meeting = await prisma.meeting.create({
        data: {
          ...data,
          slug: data.slug || uniqueSlug(data.title),
          internalRef: data.internalRef || internalRef(),
        },
      });
      break;
    } catch (error) {
      // Collision sur une référence ou un slug générés : on retire ; une référence saisie remonte en 409.
      if (!isUniqueViolation(error) || attempt >= 4) throw error;
      const target = uniqueTarget(error);
      if (data.internalRef && target.includes("internalRef")) throw error;
      if (data.slug && target.includes("slug")) throw error;
    }
  }
  await ensureStaticToken(meeting);
  await writeAudit({
    actorId: data.createdById,
    action: "meeting.create",
    entity: "Meeting",
    entityId: meeting.id,
    afterData: {
      title: meeting.title,
      internalRef: meeting.internalRef,
      type: meeting.type,
      startsAt: meeting.startsAt,
      endsAt: meeting.endsAt,
      location: meeting.location,
      qrMode: meeting.qrMode,
      status: meeting.status,
      secretaryId: meeting.secretaryId,
    },
  });
  return meeting;
}

/** Copie la configuration (sans notes internes) sur la date choisie, à la même heure que l'original. */
export async function duplicateMeeting(
  id: string,
  actorId: string,
  day: Date,
  overrides: { secretaryId?: string | null } = {},
) {
  const source = await prisma.meeting.findUniqueOrThrow({ where: { id } });
  const startsAt = new Date(day);
  startsAt.setUTCHours(source.startsAt.getUTCHours(), source.startsAt.getUTCMinutes(), 0, 0);
  const shift = (value: Date | null) =>
    value ? new Date(startsAt.getTime() + (value.getTime() - source.startsAt.getTime())) : undefined;
  const copy = await createMeeting({
    title: source.title,
    description: source.description ?? undefined,
    type: source.type,
    location: source.location,
    videoConferenceUrl: source.videoConferenceUrl,
    startsAt,
    endsAt: shift(source.endsAt),
    registrationOpensAt: shift(source.registrationOpensAt),
    registrationClosesAt: shift(source.registrationClosesAt),
    toleranceMinutes: source.toleranceMinutes,
    qrMode: source.qrMode,
    qrSecurityLevel: source.qrSecurityLevel,
    allowGuests: source.allowGuests,
    showPublicAttendance: source.showPublicAttendance,
    expectedParticipants: source.expectedParticipants ?? undefined,
    signatureRequired: source.signatureRequired,
    emailRequired: source.emailRequired,
    secretaryId: overrides.secretaryId !== undefined ? overrides.secretaryId : source.secretaryId,
    status: MeetingStatus.BROUILLON,
    createdById: actorId,
  });
  await writeAudit({
    actorId,
    action: "meeting.duplicate",
    entity: "Meeting",
    entityId: copy.id,
    beforeData: { sourceId: source.id },
  });
  return copy;
}

/**
 * Change le statut par une mise à jour conditionnelle (statut attendu) : deux clics simultanés
 * ou une clôture automatique concurrente ne peuvent pas appliquer deux fois la même transition.
 * actorId = null pour la clôture automatique.
 */
export async function transitionMeeting(
  id: string,
  to: MeetingStatus,
  actorId: string | null,
  options: { auto?: boolean; from?: MeetingStatus } = {},
) {
  const meeting = await prisma.meeting.findUniqueOrThrow({ where: { id } });
  if (options.from && meeting.status !== options.from) {
    throw new TransitionError("Le statut de la réunion vient d'être modifié par ailleurs : actualisez la page.");
  }
  if (meeting.purgedAt && to !== MeetingStatus.ARCHIVEE) {
    throw new TransitionError("Données anonymisées (durée de conservation écoulée) : la réunion ne peut plus être rouverte.");
  }
  if (!canTransition(meeting.status, to)) {
    throw new TransitionError(`Passage de « ${STATUS_LABELS[meeting.status]} » à « ${STATUS_LABELS[to]} » impossible.`);
  }
  if (to === MeetingStatus.PLANIFIEE && meeting.status === MeetingStatus.OUVERTE) {
    const count = await prisma.attendance.count({ where: { meetingId: id } });
    if (count > 0) {
      throw new TransitionError("Des participants ont déjà émargé : la réunion ne peut plus revenir à l'état planifié.");
    }
  }

  const closing = to === MeetingStatus.CLOTUREE;
  const reopening = to === MeetingStatus.OUVERTE && meeting.status === MeetingStatus.CLOTUREE;
  const result = await prisma.meeting.updateMany({
    where: { id, status: meeting.status },
    data: {
      status: to,
      ...(actorId ? { updatedById: actorId } : {}),
      ...(closing ? { closedAt: new Date(), closedById: actorId, autoClosed: Boolean(options.auto) } : {}),
      ...(reopening ? { closedAt: null, closedById: null, autoClosed: false, reopenedAt: new Date() } : {}),
    },
  });
  if (result.count === 0) {
    throw new TransitionError("Le statut de la réunion vient d'être modifié par ailleurs : actualisez la page.");
  }
  const updated = { ...meeting, ...((await prisma.meeting.findUnique({ where: { id } })) ?? { status: to }) };

  // Le statut est acquis : les étapes suivantes sont journalisées en cas d'échec sans faire paraître
  // la transition refusée (l'interface afficherait une erreur alors que le statut a changé).
  const step = async (name: string, run: () => Promise<unknown>) => {
    try {
      await run();
    } catch (error) {
      logger.error("meeting.transition_step_failed", { meetingId: id, step: name, error });
    }
  };

  // Le jeton statique n'est pas révoqué à la clôture : l'affiche doit afficher « réunion clôturée ».
  // Le statut suffit à refuser tout nouvel émargement.
  if (closing || to === MeetingStatus.ARCHIVEE) {
    await step("revoke_dynamic_tokens", () => revokeDynamicTokens(id));
  }
  if (reopening) {
    await step("restore_static_token", async () => {
      const lastStatic = await prisma.meetingQrToken.findFirst({
        where: { meetingId: id, type: "STATIC" },
        orderBy: { createdAt: "desc" },
      });
      if (lastStatic) {
        await prisma.meetingQrToken.update({ where: { id: lastStatic.id }, data: { revokedAt: null } });
      } else {
        await ensureStaticToken(updated);
      }
    });
  }

  await step("audit", () =>
    writeAudit({
      actorId,
      action: options.auto ? "meeting.auto_close" : closing ? "meeting.close" : reopening ? "meeting.reopen" : "meeting.status",
      entity: "Meeting",
      entityId: id,
      beforeData: { status: meeting.status },
      afterData: { status: to },
    }),
  );

  if (closing) {
    // Établie en arrière-plan : la clôture répond sans attendre le rendu du PDF. Un export lancé entre-temps
    // attend la même génération (file par réunion) au lieu d'en produire une seconde.
    void (async () => {
      const actor = actorId ? await prisma.user.findUnique({ where: { id: actorId } }) : null;
      await generateListDocument({ meeting: updated, actor, kind: "official" });
    })().catch((error) => {
      // La clôture reste acquise : la liste officielle sera régénérée au prochain export.
      logger.error("meeting.official_list_failed", { meetingId: id, error: error instanceof Error ? error.message : String(error) });
    });
  }

  return updated;
}

export function meetingWhereForRole(
  role: Role,
  userId: string,
  extra: Prisma.MeetingWhereInput = {},
): Prisma.MeetingWhereInput {
  const scope = meetingScope(role);
  if (scope === "own") return { AND: [{ createdById: userId }, extra] };
  if (scope === "assigned") return { AND: [{ secretaryId: userId }, extra] };
  return extra;
}

export { isRegistrationOpen };
