import { createHash } from "crypto";
import type { CheckInMethod, Civility } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { writeAudit } from "@/lib/audit";
import { genderFromCivility, nameKey, normalizeEmail, toTitleFirstNames, toUpperLastName } from "@/lib/identity";
import { normalizePhone } from "@/lib/phone";
import { confirmationCode } from "@/lib/utils";
import { meetingObjectKey, putObject } from "@/lib/storage";
import { findDuplicate } from "./duplicates";
import { isRegistrationOpen } from "@/lib/meeting-status";
import { publish, meetingChannel } from "@/lib/realtime";

const MAX_SIGNATURE_BYTES = 512 * 1024;

function isUniqueViolation(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: string }).code === "P2002"
  );
}

function decodeDataUrl(dataUrl: string) {
  const match = dataUrl.match(/^data:(image\/png|image\/jpeg);base64,(.+)$/);
  if (!match) return null;
  return {
    mime: match[1],
    buffer: Buffer.from(match[2], "base64"),
  };
}

export class DuplicateAttendanceError extends Error {
  checkInAt: Date;
  constructor(checkInAt: Date) {
    super(`Vous êtes déjà enregistré(e) pour cette réunion à ${checkInAt.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}.`);
    this.name = "DuplicateAttendanceError";
    this.checkInAt = checkInAt;
  }
}

export class ClosedMeetingError extends Error {
  constructor() {
    super("Les inscriptions sont fermées pour cette réunion.");
    this.name = "ClosedMeetingError";
  }
}

export async function registerAttendance(input: {
  meetingId: string;
  meetingUuid: string;
  meetingStatus: "BROUILLON" | "PLANIFIEE" | "OUVERTE" | "EN_COURS" | "CLOTUREE" | "ARCHIVEE";
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
}) {
  if (!isRegistrationOpen(input.meetingStatus) && input.method === "QR_CODE") {
    throw new ClosedMeetingError();
  }

  const lastName = toUpperLastName(input.lastName);
  const firstNames = toTitleFirstNames(input.firstNames);
  const emailNormalized = normalizeEmail(input.email);
  const phoneNormalized = normalizePhone(input.phone);
  const key = nameKey(lastName, firstNames);

  if (input.emailRequired && !emailNormalized) {
    throw new Error("L'email est obligatoire pour cette réunion.");
  }

  const duplicate = await findDuplicate({
    meetingId: input.meetingId,
    userId: input.userId,
    emailNormalized,
    phoneNormalized,
    nameKey: key,
  });
  if (duplicate) {
    throw new DuplicateAttendanceError(duplicate.checkInAt);
  }

  let signatureObjectKey: string | undefined;
  let signatureHash: string | undefined;
  let signatureMime: string | undefined;
  let signatureSize: number | undefined;

  if (input.signatureDataUrl) {
    const decoded = decodeDataUrl(input.signatureDataUrl);
    if (!decoded || decoded.buffer.length > MAX_SIGNATURE_BYTES) {
      throw new Error("Signature invalide ou trop volumineuse.");
    }
    signatureHash = createHash("sha256").update(decoded.buffer).digest("hex");
    signatureMime = decoded.mime;
    signatureSize = decoded.buffer.length;
    signatureObjectKey = meetingObjectKey(
      input.meetingUuid,
      "signatures",
      `${confirmationCode()}.png`,
    );
    await putObject(signatureObjectKey, decoded.buffer, decoded.mime);
  } else if (input.signatureRequired && input.method === "QR_CODE") {
    throw new Error("La signature est obligatoire.");
  }

  let attendance;
  try {
    attendance = await prisma.attendance.create({
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
        signatureObjectKey,
        signatureHash,
        signatureMime,
        signatureSize,
        checkInMethod: input.method,
        confirmationCode: confirmationCode(),
        createdById: input.createdById ?? undefined,
        ipHash: input.ip ? createHash("sha256").update(input.ip).digest("hex") : undefined,
        userAgent: input.userAgent,
      },
    });
  } catch (error) {
    if (isUniqueViolation(error)) {
      const existing = await findDuplicate({
        meetingId: input.meetingId,
        userId: input.userId,
        emailNormalized,
        phoneNormalized,
        nameKey: key,
      });
      throw new DuplicateAttendanceError(existing?.checkInAt ?? new Date());
    }
    throw error;
  }

  await writeAudit({
    actorId: input.createdById,
    action: "attendance.create",
    entity: "Attendance",
    entityId: attendance.id,
    afterData: {
      meetingId: input.meetingId,
      lastName,
      firstNames,
      method: input.method,
    },
  });

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
