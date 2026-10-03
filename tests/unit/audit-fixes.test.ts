import { describe, expect, it, vi } from "vitest";

vi.mock("../../src/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("next/server", () => ({ NextResponse: { json: vi.fn() } }));
vi.mock("next/navigation", () => ({ notFound: vi.fn(), redirect: vi.fn() }));
import { hasPermission, meetingScope } from "../../src/lib/rbac";
import { canAccessMeeting } from "../../src/lib/meeting-access";
import { nameKey, toTitleFirstNames } from "../../src/lib/identity";
import { fromDateTimeLocal, toDateTimeLocal } from "../../src/lib/utils";
import { generateTemporaryPassword } from "../../src/lib/temp-password";
import { PASSWORD_RULES } from "../../src/lib/validators";
import { spreadsheetSafe } from "../../src/server/services/documents";
import { decodeSignature } from "../../src/server/services/attendances";

describe("rôles et périmètre des réunions", () => {
  it("l'auditeur lit tout sans rien modifier ni afficher de QR", () => {
    expect(meetingScope("AUDITOR")).toBe("all");
    expect(hasPermission("AUDITOR", "documents.read")).toBe(true);
    expect(hasPermission("AUDITOR", "attendances.manage")).toBe(false);
    expect(hasPermission("AUDITOR", "qr.display")).toBe(false);
  });

  it("le secrétaire ne voit que les réunions qui lui sont affectées", () => {
    expect(meetingScope("SECRETARY")).toBe("assigned");
    const user = { id: "sec-1", role: "SECRETARY" as const };
    const assigned = { createdById: "org-1", secretaryId: "sec-1" };
    const other = { createdById: "org-1", secretaryId: "sec-2" };
    expect(canAccessMeeting(user, assigned, "read")).toBe(true);
    expect(canAccessMeeting(user, assigned, "close")).toBe(true);
    expect(canAccessMeeting(user, other, "read")).toBe(false);
  });

  it("l'organisateur ne gère que ses réunions et n'archive pas", () => {
    expect(meetingScope("ORGANIZER")).toBe("own");
    expect(hasPermission("ORGANIZER", "meetings.archive")).toBe(false);
    expect(canAccessMeeting({ id: "org-1", role: "ORGANIZER" }, { createdById: "org-2", secretaryId: null }, "read")).toBe(false);
  });
});

describe("exports tableur", () => {
  it("neutralise les formules", () => {
    expect(spreadsheetSafe("=HYPERLINK(\"x\")")).toBe("'=HYPERLINK(\"x\")");
    expect(spreadsheetSafe("+2250700000000")).toBe("'+2250700000000");
    expect(spreadsheetSafe("-1")).toBe("'-1");
    expect(spreadsheetSafe("@SUM(A1)")).toBe("'@SUM(A1)");
    expect(spreadsheetSafe("KOUASSI")).toBe("KOUASSI");
    expect(spreadsheetSafe(null)).toBe("");
  });
});

describe("dates à l'heure d'Abidjan", () => {
  it("interprète un champ datetime-local comme UTC, quel que soit le navigateur", () => {
    expect(fromDateTimeLocal("2026-09-21T14:30")?.toISOString()).toBe("2026-09-21T14:30:00.000Z");
    expect(fromDateTimeLocal("2026-09-21T14:30:15")?.toISOString()).toBe("2026-09-21T14:30:15.000Z");
    expect(fromDateTimeLocal("2026-09-21T14:30:00+01:00")?.toISOString()).toBe("2026-09-21T13:30:00.000Z");
    expect(fromDateTimeLocal("")).toBeNull();
    expect(fromDateTimeLocal("pas une date")).toBeNull();
  });

  it("fait l'aller-retour sans décalage", () => {
    expect(toDateTimeLocal(fromDateTimeLocal("2026-09-21T08:05"))).toBe("2026-09-21T08:05");
  });
});

describe("noms composés", () => {
  it("considère trait d'union, apostrophe et espace comme équivalents pour les doublons", () => {
    expect(nameKey("KOUAME", "Jean-Marc")).toBe(nameKey("kouame", "jean marc"));
    expect(nameKey("N'GUESSAN", "Awa")).toBe(nameKey("N GUESSAN", "awa"));
  });

  it("met une majuscule après le trait d'union et l'apostrophe", () => {
    expect(toTitleFirstNames("jean-marc")).toBe("Jean-Marc");
    expect(toTitleFirstNames("marie-éloïse d'arc")).toBe("Marie-Éloïse D'Arc");
  });
});

describe("mot de passe provisoire", () => {
  it("respecte les règles de robustesse et varie à chaque tirage", () => {
    const samples = Array.from({ length: 50 }, () => generateTemporaryPassword());
    for (const password of samples) {
      expect(password).toHaveLength(14);
      expect(PASSWORD_RULES.every((rule) => rule.test(password))).toBe(true);
    }
    expect(new Set(samples).size).toBe(samples.length);
  });
});

describe("signature", () => {
  const png = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==";

  it("accepte un PNG réel", () => {
    expect(decodeSignature(`data:image/png;base64,${png}`)?.extension).toBe("png");
  });

  it("refuse un contenu qui ne correspond pas au format annoncé", () => {
    const html = Buffer.from("<svg onload=alert(1)>").toString("base64");
    expect(decodeSignature(`data:image/png;base64,${html}`)).toBeNull();
    expect(decodeSignature(`data:image/jpeg;base64,${png}`)).toBeNull();
    expect(decodeSignature(`data:image/svg+xml;base64,${html}`)).toBeNull();
  });
});
