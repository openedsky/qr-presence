import type { MeetingStatus, Prisma } from "@prisma/client";

/** Le statut a changé entre la lecture de la requête et l'écriture (clôture, archivage, purge). */
export class MeetingStateChangedError extends Error {
  constructor(message = "Le statut de la réunion vient de changer : actualisez la page.") {
    super(message);
    this.name = "MeetingStateChangedError";
  }
}

export type LockedMeeting = { status: MeetingStatus; purgedAt: Date | null };

/**
 * Verrouille la ligne de la réunion (SELECT … FOR UPDATE), contrôle son statut relu et incrémente sa version
 * de contenu. Une clôture concurrente (UPDATE sur la même ligne) attend la fin de la transaction : la présence
 * est donc soit vue par la liste officielle, soit refusée.
 */
export async function lockMeetingContent(
  tx: Prisma.TransactionClient,
  meetingId: string,
  check: (meeting: LockedMeeting) => string | null,
) {
  const rows = await tx.$queryRaw<LockedMeeting[]>`SELECT status, purgedAt FROM Meeting WHERE id = ${meetingId} FOR UPDATE`;
  const meeting = rows[0];
  if (!meeting) throw new MeetingStateChangedError("Réunion introuvable.");
  if (meeting.purgedAt) throw new MeetingStateChangedError("Données anonymisées (durée de conservation écoulée).");
  if (meeting.status === "ARCHIVEE") throw new MeetingStateChangedError("Réunion archivée : aucune modification possible.");
  const refused = check(meeting);
  if (refused) throw new MeetingStateChangedError(refused);
  await tx.meeting.update({ where: { id: meetingId }, data: { contentVersion: { increment: 1 } } });
  return meeting;
}

/** Une correction sans motif ne peut pas s'appliquer à une réunion clôturée entre-temps (et inversement). */
export function expectClosed(closed: boolean) {
  return (meeting: LockedMeeting) => {
    if (closed === (meeting.status === "CLOTUREE")) return null;
    return closed
      ? "La réunion vient d'être rouverte : actualisez la page."
      : "La réunion vient d'être clôturée : actualisez la page et indiquez le motif de la correction.";
  };
}
