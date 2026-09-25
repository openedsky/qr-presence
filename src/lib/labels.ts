import type { CheckInMethod, MeetingType } from "@prisma/client";

export const MEETING_TYPE_LABELS: Record<MeetingType, string> = {
  COMITE: "Comité",
  ATELIER: "Atelier",
  SEMINAIRE: "Séminaire",
  ASSEMBLEE: "Assemblée",
  FORMATION: "Formation",
  AUTRE: "Autre",
};

export const METHOD_LABELS: Record<CheckInMethod, string> = {
  QR_CODE: "QR Code",
  ADMIN_MANUAL: "Saisie administrateur",
  KIOSK: "Kiosque",
};

export const CIVILITY_LABELS = {
  M: "M.",
  MME: "Mme",
  MLLE: "Mlle",
} as const;
