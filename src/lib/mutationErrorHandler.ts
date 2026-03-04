/** TECH-7: Central Supabase Mutation Error Handler
 * Provides consistent error handling for all mutations across the app.
 * Maps Supabase error codes to user-friendly German messages and logs to error tracking. */
import { toast } from "sonner";
import { logger } from "@/lib/logger";

/** Known Supabase/PostgreSQL error codes mapped to German messages */
const ERROR_MESSAGES: Record<string, string> = {
  "23505": "Dieser Eintrag existiert bereits",
  "23503": "Verknüpfter Datensatz nicht gefunden",
  "23502": "Pflichtfeld fehlt",
  "42501": "Keine Berechtigung für diese Aktion",
  "PGRST301": "Nicht authentifiziert — bitte erneut anmelden",
  "PGRST204": "Kein Ergebnis gefunden",
  "57014": "Anfrage dauerte zu lange — bitte erneut versuchen",
};

interface MutationErrorOptions {
  /** Context label for error tracking (e.g. "Darlehen speichern") */
  context: string;
  /** Custom fallback message if no specific mapping exists */
  fallbackMessage?: string;
  /** If true, shows error as toast (default: true) */
  showToast?: boolean;
}

/** Extract a user-friendly error message from a Supabase/generic error */
export function getMutationErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    // Check for Supabase error code
    const supaErr = error as Error & { code?: string; details?: string; hint?: string };
    if (supaErr.code && ERROR_MESSAGES[supaErr.code]) {
      return ERROR_MESSAGES[supaErr.code];
    }
    // Network errors
    if (error.message.includes("Failed to fetch") || error.message.includes("NetworkError")) {
      return "Netzwerkfehler — bitte Internetverbindung prüfen";
    }
    if (error.message.includes("JWT expired") || error.message.includes("token")) {
      return "Sitzung abgelaufen — bitte erneut anmelden";
    }
    return error.message;
  }
  if (typeof error === "string") return error;
  return "Ein unbekannter Fehler ist aufgetreten";
}

/** Central mutation error handler — use in onError callbacks */
export function handleMutationError(error: unknown, options: MutationErrorOptions): void {
  const message = getMutationErrorMessage(error);
  const finalMessage = options.fallbackMessage
    ? `${options.fallbackMessage}: ${message}`
    : message;

  logger.error(`Mutation Error [${options.context}]: ${message}`, "MutationError");

  if (options.showToast !== false) {
    toast.error(finalMessage);
  }
}

/** Create a reusable onError handler for React Query mutations */
export function createMutationErrorHandler(context: string, fallbackMessage?: string) {
  return (error: unknown) => handleMutationError(error, { context, fallbackMessage });
}
