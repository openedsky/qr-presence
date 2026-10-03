import type { CheckInMethod } from "@prisma/client";

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
