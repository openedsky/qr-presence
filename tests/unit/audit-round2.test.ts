import { beforeAll, describe, expect, it, vi } from "vitest";
import { PDFDocument, StandardFonts } from "pdf-lib";

vi.mock("next-auth", () => ({ default: vi.fn(() => ({})), CredentialsSignin: class extends Error {} }));
vi.mock("next-auth/providers/credentials", () => ({ default: vi.fn() }));
import { lockDuration, nextFailureCount, temporaryPasswordExpired } from "../../src/lib/auth";
import { issueCheckinSession, verifyCheckinSession } from "../../src/lib/checkin-session";
import { memo, invalidateMemo } from "../../src/lib/memo-cache";
import { mapWithLimit } from "../../src/lib/concurrency";
import { cancelAttendanceSchema } from "../../src/lib/validators";
import { wrapText } from "../../src/server/services/documents";
import { tourSteps } from "../../src/lib/onboarding";
import { hasPermission, ROLE_LABELS, type Permission } from "../../src/lib/rbac";
import type { Role } from "@prisma/client";

beforeAll(() => {
  process.env.AUTH_SECRET ??= "test-secret-test-secret-test-secret-42";
});

describe("verrouillage de compte", () => {
  it("verrouille par paliers de 5 échecs, plafonné à 1 h", () => {
    expect(lockDuration(5)).toBe(0);
    expect(lockDuration(19)).toBe(0);
    expect(lockDuration(20)).toBe(15);
    expect(lockDuration(30)).toBe(0);
    expect(lockDuration(40)).toBe(60);
    expect(lockDuration(100)).toBe(60);
  });

  it("repart à zéro après 24 h sans échec", () => {
    const now = new Date("2026-09-29T12:00:00Z");
    expect(nextFailureCount(9, new Date("2026-09-29T11:00:00Z"), now)).toBe(10);
    expect(nextFailureCount(9, new Date("2026-09-28T11:00:00Z"), now)).toBe(1);
    expect(nextFailureCount(3, null, now)).toBe(1);
  });

  it("fait expirer le mot de passe provisoire après 7 jours", () => {
    const now = new Date("2026-09-29T12:00:00Z");
    const set = (days: number) => new Date(now.getTime() - days * 86_400_000);
    expect(temporaryPasswordExpired({ mustChangePassword: true, passwordChangedAt: set(6) }, now)).toBe(false);
    expect(temporaryPasswordExpired({ mustChangePassword: true, passwordChangedAt: set(8) }, now)).toBe(true);
    expect(temporaryPasswordExpired({ mustChangePassword: false, passwordChangedAt: set(30) }, now)).toBe(false);
  });
});

describe("session d'émargement", () => {
  it("part de l'ouverture (plafonnée à 2 h d'attente) et porte le jeton QR d'origine", () => {
    const opensIn10 = new Date(Date.now() + 10 * 60_000);
    const session = verifyCheckinSession(issueCheckinSession("m1", "qr1", opensIn10), "m1");
    expect(session?.q).toBe("qr1");
    const expected = Math.floor(opensIn10.getTime() / 1000) + 15 * 60;
    expect(Math.abs((session?.e ?? 0) - expected)).toBeLessThanOrEqual(1);

    const far = verifyCheckinSession(issueCheckinSession("m1", "qr1", new Date(Date.now() + 24 * 3600_000)), "m1");
    expect((far?.e ?? 0) - Math.floor(Date.now() / 1000)).toBeLessThanOrEqual(2 * 3600 + 15 * 60 + 1);
  });

  it("refuse une session d'une autre réunion ou falsifiée", () => {
    const value = issueCheckinSession("m1", "qr1");
    expect(verifyCheckinSession(value, "m2")).toBeNull();
    expect(verifyCheckinSession(`${value}x`, "m1")).toBeNull();
  });
});

describe("cache mémoire", () => {
  it("partage la lecture, s'invalide et n'enregistre pas les échecs", async () => {
    let calls = 0;
    const load = async () => ++calls;
    expect(await memo("t:a", 60_000, load)).toBe(1);
    expect(await memo("t:a", 60_000, load)).toBe(1);
    invalidateMemo("t:");
    expect(await memo("t:a", 60_000, load)).toBe(2);

    await expect(memo("t:b", 60_000, () => Promise.reject(new Error("db")))).rejects.toThrow("db");
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(await memo("t:b", 60_000, async () => "ok")).toBe("ok");
  });
});

describe("concurrence bornée", () => {
  it("respecte la limite et l'ordre des résultats", async () => {
    let running = 0;
    let peak = 0;
    const results = await mapWithLimit([5, 1, 4, 2, 3], 2, async (n) => {
      running++;
      peak = Math.max(peak, running);
      await new Promise((resolve) => setTimeout(resolve, n));
      running--;
      return n * 10;
    });
    expect(results).toEqual([50, 10, 40, 20, 30]);
    expect(peak).toBe(2);
  });
});

describe("motifs", () => {
  it("exige 5 caractères pour une annulation", () => {
    expect(cancelAttendanceSchema.safeParse({ reason: " abc " }).success).toBe(false);
    expect(cancelAttendanceSchema.safeParse({ reason: "Doublon" }).success).toBe(true);
  });

  it("répartit le motif de correction sur 3 lignes au plus", async () => {
    const pdf = await PDFDocument.create();
    const font = await pdf.embedFont(StandardFonts.Helvetica);
    const reason = "Participant arrivé en retard et enregistré manuellement par le secrétaire de séance ".repeat(5);
    const lines = wrapText(reason, 200, 8, font, 3);
    expect(lines).toHaveLength(3);
    expect(lines[2].endsWith("…")).toBe(true);
    for (const line of lines) expect(font.widthOfTextAtSize(line, 8)).toBeLessThanOrEqual(200);
    expect(wrapText("Court motif", 200, 8, font, 3)).toEqual(["Court motif"]);
  });
});

describe("didacticiel", () => {
  it("ne cible que des écrans accessibles au rôle", () => {
    const routes: Record<string, string> = {
      "/statistics": "stats.read",
      "/users": "users.manage",
      "/settings": "settings.manage",
      "/documents": "documents.manage",
      "/audit": "audit.read",
    };
    const relevant: Permission[] = ["meetings.create", "qr.display", ...(Object.values(routes) as Permission[])];
    for (const role of Object.keys(ROLE_LABELS) as Role[]) {
      const permissions = relevant.filter((permission) => hasPermission(role, permission));
      for (const step of tourSteps(permissions)) {
        const required = step.target ? routes[step.target] : undefined;
        if (required) expect(permissions, `${role} → ${step.target}`).toContain(required);
      }
    }
  });
});
