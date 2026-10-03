import type { Attendance, Meeting } from "@prisma/client";
import type { z } from "zod";
import type { pdfTemplateSchema } from "@/lib/validators";
import { renderList } from "./documents";
import { buildQrPoster } from "./qr-poster";
import { TEMPLATE_META, type ResolvedTemplate, type TemplateKind } from "./pdf-templates";

type TemplateInput = z.infer<typeof pdfTemplateSchema>;

/** Applique des valeurs saisies (non enregistrées) sur un modèle, en respectant les colonnes autorisées. */
export function mergeTemplate(base: ResolvedTemplate, input: TemplateInput): ResolvedTemplate {
  const allowed = TEMPLATE_META[base.kind].allowedColumns;
  return {
    ...base,
    title: input.title,
    subtitle: input.subtitle ?? "",
    headerNote: input.headerNote ?? "",
    footerText: input.footerText ?? "",
    accentColor: input.accentColor,
    columns: input.columns ? input.columns.filter((column) => allowed.includes(column)) : base.columns,
    showVerificationQr: base.kind === "LISTE_PUBLIQUE" ? false : (input.showVerificationQr ?? base.showVerificationQr),
    ctaText: input.ctaText ?? base.ctaText,
    steps: input.steps ?? base.steps,
    showUrl: input.showUrl ?? base.showUrl,
  };
}

const SAMPLE_PEOPLE = [
  ["M", "KOUASSI", "Awa Marie", "Directrice technique", "Direction Générale", "awa.kouassi@sodefor.ci", "07 07 00 00 01"],
  ["M", "YAO", "Jean-Baptiste", "Chef de service", "Centre de Gestion d'Abidjan", "jb.yao@sodefor.ci", "05 05 00 00 02"],
  ["MME", "KONE", "Mariam", "Auditrice interne", "SODEFOR", "mariam.kone@sodefor.ci", "01 01 00 00 03"],
  ["M", "BAMBA", "Seydou", "Ingénieur forestier", "Ministère des Eaux et Forêts", "s.bamba@eauxforets.gouv.ci", "07 08 00 00 04"],
  ["MLLE", "N'GUESSAN", "Aya Grâce", "Assistante de direction", "DSI – SODEFOR", "aya.nguessan@sodefor.ci", "05 06 00 00 05"],
  ["M", "TRAORE", "Ibrahim", "Consultant", "Partenaire externe", "i.traore@exemple.ci", "+33 6 00 00 00 06"],
] as const;

function sampleMeeting(): Meeting {
  const startsAt = new Date();
  startsAt.setHours(9, 0, 0, 0);
  return {
    id: "apercu",
    uuid: "00000000-0000-0000-0000-000000000000",
    title: "Comité technique de suivi des plantations (aperçu)",
    internalRef: "REU-APERCU-0001",
    slug: "apercu",
    description: null,
    type: "COMITE",
    location: "Salle de conférence — Siège SODEFOR",
    videoConferenceUrl: null,
    startsAt,
    endsAt: null,
    registrationOpensAt: null,
    registrationClosesAt: null,
    toleranceMinutes: 15,
    status: "CLOTUREE",
    qrMode: "STATIC",
    qrSecurityLevel: 1,
    allowGuests: true,
    showPublicAttendance: true,
    expectedParticipants: 20,
    signatureRequired: true,
    emailRequired: true,
    active: true,
    internalNotes: null,
    createdById: "apercu",
    updatedById: null,
    secretaryId: null,
    closedAt: startsAt,
    closedById: null,
    contentVersion: 0,
    autoClosed: false,
    purgedAt: null,
    reopenedAt: null,
    createdAt: startsAt,
    updatedAt: startsAt,
    legacyPublicationId: null,
    legacySha1: null,
    legacySha2: null,
  };
}

function sampleAttendances(meeting: Meeting): Attendance[] {
  return SAMPLE_PEOPLE.map(([civility, lastName, firstNames, jobTitle, organization, email, phone], index) => ({
    id: `apercu-${index}`,
    uuid: `apercu-${index}`,
    meetingId: meeting.id,
    userId: null,
    civility,
    lastName,
    firstNames,
    gender: civility === "M" ? "M" : "F",
    jobTitle,
    organization,
    email,
    phone,
    emailNormalized: null,
    phoneNormalized: null,
    nameKey: "",
    activeEmailKey: null,
    activePhoneKey: null,
    activeNameKey: null,
    activeUserKey: null,
    suspectedDuplicate: false,
    signatureObjectKey: null,
    signatureHash: null,
    signatureMime: null,
    signatureSize: null,
    checkInAt: new Date(meeting.startsAt.getTime() + index * 4 * 60_000),
    checkInMethod: index === 4 ? "ADMIN_MANUAL" : "QR_CODE",
    publicListConsent: true,
    manualReason: null,
    status: "ACTIVE",
    cancelledAt: null,
    cancelledById: null,
    cancelReason: null,
    ipHash: null,
    userAgent: null,
    confirmationCode: `SDF-APERCU${index}`,
    createdAt: meeting.startsAt,
    updatedAt: meeting.startsAt,
    createdById: null,
    updatedById: null,
    legacyPresenceId: null,
  }));
}

export async function renderTemplatePreview(template: ResolvedTemplate, actor: { firstName: string; lastName: string }) {
  const meeting = sampleMeeting();
  const kind: TemplateKind = template.kind;
  if (kind === "QR_POSTER") {
    return buildQrPoster(meeting, "https://presence.sodefor.ci/r/exemple-de-jeton-apercu", template);
  }
  const listKind = kind === "LISTE_OFFICIELLE" ? "official" : kind === "LISTE_PROVISOIRE" ? "provisional" : "public";
  return renderList({
    meeting: { ...meeting, status: listKind === "official" ? "CLOTUREE" : "OUVERTE" },
    attendances: sampleAttendances(meeting),
    actor,
    kind: listKind,
    documentUuid: "apercu-non-enregistre",
    version: 1,
    template,
  });
}
