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

export function deriveLiveStatus(status: MeetingStatus, startsAt: Date): MeetingStatus {
  if (status === MeetingStatus.OUVERTE && Date.now() >= startsAt.getTime()) {
    return MeetingStatus.EN_COURS;
  }
  return status;
}
