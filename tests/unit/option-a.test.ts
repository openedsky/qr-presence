import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { issueCheckinSession, verifyCheckinSession, CHECKIN_SESSION_SECONDS } from "../../src/lib/checkin-session";
import { clientIp, deviceId } from "../../src/lib/rate-limit";
import { registrationWindow, selfRegistrationState, windowState } from "../../src/lib/meeting-status";

beforeAll(() => {
  process.env.AUTH_SECRET = "test-secret-for-unit-tests-only-32chars";
});

afterEach(() => {
  vi.useRealTimers();
  delete process.env.TRUSTED_PROXY_HOPS;
});

describe("session d'émargement (QR dynamique)", () => {
  it("reste valable après l'expiration du jeton QR, pendant la durée de saisie", () => {
    vi.useFakeTimers();
    const session = issueCheckinSession("meeting-1", "qr-1");
    vi.advanceTimersByTime(10 * 60 * 1000);
    expect(verifyCheckinSession(session, "meeting-1")?.q).toBe("qr-1");
  });

  it("expire au-delà de la durée prévue", () => {
    vi.useFakeTimers();
    const session = issueCheckinSession("meeting-1", "qr-1");
    vi.advanceTimersByTime((CHECKIN_SESSION_SECONDS + 5) * 1000);
    expect(verifyCheckinSession(session, "meeting-1")).toBeNull();
  });

  it("est liée à la réunion et infalsifiable", () => {
    const session = issueCheckinSession("meeting-1", "qr-1");
    expect(verifyCheckinSession(session, "meeting-2")).toBeNull();
    const [body] = session.split(".");
    expect(verifyCheckinSession(`${body}.forged`, "meeting-1")).toBeNull();
    expect(verifyCheckinSession(undefined, "meeting-1")).toBeNull();
  });
});

describe("adresse IP du client", () => {
  const request = (xff: string) => new Request("http://x", { headers: { "x-forwarded-for": xff } });

  it("ignore l'adresse forgée par le client et retient celle ajoutée par le proxy", () => {
    expect(clientIp(request("6.6.6.6, 41.66.10.20"))).toBe("41.66.10.20");
  });

  it("tient compte du nombre de proxys de confiance", () => {
    process.env.TRUSTED_PROXY_HOPS = "2";
    expect(clientIp(request("6.6.6.6, 41.66.10.20, 10.0.0.2"))).toBe("41.66.10.20");
  });

  it("n'accepte qu'un identifiant d'appareil bien formé", () => {
    const withDevice = (value: string) => new Request("http://x", { headers: { "x-device-id": value } });
    expect(deviceId(withDevice("a1b2c3d4e5f6a7b8c9d0"))).toBe("a1b2c3d4e5f6a7b8c9d0");
    expect(deviceId(withDevice("<script>"))).toBeNull();
  });
});

describe("fenêtre d'émargement", () => {
  const meeting = {
    startsAt: new Date("2026-09-21T14:30:00Z"),
    endsAt: new Date("2026-09-21T17:30:00Z"),
    registrationOpensAt: null,
    registrationClosesAt: null,
    toleranceMinutes: 15,
  };

  it("s'ouvre avant le début et se ferme après la fin, tolérance comprise", () => {
    const { opensAt, closesAt } = registrationWindow(meeting);
    expect(opensAt.toISOString()).toBe("2026-09-21T14:15:00.000Z");
    expect(closesAt?.toISOString()).toBe("2026-09-21T17:45:00.000Z");
  });

  it("distingue avant, pendant et après", () => {
    expect(windowState(meeting, new Date("2026-09-21T13:00:00Z"))).toBe("before");
    expect(windowState(meeting, new Date("2026-09-21T15:00:00Z"))).toBe("open");
    expect(windowState(meeting, new Date("2026-09-21T18:00:00Z"))).toBe("after");
  });

  it("sans heure de fin, se ferme 12 h après le début", () => {
    const openEnded = { ...meeting, endsAt: null };
    expect(registrationWindow(openEnded).closesAt.toISOString()).toBe("2026-09-22T02:30:00.000Z");
    expect(windowState(openEnded, new Date("2026-09-21T20:00:00Z"))).toBe("open");
    expect(windowState(openEnded, new Date("2026-09-25T10:00:00Z"))).toBe("after");
  });
});

describe("émargement libre-service", () => {
  const meeting = {
    startsAt: new Date("2026-09-21T14:30:00Z"),
    endsAt: new Date("2026-09-21T17:30:00Z"),
    registrationOpensAt: null,
    registrationClosesAt: null,
    toleranceMinutes: 15,
  };
  const during = new Date("2026-09-21T15:00:00Z");

  it("exige à la fois le statut ouvert et la fenêtre horaire", () => {
    expect(selfRegistrationState({ ...meeting, status: "OUVERTE" }, during)).toBe("open");
    expect(selfRegistrationState({ ...meeting, status: "EN_COURS" }, during)).toBe("open");
    expect(selfRegistrationState({ ...meeting, status: "PLANIFIEE" }, during)).toBe("not_open");
    expect(selfRegistrationState({ ...meeting, status: "CLOTUREE" }, during)).toBe("closed");
    expect(selfRegistrationState({ ...meeting, status: "OUVERTE" }, new Date("2026-09-21T10:00:00Z"))).toBe("before");
    expect(selfRegistrationState({ ...meeting, status: "OUVERTE" }, new Date("2026-09-21T20:00:00Z"))).toBe("after");
  });
});
