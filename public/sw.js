/* ImmoControl Service Worker v2 — Enhanced PWA offline support */
const CACHE_NAME = "immocontrol-v2-cache-v2";
const PRECACHE_URLS = [
  "/",
  "/index.html",
  "/manifest.json",
  "/favicon.ico",
];

/* OFFLINE-2: Offline fallback page content */
const OFFLINE_HTML = '<!DOCTYPE html><html lang="de"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>ImmoControl - Offline</title><style>body{font-family:system-ui,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;background:#0a0a0a;color:#e5e5e5}.c{text-align:center;padding:2rem}h1{font-size:1.5rem}p{color:#a1a1aa;font-size:.875rem}button{margin-top:1rem;padding:.5rem 1.5rem;border-radius:.5rem;border:1px solid #333;background:#1a1a2e;color:#e5e5e5;cursor:pointer}</style></head><body><div class="c"><h1>Keine Internetverbindung</h1><p>ImmoControl ist offline. Daten sind lokal gespeichert.</p><button onclick="location.reload()">Erneut versuchen</button></div></body></html>';

/* Install — precache essential assets + offline page. Do not skipWaiting here so the client can show "Update now / Later" and trigger skipWaiting on user choice. */
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      await cache.addAll(PRECACHE_URLS);
      await cache.put(
        new Request("/_offline"),
        new Response(OFFLINE_HTML, { headers: { "Content-Type": "text/html;charset=utf-8" } })
      );
    })
  );
});

/* When the user clicks "Jetzt aktualisieren", the client posts SKIP_WAITING so we activate and the page can reload. */
self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") self.skipWaiting();
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

/* NOTIFY-2: Push notification handler */
self.addEventListener("push", (event) => {
  if (!event.data) return;
  try {
    const data = event.data.json();
    event.waitUntil(
      self.registration.showNotification(data.title || "ImmoControl", {
        body: data.body || "",
        icon: "/favicon.ico",
        badge: "/favicon.ico",
        tag: data.tag || "immo-notification",
        data: { url: data.url || "/" },
      })
    );
  } catch (_e) {
    /* Silently fail for malformed push data */
  }
});

/* Handle notification click — open the app */
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url || "/";
  event.waitUntil(
    self.clients.matchAll({ type: "window" }).then((clients) => {
      for (const client of clients) {
        if (client.url.includes(self.location.origin) && "focus" in client) {
          client.navigate(url);
          return client.focus();
        }
      }
      return self.clients.openWindow(url);
    })
  );
});

/* Fetch — network-first with cache fallback for navigation, stale-while-revalidate for assets */
self.addEventListener("fetch", (event) => {
  const { request } = event;
  /* Skip non-GET requests and Supabase API calls */
  if (request.method !== "GET") return;
  if (request.url.includes("supabase.co") || request.url.includes("supabase.in")) return;

  /* Version-Check immer frisch vom Netz (kein Cache), damit Update-Banner zuverlässig erkennt */
  if (request.url.includes("/version.json")) {
    event.respondWith(fetch(request));
    return;
  }

  if (request.mode === "navigate") {
    /* Navigation requests — network first, fallback to cached index.html, then offline page */
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          }
          return response;
        })
        .catch(() =>
          caches.match("/index.html").then((cached) => cached || caches.match("/_offline"))
        )
    );
  } else if (request.url.match(/\.(js|css|png|jpg|svg|ico|woff2?|webp|avif)$/)) {
    /* Static assets — stale-while-revalidate */
    event.respondWith(
      caches.match(request).then((cached) => {
        const updatePromise = fetch(request)
          .then((response) => {
            if (response.ok) {
              const clone = response.clone();
              caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
            }
            return response;
          })
          .catch(() => undefined);

        if (cached) {
          void updatePromise;
          return cached;
        }

        return updatePromise.then((response) => response || Response.error());
      })
    );
  } else if (request.url.match(/\.(json|xml|txt)$/) && !request.url.includes("version.json")) {
    /* Data files — network first with cache fallback */
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          }
          return response;
        })
        .catch(() => caches.match(request))
    );
  }
});

/* OFFLINE-3: Background sync — replay pending mutations when back online */
self.addEventListener("sync", (event) => {
  if (event.tag === "immo-sync-pending") {
    event.waitUntil(
      self.clients.matchAll().then((clients) => {
        clients.forEach((client) => {
          client.postMessage({ type: "SYNC_PENDING_MUTATIONS" });
        });
      })
    );
  }
});
