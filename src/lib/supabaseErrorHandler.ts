/**
 * Central Supabase Error Handler — unified error handling for all Supabase operations.
 * Improvement 8: Instead of checking .error manually everywhere, use this handler.
 */
import { toast } from "sonner";
import { logger } from "@/lib/logger";
import { toastNetworkError } from "@/lib/toastMessages";

export interface SupabaseResult<T> {
  data: T | null;
  error: { message: string; code?: string; details?: string } | null;
}

/** Known Supabase error codes and their user-friendly German messages */
const ERROR_MESSAGES: Record<string, string> = {
  "PGRST116": "Datensatz nicht gefunden",
  "23505": "Dieser Eintrag existiert bereits",
  "23503": "Referenzierter Datensatz existiert nicht",
  "42501": "Keine Berechtigung f\u00fcr diese Aktion",
  "42P01": "Tabelle nicht gefunden",
  "PGRST301": "Anfrage-Timeout \u2014 bitte erneut versuchen",
  "23502": "Pflichtfeld fehlt",
};

/** Parse a Supabase error into a user-friendly message */
function parseError(error: { message: string; code?: string; details?: string }): string {
  if (error.code && ERROR_MESSAGES[error.code]) {
    return ERROR_MESSAGES[error.code];
  }
  if (error.message.includes("JWT expired")) {
    return "Sitzung abgelaufen \u2014 bitte neu anmelden";
  }
  if (error.message.includes("Failed to fetch") || error.message.includes("NetworkError")) {
    return "Netzwerkfehler \u2014 bitte Internetverbindung pr\u00fcfen";
  }
  if (error.message.includes("duplicate key")) {
    return "Dieser Eintrag existiert bereits";
  }
  return error.message || "Ein unerwarteter Fehler ist aufgetreten";
}

/**
 * Handle a Supabase operation result.
 * Shows toast on error, logs to error tracking, returns data or null.
 */
export function handleSupabaseResult<T>(
  result: SupabaseResult<T>,
  context: string,
  options?: {
    /** Show toast on error (default: true) */
    showToast?: boolean;
    /** Custom success message */
    successMessage?: string;
    /** Show toast on success (default: false) */
    showSuccessToast?: boolean;
  },
): T | null {
  const { showToast = true, successMessage, showSuccessToast = false } = options || {};

  if (result.error) {
    const userMessage = parseError(result.error);
    logger.error(`Supabase error in ${context}`, context, {
      code: result.error.code,
      message: result.error.message,
      details: result.error.details,
    });
    if (showToast) {
      const isNetwork =
        result.error.message.includes("Failed to fetch") || result.error.message.includes("NetworkError");
      if (isNetwork) toastNetworkError();
      else toast.error(userMessage);
    }
    return null;
  }

  if (showSuccessToast && successMessage) {
    toast.success(successMessage);
  }

  return result.data;
}

/**
 * Wrap an async Supabase operation with error handling.
 * Usage: const data = await withSupabaseError(() => supabase.from('x').select(), 'loadX');
 */
export async function withSupabaseError<T>(
  operation: () => Promise<SupabaseResult<T>>,
  context: string,
  options?: {
    showToast?: boolean;
    successMessage?: string;
    showSuccessToast?: boolean;
  },
): Promise<T | null> {
  try {
    const result = await operation();
    return handleSupabaseResult(result, context, options);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unbekannter Fehler";
    logger.error(`Supabase exception in ${context}`, context, { message });
    if (options?.showToast !== false) {
      toastNetworkError();
    }
    return null;
  }
}
