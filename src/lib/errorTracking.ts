/**
 * #16: Error Tracking — Lightweight error tracking without external dependencies.
 * Captures unhandled errors, promise rejections, and manual error reports.
 * Stores errors in localStorage for debugging and exports to console/clipboard.
 * No paid service needed — fully self-contained.
 */

interface ErrorEntry {
  id: string;
  timestamp: string;
  message: string;
  stack?: string;
  type: "error" | "unhandledrejection" | "manual" | "component";
  url: string;
  userAgent: string;
  componentStack?: string;
}

const STORAGE_KEY = "immocontrol_error_tracking";
const MAX_ERRORS = 100;

function loadErrors(): ErrorEntry[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) return JSON.parse(stored) as ErrorEntry[];
  } catch { /* ignore */ }
  return [];
}

/* FUND-5: Handle localStorage quota exceeded — evict oldest entries when full */
function saveErrors(errors: ErrorEntry[]) {
  const trimmed = errors.slice(-MAX_ERRORS);
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
  } catch {
    /* localStorage full — evict oldest half and retry */
    try {
      const reduced = trimmed.slice(Math.floor(trimmed.length / 2));
      localStorage.setItem(STORAGE_KEY, JSON.stringify(reduced));
    } catch { /* still full — give up silently */ }
  }
}

/** Log an error to the tracking store */
export function trackError(error: Error | string, type: ErrorEntry["type"] = "manual", componentStack?: string) {
  const entry: ErrorEntry = {
    id: `err-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    timestamp: new Date().toISOString(),
    message: typeof error === "string" ? error : error.message,
    stack: typeof error === "string" ? undefined : error.stack,
    type,
    url: window.location.href,
    userAgent: navigator.userAgent,
    componentStack,
  };

  const errors = loadErrors();
  errors.push(entry);
  saveErrors(errors);

  // Also log to console in development
  if (import.meta.env.DEV) {
    console.error(`[ErrorTracking] ${entry.type}: ${entry.message}`, entry);
  }
}

/** Get all tracked errors */
export function getTrackedErrors(): ErrorEntry[] {
  return loadErrors();
}

/** Clear all tracked errors */
export function clearTrackedErrors() {
  localStorage.removeItem(STORAGE_KEY);
}

/** Export errors as JSON string for debugging */
export function exportErrors(): string {
  return JSON.stringify(loadErrors(), null, 2);
}

/** Get error count for badge display */
export function getErrorCount(): number {
  return loadErrors().length;
}

/* STRONG-1: Return cleanup function from initErrorTracking so listeners can be removed on HMR / unmount.
   Previously listeners were added but never removed, causing duplicate tracking in development. */
export function initErrorTracking(): () => void {
  const onError = (event: ErrorEvent) => {
    trackError(
      event.error instanceof Error ? event.error : new Error(event.message),
      "error"
    );
  };

  const onUnhandledRejection = (event: PromiseRejectionEvent) => {
    const error = event.reason instanceof Error
      ? event.reason
      : new Error(String(event.reason));
    trackError(error, "unhandledrejection");
  };

  window.addEventListener("error", onError);
  window.addEventListener("unhandledrejection", onUnhandledRejection);

  // Return cleanup function
  return () => {
    window.removeEventListener("error", onError);
    window.removeEventListener("unhandledrejection", onUnhandledRejection);
  };
}
