import { afterEach, describe, expect, it, vi } from "vitest";
import { attendancePatchSchema, structurePatchSchema } from "../../src/lib/validators";
import { internalRef } from "../../src/lib/utils";
import { cacheIncr } from "../../src/lib/redis";

describe("modification d'une structure", () => {
  it("un renommage ne réactive pas une structure désactivée", () => {
    const parsed = structurePatchSchema.parse({ name: "Direction financière" });
    expect(parsed).toEqual({ name: "Direction financière" });
    expect("active" in parsed).toBe(false);
    expect("internal" in parsed).toBe(false);
  });

  it("une désactivation seule ne touche pas au nom", () => {
    expect(structurePatchSchema.parse({ active: false })).toEqual({ active: false });
  });
});

describe("référence interne", () => {
  it("6 caractères aléatoires sans ambiguïté", () => {
    const refs = new Set(Array.from({ length: 2000 }, () => internalRef()));
    for (const ref of refs) expect(ref).toMatch(/^REU-\d{4}-[2-9A-HJ-NP-Z]{6}$/);
    expect(refs.size).toBe(2000);
  });
});

describe("limiteur sans Redis", () => {
  afterEach(() => vi.useRealTimers());

  it("la fenêtre n'est pas prolongée par les tentatives suivantes", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T10:00:00Z"));
    const key = `test:${Math.random()}`;
    expect(await cacheIncr(key, 60)).toBe(1);
    vi.setSystemTime(new Date("2026-01-01T10:00:50Z"));
    expect(await cacheIncr(key, 60)).toBe(2);
    // Au-delà de 60 s après le premier passage, le compteur repart de 1 malgré le passage à 50 s.
    vi.setSystemTime(new Date("2026-01-01T10:01:01Z"));
    expect(await cacheIncr(key, 60)).toBe(1);
  });
});

describe("correction d'une présence", () => {
  it("accepte un email ou un téléphone vidé", () => {
    expect(attendancePatchSchema.safeParse({ email: "", phone: "" }).success).toBe(true);
  });

  it("refuse un téléphone invalide", () => {
    expect(attendancePatchSchema.safeParse({ phone: "abc" }).success).toBe(false);
  });
});
