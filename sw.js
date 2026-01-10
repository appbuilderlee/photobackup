/* PHOTO BACKUP PRO - Service Worker (offline-first) */

const CACHE_NAME = "photobackup-cache-v1";

// Only precache same-origin assets (GitHub Pages path-safe).
const PRECACHE_URLS = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./icons/favicon-32.png",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/icon-512-maskable.png",
  "./icons/apple-touch-icon.png",
  "./icons/icon.svg",
  "./icons/icon-maskable.svg",
];

self.addEventListener("install", (event) => {
  self.skipWaiting();
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE_NAME);
      await cache.addAll(PRECACHE_URLS.map((u) => new Request(u, { cache: "reload" })));
    })()
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)));
      await self.clients.claim();
    })()
  );
});

const isHtmlNavigation = (request) =>
  request.mode === "navigate" ||
  (request.headers.get("accept") || "").includes("text/html");

// Network-first for navigations so updates propagate, cache fallback for offline.
async function handleNavigation(request) {
  const cache = await caches.open(CACHE_NAME);
  try {
    const fresh = await fetch(request);
    // Cache a copy of the app shell.
    cache.put(request, fresh.clone());
    return fresh;
  } catch {
    return (await cache.match(request)) || (await cache.match("./index.html"));
  }
}

// Stale-while-revalidate for other GETs.
async function handleAsset(request) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(request);
  const fetchPromise = fetch(request)
    .then((resp) => {
      // Cache same-origin and opaque/cors responses (best-effort).
      if (resp && (resp.ok || resp.type === "opaque")) {
        cache.put(request, resp.clone()).catch(() => {});
      }
      return resp;
    })
    .catch(() => undefined);

  return cached || (await fetchPromise) || new Response("Offline", { status: 503 });
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  if (isHtmlNavigation(request)) {
    event.respondWith(handleNavigation(request));
    return;
  }

  event.respondWith(handleAsset(request));
});

