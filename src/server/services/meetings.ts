import { MeetingStatus, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { internalRef, slugify } from "@/lib/utils";
import { writeAudit } from "@/lib/audit";
import { canTransition, isRegistrationOpen } from "@/lib/meeting-status";
import { ensureStaticToken, revokeMeetingTokens } from "@/lib/qr";

function uniqueSlug(title: string) {
  const base = slugify(title) || "reunion";
  return `${base}-${Math.random().toString(36).slice(2, 7)}`;
}

export async function createMeeting(
  data: Omit<Prisma.MeetingUncheckedCreateInput, "slug" | "internalRef" | "createdById"> & {
    slug?: string;
    internalRef?: string;
    createdById: string;
  },
) {
  const meeting = await prisma.meeting.create({
    data: {
      ...data,
      slug: data.slug || uniqueSlug(data.title),
      internalRef: data.internalRef || internalRef(),
    },
  });
  await ensureStaticToken(meeting);
  await writeAudit({
    actorId: data.createdById,
    action: "meeting.create",
    entity: "Meeting",
    entityId: meeting.id,
    afterData: { title: meeting.title, status: meeting.status },
  });
  return meeting;
}

export async function duplicateMeeting(id: string, actorId: string, startsAt: Date) {
  const source = await prisma.meeting.findUniqueOrThrow({ where: { id } });
  const copy = await createMeeting({
    title: `${source.title} — copie`,
    description: source.description ?? undefined,
    type: source.type,
    location: source.location,
    videoConferenceUrl: source.videoConferenceUrl,
    startsAt,
    endsAt: source.endsAt
      ? new Date(startsAt.getTime() + (source.endsAt.getTime() - source.startsAt.getTime()))
      : undefined,
    toleranceMinutes: source.toleranceMinutes,
    qrMode: source.qrMode,
    qrSecurityLevel: source.qrSecurityLevel,
    allowGuests: source.allowGuests,
    showPublicAttendance: source.showPublicAttendance,
    expectedParticipants: source.expectedParticipants ?? undefined,
    signatureRequired: source.signatureRequired,
    emailRequired: source.emailRequired,
    internalNotes: source.internalNotes ?? undefined,
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

export async function transitionMeeting(
  id: string,
  to: MeetingStatus,
  actorId: string,
) {
  const meeting = await prisma.meeting.findUniqueOrThrow({ where: { id } });
  if (!canTransition(meeting.status, to)) {
    throw new Error(`Transition ${meeting.status} → ${to} interdite`);
  }

  const updated = await prisma.meeting.update({
    where: { id },
    data: {
      status: to,
      updatedById: actorId,
      closedAt: to === MeetingStatus.CLOTUREE ? new Date() : meeting.closedAt,
      closedById: to === MeetingStatus.CLOTUREE ? actorId : meeting.closedById,
    },
  });

  if (to === MeetingStatus.CLOTUREE || to === MeetingStatus.ARCHIVEE) {
    await revokeMeetingTokens(id);
  }
  if (to === MeetingStatus.OUVERTE && meeting.status === MeetingStatus.CLOTUREE) {
    // Les affiches déjà imprimées doivent redevenir valides après une réouverture.
    const lastStatic = await prisma.meetingQrToken.findFirst({
      where: { meetingId: id, type: "STATIC" },
      orderBy: { createdAt: "desc" },
    });
    if (lastStatic) {
      await prisma.meetingQrToken.update({ where: { id: lastStatic.id }, data: { revokedAt: null } });
    } else {
      await ensureStaticToken(updated);
    }
  }

  await writeAudit({
    actorId,
    action:
      to === MeetingStatus.CLOTUREE
        ? "meeting.close"
        : to === MeetingStatus.OUVERTE && meeting.status === MeetingStatus.CLOTUREE
          ? "meeting.reopen"
          : "meeting.status",
    entity: "Meeting",
    entityId: id,
    beforeData: { status: meeting.status },
    afterData: { status: to },
  });

  return updated;
}

export function meetingWhereForRole(
  role: string,
  userId: string,
  extra: Prisma.MeetingWhereInput = {},
): Prisma.MeetingWhereInput {
  if (role === "ORGANIZER") {
    return { AND: [{ createdById: userId }, extra] };
  }
  return extra;
}

export { isRegistrationOpen };
