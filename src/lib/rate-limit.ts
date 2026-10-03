import { cacheIncr } from "./redis";
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
 * - par adresse IP : large quand l'appareil est identifié (Wi-Fi partagé de la salle), strict sinon ;
 * Le plafond par réunion est contrôlé à part (checkMeetingCap), une fois la demande authentifiée : sinon
 * quiconque a vu le QR pourrait l'épuiser avec des envois invalides et bloquer les vrais participants.
 */
export async function checkPublicSubmissionLimits(input: {
  meetingId: string;
  ip: string;
  device: string | null;
  expectedParticipants: number | null;
  perMinute: number;
  /** Niveau 2 : un appareil ne sert qu'à une personne (quelques essais pour corriger une saisie). */
  strictDevice?: boolean;
}) {
  const expected = input.expectedParticipants ?? 0;
  const roomCap = Math.max(input.perMinute, 60, expected);
  const checks = [
    input.device
      ? input.strictDevice
        ? rateLimit(`dev-strict:${input.meetingId}:${input.device}`, 3, 12 * 3600)
        : rateLimit(`dev:${input.meetingId}:${input.device}`, 10, 600)
      : Promise.resolve({ allowed: true }),
    rateLimit(`ip:${input.meetingId}:${input.ip}:${input.device ? "d" : "n"}`, input.device ? roomCap : input.perMinute, 60),
  ];
  const results = await Promise.all(checks);
  return results.every((result) => result.allowed);
}

/** Plafond global par réunion, décompté seulement pour une demande valide (session ou formulaire vérifiés). */
export async function checkMeetingCap(meetingId: string, expectedParticipants: number | null) {
  const expected = expectedParticipants ?? 0;
  return (await rateLimit(`meeting:${meetingId}`, Math.max(120, expected * 2), 60)).allowed;
}
