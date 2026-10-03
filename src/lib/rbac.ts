import type { Role } from "@prisma/client";

export type Permission =
  | "settings.manage"
  | "users.manage"
  | "meetings.create"
  /** Portée globale : toutes les réunions, sans restriction de créateur ou d'affectation. */
  | "meetings.manage_all"
  | "meetings.manage_own"
  | "meetings.close"
  | "meetings.archive"
  | "meetings.reopen"
  | "meetings.delete"
  | "qr.display"
  | "attendances.read"
  | "attendances.manage"
  | "attendances.export"
  | "documents.read"
  | "audit.read"
  | "stats.read"
  | "documents.manage"
  | "history.global";

const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  SUPER_ADMIN: [
    "settings.manage",
    "users.manage",
    "meetings.create",
    "meetings.manage_all",
    "meetings.manage_own",
    "meetings.close",
    "meetings.archive",
    "meetings.reopen",
    "meetings.delete",
    "qr.display",
    "attendances.read",
    "attendances.manage",
    "attendances.export",
    "documents.read",
    "audit.read",
    "stats.read",
    "documents.manage",
    "history.global",
  ],
  MEETING_ADMIN: [
    "meetings.create",
    "meetings.manage_all",
    "meetings.manage_own",
    "meetings.close",
    "meetings.archive",
    "qr.display",
    "attendances.read",
    "attendances.manage",
    "attendances.export",
    "documents.read",
    "stats.read",
    "documents.manage",
  ],
  ORGANIZER: [
    "meetings.create",
    "meetings.manage_own",
    "meetings.close",
    "qr.display",
    "attendances.read",
    "attendances.manage",
    "attendances.export",
    "documents.read",
    "stats.read",
  ],
  /** Secrétaire de séance : uniquement les réunions auxquelles il est affecté. */
  SECRETARY: ["meetings.close", "qr.display", "attendances.read", "attendances.manage", "documents.read", "stats.read"],
  /** Contrôle : lecture de toutes les réunions et des listes officielles, sans QR ni export de données brutes. */
  AUDITOR: ["attendances.read", "documents.read", "audit.read", "stats.read"],
  USER: [],
};

export function hasPermission(role: Role, permission: Permission) {
  return ROLE_PERMISSIONS[role].includes(permission);
}

export function canAccessBackoffice(role: Role) {
  return role !== "USER";
}

/** Périmètre des réunions visibles : toutes, celles créées par l'utilisateur, ou celles qui lui sont affectées. */
export type MeetingScope = "all" | "own" | "assigned";

export function meetingScope(role: Role): MeetingScope {
  if (hasPermission(role, "meetings.manage_all") || role === "AUDITOR") return "all";
  if (role === "SECRETARY") return "assigned";
  return "own";
}

export const ROLE_LABELS: Record<Role, string> = {
  SUPER_ADMIN: "Super administrateur",
  MEETING_ADMIN: "Administrateur réunions",
  ORGANIZER: "Organisateur",
  SECRETARY: "Secrétaire de séance",
  AUDITOR: "Auditeur",
  USER: "Utilisateur",
};
