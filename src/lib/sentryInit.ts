/**
 * Optionale Sentry-Integration. Nur aktiv wenn VITE_SENTRY_DSN gesetzt ist.
 * Optional: npm install @sentry/react — dann wird bei Build automatisch eingebunden.
 * Setzt window.__immocontrol_reportError, damit errorTracking.ts Fehler dorthin sendet.
 */
import type { ErrorEntry } from "./errorTracking";

export function initSentryIfConfigured(): void {
  const dsn = import.meta.env.VITE_SENTRY_DSN;
  if (typeof dsn !== "string" || !dsn.trim()) return;

  // Dynamischer Import: nur laden wenn DSN gesetzt (Bundle enthält Sentry nur wenn Paket installiert)
  void import("@sentry/react")
    .then((Sentry) => {
      Sentry.init({
        dsn: dsn.trim(),
        environment: import.meta.env.MODE || "production",
      });
      if (typeof window !== "undefined") {
        (window as Window & { __immocontrol_reportError?: (entry: ErrorEntry) => void }).__immocontrol_reportError =
          (entry: ErrorEntry) => {
            Sentry.captureException(new Error(entry.message), {
              extra: { url: entry.url, type: entry.type },
            });
          };
      }
    })
    .catch(() => {
      /* @sentry/react nicht installiert — optional */
    });
}
