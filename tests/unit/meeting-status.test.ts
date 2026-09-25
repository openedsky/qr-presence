import { describe, expect, it } from "vitest";
import { MeetingStatus } from "@prisma/client";
import { canTransition, isFrozen, isRegistrationOpen } from "../../src/lib/meeting-status";

describe("cycle de vie réunion", () => {
  it("autorise le parcours métier", () => {
    expect(canTransition(MeetingStatus.BROUILLON, MeetingStatus.PLANIFIEE)).toBe(true);
    expect(canTransition(MeetingStatus.PLANIFIEE, MeetingStatus.OUVERTE)).toBe(true);
    expect(canTransition(MeetingStatus.OUVERTE, MeetingStatus.CLOTUREE)).toBe(true);
    expect(canTransition(MeetingStatus.CLOTUREE, MeetingStatus.OUVERTE)).toBe(true);
    expect(canTransition(MeetingStatus.ARCHIVEE, MeetingStatus.OUVERTE)).toBe(false);
  });

  it("ouvre et gèle correctement", () => {
    expect(isRegistrationOpen(MeetingStatus.OUVERTE)).toBe(true);
    expect(isRegistrationOpen(MeetingStatus.EN_COURS)).toBe(true);
    expect(isFrozen(MeetingStatus.CLOTUREE)).toBe(true);
  });
});
