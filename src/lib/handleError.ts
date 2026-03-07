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

const CONTEXT_MESSAGES: Record<ErrorContext, string> = {
  supabase: "Datenbankfehler",
  auth: "Authentifizierungsfehler",
  network: "Netzwerkfehler — bitte Verbindung prüfen",
  validation: "Validierungsfehler",
  file: "Dateifehler",
  export: "Export fehlgeschlagen",
  import: "Import fehlgeschlagen",
  general: "Ein Fehler ist aufgetreten",
};

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
    const message = toastMessage || CONTEXT_MESSAGES[context];
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
