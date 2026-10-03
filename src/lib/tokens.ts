import { createHash, randomBytes, timingSafeEqual } from "crypto";

export function generatePublicToken() {
  return randomBytes(32).toString("base64url");
}

export function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export function tokenHint(token: string) {
  return token.slice(-6);
}

export function safeEqual(a: string, b: string) {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

/**
 * Adresse publique des QR codes et des liens de vérification : variable APP_URL (lue à l'exécution),
 * seule source de vérité, affichée en lecture seule dans les paramètres.
 */
export function appBaseUrl() {
  const base = process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  return base.replace(/\/$/, "");
}

export function publicAttendanceUrl(token: string) {
  return `${appBaseUrl()}/r/${token}`;
}

export function verifyDocumentUrl(documentId: string) {
  return `${appBaseUrl()}/verify/${documentId}`;
}
