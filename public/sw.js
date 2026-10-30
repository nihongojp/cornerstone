/*
 * Nihon-Go service worker — Phase 1 of docs/mobile/README.md.
 *
 * Hand-written on purpose: no build plugin, so it works the same under
 * Turbopack and webpack and there is nothing to keep in step with Next
 * upgrades. It is registered by src/components/pwa/RegisterServiceWorker.tsx
 * in production builds only.
 *
 * What it does
 *   - Precaches the /offline page and the app icons at install.
 *   - /_next/static/* (content-hashed, immutable): cache-first.
 *   - Images, audio, video, fonts (any origin): stale-while-revalidate,
 *     capped so a learner who opens every lesson doesn't fill their phone.
 *   - Page navigations: network only, falling back to /offline when the
 *     network is down. Pages are per-learner and session-gated, so their
 *     HTML is deliberately never stored.
 *   - Everything under /api, /admin and the preview routes is left alone.
 *
 * What it does not do (yet)
 *   - Cache lesson content for offline play. That lands with the Capacitor
 *     shell (Phase 2), where the UI is bundled and content is fetched per
 *     section through a route handler.
 *   - Push. The handler stub is at the bottom; wiring needs VAPID keys and a
 *     subscription table, which is a Phase 2 item.
 *
 * Bump CACHE_VERSION whenever the precache list or the strategies change;
 * `activate` deletes every cache that doesn't carry the current version.
 */

const CACHE_VERSION = "nihongo-sw-v1";
const PRECACHE = `${CACHE_VERSION}-precache`;
const STATIC = `${CACHE_VERSION}-static`;
const MEDIA = `${CACHE_VERSION}-media`;
const MEDIA_MAX_ENTRIES = 200;

const OFFLINE_URL = "/offline";
const PRECACHE_URLS = [
  OFFLINE_URL,
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/manifest.webmanifest",
];

// Paths the worker must never intercept. Auth, Payload REST/GraphQL, Draft
// Mode toggles and the pronunciation proxy all live here.
const BYPASS_PREFIXES = ["/api/", "/admin", "/preview", "/exit-preview"];

const MEDIA_DESTINATIONS = new Set(["image", "audio", "video", "font"]);

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(PRECACHE)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => !key.startsWith(CACHE_VERSION))
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") self.skipWaiting();
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  const sameOrigin = url.origin === self.location.origin;

  if (sameOrigin && BYPASS_PREFIXES.some((p) => url.pathname.startsWith(p))) {
    return;
  }

  if (request.mode === "navigate") {
    event.respondWith(networkWithOfflineFallback(request));
    return;
  }

  if (sameOrigin && url.pathname.startsWith("/_next/static/")) {
    event.respondWith(cacheFirst(STATIC, request));
    return;
  }

  if (MEDIA_DESTINATIONS.has(request.destination)) {
    event.respondWith(staleWhileRevalidate(MEDIA, request, MEDIA_MAX_ENTRIES));
    return;
  }

  if (sameOrigin && PRECACHE_URLS.includes(url.pathname)) {
    event.respondWith(cacheFirst(PRECACHE, request));
  }
});

async function networkWithOfflineFallback(request) {
  try {
    return await fetch(request);
  } catch {
    const cache = await caches.open(PRECACHE);
    const offline = await cache.match(OFFLINE_URL);
    return (
      offline ||
      new Response("You are offline.", {
        status: 503,
        headers: { "Content-Type": "text/plain; charset=utf-8" },
      })
    );
  }
}

async function cacheFirst(cacheName, request) {
  const cache = await caches.open(cacheName);
  const hit = await cache.match(request);
  if (hit) return hit;
  const response = await fetch(request);
  if (response.ok) cache.put(request, response.clone());
  return response;
}

async function staleWhileRevalidate(cacheName, request, maxEntries) {
  const cache = await caches.open(cacheName);
  const hit = await cache.match(request);

  const refresh = fetch(request)
    .then(async (response) => {
      // Opaque (cross-origin, no CORS) responses have status 0; they still
      // play in <img>/<audio>, so keep them too.
      if (response.ok || response.type === "opaque") {
        await cache.put(request, response.clone());
        await trim(cache, maxEntries);
      }
      return response;
    })
    .catch(() => undefined);

  if (hit) return hit;
  const fresh = await refresh;
  return fresh || Response.error();
}

// Cache API has no LRU; evict the oldest inserted entries once over the cap.
async function trim(cache, maxEntries) {
  const keys = await cache.keys();
  if (keys.length <= maxEntries) return;
  await Promise.all(keys.slice(0, keys.length - maxEntries).map((k) => cache.delete(k)));
}

/*
 * Push — Phase 2. Left in place so the worker version doesn't need bumping
 * when the server side lands; until then no subscription exists and this
 * never fires.
 */
self.addEventListener("push", (event) => {
  if (!event.data) return;
  let data = {};
  try {
    data = event.data.json();
  } catch {
    data = { title: "Nihon-Go", body: event.data.text() };
  }
  event.waitUntil(
    self.registration.showNotification(data.title || "Nihon-Go", {
      body: data.body || "",
      icon: "/icons/icon-192.png",
      badge: "/icons/icon-192.png",
      data: { url: data.url || "/dashboard" },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = (event.notification.data && event.notification.data.url) || "/dashboard";
  event.waitUntil(self.clients.openWindow(target));
});
