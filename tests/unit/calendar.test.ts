import { describe, expect, it } from "vitest";
import { categorize, dayKey, monthGrid, parseMonth } from "../../src/lib/calendar";

describe("calendrier", () => {
  it("construit une grille complète commençant le lundi", () => {
    const { days } = monthGrid(new Date(2026, 8, 1));
    expect(days.length % 7).toBe(0);
    expect(days[0].getDay()).toBe(1);
    expect(days[days.length - 1].getDay()).toBe(0);
    expect(days.some((d) => dayKey(d) === "2026-09-01")).toBe(true);
    expect(days.some((d) => dayKey(d) === "2026-09-30")).toBe(true);
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
    const parsed = parseMonth("n'importe-quoi");
    expect(parsed.getDate()).toBe(1);
    expect(parseMonth("2026-02").getMonth()).toBe(1);
  });
});
