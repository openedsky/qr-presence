import { MeetingStatus } from "@prisma/client";

export const STATUS_ORDER: MeetingStatus[] = [
  MeetingStatus.BROUILLON,
  MeetingStatus.PLANIFIEE,
  MeetingStatus.OUVERTE,
  MeetingStatus.EN_COURS,
  MeetingStatus.CLOTUREE,
  MeetingStatus.ARCHIVEE,
];

export const STATUS_LABELS: Record<MeetingStatus, string> = {
  BROUILLON: "Brouillon",
  PLANIFIEE: "Planifiée",
  OUVERTE: "Ouverte",
  EN_COURS: "En cours",
  CLOTUREE: "Clôturée",
  ARCHIVEE: "Archivée",
};

export const STATUS_TONES: Record<MeetingStatus, string> = {
  BROUILLON: "bg-stone-100 text-stone-700",
  PLANIFIEE: "bg-sky-50 text-sky-800",
  OUVERTE: "bg-emerald-50 text-emerald-800",
  EN_COURS: "bg-green-100 text-green-900",
  CLOTUREE: "bg-amber-50 text-amber-800",
  ARCHIVEE: "bg-neutral-100 text-neutral-600",
};

const ALLOWED: Record<MeetingStatus, MeetingStatus[]> = {
  BROUILLON: [MeetingStatus.PLANIFIEE, MeetingStatus.OUVERTE],
  PLANIFIEE: [MeetingStatus.OUVERTE, MeetingStatus.BROUILLON],
  OUVERTE: [MeetingStatus.EN_COURS, MeetingStatus.CLOTUREE, MeetingStatus.PLANIFIEE],
  EN_COURS: [MeetingStatus.CLOTUREE],
  CLOTUREE: [MeetingStatus.ARCHIVEE, MeetingStatus.OUVERTE],
  ARCHIVEE: [],
};

export function canTransition(from: MeetingStatus, to: MeetingStatus) {
  return ALLOWED[from].includes(to);
}

export function isRegistrationOpen(status: MeetingStatus) {
  return status === MeetingStatus.OUVERTE || status === MeetingStatus.EN_COURS;
}

export function isFrozen(status: MeetingStatus) {
  return status === MeetingStatus.CLOTUREE || status === MeetingStatus.ARCHIVEE;
}

type WindowFields = {
  startsAt: Date;
  endsAt: Date | null;
  registrationOpensAt: Date | null;
  registrationClosesAt: Date | null;
  toleranceMinutes: number;
};

/** Réunion sans heure de fin : l'émargement se ferme au plus tard 12 h après le début. */
export const OPEN_ENDED_HOURS = 12;

/**
 * Fenêtre d'émargement : ouverture explicite ou début − tolérance ; fermeture explicite ou fin, + tolérance
 * (à défaut, début + 12 h). Elle s'applique quel que soit le niveau de sécurité du QR.
 */
export function registrationWindow(meeting: WindowFields) {
  const tolerance = meeting.toleranceMinutes * 60000;
  const opensAt = meeting.registrationOpensAt ?? new Date(meeting.startsAt.getTime() - tolerance);
  const closeBase = meeting.registrationClosesAt ?? meeting.endsAt;
  const closesAt = closeBase
    ? new Date(closeBase.getTime() + tolerance)
    : new Date(meeting.startsAt.getTime() + OPEN_ENDED_HOURS * 3600_000);
  return { opensAt, closesAt };
}

export function windowState(meeting: WindowFields, now = new Date()): "before" | "open" | "after" {
  const { opensAt, closesAt } = registrationWindow(meeting);
  if (now < opensAt) return "before";
  if (now > closesAt) return "after";
  return "open";
}

export type SelfRegistrationState = "open" | "not_open" | "before" | "after" | "closed";

/** Émargement libre-service possible ? Combine le statut de la réunion et sa fenêtre horaire. */
export function selfRegistrationState(
  meeting: WindowFields & { status: MeetingStatus },
  now = new Date(),
): SelfRegistrationState {
  if (isFrozen(meeting.status)) return "closed";
  const state = windowState(meeting, now);
  // Jamais ouverte et fenêtre passée : l'émargement n'aura plus lieu (inutile de faire attendre le participant).
  if (!isRegistrationOpen(meeting.status)) return state === "after" ? "after" : "not_open";
  return state === "open" ? "open" : state;
}

/** « En direct » : réunion ouverte et fenêtre d'émargement en cours (hors fenêtre, elle attend sa clôture automatique). */
export function isLive(meeting: WindowFields & { status: MeetingStatus }, now = new Date()) {
  return isRegistrationOpen(meeting.status) && windowState(meeting, now) === "open";
}
