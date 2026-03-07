/**
 * UX-10: Einheitliche Erfolgs-Toasts — gleiche Dauer und klare Formulierung.
 * Nutzen: Klares, nicht störendes Feedback auf Handy und Browser.
 */
import { toast } from "sonner";

export const TOAST_DURATION_SUCCESS = 4000;
export const TOAST_DURATION_ERROR = 5000;

export function toastSuccess(message: string, duration = TOAST_DURATION_SUCCESS) {
  toast.success(message, { duration });
}

export function toastError(message: string, duration = TOAST_DURATION_ERROR) {
  toast.error(message, { duration });
}

/**
 * Fehler-Toast mit optionaler „Erneut versuchen“-Aktion.
 * Hoher Impact: Nutzer können nach Fehlern sofort erneut versuchen.
 */
export function toastErrorWithRetry(
  message: string,
  onRetry: () => void,
  duration = TOAST_DURATION_ERROR,
) {
  toast.error(message, {
    duration,
    action: {
      label: "Erneut versuchen",
      onClick: onRetry,
    },
  });
}

/** Kurze Bestätigung nach Speichern (z. B. "Objekt gespeichert", "Einstellung gespeichert") */
export function toastSaved(label?: string) {
  toastSuccess(label ? `${label} gespeichert` : "Gespeichert");
}
