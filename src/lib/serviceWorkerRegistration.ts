/**
 * #17: API Response Caching with Service Worker — Offline PWA support.
 * Registers a service worker for caching API responses and static assets.
 * Uses Cache-First strategy for static assets and Network-First for API calls.
 */
import { logger } from "@/lib/logger";

const SW_URL = "/sw.js";

interface ServiceWorkerConfig {
  onSuccess?: (registration: ServiceWorkerRegistration) => void;
  onUpdate?: (registration: ServiceWorkerRegistration) => void;
}

export function registerServiceWorker(config?: ServiceWorkerConfig) {
  if (!("serviceWorker" in navigator)) return;

  window.addEventListener("load", async () => {
    try {
      const registration = await navigator.serviceWorker.register(SW_URL, {
        scope: "/",
      });

      registration.onupdatefound = () => {
        const installingWorker = registration.installing;
        if (!installingWorker) return;

        installingWorker.onstatechange = () => {
          if (installingWorker.state === "installed") {
            if (navigator.serviceWorker.controller) {
              // New content available — notify user
              config?.onUpdate?.(registration);
              logger.info("[SW] New content available; please refresh.");
            } else {
              // Content cached for offline use
              config?.onSuccess?.(registration);
              logger.info("[SW] Content cached for offline use.");
            }
          }
        };
      };
    } catch (error) {
      logger.error("[SW] Registration failed", "ServiceWorker", error);
    }
  });
}

export function unregisterServiceWorker(): Promise<void> {
  if (!("serviceWorker" in navigator)) return Promise.resolve();
  return navigator.serviceWorker.ready.then((registration) => registration.unregister());
}

/**
 * Request the service worker to cache specific URLs for offline access
 */
export function precacheUrls(urls: string[]) {
  if (!("serviceWorker" in navigator) || !navigator.serviceWorker.controller) return;
  navigator.serviceWorker.controller.postMessage({
    type: "PRECACHE",
    urls,
  });
}

/**
 * Clear all caches managed by the service worker (immocontrol-*)
 */
export async function clearServiceWorkerCaches() {
  const cacheNames = await caches.keys();
  await Promise.all(
    cacheNames
      .filter((name) => name.startsWith("immocontrol-"))
      .map((name) => caches.delete(name))
  );
}

const OFFLINE_DB_NAME = "immocontrol-offline";

/**
 * Umfassendes Cache-Leeren: Cache API (alle), IndexedDB Offline-DB, sessionStorage.
 * localStorage (Anmeldung) wird nicht gelöscht.
 */
export async function clearAllAppCaches(): Promise<{ caches: number; indexedDB: boolean; session: boolean }> {
  let cachesDeleted = 0;
  let indexedDBCleared = false;
  let sessionCleared = false;

  if ("caches" in window) {
    const names = await caches.keys();
    const results = await Promise.all(names.map((name) => caches.delete(name)));
    cachesDeleted = results.filter(Boolean).length;
  }

  if (typeof indexedDB !== "undefined") {
    try {
      await new Promise<void>((resolve, reject) => {
        const req = indexedDB.deleteDatabase(OFFLINE_DB_NAME);
        req.onsuccess = () => { indexedDBCleared = true; resolve(); };
        req.onerror = () => reject(req.error);
        req.onblocked = () => resolve();
      });
    } catch {
      /* ignore */
    }
  }

  try {
    sessionStorage.clear();
    sessionCleared = true;
  } catch {
    /* ignore */
  }

  return { caches: cachesDeleted, indexedDB: indexedDBCleared, session: sessionCleared };
}
