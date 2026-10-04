import { cacheGet, cacheIncr, cacheSet } from "./redis";
import { ipFromHeaders } from "./client-ip";

export async function rateLimit(key: string, limit: number, windowSeconds = 60) {
  const count = await cacheIncr(`rl:${key}`, windowSeconds);
  return {
    allowed: count <= limit,
    remaining: Math.max(0, limit - count),
    count,
  };
}

export function clientIp(request: Request) {
  return ipFromHeaders(request.headers);
}

const DEVICE_ID = /^[A-Za-z0-9_-]{16,64}$/;

export function deviceId(request: Request) {
  const value = request.headers.get("x-device-id");
  return value && DEVICE_ID.test(value) ? value : null;
}

/**
 * Limites d'émargement public, dimensionnées sur l'effectif attendu :
 * - par appareil : quelques essais (erreur de saisie, téléphone prêté) ;
 * - par adresse IP : large quand l'appareil est identifié (Wi-Fi partagé de la salle), strict sinon.
 * L'identifiant d'appareil est choisi par le navigateur : ces limites préviennent les erreurs et les abus
 * grossiers, pas une fraude déterminée (seul le QR dynamique, niveau 3, l'empêche).
 * Le plafond par réunion est contrôlé à part (checkMeetingCap), une fois la demande authentifiée : sinon
 * quiconque a vu le QR pourrait l'épuiser avec des envois invalides et bloquer les vrais participants.
 */
export async function checkPublicSubmissionLimits(input: {
  meetingId: string;
  ip: string;
  device: string | null;
  expectedParticipants: number | null;
  perMinute: number;
}) {
  const expected = input.expectedParticipants ?? 0;
  const roomCap = Math.max(input.perMinute, 60, expected);
  const checks = [
    input.device ? rateLimit(`dev:${input.meetingId}:${input.device}`, 10, 600) : Promise.resolve({ allowed: true }),
    rateLimit(`ip:${input.meetingId}:${input.ip}:${input.device ? "d" : "n"}`, input.device ? roomCap : input.perMinute, 60),
  ];
  const results = await Promise.all(checks);
  return results.every((result) => result.allowed);
}

const DEVICE_DONE_SECONDS = 12 * 3600;
const deviceDoneKey = (meetingId: string, device: string) => `dev-done:${meetingId}:${device}`;

/** Code de confirmation déjà obtenu par cet appareil pour la réunion (niveau 2 : un appareil = une personne). */
export async function deviceConfirmation(meetingId: string, device: string | null) {
  return device ? cacheGet(deviceDoneKey(meetingId, device)) : null;
}

/** Posée seulement après un émargement réussi : les erreurs de saisie ne bloquent pas l'appareil. */
export async function markDeviceDone(meetingId: string, device: string | null, confirmationCode: string) {
  if (device) await cacheSet(deviceDoneKey(meetingId, device), confirmationCode, DEVICE_DONE_SECONDS);
}

/** Plafond global par réunion, décompté seulement pour une demande valide (session ou formulaire vérifiés). */
export async function checkMeetingCap(meetingId: string, expectedParticipants: number | null) {
  const expected = expectedParticipants ?? 0;
  return (await rateLimit(`meeting:${meetingId}`, Math.max(120, expected * 2), 60)).allowed;
}
