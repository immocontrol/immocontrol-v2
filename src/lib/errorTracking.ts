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

const STORAGE_KEY = "immocontrol_error_log";
const MAX_ERRORS = 100;

function loadErrors(): ErrorEntry[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) return JSON.parse(stored) as ErrorEntry[];
  } catch { /* ignore */ }
  return [];
}

function saveErrors(errors: ErrorEntry[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(errors.slice(-MAX_ERRORS)));
  } catch { /* localStorage full — clear old errors */ }
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

/** Initialize global error listeners */
export function initErrorTracking() {
  // Catch unhandled errors
  window.addEventListener("error", (event) => {
    trackError(
      event.error instanceof Error ? event.error : new Error(event.message),
      "error"
    );
  });

  // Catch unhandled promise rejections
  window.addEventListener("unhandledrejection", (event) => {
    const error = event.reason instanceof Error
      ? event.reason
      : new Error(String(event.reason));
    trackError(error, "unhandledrejection");
  });
}
