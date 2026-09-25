const IVORY_COAST_PREFIX = "225";

export function normalizePhone(raw?: string | null): string | null {
  if (!raw) return null;
  let digits = raw.replace(/[^\d+]/g, "");
  if (digits.startsWith("00")) digits = `+${digits.slice(2)}`;
  if (digits.startsWith("+")) digits = digits.slice(1);
  digits = digits.replace(/\D/g, "");
  if (!digits) return null;

  if (digits.startsWith("0") && digits.length === 10) {
    digits = `${IVORY_COAST_PREFIX}${digits.slice(1)}`;
  } else if (digits.length === 10 && /^[01567]/.test(digits)) {
    digits = `${IVORY_COAST_PREFIX}${digits}`;
  } else if (digits.length === 8) {
    digits = `${IVORY_COAST_PREFIX}${digits}`;
  }

  return digits;
}

export function isValidPhone(raw?: string | null): boolean {
  const normalized = normalizePhone(raw);
  if (!normalized) return false;
  return normalized.length >= 8 && normalized.length <= 15;
}

export function formatPhoneDisplay(raw?: string | null): string {
  const normalized = normalizePhone(raw);
  if (!normalized) return raw ?? "—";
  if (normalized.startsWith(IVORY_COAST_PREFIX) && normalized.length === 13) {
    const rest = normalized.slice(3);
    return `+225 ${rest.slice(0, 2)} ${rest.slice(2, 4)} ${rest.slice(4, 6)} ${rest.slice(6, 8)} ${rest.slice(8, 10)}`;
  }
  return `+${normalized}`;
}
