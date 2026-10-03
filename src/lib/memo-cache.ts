type Entry = { value: Promise<unknown>; expiresAt: number };

const globalForMemo = globalThis as unknown as { sodeforMemo?: Map<string, Entry> };
const store = (globalForMemo.sodeforMemo ??= new Map<string, Entry>());

/**
 * Cache mémoire court pour les données de configuration relues à chaque page (paramètres, modèles, structures).
 * Invalidé localement à l'enregistrement ; avec plusieurs instances, l'écart est borné par la durée de vie.
 */
export function memo<T>(key: string, ttlMs: number, load: () => Promise<T>): Promise<T> {
  const now = Date.now();
  const hit = store.get(key);
  if (hit && hit.expiresAt > now) return hit.value as Promise<T>;
  const value = load();
  if (store.size >= 500) {
    for (const [stale, entry] of store) if (entry.expiresAt <= now) store.delete(stale);
  }
  store.set(key, { value, expiresAt: now + ttlMs });
  // Une lecture en échec ne doit pas rester en cache.
  value.catch(() => {
    if (store.get(key)?.value === value) store.delete(key);
  });
  return value;
}

export function invalidateMemo(prefix: string) {
  for (const key of store.keys()) if (key.startsWith(prefix)) store.delete(key);
}
