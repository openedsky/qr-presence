import { NextResponse } from "next/server";
import { attendanceFormSchema } from "@/lib/validators";
import { resolveToken } from "@/lib/qr";
import {
  checkMeetingCap,
  checkPublicSubmissionLimits,
  clientIp,
  deviceConfirmation,
  deviceId,
  markDeviceDone,
} from "@/lib/rate-limit";
import { verifyCheckinSession, CHECKIN_SESSION_SECONDS } from "@/lib/checkin-session";
import { cacheDel, cacheSetNx } from "@/lib/redis";
import { PayloadTooLargeError, readJsonLimited } from "@/lib/http";
import { logger } from "@/lib/logger";
import { getSettings } from "@/server/services/settings";
import {
  AttendanceValidationError,
  ClosedMeetingError,
  DuplicateAttendanceError,
  GuestsNotAllowedError,
  registerAttendance,
} from "@/server/services/attendances";
import { displayName } from "@/lib/utils";
import { selfRegistrationState } from "@/lib/meeting-status";

/** Signature (≤ 700 000 caractères) + champs du formulaire. */
const MAX_BODY_BYTES = 760 * 1024;

const STATE_ERRORS = {
  not_open: ["L'émargement n'est pas encore ouvert pour cette réunion.", 403],
  before: ["L'émargement n'est pas encore ouvert pour cette réunion.", 403],
  after: ["L'émargement est terminé pour cette réunion.", 403],
  closed: ["Les inscriptions sont fermées.", 409],
} as const;

function fail(error: string, status: number) {
  return NextResponse.json({ error }, { status });
}

/** 409 accompagné du code déjà délivré à cet appareil : le formulaire renvoie vers la page de confirmation. */
function alreadyDone(confirmationCode: string, error: string) {
  return NextResponse.json({ error, confirmationCode, alreadyRegistered: true }, { status: 409 });
}

export async function POST(request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!token || token.length > 128) return fail("QR invalide.", 404);

  const resolved = await resolveToken(token);
  if (!resolved) return fail("QR invalide.", 404);
  if (resolved.modeMismatch) {
    return fail("Ce QR n'est pas valable pour cette réunion : scannez le QR affiché dans la salle.", 403);
  }
  const meeting = resolved.record.meeting;

  const state = selfRegistrationState(meeting);
  if (state !== "open") {
    const [message, status] = STATE_ERRORS[state];
    return fail(message, status);
  }

  // Limites vérifiées avant de lire le corps : une rafale de requêtes volumineuses ne coûte rien au serveur.
  const settings = await getSettings();
  const ip = clientIp(request);
  const device = deviceId(request);
  if (meeting.qrSecurityLevel === 2 && !device) {
    return fail("Appareil non reconnu : rechargez la page du QR code puis réessayez.", 400);
  }
  const allowed = await checkPublicSubmissionLimits({
    meetingId: meeting.id,
    ip,
    device,
    expectedParticipants: meeting.expectedParticipants,
    perMinute: settings.rateLimitPerMinute,
  });
  if (!allowed) return fail("Trop de tentatives. Réessayez dans une minute.", 429);
  // Cet appareil a déjà émargé (réponse perdue sur un réseau lent, ou niveau 2) : on lui rend son code.
  const previousCode = await deviceConfirmation(meeting.id, device);
  if (previousCode && meeting.qrSecurityLevel === 2) {
    return alreadyDone(previousCode, "Cet appareil a déjà servi à émarger pour cette réunion (une personne par appareil).");
  }

  let body: unknown;
  try {
    body = await readJsonLimited(request, MAX_BODY_BYTES);
  } catch (error) {
    if (error instanceof PayloadTooLargeError) return fail(error.message, 413);
    throw error;
  }
  if (!body || typeof body !== "object") return fail("Données invalides", 400);

  // QR dynamique : le jeton ne vit que quelques secondes. Il est vérifié au scan, qui délivre une
  // session d'émargement signée ; c'est elle qui autorise l'envoi du formulaire, une seule fois.
  let nonceKey: string | null = null;
  let nonceTtl = CHECKIN_SESSION_SECONDS;
  if (resolved.record.type === "DYNAMIC") {
    const session = verifyCheckinSession((body as { session?: string }).session, meeting.id);
    // La session n'est valable qu'avec le QR qui l'a délivrée (pas de réemploi avec un autre jeton).
    if (!session || session.q !== resolved.record.id) {
      return fail(
        resolved.expired
          ? "Votre session d'émargement a expiré. Scannez à nouveau le QR affiché dans la salle."
          : "Session d'émargement manquante. Scannez à nouveau le QR affiché dans la salle.",
        410,
      );
    }
    nonceKey = `checkin:used:${session.n}`;
    // Le nonce reste marqué tant que la session est valable (jusqu'à 2 h 15 pour un scan avant l'ouverture).
    nonceTtl = Math.max(60, session.e - Math.floor(Date.now() / 1000));
  } else if (resolved.expired) {
    return fail("QR expiré.", 410);
  }

  const parsed = attendanceFormSchema.safeParse({ ...body, token });
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const field = typeof issue?.path[0] === "string" ? issue.path[0] : undefined;
    return NextResponse.json({ error: issue?.message ?? "Données invalides", field }, { status: 400 });
  }

  if (!(await checkMeetingCap(meeting.id, meeting.expectedParticipants))) {
    return fail("Trop de tentatives. Réessayez dans une minute.", 429);
  }

  if (nonceKey && !(await cacheSetNx(nonceKey, "1", nonceTtl))) {
    return fail("Cette session d'émargement a déjà servi. Scannez à nouveau le QR pour une autre personne.", 409);
  }

  try {
    const attendance = await registerAttendance({
      meetingId: meeting.id,
      meetingUuid: meeting.uuid,
      meetingStatus: meeting.status,
      signatureRequired: meeting.signatureRequired,
      emailRequired: meeting.emailRequired,
      allowGuests: meeting.allowGuests,
      civility: parsed.data.civility,
      lastName: parsed.data.lastName,
      firstNames: parsed.data.firstNames,
      jobTitle: parsed.data.jobTitle,
      organization: parsed.data.organization,
      email: parsed.data.email,
      phone: parsed.data.phone,
      signatureDataUrl: parsed.data.signatureDataUrl,
      publicListConsent: meeting.showPublicAttendance && parsed.data.publicListConsent === true,
      method: "QR_CODE",
      ip,
      userAgent: request.headers.get("user-agent"),
    });
    await markDeviceDone(meeting.id, device, attendance.confirmationCode).catch(() => undefined);
    return NextResponse.json({
      confirmationCode: attendance.confirmationCode,
      displayName: displayName(attendance.lastName, attendance.firstNames),
      organization: `${attendance.jobTitle} – ${attendance.organization}`,
      checkInAt: attendance.checkInAt,
    });
  } catch (error) {
    // La session n'est consommée que par un émargement réussi : une erreur de saisie permet de corriger et renvoyer.
    if (nonceKey) await cacheDel(nonceKey);
    if (error instanceof DuplicateAttendanceError && previousCode) {
      return alreadyDone(previousCode, "Votre présence est déjà enregistrée depuis cet appareil.");
    }
    if (error instanceof DuplicateAttendanceError || error instanceof ClosedMeetingError) {
      return fail(error.message, 409);
    }
    if (error instanceof GuestsNotAllowedError) return fail(error.message, 403);
    if (error instanceof AttendanceValidationError) return fail(error.message, 400);
    logger.error("public.attendance_failed", error);
    return fail("L'émargement n'a pas pu être enregistré. Réessayez dans un instant.", 500);
  }
}
