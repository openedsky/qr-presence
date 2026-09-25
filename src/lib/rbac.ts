import type { Role } from "@prisma/client";

export type Permission =
  | "settings.manage"
  | "users.manage"
  | "roles.manage"
  | "meetings.create"
  | "meetings.manage_all"
  | "meetings.manage_own"
  | "meetings.reopen"
  | "meetings.delete"
  | "attendances.read"
  | "attendances.manage"
  | "attendances.export"
  | "audit.read"
  | "stats.read"
  | "documents.manage";

const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  SUPER_ADMIN: [
    "settings.manage",
    "users.manage",
    "roles.manage",
    "meetings.create",
    "meetings.manage_all",
    "meetings.manage_own",
    "meetings.reopen",
    "meetings.delete",
    "attendances.read",
    "attendances.manage",
    "attendances.export",
    "audit.read",
    "stats.read",
    "documents.manage",
  ],
  MEETING_ADMIN: [
    "meetings.create",
    "meetings.manage_all",
    "meetings.manage_own",
    "attendances.read",
    "attendances.manage",
    "attendances.export",
    "stats.read",
    "documents.manage",
  ],
  ORGANIZER: [
    "meetings.create",
    "meetings.manage_own",
    "attendances.read",
    "attendances.manage",
    "attendances.export",
    "stats.read",
  ],
  SECRETARY: [
    "attendances.read",
    "attendances.manage",
    "stats.read",
  ],
  AUDITOR: ["attendances.read", "audit.read", "stats.read"],
  USER: [],
};

export function hasPermission(role: Role, permission: Permission) {
  return ROLE_PERMISSIONS[role].includes(permission);
}

export function canAccessBackoffice(role: Role) {
  return role !== "USER";
}

export const ROLE_LABELS: Record<Role, string> = {
  SUPER_ADMIN: "Super administrateur",
  MEETING_ADMIN: "Administrateur réunions",
  ORGANIZER: "Organisateur",
  SECRETARY: "Secrétaire de séance",
  AUDITOR: "Auditeur",
  USER: "Utilisateur",
};
