/**
 * #16: Error Tracking — Lightweight error tracking without external dependencies.
 * Captures unhandled errors, promise rejections, and manual error reports.
 * Stores errors in localStorage for debugging and exports to console/clipboard.
 * Sanitizes messages/stacks so no passwords, tokens, or PII are stored or sent.
 * Optional: set VITE_SENTRY_DSN and assign globalThis.__immocontrol_reportError to send to Sentry.
 */

export interface ErrorEntry {
  id: string;
  timestamp: string;
  message: string;
  stack?: string;
  type: "error" | "unhandledrejection" | "manual" | "component";
  url: string;
  userAgent: string;
  componentStack?: string;
}

/** Redact sensitive patterns so they never end up in localStorage or external services. Export for use before sending to external services. */
export function sanitizeForLog(text: string | undefined): string {
  if (text == null || text === "") return "";
  let out = text;
  /* Passwords and secrets */
  out = out.replace(/\b(password|passwd|secret|token|api[_-]?key|auth|bearer)\s*[:=]\s*["']?[^\s"']+["']?/gi, "$1=***");
  out = out.replace(/\b[A-Za-z0-9_-]{20,}\b/g, (m) => (m.length > 32 ? "***" : m)); /* long tokens */
  /* E‑mail (keep structure, redact local part) */
  out = out.replace(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/gi, "***@***.***");
  /* Phone (DE-style) */
  out = out.replace(/\b(\+49|0)[\s\d/-]{6,}\b/g, "***");
  return out;
}

declare global {
  interface Window {
    __immocontrol_reportError?: (entry: ErrorEntry) => void;
  }
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

/** Log an error to the tracking store. Message and stack are sanitized (no PII/tokens). */
export function trackError(error: Error | string, type: ErrorEntry["type"] = "manual", componentStack?: string) {
  const rawMessage = typeof error === "string" ? error : error.message;
  const rawStack = typeof error === "string" ? undefined : error.stack;
  const entry: ErrorEntry = {
    id: `err-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    timestamp: new Date().toISOString(),
    message: sanitizeForLog(rawMessage),
    stack: rawStack ? sanitizeForLog(rawStack) : undefined,
    type,
    url: window.location.href,
    userAgent: navigator.userAgent,
    componentStack: componentStack ? sanitizeForLog(componentStack) : undefined,
  };

  try {
    const errors = loadErrors();
    errors.push(entry);
    saveErrors(errors);
  } catch {
    /* avoid throwing from tracking */
  }

  if (typeof window !== "undefined" && window.__immocontrol_reportError && import.meta.env.VITE_SENTRY_DSN) {
    try {
      window.__immocontrol_reportError(entry);
    } catch {
      /* optional reporter must not break tracking */
    }
  }

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
