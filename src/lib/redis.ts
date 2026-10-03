import Redis from "ioredis";

const globalForRedis = globalThis as unknown as { redis?: Redis | null };

/** Redis indisponible : chaque commande échoue vite et bascule sur le repli mémoire au lieu de bloquer la requête. */
export function redisOptions() {
  return {
    maxRetriesPerRequest: 1,
    enableReadyCheck: false,
    lazyConnect: true,
    connectTimeout: 2_000,
    commandTimeout: 1_500,
  };
}

function createClient() {
  const url = process.env.REDIS_URL;
  if (!url) return null;
  try {
    const client = new Redis(url, redisOptions());
    client.on("error", () => undefined);
    return client;
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

/** Pose la clé seulement si elle n'existe pas (SET NX) : true si cet appel l'a créée. */
export async function cacheSetNx(key: string, value: string, ttlSeconds: number) {
  const redis = getRedis();
  if (redis) {
    try {
      if (redis.status === "wait") await redis.connect();
      return (await redis.set(key, value, "EX", ttlSeconds, "NX")) === "OK";
    } catch {
      // fallback
    }
  }
  const hit = memory.get(key);
  if (hit && hit.expiresAt >= Date.now()) return false;
  memory.set(key, { value, expiresAt: Date.now() + ttlSeconds * 1000 });
  return true;
}

export async function cacheDel(key: string) {
  memory.delete(key);
  const redis = getRedis();
  if (!redis) return;
  try {
    if (redis.status === "wait") await redis.connect();
    await redis.del(key);
  } catch {
    // fallback mémoire déjà appliqué
  }
}

const DEL_IF_EQUALS = "if redis.call('get', KEYS[1]) == ARGV[1] then return redis.call('del', KEYS[1]) else return 0 end";

/** Libère un verrou seulement s'il appartient encore à l'appelant (il a pu expirer et être repris). */
export async function cacheDelIfEquals(key: string, value: string) {
  const hit = memory.get(key);
  if (hit?.value === value) memory.delete(key);
  const redis = getRedis();
  if (!redis) return;
  try {
    if (redis.status === "wait") await redis.connect();
    await redis.eval(DEL_IF_EQUALS, 1, key, value);
  } catch {
    // le verrou expirera de lui-même
  }
}

export async function cacheIncr(key: string, ttlSeconds: number) {
  const redis = getRedis();
  if (redis) {
    try {
      if (redis.status === "wait") await redis.connect();
      const [[, count]] = (await redis.multi().incr(key).expire(key, ttlSeconds, "NX").exec()) as [[unknown, number]];
      return count;
    } catch {
      // fallback
    }
  }
  // Fenêtre fixe : l'échéance est posée au premier passage et n'est pas repoussée par les suivants.
  const now = Date.now();
  sweepMemory(now);
  const hit = memory.get(key);
  if (!hit || hit.expiresAt < now) {
    memory.set(key, { value: "1", expiresAt: now + ttlSeconds * 1000 });
    return 1;
  }
  const count = Number(hit.value) + 1;
  hit.value = String(count);
  return count;
}

let lastSweep = 0;

/** Purge périodique des clés mémoire expirées jamais relues (le repli mémoire ne doit pas grossir sans fin). */
function sweepMemory(now: number) {
  if (now - lastSweep < 60_000) return;
  lastSweep = now;
  for (const [key, entry] of memory) if (entry.expiresAt < now) memory.delete(key);
}
