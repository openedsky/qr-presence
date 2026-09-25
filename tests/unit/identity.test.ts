import { describe, expect, it } from "vitest";
import { nameKey, normalizeEmail, toTitleFirstNames, toUpperLastName } from "../../src/lib/identity";

describe("identity", () => {
  it("normalise l'email", () => {
    expect(normalizeEmail("  A.Seri@SODEFOR.CI ")).toBe("a.seri@sodefor.ci");
  });

  it("produit une clé de doublon stable", () => {
    expect(nameKey("Séri", "Anselme")).toBe(nameKey("SERI", "anselme"));
  });

  it("met le nom en majuscules et le prénom en titre", () => {
    expect(toUpperLastName(" seri ")).toBe("SERI");
    expect(toTitleFirstNames("anselme jean")).toBe("Anselme Jean");
  });
});
