import { randomUUID } from "crypto";
import Redis from "ioredis";
import { getRedis, redisOptions } from "./redis";
import { logger } from "./logger";

type Listener = (payload: unknown) => void;

const BUS = "sodefor:realtime";

const globalForRealtime = globalThis as unknown as {
  sodeforRealtime?: { channels: Map<string, Set<Listener>>; origin: string; subscriber: Redis | null | undefined };
};
const state = (globalForRealtime.sodeforRealtime ??= { channels: new Map(), origin: randomUUID(), subscriber: undefined });

function deliver(channel: string, payload: unknown) {
  const set = state.channels.get(channel);
  if (!set) return;
  for (const listener of set) {
    // Un flux fermé côté navigateur ne doit ni interrompre les autres, ni faire échouer l'appelant.
    try {
      listener(payload);
    } catch {
      set.delete(listener);
    }
  }
}

/** Avec plusieurs instances, les événements transitent par Redis : chaque flux SSE reçoit tous les émargements. */
function ensureSubscriber() {
  if (state.subscriber !== undefined) return;
  const url = process.env.REDIS_URL;
  if (!url) {
    state.subscriber = null;
    return;
  }
  const subscriber = new Redis(url, { ...redisOptions(), lazyConnect: false, commandTimeout: undefined });
  subscriber.on("error", () => undefined);
  subscriber.on("message", (_bus: string, raw: string) => {
    try {
      const message = JSON.parse(raw) as { origin: string; channel: string; payload: unknown };
      if (message.origin !== state.origin) deliver(message.channel, message.payload);
    } catch {
      // message illisible : ignoré
    }
  });
  subscriber.subscribe(BUS).catch((error) => logger.warn("realtime.subscribe_failed", { error: String(error) }));
  state.subscriber = subscriber;
}

export function subscribe(channel: string, listener: Listener) {
  ensureSubscriber();
  const set = state.channels.get(channel) ?? new Set<Listener>();
  set.add(listener);
  state.channels.set(channel, set);
  return () => {
    set.delete(listener);
    if (set.size === 0) state.channels.delete(channel);
  };
}

export function publish(channel: string, payload: unknown) {
  deliver(channel, payload);
  const redis = getRedis();
  if (!redis) return;
  const message = JSON.stringify({ origin: state.origin, channel, payload });
  void (async () => {
    if (redis.status === "wait") await redis.connect();
    await redis.publish(BUS, message);
  })().catch(() => undefined);
}

export function meetingChannel(meetingId: string) {
  return `meeting:${meetingId}`;
}
