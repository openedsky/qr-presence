import { createCipheriv, createDecipheriv, hkdfSync, randomBytes } from "crypto";
import type { NextResponse } from "next/server";
import { z } from "zod";
import { participantProfileSchema } from "./validators";

export type ParticipantProfile = z.infer<typeof participantProfileSchema>;

export const PROFILE_COOKIE = "sodefor_participant";
/** Le cookie n'est envoyé qu'à cette route : jamais aux pages ni aux autres API. */
export const PROFILE_COOKIE_PATH = "/api/public/participant-profile";
export const PROFILE_MAX_AGE_SECONDS = 180 * 24 * 3600;

const VERSION = "v1";

function key() {
  const secret = process.env.AUTH_SECRET;
  if (!secret) throw new Error("AUTH_SECRET manquant");
  return Buffer.from(hkdfSync("sha256", secret, "sodefor-presences", "participant-profile", 32));
}

/** Chiffré et authentifié (AES-256-GCM) : illisible et infalsifiable côté navigateur. */
export function sealProfile(profile: ParticipantProfile, now = Date.now()) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const payload = JSON.stringify({ p: profile, e: Math.floor(now / 1000) + PROFILE_MAX_AGE_SECONDS });
  const data = Buffer.concat([cipher.update(payload, "utf8"), cipher.final()]);
  return [VERSION, iv.toString("base64url"), data.toString("base64url"), cipher.getAuthTag().toString("base64url")].join(".");
}

export function openProfile(value: string | null | undefined, now = Date.now()): ParticipantProfile | null {
  if (!value || value.length > 4096) return null;
  const [version, iv, data, tag] = value.split(".");
  if (version !== VERSION || !iv || !data || !tag) return null;
  try {
    const decipher = createDecipheriv("aes-256-gcm", key(), Buffer.from(iv, "base64url"));
    decipher.setAuthTag(Buffer.from(tag, "base64url"));
    const plain = Buffer.concat([decipher.update(Buffer.from(data, "base64url")), decipher.final()]).toString("utf8");
    const payload = JSON.parse(plain) as { p?: unknown; e?: number };
    if (typeof payload.e !== "number" || payload.e < Math.floor(now / 1000)) return null;
    const parsed = participantProfileSchema.safeParse(payload.p);
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

function secureCookies() {
  return (process.env.APP_URL ?? "").startsWith("https://");
}

export function setProfileCookie(response: NextResponse, profile: ParticipantProfile) {
  response.cookies.set(PROFILE_COOKIE, sealProfile(profile), {
    httpOnly: true,
    secure: secureCookies(),
    sameSite: "strict",
    path: PROFILE_COOKIE_PATH,
    maxAge: PROFILE_MAX_AGE_SECONDS,
  });
}

export function clearProfileCookie(response: NextResponse) {
  response.cookies.set(PROFILE_COOKIE, "", {
    httpOnly: true,
    secure: secureCookies(),
    sameSite: "strict",
    path: PROFILE_COOKIE_PATH,
    maxAge: 0,
  });
}
