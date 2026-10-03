const CACHE = "sodefor-presences-v4";
const SHELL = ["/manifest.json", "/icon.svg"];
/** Fichiers de build conservés au plus (les anciennes versions s'accumuleraient à chaque déploiement). */
const MAX_ENTRIES = 120;

const OFFLINE_PAGE = `<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Hors connexion</title></head>
<body style="font-family:system-ui,sans-serif;max-width:28rem;margin:4rem auto;padding:0 1.5rem;color:#14281d">
<h1 style="font-size:1.4rem">Pas de connexion</h1>
<p>L'émargement nécessite une connexion à Internet. Vérifiez le Wi-Fi ou les données mobiles, puis rechargez la page.</p>
<button onclick="location.reload()" style="padding:.6rem 1.2rem;border-radius:.75rem;border:0;background:#14532d;color:#fff;font-size:1rem">Réessayer</button>
</body></html>`;

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(SHELL)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

async function trim(cache) {
  const keys = await cache.keys();
  await Promise.all(keys.slice(0, Math.max(0, keys.length - MAX_ENTRIES)).map((key) => cache.delete(key)));
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin || url.pathname.startsWith("/api/")) return;

  // Fichiers de build immuables : cache d'abord.
  if (url.pathname.startsWith("/_next/static/") || SHELL.includes(url.pathname)) {
    event.respondWith(
      caches.match(request).then(
        (cached) =>
          cached ||
          fetch(request).then((response) => {
            if (response.ok) {
              const copy = response.clone();
              caches.open(CACHE).then(async (cache) => {
                await cache.put(request, copy);
                await trim(cache);
              });
            }
            return response;
          }),
      ),
    );
    return;
  }

  // Pages : toujours le réseau, jamais mises en cache (elles portent des sessions d'émargement et des
  // données personnelles). Hors connexion, une page d'information neutre.
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).catch(
        () => new Response(OFFLINE_PAGE, { status: 503, headers: { "Content-Type": "text/html; charset=utf-8" } }),
      ),
    );
  }
});
