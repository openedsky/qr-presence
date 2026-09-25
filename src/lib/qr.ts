import QRCode from "qrcode";
import { cacheGet, cacheSet } from "./redis";
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

export async function issueDynamicToken(meeting: Meeting, ttlSeconds: number) {
  const token = generatePublicToken();
  const validUntil = new Date(Date.now() + ttlSeconds * 1000);
  await prisma.meetingQrToken.create({
    data: {
      meetingId: meeting.id,
      tokenHash: hashToken(token),
      tokenHint: tokenHint(token),
      type: "DYNAMIC",
      validUntil,
    },
  });
  await cacheSet(`qr:dyn:${meeting.id}`, token, ttlSeconds);
  return { token, url: publicAttendanceUrl(token), validUntil };
}

export async function currentDynamicToken(meeting: Meeting, ttlSeconds: number) {
  const cached = await cacheGet(`qr:dyn:${meeting.id}`);
  if (cached) {
    return { token: cached, url: publicAttendanceUrl(cached) };
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
  if (record.validUntil && record.validUntil < new Date()) return { expired: true as const, record };
  return { expired: false as const, record };
}

export async function revokeMeetingTokens(meetingId: string) {
  await prisma.meetingQrToken.updateMany({
    where: { meetingId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

export async function qrPngDataUrl(url: string) {
  return QRCode.toDataURL(url, {
    errorCorrectionLevel: "H",
    margin: 1,
    width: 420,
    color: { dark: "#0b3d24", light: "#ffffff" },
  });
}
