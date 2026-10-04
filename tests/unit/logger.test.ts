import { describe, expect, it } from "vitest";
import { sanitizeError } from "@/lib/logger";

describe("sanitizeError", () => {
  it("ne garde que la première ligne du message (pas de requête SQL ni de données)", () => {
    const error = new Error("Invalid `prisma.attendance.create()` invocation:\n\n  data: { email: \"x@y.ci\" }");
    const out = sanitizeError(error);
    expect(out.error).toBe("Invalid `prisma.attendance.create()` invocation:");
    expect(JSON.stringify(out)).not.toContain("x@y.ci");
    expect(out.errorName).toBe("Error");
  });

  it("borne la longueur du message et la pile, conserve le code", () => {
    const error = Object.assign(new Error("a".repeat(1000)), { code: "P2002" });
    error.stack = ["Error: x", ...Array.from({ length: 20 }, (_, i) => `    at frame${i} (file.ts:1:1)`)].join("\n");
    const out = sanitizeError(error);
    expect(out.error).toHaveLength(300);
    expect(out.code).toBe("P2002");
    expect(out.stack?.split("\n")).toHaveLength(8);
  });
});
