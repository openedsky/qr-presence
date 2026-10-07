import { beforeAll, describe, expect, it } from "vitest";
import { PROFILE_MAX_AGE_SECONDS, openProfile, sealProfile } from "@/lib/participant-profile";

const profile = {
  civility: "MME" as const,
  lastName: "KOUASSI",
  firstNames: "Aya Marie",
  jobTitle: "Ingénieure forestière",
  organization: "SODEFOR",
  email: "aya.kouassi@example.ci",
  phone: "0700000000",
};

describe("profil participant mémorisé", () => {
  beforeAll(() => {
    process.env.AUTH_SECRET = "test-secret-0123456789-abcdefghijklmnop";
  });

  it("se relit tel quel", () => {
    expect(openProfile(sealProfile(profile))).toEqual(profile);
  });

  it("n'est pas lisible en clair dans le cookie", () => {
    const sealed = sealProfile(profile);
    expect(sealed).not.toContain("KOUASSI");
    expect(Buffer.from(sealed.split(".")[2], "base64url").toString("utf8")).not.toContain("KOUASSI");
  });

  it("rejette un cookie altéré", () => {
    const [v, iv, data, tag] = sealProfile(profile).split(".");
    const flipped = Buffer.from(data, "base64url");
    flipped[0] ^= 1;
    expect(openProfile([v, iv, flipped.toString("base64url"), tag].join("."))).toBeNull();
    expect(openProfile("v1.a.b.c")).toBeNull();
    expect(openProfile("")).toBeNull();
  });

  it("expire après la durée de conservation", () => {
    const now = Date.now();
    const sealed = sealProfile(profile, now);
    expect(openProfile(sealed, now + (PROFILE_MAX_AGE_SECONDS - 60) * 1000)).not.toBeNull();
    expect(openProfile(sealed, now + (PROFILE_MAX_AGE_SECONDS + 60) * 1000)).toBeNull();
  });

  it("devient illisible si le secret change", () => {
    const sealed = sealProfile(profile);
    process.env.AUTH_SECRET = "another-secret-0123456789-abcdefghijklm";
    expect(openProfile(sealed)).toBeNull();
    process.env.AUTH_SECRET = "test-secret-0123456789-abcdefghijklmnop";
  });
});
