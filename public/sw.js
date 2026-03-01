/* ImmoControl Service Worker — PWA offline support */
const CACHE_NAME = "immocontrol-v2-cache-v1";
const PRECACHE_URLS = [
  "/",
  "/index.html",
  "/manifest.json",
  "/favicon.ico",
];

/* Install — precache essential assets */
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_URLS))
  );
  self.skipWaiting();
});

/* Activate — clean old caches */
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

/* Fetch — network-first with cache fallback for navigation, cache-first for assets */
self.addEventListener("fetch", (event) => {
  const { request } = event;
  /* Skip non-GET requests and Supabase API calls */
  if (request.method !== "GET") return;
  if (request.url.includes("supabase.co") || request.url.includes("supabase.in")) return;

  if (request.mode === "navigate") {
    /* Navigation requests — network first, fallback to cached index.html */
    event.respondWith(
      fetch(request).catch(() => caches.match("/index.html"))
    );
  } else if (request.url.match(/\.(js|css|png|jpg|svg|ico|woff2?)$/)) {
    /* Static assets — cache first, fallback to network */
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached;
        return fetch(request).then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          }
          return response;
        });
      })
    );
  }
});
