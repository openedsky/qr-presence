import { createHmac, randomBytes } from "crypto";
import { safeEqual } from "./tokens";

// Durée laissée au participant pour remplir et signer après un scan valide du QR dynamique.
export const CHECKIN_SESSION_SECONDS = 15 * 60;
/** Scan avant l'ouverture : la session court à partir de l'ouverture, dans la limite de 2 h d'attente. */
export const MAX_WAIT_SECONDS = 2 * 3600;

type Payload = { m: string; q: string; n: string; e: number };

function secret() {
  const value = process.env.AUTH_SECRET;
  if (!value) throw new Error("AUTH_SECRET manquant");
  return value;
}

function sign(body: string) {
  return createHmac("sha256", secret()).update(`checkin:${body}`).digest("base64url");
}

export function issueCheckinSession(meetingId: string, qrTokenId: string, startsAt?: Date) {
  const now = Math.floor(Date.now() / 1000);
  const start = startsAt ? Math.min(Math.max(now, Math.floor(startsAt.getTime() / 1000)), now + MAX_WAIT_SECONDS) : now;
  const payload: Payload = {
    m: meetingId,
    q: qrTokenId,
    n: randomBytes(12).toString("base64url"),
    e: start + CHECKIN_SESSION_SECONDS,
  };
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${body}.${sign(body)}`;
}

export function verifyCheckinSession(value: string | null | undefined, meetingId: string) {
  if (!value) return null;
  const [body, signature] = value.split(".");
  if (!body || !signature || !safeEqual(signature, sign(body))) return null;
  try {
    const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as Payload;
    if (payload.m !== meetingId || payload.e < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
}
