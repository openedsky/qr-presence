import { describe, expect, it } from "vitest";
import { tourSteps } from "../../src/lib/onboarding";
import { formatRemaining } from "../../src/lib/countdown";
import { hasPermission, type Permission } from "../../src/lib/rbac";
import type { Role } from "@prisma/client";

const ALL: Permission[] = [
  "stats.read",
  "users.manage",
  "audit.read",
  "history.global",
  "documents.manage",
  "settings.manage",
  "meetings.create",
  "qr.display",
];
const permissionsOf = (role: Role) => ALL.filter((permission) => hasPermission(role, permission));
const ids = (role: Role) => tourSteps(permissionsOf(role)).map((step) => step.id);

describe("visite guidée", () => {
  it("le super administrateur voit création de réunion, QR, statistiques et administration", () => {
    const steps = ids("SUPER_ADMIN");
    expect(steps).toEqual(expect.arrayContaining(["welcome", "meetings-create", "qr", "statistics", "admin-users", "done"]));
    expect(steps).not.toContain("meetings-read");
    expect(steps).not.toContain("admin-other");
  });

  it("l'auditeur ne voit ni création, ni QR, ni gestion des utilisateurs", () => {
    const steps = ids("AUDITOR");
    expect(steps).toContain("meetings-read");
    expect(steps).not.toContain("meetings-create");
    expect(steps).not.toContain("qr");
    expect(steps).not.toContain("admin-users");
  });

  it("commence par l'accueil et finit par la conclusion", () => {
    for (const role of ["SUPER_ADMIN", "MEETING_ADMIN", "ORGANIZER", "SECRETARY", "AUDITOR"] as Role[]) {
      const steps = ids(role);
      expect(steps[0]).toBe("welcome");
      expect(steps.at(-1)).toBe("done");
    }
  });
});

describe("compte à rebours", () => {
  it("décompose en jours, heures, minutes et secondes", () => {
    expect(formatRemaining(90_061)).toEqual({ days: 1, hours: 1, minutes: 1, seconds: 1 });
    expect(formatRemaining(59)).toEqual({ days: 0, hours: 0, minutes: 0, seconds: 59 });
  });

  it("ne descend pas sous zéro", () => {
    expect(formatRemaining(-5)).toEqual({ days: 0, hours: 0, minutes: 0, seconds: 0 });
  });
});
