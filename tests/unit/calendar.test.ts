import { describe, expect, it } from "vitest";
import { categorize, dayKey, monthGrid, parseMonth, shiftMonth } from "../../src/lib/calendar";

describe("calendrier", () => {
  it("construit une grille complète commençant le lundi", () => {
    const { days, gridEnd } = monthGrid(new Date(Date.UTC(2026, 8, 1)));
    expect(days.length % 7).toBe(0);
    expect(days[0].getUTCDay()).toBe(1);
    expect(days[days.length - 1].getUTCDay()).toBe(0);
    expect(days.some((d) => dayKey(d) === "2026-09-01")).toBe(true);
    expect(days.some((d) => dayKey(d) === "2026-09-30")).toBe(true);
    expect(gridEnd.toISOString()).toBe("2026-10-04T23:59:59.999Z");
  });

  it("classe les réunions prévues, en cours et achevées", () => {
    const now = new Date(2026, 8, 25, 10);
    expect(categorize("PLANIFIEE", new Date(2026, 8, 30), now)).toBe("prevue");
    expect(categorize("OUVERTE", new Date(2026, 8, 30), now)).toBe("prevue");
    expect(categorize("OUVERTE", new Date(2026, 8, 25, 9), now)).toBe("en_cours");
    expect(categorize("CLOTUREE", new Date(2026, 8, 20), now)).toBe("achevee");
    expect(categorize("ARCHIVEE", new Date(2026, 7, 1), now)).toBe("achevee");
  });

  it("ignore un paramètre de mois invalide", () => {
    const now = new Date(Date.UTC(2026, 9, 4, 23, 30));
    const parsed = parseMonth("n'importe-quoi", now);
    expect(parsed.toISOString()).toBe("2026-10-01T00:00:00.000Z");
    expect(parseMonth("2026-02").getUTCMonth()).toBe(1);
  });

  it("passe d'un mois à l'autre, y compris d'une année à l'autre", () => {
    expect(dayKey(shiftMonth(parseMonth("2026-01"), -1))).toBe("2025-12-01");
    expect(dayKey(shiftMonth(parseMonth("2026-12"), 1))).toBe("2027-01-01");
  });
});
