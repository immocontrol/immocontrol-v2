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

export function unregisterServiceWorker() {
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.ready.then((registration) => {
      registration.unregister();
    });
  }
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
 * Clear all caches managed by the service worker
 */
export async function clearServiceWorkerCaches() {
  const cacheNames = await caches.keys();
  await Promise.all(
    cacheNames
      .filter((name) => name.startsWith("immocontrol-"))
      .map((name) => caches.delete(name))
  );
}
