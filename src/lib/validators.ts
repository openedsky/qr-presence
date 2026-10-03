import { z } from "zod";
import { isValidPhone } from "./phone";
import { fromDateTimeLocal } from "./utils";

export const civilitySchema = z.enum(["M", "MME", "MLLE"]);

const meetingBaseSchema = z.object({
    title: z.string().min(3, "L'objet est obligatoire").max(180),
    internalRef: z.string().max(40).optional().or(z.literal("")),
    description: z.string().max(8000).optional().or(z.literal("")),
    type: z.string().min(1, "Le type est obligatoire").max(40),
    location: z.string().max(180).optional().or(z.literal("")),
    videoConferenceUrl: z.string().url("URL invalide").optional().or(z.literal("")),
    startsAt: z.string().min(1, "La date de début est obligatoire"),
    endsAt: z.string().optional().or(z.literal("")),
    registrationOpensAt: z.string().optional().or(z.literal("")),
    registrationClosesAt: z.string().optional().or(z.literal("")),
    toleranceMinutes: z.coerce.number().int().min(0).max(240).default(15),
    qrMode: z.enum(["STATIC", "DYNAMIC"]),
    qrSecurityLevel: z.coerce.number().int().min(1).max(3).default(1),
    allowGuests: z.boolean().default(true),
    showPublicAttendance: z.boolean().default(false),
    expectedParticipants: z.coerce.number().int().min(0).max(20000).optional(),
    signatureRequired: z.boolean().default(true),
    emailRequired: z.boolean().default(true),
    internalNotes: z.string().max(4000).optional().or(z.literal("")),
    secretaryId: z.string().max(40).optional().or(z.literal("")).nullable(),
  });

export const MAX_CLOSE_AFTER_END_HOURS = 24;

export const meetingFormSchema = meetingBaseSchema.superRefine(
  (data: z.infer<typeof meetingBaseSchema>, ctx: z.RefinementCtx) => {
    const starts = fromDateTimeLocal(data.startsAt);
    if (!starts) {
      ctx.addIssue({ code: "custom", path: ["startsAt"], message: "Date de début invalide" });
      return;
    }
    const ends = fromDateTimeLocal(data.endsAt);
    if (data.endsAt && (!ends || ends <= starts)) {
      ctx.addIssue({ code: "custom", path: ["endsAt"], message: "La fin doit être postérieure au début" });
    }
    if (ends && ends.getTime() - starts.getTime() > 24 * 3600_000) {
      ctx.addIssue({ code: "custom", path: ["endsAt"], message: "Une réunion ne peut pas durer plus de 24 heures" });
    }
    const opens = fromDateTimeLocal(data.registrationOpensAt);
    const closes = fromDateTimeLocal(data.registrationClosesAt);
    if (data.registrationOpensAt && !opens) {
      ctx.addIssue({ code: "custom", path: ["registrationOpensAt"], message: "Ouverture de l'émargement invalide" });
    }
    if (data.registrationClosesAt && !closes) {
      ctx.addIssue({ code: "custom", path: ["registrationClosesAt"], message: "Fermeture de l'émargement invalide" });
    }
    if (opens && closes && closes <= opens) {
      ctx.addIssue({ code: "custom", path: ["registrationClosesAt"], message: "La fermeture de l'émargement doit suivre son ouverture" });
    }
    if (closes && closes < starts) {
      ctx.addIssue({ code: "custom", path: ["registrationClosesAt"], message: "L'émargement ne peut pas se fermer avant le début de la réunion" });
    }
    // Une fenêtre trop longue repousserait d'autant la liste officielle et la purge de conservation.
    if (closes && closes.getTime() > (ends ?? starts).getTime() + MAX_CLOSE_AFTER_END_HOURS * 3600_000) {
      ctx.addIssue({
        code: "custom",
        path: ["registrationClosesAt"],
        message: `L'émargement doit se fermer au plus tard ${MAX_CLOSE_AFTER_END_HOURS} h après la fin de la réunion`,
      });
    }
    if (opens && opens.getTime() < starts.getTime() - 24 * 3600_000) {
      ctx.addIssue({ code: "custom", path: ["registrationOpensAt"], message: "L'émargement ne peut pas ouvrir plus de 24 h avant la réunion" });
    }
    if (opens && (ends ?? starts) < opens) {
      ctx.addIssue({ code: "custom", path: ["registrationOpensAt"], message: "L'émargement doit ouvrir avant la fin de la réunion" });
    }
    const dynamicLevel = data.qrSecurityLevel >= 3;
    if (dynamicLevel !== (data.qrMode === "DYNAMIC")) {
      ctx.addIssue({
        code: "custom",
        path: ["qrSecurityLevel"],
        message: "Niveau de sécurité incohérent : niveaux 1-2 = QR statique, niveau 3 = QR dynamique",
      });
    }
    if (!data.location && !data.videoConferenceUrl) {
      ctx.addIssue({
        code: "custom",
        path: ["location"],
        message: "Le lieu est obligatoire sauf réunion à distance",
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
    // 512 Ko de signature binaire ≈ 700 000 caractères en base64.
    signatureDataUrl: z.string().max(700_000, "Signature trop volumineuse").optional().or(z.literal("")),
    publicListConsent: z.boolean().optional(),
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
  password: z.string().min(8, "Mot de passe trop court").max(200),
});

const roleSchema = z.enum(["SUPER_ADMIN", "MEETING_ADMIN", "ORGANIZER", "SECRETARY", "AUDITOR", "USER"]);

/** Création d'un compte : le mot de passe provisoire est généré par le serveur et affiché une seule fois. */
export const userFormSchema = z.object({
  email: z.string().trim().email("Email invalide").max(160),
  firstName: z.string().trim().min(2, "Prénom trop court").max(80),
  lastName: z.string().trim().min(2, "Nom trop court").max(80),
  jobTitle: z.string().trim().max(120).optional().or(z.literal("")),
  organization: z.string().trim().max(160).optional().or(z.literal("")),
  phone: z.string().trim().max(30).optional().or(z.literal("")),
  role: roleSchema,
  active: z.boolean().default(true),
});

export const userPatchSchema = z.object({
  firstName: z.string().trim().min(2, "Prénom trop court").max(80).optional(),
  lastName: z.string().trim().min(2, "Nom trop court").max(80).optional(),
  jobTitle: z.string().trim().max(120).optional().or(z.literal("")),
  organization: z.string().trim().max(160).optional().or(z.literal("")),
  phone: z.string().trim().max(30).optional().or(z.literal("")),
  role: roleSchema.optional(),
  active: z.boolean().optional(),
  resetPassword: z.boolean().optional(),
  unlock: z.boolean().optional(),
});

export const attendancePatchSchema = z.object({
  lastName: z.string().min(2).max(80).optional(),
  firstNames: z.string().min(2).max(120).optional(),
  jobTitle: z.string().min(2).max(120).optional(),
  organization: z.string().min(2).max(160).optional(),
  email: z.string().trim().email("Email invalide").optional().or(z.literal("")),
  phone: z
    .string()
    .trim()
    .max(30)
    .refine((value) => value === "" || isValidPhone(value), "Numéro ivoirien ou international invalide")
    .optional(),
});

export const cancelAttendanceSchema = z.object({
  reason: z.string().trim().min(5).max(400),
});

export const settingsSchema = z.object({
  organizationName: z.string().min(2).max(120),
  ministryName: z.string().min(2).max(180),
  appName: z.string().min(2).max(120),
  appTagline: z.string().max(180),
  retentionMonths: z.coerce.number().int().min(12).max(240),
  emailRequiredDefault: z.boolean(),
  signatureRequiredDefault: z.boolean(),
  dynamicQrSeconds: z.coerce.number().int().min(15).max(180),
  rateLimitPerMinute: z.coerce.number().int().min(5).max(200),
  privacyNotice: z.string().min(10).max(4000),
});

export const structureSchema = z.object({
  name: z.string().trim().min(2, "Nom trop court").max(120),
  internal: z.boolean().default(true),
  active: z.boolean().default(true),
});

// Sans `.default()` : avec zod 4, `.partial()` conserverait les valeurs par défaut et réactiverait
// silencieusement une structure lors d'un simple renommage.
export const structurePatchSchema = z.object({
  name: z.string().trim().min(2, "Nom trop court").max(120).optional(),
  internal: z.boolean().optional(),
  active: z.boolean().optional(),
});

const hexColor = z.string().regex(/^#[0-9a-fA-F]{6}$/, "Couleur invalide (format #RRGGBB)");

export const appearanceSchema = z.object({
  backgroundColor: hexColor,
  cardColor: hexColor,
  sidebarColor: hexColor,
  primaryColor: hexColor,
});

export const meetingTypeSchema = z.object({
  label: z.string().trim().min(2, "Libellé trop court").max(60),
  code: z
    .string()
    .trim()
    .regex(/^[A-Z0-9_]{2,40}$/, "Code : majuscules, chiffres et _ uniquement")
    .optional()
    .or(z.literal("")),
  color: hexColor.default("#14532d"),
  active: z.boolean().default(true),
  sortOrder: z.coerce.number().int().min(0).max(9999).default(0),
});

export const meetingTypePatchSchema = z.object({
  label: z.string().trim().min(2, "Libellé trop court").max(60).optional(),
  color: hexColor.optional(),
  active: z.boolean().optional(),
  sortOrder: z.coerce.number().int().min(0).max(9999).optional(),
});

export const LIST_COLUMNS = ["civility", "jobTitle", "organization", "email", "phone", "signature", "time"] as const;
export const PUBLIC_LIST_COLUMNS = ["jobTitle", "organization", "time"] as const;

export const pdfTemplateSchema = z.object({
  title: z.string().trim().min(3).max(120),
  subtitle: z.string().trim().max(160).optional().or(z.literal("")),
  headerNote: z.string().trim().max(160).optional().or(z.literal("")),
  footerText: z.string().trim().max(400).optional().or(z.literal("")),
  accentColor: hexColor,
  columns: z.array(z.enum(LIST_COLUMNS)).optional(),
  showVerificationQr: z.boolean().optional(),
  ctaText: z.string().trim().min(3).max(60).optional(),
  steps: z.array(z.string().trim().max(40)).max(3).optional(),
  showUrl: z.boolean().optional(),
});

export const profileSchema = z.object({
  firstName: z.string().trim().min(2, "Prénom trop court").max(80),
  lastName: z.string().trim().min(2, "Nom trop court").max(80),
  jobTitle: z.string().trim().max(120).optional().or(z.literal("")),
  organization: z.string().trim().max(160).optional().or(z.literal("")),
  phone: z.string().trim().max(30).optional().or(z.literal("")),
});

export const PASSWORD_RULES = [
  { test: (value: string) => value.length >= 10, label: "10 caractères minimum" },
  { test: (value: string) => /[a-z]/.test(value), label: "une minuscule" },
  { test: (value: string) => /[A-Z]/.test(value), label: "une majuscule" },
  { test: (value: string) => /\d/.test(value), label: "un chiffre" },
  { test: (value: string) => /[^A-Za-z0-9]/.test(value), label: "un caractère spécial" },
];

export const passwordChangeSchema = z
  .object({
    currentPassword: z.string().min(1, "Mot de passe actuel requis"),
    newPassword: z
      .string()
      // bcrypt ignore tout au-delà de 72 octets : des caractères au-delà ne protégeraient rien.
      .refine((value) => new TextEncoder().encode(value).length <= 72, { message: "72 caractères au maximum (accents comptés double)." })
      .refine((value) => PASSWORD_RULES.every((rule) => rule.test(value)), {
        message: `Le nouveau mot de passe doit contenir : ${PASSWORD_RULES.map((rule) => rule.label).join(", ")}.`,
      }),
    confirmPassword: z.string(),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    path: ["confirmPassword"],
    message: "La confirmation ne correspond pas au nouveau mot de passe",
  })
  .refine((data) => data.newPassword !== data.currentPassword, {
    path: ["newPassword"],
    message: "Le nouveau mot de passe doit être différent de l'actuel",
  });
