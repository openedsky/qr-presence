import { describe, expect, it } from "vitest";
import { formatPhoneDisplay, isValidPhone, normalizePhone } from "../../src/lib/phone";

describe("normalizePhone", () => {
  it("normalise un numéro ivoirien local", () => {
    expect(normalizePhone("07 00 00 00 01")).toBe("225700000001");
  });

  it("accepte le format international", () => {
    expect(normalizePhone("+2250700000001")).toBe("2250700000001");
  });

  it("rejette une valeur vide", () => {
    expect(normalizePhone("")).toBeNull();
    expect(isValidPhone("12")).toBe(false);
  });

  it("formate l'affichage", () => {
    expect(formatPhoneDisplay("0700000001")).toContain("+225");
  });
});
