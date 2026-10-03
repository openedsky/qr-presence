import QRCode from "qrcode";
import { cacheDel, cacheGet, cacheSet } from "./redis";
import { generatePublicToken, hashToken, publicAttendanceUrl, tokenHint } from "./tokens";
import { prisma } from "./prisma";
import type { Meeting } from "@prisma/client";

export async function ensureStaticToken(meeting: Meeting) {
  const existing = await prisma.meetingQrToken.findFirst({
    where: { meetingId: meeting.id, type: "STATIC", revokedAt: null },
    orderBy: { createdAt: "desc" },
  });
  if (existing?.publicToken) {
    return {
      token: existing.publicToken,
      url: publicAttendanceUrl(existing.publicToken),
    };
  }

  const token = generatePublicToken();
  await prisma.meetingQrToken.create({
    data: {
      meetingId: meeting.id,
      tokenHash: hashToken(token),
      publicToken: token,
      tokenHint: tokenHint(token),
      type: "STATIC",
    },
  });
  return { token, url: publicAttendanceUrl(token) };
}

/**
 * Marge après le renouvellement à l'écran : un QR scanné juste avant le changement reste accepté
 * le temps que le téléphone ouvre la page.
 */
export const DYNAMIC_GRACE_SECONDS = 20;

type DynamicEntry = { token: string; displayUntil: number };

export async function issueDynamicToken(meeting: Meeting, ttlSeconds: number) {
  const token = generatePublicToken();
  const displayUntil = Date.now() + ttlSeconds * 1000;
  const validUntil = new Date(displayUntil + DYNAMIC_GRACE_SECONDS * 1000);
  await prisma.meetingQrToken.create({
    data: {
      meetingId: meeting.id,
      tokenHash: hashToken(token),
      tokenHint: tokenHint(token),
      type: "DYNAMIC",
      validUntil,
    },
  });
  const entry: DynamicEntry = { token, displayUntil };
  await cacheSet(`qr:dyn:${meeting.id}`, JSON.stringify(entry), ttlSeconds);
  return { token, url: publicAttendanceUrl(token), validUntil, secondsLeft: ttlSeconds };
}

/** Jeton affiché à l'écran et secondes restantes avant renouvellement (un écran rechargé ne repart pas à zéro). */
export async function currentDynamicToken(meeting: Meeting, ttlSeconds: number) {
  const cached = await cacheGet(`qr:dyn:${meeting.id}`);
  if (cached) {
    try {
      const entry = JSON.parse(cached) as DynamicEntry;
      const secondsLeft = Math.floor((entry.displayUntil - Date.now()) / 1000);
      if (entry.token && secondsLeft >= 2) {
        return { token: entry.token, url: publicAttendanceUrl(entry.token), secondsLeft };
      }
    } catch {
      // ancienne valeur (jeton brut) : on en émet un nouveau
    }
  }
  return issueDynamicToken(meeting, ttlSeconds);
}

export async function resolveToken(token: string) {
  const hashed = hashToken(token);
  const record = await prisma.meetingQrToken.findFirst({
    where: {
      OR: [{ tokenHash: hashed }, { publicToken: token }],
      revokedAt: null,
    },
    include: { meeting: true },
  });
  if (!record) return null;
  // Un jeton d'un autre mode (affiche statique d'une réunion passée en dynamique, ou l'inverse) ne vaut pas émargement.
  const modeMismatch = record.type !== record.meeting.qrMode;
  if (record.validUntil && record.validUntil < new Date()) return { expired: true as const, modeMismatch, record };
  return { expired: false as const, modeMismatch, record };
}

export async function revokeDynamicTokens(meetingId: string) {
  await prisma.meetingQrToken.updateMany({
    where: { meetingId, type: "DYNAMIC", revokedAt: null },
    data: { revokedAt: new Date() },
  });
  await cacheDel(`qr:dyn:${meetingId}`);
}

export async function qrPngDataUrl(url: string) {
  return QRCode.toDataURL(url, {
    errorCorrectionLevel: "H",
    margin: 1,
    width: 420,
    color: { dark: "#0b3d24", light: "#ffffff" },
  });
}
