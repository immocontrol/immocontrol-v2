/**
 * FUND-5: Unified error handling — replaces empty catch {} blocks with
 * contextual error tracking and user-friendly toasts.
 * In DEV, toast offers "Copy for AI" so the error report can be pasted into Cursor/Lovable etc.
 */
import { trackError, copyErrorReportToClipboard } from "@/lib/errorTracking";
import { toast } from "sonner";

type ErrorContext =
  | "supabase"
  | "auth"
  | "network"
  | "validation"
  | "file"
  | "export"
  | "import"
  | "ai"
  | "general";

interface HandleErrorOptions {
  /** Context where the error occurred */
  context?: ErrorContext;
  /** Show a toast to the user (default: true) */
  showToast?: boolean;
  /** Custom toast message (overrides auto-generated) */
  toastMessage?: string;
  /** Silent mode — track but don't show toast */
  silent?: boolean;
  /** Additional details for logging */
  details?: string;
}

/* UX-9: Nutzerverständliche Fehlermeldungen mit Handlungsempfehlung */
const CONTEXT_MESSAGES: Record<ErrorContext, string> = {
  supabase: "Verbindung zur Datenbank fehlgeschlagen. Bitte erneut versuchen.",
  auth: "Anmeldung fehlgeschlagen. Bitte erneut anmelden.",
  network: "Verbindung unterbrochen. Bitte prüfen Sie Ihr Netzwerk und versuchen Sie es erneut.",
  validation: "Eingabe ungültig. Bitte prüfen Sie die Felder.",
  file: "Datei konnte nicht verarbeitet werden. Format oder Größe prüfen.",
  export: "Export fehlgeschlagen. Bitte erneut versuchen.",
  import: "Import fehlgeschlagen. Bitte Datei prüfen und erneut versuchen.",
  ai: "KI-Funktion vorübergehend nicht verfügbar. Bitte später erneut versuchen.",
  general: "Ein Fehler ist aufgetreten. Bitte erneut versuchen.",
};

/** Map known API/network error patterns to short, actionable German messages */
function getFriendlyMessage(err: Error, context: ErrorContext): string | null {
  const msg = (err.message || "").toLowerCase();
  if (msg.includes("failed to fetch") || msg.includes("network") || msg.includes("load failed"))
    return "Verbindung unterbrochen. Bitte Internet prüfen und erneut versuchen.";
  if (msg.includes("jwt") || msg.includes("session") || msg.includes("unauthorized"))
    return "Sitzung abgelaufen. Bitte erneut anmelden.";
  if (msg.includes("not found") || msg.includes("pgrst116") || msg.includes("404"))
    return "Eintrag nicht gefunden. Seite ggf. neu laden.";
  if (msg.includes("conflict") || msg.includes("unique") || msg.includes("duplicate"))
    return "Eintrag existiert bereits oder wurde gerade geändert. Bitte neu laden.";
  if (msg.includes("permission") || msg.includes("forbidden") || msg.includes("403"))
    return "Keine Berechtigung für diese Aktion.";
  if (msg.includes("payload") || msg.includes("too large"))
    return "Datenmenge zu groß. Bitte verkleinern und erneut versuchen.";
  return null;
}

/**
 * Unified error handler — logs to error tracking and optionally shows a toast.
 * Use this instead of empty catch {} blocks.
 *
 * @example
 * ```ts
 * try { await supabase.from("properties").select("*"); }
 * catch (err) { handleError(err, { context: "supabase" }); }
 * ```
 */
export function handleError(error: unknown, options: HandleErrorOptions = {}): void {
  const { context = "general", showToast = true, toastMessage, silent = false, details } = options;

  // Normalize to Error object
  const err =
    error instanceof Error
      ? error
      : new Error(typeof error === "string" ? error : "Unknown error");

  // Build detail string for tracking
  const trackingDetails = [
    `context: ${context}`,
    details ? `details: ${details}` : null,
  ]
    .filter(Boolean)
    .join(", ");

  // Track the error and get entry for "Copy for AI"
  const entry = trackError(err, "manual", trackingDetails);

  // Show toast unless silent
  if (showToast && !silent) {
    const message =
      toastMessage ||
      getFriendlyMessage(err, context) ||
      CONTEXT_MESSAGES[context];
    toast.error(message, {
      description: import.meta.env.DEV ? err.message : undefined,
      duration: 6000,
      action:
        import.meta.env.DEV
          ? {
              label: "Copy for AI",
              onClick: () => {
                copyErrorReportToClipboard(entry).then((ok) =>
                  ok ? toast.success("Fehlerbericht in Zwischenablage – in Cursor/Lovable einfügen") : toast.error("Kopieren fehlgeschlagen"),
                );
              },
            }
          : undefined,
    });
  }
}

/**
 * Wrap an async function with error handling.
 * Returns the result or null on error.
 *
 * @example
 * ```ts
 * const data = await safeAsync(() => fetchData(), { context: "supabase" });
 * if (!data) return; // error already handled
 * ```
 */
export async function safeAsync<T>(
  fn: () => Promise<T>,
  options: HandleErrorOptions = {},
): Promise<T | null> {
  try {
    return await fn();
  } catch (error) {
    handleError(error, options);
    return null;
  }
}
