import Redis from "ioredis";

const globalForRedis = globalThis as unknown as { redis?: Redis | null };

function createClient() {
  const url = process.env.REDIS_URL;
  if (!url) return null;
  try {
    return new Redis(url, {
      maxRetriesPerRequest: 2,
      enableReadyCheck: false,
      lazyConnect: true,
    });
  } catch {
    return null;
  }
}

export function getRedis() {
  if (globalForRedis.redis !== undefined) return globalForRedis.redis;
  globalForRedis.redis = createClient();
  return globalForRedis.redis;
}

const memory = new Map<string, { value: string; expiresAt: number }>();

export async function cacheGet(key: string) {
  const redis = getRedis();
  if (redis) {
    try {
      if (redis.status === "wait") await redis.connect();
      return await redis.get(key);
    } catch {
      // fallback mémoire
    }
  }
  const hit = memory.get(key);
  if (!hit) return null;
  if (hit.expiresAt < Date.now()) {
    memory.delete(key);
    return null;
  }
  return hit.value;
}

export async function cacheSet(key: string, value: string, ttlSeconds: number) {
  const redis = getRedis();
  if (redis) {
    try {
      if (redis.status === "wait") await redis.connect();
      await redis.set(key, value, "EX", ttlSeconds);
      return;
    } catch {
      // fallback
    }
  }
  memory.set(key, { value, expiresAt: Date.now() + ttlSeconds * 1000 });
}

export async function cacheIncr(key: string, ttlSeconds: number) {
  const redis = getRedis();
  if (redis) {
    try {
      if (redis.status === "wait") await redis.connect();
      const count = await redis.incr(key);
      if (count === 1) await redis.expire(key, ttlSeconds);
      return count;
    } catch {
      // fallback
    }
  }
  const current = Number((await cacheGet(key)) ?? "0") + 1;
  await cacheSet(key, String(current), ttlSeconds);
  return current;
}
