import { describe, expect, it } from "vitest";
import { customRangeError, periodBuckets, resolveDashboardPeriod } from "@/lib/dashboard-period";

const now = new Date("2026-10-04T11:00:00Z");

describe("resolveDashboardPeriod", () => {
  it("défaut : 30 derniers jours, aujourd'hui inclus, par jour", () => {
    const period = resolveDashboardPeriod({}, now);
    expect(period.key).toBe("30d");
    expect(period.fromInput).toBe("2026-09-05");
    expect(period.toInput).toBe("2026-10-04");
    expect(period.to.toISOString()).toBe("2026-10-05T00:00:00.000Z");
    expect(period.bucket).toBe("day");
    expect(periodBuckets(period)).toHaveLength(30);
  });

  it("aujourd'hui et ce mois", () => {
    expect(resolveDashboardPeriod({ p: "today" }, now).fromInput).toBe("2026-10-04");
    expect(resolveDashboardPeriod({ p: "month" }, now).fromInput).toBe("2026-10-01");
  });

  it("12 mois : histogramme mensuel", () => {
    const period = resolveDashboardPeriod({ p: "365d" }, now);
    expect(period.bucket).toBe("month");
    const buckets = periodBuckets(period);
    expect(buckets[0]).toBe("2025-10");
    expect(buckets.at(-1)).toBe("2026-10");
  });

  it("période personnalisée : bornes inversées remises dans l'ordre", () => {
    const period = resolveDashboardPeriod({ p: "custom", from: "2026-03-31", to: "2026-03-01" }, now);
    expect(period.key).toBe("custom");
    expect(period.fromInput).toBe("2026-03-01");
    expect(period.toInput).toBe("2026-03-31");
    expect(periodBuckets(period)).toHaveLength(31);
  });

  it("période personnalisée invalide : retour au défaut", () => {
    expect(resolveDashboardPeriod({ p: "custom", from: "2026-02-30", to: "2026-03-01" }, now).key).toBe("30d");
    expect(resolveDashboardPeriod({ p: "inconnu" }, now).key).toBe("30d");
    expect(resolveDashboardPeriod({ p: "custom", from: "0001-01-01", to: "2026-03-01" }, now).key).toBe("30d");
  });
});

describe("customRangeError", () => {
  it("accepte une plage valide", () => {
    expect(customRangeError("2026-01-01", "2026-03-31", now)).toBeNull();
  });

  it("refuse les saisies incomplètes, invalides, inversées ou trop longues", () => {
    expect(customRangeError("", "2026-03-31", now)).toMatch(/deux dates/);
    expect(customRangeError("1999-12-31", "2026-03-31", now)).toMatch(/invalide/);
    expect(customRangeError("2026-01-01", "2028-01-01", now)).toMatch(/invalide/);
    expect(customRangeError("2026-03-31", "2026-01-01", now)).toMatch(/précéder/);
    expect(customRangeError("2020-01-01", "2026-03-31", now)).toMatch(/5 ans/);
  });
});
