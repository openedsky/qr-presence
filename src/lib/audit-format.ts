import { STATUS_LABELS } from "./meeting-status";
import { ROLE_LABELS } from "./rbac";
import { METHOD_LABELS } from "./labels";
import { APP_TIME_ZONE } from "./utils";

export const ACTION_LABELS: Record<string, string> = {
  "auth.login": "Connexion",
  "auth.login_failed": "Échec de connexion",
  "meeting.create": "Création d'une réunion",
  "meeting.update": "Modification d'une réunion",
  "meeting.duplicate": "Duplication d'une réunion",
  "meeting.delete": "Suppression d'une réunion",
  "meeting.status": "Changement de statut",
  "meeting.close": "Clôture d'une réunion",
  "meeting.reopen": "Réouverture d'une réunion",
  "meeting.qr_poster": "Téléchargement de l'affiche QR",
  "attendance.create": "Émargement",
  "attendance.update": "Correction d'un participant",
  "attendance.cancel": "Annulation d'un émargement",
  "attendance.post_close_create": "Ajout après clôture",
  "attendance.post_close_update": "Correction après clôture",
  "attendance.post_close_cancel": "Annulation après clôture",
  "attendance.duplicate_resolved": "Homonyme confirmé",
  "document.official_list": "Liste officielle générée",
  "document.pdf": "Liste PDF générée",
  "document.download": "Liste PDF téléchargée",
  "file.download": "Fichier consulté",
  "export.xlsx": "Export Excel",
  "export.csv": "Export CSV",
  "settings.update": "Modification des paramètres",
  "settings.logo_update": "Modification du logo",
  "user.create": "Création d'un utilisateur",
  "user.update": "Modification d'un utilisateur",
  "user.password_reset": "Réinitialisation d'un mot de passe",
  "user.unlock": "Déverrouillage d'un compte",
  "user.legacy_credentials": "Neutralisation d'un compte par défaut",
  "user.onboarding_completed": "Visite guidée terminée",
  "auth.locked": "Verrouillage après échecs de connexion",
  "meeting.auto_close": "Clôture automatique",
  "meeting.retention_purge": "Anonymisation (durée de conservation)",
  "structure.create": "Création d'une structure",
  "structure.update": "Modification d'une structure",
  "structure.delete": "Suppression d'une structure",
  "meeting_type.create": "Création d'un type de réunion",
  "meeting_type.update": "Modification d'un type de réunion",
  "meeting_type.delete": "Suppression d'un type de réunion",
  "pdf_template.update": "Modification d'un modèle PDF",
  "pdf_template.reset": "Réinitialisation d'un modèle PDF",
  "profile.update": "Mise à jour du profil",
  "profile.password_change": "Changement de mot de passe",
};

export const ENTITY_LABELS: Record<string, string> = {
  Meeting: "Réunion",
  Attendance: "Participant",
  GeneratedDocument: "Document",
  OrganizationSetting: "Paramètres",
  User: "Utilisateur",
  MeetingTypeOption: "Type de réunion",
  PdfTemplate: "Modèle PDF",
  Structure: "Structure",
};

const FIELD_LABELS: Record<string, string> = {
  title: "Objet",
  internalRef: "Référence",
  description: "Description",
  type: "Type",
  location: "Lieu",
  videoConferenceUrl: "Lien visio",
  startsAt: "Début",
  endsAt: "Fin",
  registrationOpensAt: "Ouverture des inscriptions",
  registrationClosesAt: "Fermeture des inscriptions",
  toleranceMinutes: "Tolérance (min)",
  status: "Statut",
  qrMode: "Mode QR",
  qrSecurityLevel: "Niveau de sécurité QR",
  allowGuests: "Invités autorisés",
  showPublicAttendance: "Liste publique",
  expectedParticipants: "Participants attendus",
  signatureRequired: "Signature obligatoire",
  emailRequired: "Email obligatoire",
  internalNotes: "Notes internes",
  lastName: "Nom",
  firstNames: "Prénoms",
  firstName: "Prénom",
  jobTitle: "Fonction",
  organization: "Structure",
  email: "Email",
  phone: "Téléphone",
  method: "Mode d'émargement",
  suspectedDuplicate: "Doublon probable",
  reason: "Motif",
  role: "Rôle",
  active: "Actif",
  organizationName: "Organisation",
  ministryName: "Ministère",
  appName: "Nom de l'application",
  appTagline: "Slogan",
  publicBaseUrl: "URL publique",
  retentionMonths: "Conservation (mois)",
  emailRequiredDefault: "Email obligatoire par défaut",
  signatureRequiredDefault: "Signature obligatoire par défaut",
  dynamicQrSeconds: "Renouvellement QR (s)",
  rateLimitPerMinute: "Soumissions / minute",
  privacyNotice: "Mention de confidentialité",
  backgroundColor: "Fond de l'application",
  cardColor: "Fond des cartes",
  sidebarColor: "Fond du menu",
  primaryColor: "Fond des boutons",
  logo: "Logo de la structure",
  qrLogoEnabled: "Logo au centre des QR codes",
  code: "Code",
  label: "Libellé",
  color: "Couleur",
  sortOrder: "Ordre",
  subtitle: "Sous-titre",
  headerNote: "Mention d'en-tête",
  footerText: "Pied de page",
  accentColor: "Couleur d'accent",
  columns: "Colonnes",
  showVerificationQr: "QR de vérification",
  ctaText: "Appel à l'action",
  steps: "Étapes",
  showUrl: "Adresse affichée",
  kind: "Modèle",
  version: "Version",
  sourceId: "Réunion d'origine",
  email_attempted: "Email saisi",
  password: "Mot de passe",
  verrouillage: "Verrouillage",
  sessions: "Sessions",
  secretaryId: "Secrétaire affecté",
  internal: "Interne",
  manualReason: "Motif de dérogation",
  checkInAt: "Heure d'arrivée",
  publicListConsent: "Consentement liste publique",
  attendances: "Présences anonymisées",
};

// Contexte technique : affiché à part, pas comme un champ modifié.
const CONTEXT_KEYS = new Set(["meetingId", "supersedes"]);

const ISO_DATE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/;

export function actionLabel(action: string) {
  return ACTION_LABELS[action] ?? action;
}

export function fieldLabel(field: string) {
  return FIELD_LABELS[field] ?? field;
}

export function formatAuditValue(field: string, value: unknown): string {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "boolean") return value ? "Oui" : "Non";
  if (field === "status" && typeof value === "string") return STATUS_LABELS[value as keyof typeof STATUS_LABELS] ?? value;
  if (field === "role" && typeof value === "string") return ROLE_LABELS[value as keyof typeof ROLE_LABELS] ?? value;
  if (field === "method" && typeof value === "string") return METHOD_LABELS[value as keyof typeof METHOD_LABELS] ?? value;
  if (field === "qrMode") return value === "DYNAMIC" ? "Dynamique" : value === "STATIC" ? "Statique" : String(value);
  if (typeof value === "string" && ISO_DATE.test(value)) {
    const date = new Date(value);
    if (!Number.isNaN(date.getTime())) {
      return new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium", timeStyle: "short", timeZone: APP_TIME_ZONE }).format(date);
    }
  }
  if (value instanceof Date) return formatAuditValue(field, value.toISOString());
  if (Array.isArray(value)) return value.map((item) => formatAuditValue(field, item)).join(", ");
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

export type AuditChange = { field: string; label: string; before: string; after: string };

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

/** Lignes « champ / ancienne valeur / nouvelle valeur » d'une entrée du journal. */
export function auditChanges(beforeData: unknown, afterData: unknown): AuditChange[] {
  const before = asRecord(beforeData);
  const after = asRecord(afterData);
  const keys = [...new Set([...Object.keys(before), ...Object.keys(after)])].filter((key) => !CONTEXT_KEYS.has(key));
  return keys
    .map((field) => ({
      field,
      label: fieldLabel(field),
      before: field in before ? formatAuditValue(field, before[field]) : "—",
      after: field in after ? formatAuditValue(field, after[field]) : "—",
    }))
    .filter((row) => row.before !== row.after || !(row.field in before));
}

function comparable(value: unknown) {
  if (value instanceof Date) return value.toISOString();
  if (value === undefined || value === "") return null;
  return typeof value === "object" && value !== null ? JSON.stringify(value) : value;
}

/** Ne conserve que les champs réellement modifiés, pour écrire un journal lisible. */
export function diffForAudit<T extends Record<string, unknown>>(before: T, after: Partial<T>, fields?: (keyof T)[]) {
  const keys = (fields ?? (Object.keys(after) as (keyof T)[])).filter(
    (key) => after[key] !== undefined && comparable(before[key]) !== comparable(after[key]),
  );
  return {
    changed: keys as string[],
    beforeData: Object.fromEntries(keys.map((key) => [key, before[key] ?? null])),
    afterData: Object.fromEntries(keys.map((key) => [key, after[key] ?? null])),
  };
}
