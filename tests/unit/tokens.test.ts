import { describe, expect, it } from "vitest";
import { generatePublicToken, hashToken, safeEqual, tokenHint } from "../../src/lib/tokens";

describe("tokens", () => {
  it("génère un jeton long non prédictible", () => {
    const token = generatePublicToken();
    expect(token.length).toBeGreaterThan(32);
    expect(token).not.toBe(generatePublicToken());
  });

  it("hashe de façon déterministe", () => {
    expect(hashToken("abc")).toBe(hashToken("abc"));
    expect(hashToken("abc")).not.toBe(hashToken("abd"));
  });

  it("compare en temps constant", () => {
    expect(safeEqual("same", "same")).toBe(true);
    expect(safeEqual("same", "diff")).toBe(false);
    expect(tokenHint("abcdef")).toBe("abcdef");
  });
});
