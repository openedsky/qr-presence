import { createHash, randomBytes } from "crypto";
import type { Attendance, CheckInMethod, Civility, MeetingStatus, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { writeAudit } from "@/lib/audit";
import { genderFromCivility, nameKey, normalizeEmail, toTitleFirstNames, toUpperLastName } from "@/lib/identity";
import { normalizePhone } from "@/lib/phone";
import { formatDateTime } from "@/lib/utils";
import { deleteObject, meetingObjectKey, putObject } from "@/lib/storage";
import { hashIp } from "@/lib/client-ip";
import { imageWithinLimits, SIGNATURE_LIMITS } from "@/lib/image-size";
import { findDuplicate } from "./duplicates";
import { isInternalParticipant } from "./structures";
import { isRegistrationOpen } from "@/lib/meeting-status";
import { publish, meetingChannel } from "@/lib/realtime";
import { logger } from "@/lib/logger";
import { cacheDelIfEquals, cacheSetNx } from "@/lib/redis";
import { expectClosed, lockMeetingContent, MeetingStateChangedError } from "./meeting-content";

export const MAX_SIGNATURE_BYTES = 512 * 1024;

/** Ordre de référence (listes, exports, PDF) : l'heure d'arrivée, puis l'identifiant pour départager les égalités. */
export const ATTENDANCE_ORDER = [{ checkInAt: "asc" }, { id: "asc" }] satisfies Prisma.AttendanceOrderByWithRelationInput[];

/** 48 bits : la page de confirmation publique ne doit pas pouvoir être parcourue par énumération. */
function confirmationCode() {
  return `SDF-${randomBytes(6).toString("hex").toUpperCase()}`;
}

function isUniqueViolation(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: string }).code === "P2002"
  );
}

const SIGNATURE_FORMATS = {
  "image/png": { extension: "png", magic: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] },
  "image/jpeg": { extension: "jpg", magic: [0xff, 0xd8, 0xff] },
} as const;

/** Décode la signature et vérifie que le contenu correspond bien au format annoncé (signature binaire). */
export function decodeSignature(dataUrl: string) {
  const match = dataUrl.match(/^data:(image\/png|image\/jpeg);base64,([A-Za-z0-9+/=]+)$/);
  if (!match) return null;
  const mime = match[1] as keyof typeof SIGNATURE_FORMATS;
  const buffer = Buffer.from(match[2], "base64");
  const format = SIGNATURE_FORMATS[mime];
  if (buffer.length < format.magic.length || !format.magic.every((byte, index) => buffer[index] === byte)) return null;
  if (!imageWithinLimits(buffer, SIGNATURE_LIMITS)) return null;
  return { mime, buffer, extension: format.extension };
}

/** Le message public reste neutre : il ne révèle ni l'identité ni l'heure d'émargement d'un tiers. */
export class DuplicateAttendanceError extends Error {
  existing: Pick<Attendance, "lastName" | "firstNames" | "checkInAt"> | null;
  constructor(existing: Pick<Attendance, "lastName" | "firstNames" | "checkInAt"> | null) {
    super(
      "Une présence est déjà enregistrée avec ces coordonnées pour cette réunion. En cas d'erreur, adressez-vous à l'organisateur.",
    );
    this.name = "DuplicateAttendanceError";
    this.existing = existing;
  }

  get adminMessage() {
    if (!this.existing) return this.message;
    return `Déjà enregistré : ${this.existing.lastName} ${this.existing.firstNames}, le ${formatDateTime(this.existing.checkInAt)}.`;
  }
}

export class ClosedMeetingError extends Error {
  constructor(message = "Les inscriptions sont fermées pour cette réunion.") {
    super(message);
    this.name = "ClosedMeetingError";
  }
}

export class GuestsNotAllowedError extends Error {
  constructor() {
    super(
      "Cette réunion est réservée aux agents SODEFOR : choisissez votre structure dans la liste proposée et, si vous indiquez un email, utilisez votre adresse professionnelle.",
    );
    this.name = "GuestsNotAllowedError";
  }
}

/** Erreur de saisie à afficher telle quelle à l'utilisateur. */
export class AttendanceValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AttendanceValidationError";
  }
}

export async function registerAttendance(input: {
  meetingId: string;
  meetingUuid: string;
  meetingStatus: MeetingStatus;
  signatureRequired: boolean;
  emailRequired: boolean;
  allowGuests: boolean;
  civility: Civility;
  lastName: string;
  firstNames: string;
  jobTitle: string;
  organization: string;
  email?: string | null;
  phone?: string | null;
  signatureDataUrl?: string | null;
  userId?: string | null;
  createdById?: string | null;
  method: CheckInMethod;
  ip?: string | null;
  userAgent?: string | null;
  correctionReason?: string | null;
  /** Saisie administrateur : heure d'arrivée réelle (sinon l'heure de saisie). */
  checkInAt?: Date | null;
  /** Saisie administrateur : motif obligatoire pour déroger aux règles de la réunion. */
  manualReason?: string | null;
  publicListConsent?: boolean;
}) {
  const selfService = input.method === "QR_CODE";
  if (selfService && !isRegistrationOpen(input.meetingStatus)) {
    throw new ClosedMeetingError();
  }
  if (!selfService && (input.meetingStatus === "BROUILLON" || input.meetingStatus === "PLANIFIEE")) {
    throw new ClosedMeetingError("Ouvrez d'abord la réunion : une présence ne peut pas être saisie avant son ouverture.");
  }

  const lastName = toUpperLastName(input.lastName);
  const firstNames = toTitleFirstNames(input.firstNames);
  const emailNormalized = normalizeEmail(input.email);
  const phoneNormalized = normalizePhone(input.phone);
  const key = nameKey(lastName, firstNames);
  const manualReason = input.manualReason?.trim() || null;

  const missingEmail = input.emailRequired && !emailNormalized;
  const external = !input.allowGuests && !(await isInternalParticipant(input.organization, input.email));
  if (selfService) {
    if (missingEmail) throw new AttendanceValidationError("L'email est obligatoire pour cette réunion.");
    if (external) throw new GuestsNotAllowedError();
  } else if ((missingEmail || external) && !manualReason) {
    throw new AttendanceValidationError(
      external
        ? "Cette réunion est réservée aux agents SODEFOR : indiquez le motif de cette saisie dérogatoire."
        : "L'email est obligatoire pour cette réunion : indiquez le motif de cette saisie sans email.",
    );
  }

  let checkInAt: Date | undefined;
  if (!selfService && input.checkInAt) {
    if (input.checkInAt.getTime() > Date.now() + 60_000) {
      throw new AttendanceValidationError("L'heure d'arrivée ne peut pas être dans le futur.");
    }
    checkInAt = input.checkInAt;
  }

  // Sans identifiant, seul le nom distingue deux saisies : deux envois simultanés passeraient tous deux
  // la recherche de doublon (aucune contrainte d'unicité sur le nom). Verrou court le temps de l'enregistrement.
  const nameLock = !input.userId && !emailNormalized && !phoneNormalized ? `attlock:${input.meetingId}:${key}` : null;
  const lockValue = randomBytes(8).toString("hex");
  if (nameLock && !(await cacheSetNx(nameLock, lockValue, 30))) {
    throw new DuplicateAttendanceError(null);
  }
  try {
    return await insertAttendance();
  } catch (error) {
    if (nameLock) await cacheDelIfEquals(nameLock, lockValue).catch(() => undefined);
    throw error;
  }

  async function insertAttendance() {
    const duplicate = await findDuplicate({
      meetingId: input.meetingId,
      userId: input.userId,
      emailNormalized,
      phoneNormalized,
      nameKey: key,
    });
    if (duplicate.blocking) {
      throw new DuplicateAttendanceError(duplicate.blocking);
    }

    let signatureObjectKey: string | undefined;
    let signatureHash: string | undefined;
    let signatureMime: string | undefined;
    let signatureSize: number | undefined;

    if (input.signatureDataUrl) {
      const decoded = decodeSignature(input.signatureDataUrl);
      if (!decoded || decoded.buffer.length > MAX_SIGNATURE_BYTES) {
        throw new AttendanceValidationError("Signature invalide ou trop volumineuse.");
      }
      signatureHash = createHash("sha256").update(decoded.buffer).digest("hex");
      signatureMime = decoded.mime;
      signatureSize = decoded.buffer.length;
      signatureObjectKey = meetingObjectKey(input.meetingUuid, "signatures", `${confirmationCode()}.${decoded.extension}`);
      await putObject(signatureObjectKey, decoded.buffer, decoded.mime);
    } else if (input.signatureRequired && selfService) {
      throw new AttendanceValidationError("La signature est obligatoire.");
    }

    let attendance;
    try {
      attendance = await prisma.$transaction(async (tx) => {
        await lockMeetingContent(tx, input.meetingId, (meeting) => {
          if (selfService) return isRegistrationOpen(meeting.status) ? null : new ClosedMeetingError().message;
          if (meeting.status === "BROUILLON" || meeting.status === "PLANIFIEE") return "La réunion n'est plus ouverte : actualisez la page.";
          return expectClosed(Boolean(input.correctionReason))(meeting);
        });
        return tx.attendance.create({
          data: {
            meetingId: input.meetingId,
            userId: input.userId ?? undefined,
            civility: input.civility,
            lastName,
            firstNames,
            gender: genderFromCivility(input.civility),
            jobTitle: input.jobTitle.trim(),
            organization: input.organization.trim(),
            email: input.email?.trim() || null,
            phone: input.phone?.trim() || null,
            emailNormalized,
            phoneNormalized,
            nameKey: key,
            activeEmailKey: emailNormalized,
            activePhoneKey: phoneNormalized,
            activeNameKey: key,
            activeUserKey: input.userId ?? null,
            suspectedDuplicate: Boolean(duplicate.homonym),
            signatureObjectKey,
            signatureHash,
            signatureMime,
            signatureSize,
            checkInMethod: input.method,
            ...(checkInAt ? { checkInAt } : {}),
            manualReason,
            publicListConsent: Boolean(input.publicListConsent),
            confirmationCode: confirmationCode(),
            createdById: input.createdById ?? undefined,
            ipHash: input.ip ? hashIp(input.ip) : undefined,
            userAgent: input.userAgent?.slice(0, 400),
          },
        });
      });
    } catch (error) {
      if (signatureObjectKey) {
        const orphan = signatureObjectKey;
        await deleteObject(orphan).catch((cleanupError) =>
          logger.warn("attendance.signature_cleanup_failed", { key: orphan, error: String(cleanupError) }),
        );
      }
      if (isUniqueViolation(error)) {
        const existing = await findDuplicate({
          meetingId: input.meetingId,
          userId: input.userId,
          emailNormalized,
          phoneNormalized,
          nameKey: key,
        });
        throw new DuplicateAttendanceError(existing.blocking);
      }
      if (error instanceof MeetingStateChangedError) throw new ClosedMeetingError(error.message);
      throw error;
    }

    // La présence est enregistrée : un échec du journal ne doit pas la faire paraître refusée
    // (le participant réessaierait et se verrait répondre « déjà enregistré »).
    try {
      await writeAudit({
        actorId: input.createdById,
        action: input.correctionReason ? "attendance.post_close_create" : "attendance.create",
        entity: "Attendance",
        entityId: attendance.id,
        afterData: {
          meetingId: input.meetingId,
          lastName,
          firstNames,
          method: input.method,
          suspectedDuplicate: Boolean(duplicate.homonym),
          ...(checkInAt ? { checkInAt: checkInAt.toISOString() } : {}),
          ...(manualReason ? { manualReason } : {}),
          ...(input.correctionReason ? { reason: input.correctionReason } : {}),
        },
      });
    } catch (error) {
      logger.error("attendance.audit_failed", { attendanceId: attendance.id, error: String(error) });
    }

    publish(meetingChannel(input.meetingId), {
      type: "attendance.created",
      attendance: {
        id: attendance.id,
        lastName: attendance.lastName,
        firstNames: attendance.firstNames,
        organization: attendance.organization,
        jobTitle: attendance.jobTitle,
        checkInAt: attendance.checkInAt,
        checkInMethod: attendance.checkInMethod,
      },
    });

    return attendance;
  }
}
