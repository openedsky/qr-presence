import { z } from "zod";
import { isValidPhone } from "./phone";

export const civilitySchema = z.enum(["M", "MME", "MLLE"]);

const meetingBaseSchema = z.object({
    title: z.string().min(3, "L'objet est obligatoire").max(180),
    internalRef: z.string().max(40).optional().or(z.literal("")),
    description: z.string().max(8000).optional().or(z.literal("")),
    type: z.enum(["COMITE", "ATELIER", "SEMINAIRE", "ASSEMBLEE", "FORMATION", "AUTRE"]),
    location: z.string().max(180).optional().or(z.literal("")),
    videoConferenceUrl: z.string().url("URL invalide").optional().or(z.literal("")),
    startsAt: z.string().min(1, "La date de début est obligatoire"),
    endsAt: z.string().optional().or(z.literal("")),
    registrationOpensAt: z.string().optional().or(z.literal("")),
    registrationClosesAt: z.string().optional().or(z.literal("")),
    toleranceMinutes: z.coerce.number().int().min(0).max(240).default(15),
    qrMode: z.enum(["STATIC", "DYNAMIC"]),
    qrSecurityLevel: z.coerce.number().int().min(1).max(4).default(1),
    allowGuests: z.boolean().default(true),
    showPublicAttendance: z.boolean().default(false),
    expectedParticipants: z.coerce.number().int().min(0).max(20000).optional(),
    signatureRequired: z.boolean().default(true),
    emailRequired: z.boolean().default(true),
    internalNotes: z.string().max(4000).optional().or(z.literal("")),
  });

export const meetingFormSchema = meetingBaseSchema.superRefine(
  (data: z.infer<typeof meetingBaseSchema>, ctx: z.RefinementCtx) => {
    const starts = new Date(data.startsAt);
    if (Number.isNaN(starts.getTime())) {
      ctx.addIssue({ code: "custom", path: ["startsAt"], message: "Date de début invalide" });
    }
    if (data.endsAt) {
      const ends = new Date(data.endsAt);
      if (ends <= starts) {
        ctx.addIssue({
          code: "custom",
          path: ["endsAt"],
          message: "La fin doit être postérieure au début",
        });
      }
    }
    if (!data.location && !data.videoConferenceUrl) {
      ctx.addIssue({
        code: "custom",
        path: ["location"],
        message: "Le lieu est obligatoire sauf réunion distante",
      });
    }
  },
);

const attendanceBaseSchema = z.object({
    token: z.string().min(16),
    civility: civilitySchema,
    lastName: z.string().min(2).max(80),
    firstNames: z.string().min(2).max(120),
    jobTitle: z.string().min(2).max(120),
    organization: z.string().min(2).max(160),
    email: z.string().email("Email invalide").optional().or(z.literal("")),
    phone: z.string().max(30).optional().or(z.literal("")),
    signatureDataUrl: z.string().optional().or(z.literal("")),
  });

export const attendanceFormSchema = attendanceBaseSchema.superRefine(
  (data: z.infer<typeof attendanceBaseSchema>, ctx: z.RefinementCtx) => {
    if (data.phone && !isValidPhone(data.phone)) {
      ctx.addIssue({
        code: "custom",
        path: ["phone"],
        message: "Numéro ivoirien ou international invalide",
      });
    }
  },
);

export const loginSchema = z.object({
  email: z.string().email("Email invalide"),
  password: z.string().min(8, "Mot de passe trop court"),
});

export const userFormSchema = z.object({
  email: z.string().email(),
  firstName: z.string().min(2).max(80),
  lastName: z.string().min(2).max(80),
  jobTitle: z.string().max(120).optional().or(z.literal("")),
  organization: z.string().max(160).optional().or(z.literal("")),
  phone: z.string().max(30).optional().or(z.literal("")),
  role: z.enum(["SUPER_ADMIN", "MEETING_ADMIN", "ORGANIZER", "SECRETARY", "AUDITOR", "USER"]),
  password: z.string().min(8).optional().or(z.literal("")),
  active: z.boolean().default(true),
});

export const attendancePatchSchema = z.object({
  lastName: z.string().min(2).max(80).optional(),
  firstNames: z.string().min(2).max(120).optional(),
  jobTitle: z.string().min(2).max(120).optional(),
  organization: z.string().min(2).max(160).optional(),
  email: z.string().email().optional().or(z.literal("")),
  phone: z.string().max(30).optional().or(z.literal("")),
});

export const cancelAttendanceSchema = z.object({
  reason: z.string().min(3).max(400),
});

export const settingsSchema = z.object({
  organizationName: z.string().min(2).max(120),
  ministryName: z.string().min(2).max(180),
  appName: z.string().min(2).max(120),
  appTagline: z.string().max(180),
  publicBaseUrl: z.string().url(),
  retentionMonths: z.coerce.number().int().min(12).max(240),
  emailRequiredDefault: z.boolean(),
  signatureRequiredDefault: z.boolean(),
  dynamicQrSeconds: z.coerce.number().int().min(15).max(180),
  rateLimitPerMinute: z.coerce.number().int().min(5).max(200),
  privacyNotice: z.string().min(10).max(4000),
});
