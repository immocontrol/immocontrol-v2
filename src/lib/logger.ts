/**
 * IMP-16: Structured logger — replaces raw console.log/warn/error calls.
 * In production, logs are suppressed. In development, they are formatted.
 * Can be extended to send errors to an external service (e.g. Sentry free tier).
 */

const isDev = import.meta.env.DEV;

type LogLevel = "debug" | "info" | "warn" | "error";

interface LogEntry {
  level: LogLevel;
  message: string;
  context?: string;
  data?: unknown;
  timestamp: string;
}

const formatEntry = (entry: LogEntry): string =>
  `[${entry.timestamp}] [${entry.level.toUpperCase()}]${entry.context ? ` [${entry.context}]` : ""} ${entry.message}`;

/* STRONG-10: Rate-limit identical log messages — prevents console spam from rapid re-renders or polling loops */
const recentLogs = new Map<string, number>();
const LOG_THROTTLE_MS = 1000;

function log(level: LogLevel, message: string, context?: string, data?: unknown): void {
  if (!isDev && level !== "error") return;

  /* STRONG-10: Skip duplicate messages within throttle window */
  const dedupeKey = `${level}:${context ?? ""}:${message}`;
  const now = Date.now();
  const lastSeen = recentLogs.get(dedupeKey);
  if (lastSeen && now - lastSeen < LOG_THROTTLE_MS) return;
  recentLogs.set(dedupeKey, now);
  /* Purge old entries every 50 inserts to prevent unbounded Map growth */
  if (recentLogs.size > 200) {
    for (const [k, v] of recentLogs) {
      if (now - v > LOG_THROTTLE_MS * 5) recentLogs.delete(k);
    }
  }

  const entry: LogEntry = {
    level,
    message,
    context,
    data,
    timestamp: new Date().toISOString(),
  };

  const formatted = formatEntry(entry);

  const hasData = data !== undefined && data !== null && (typeof data !== "object" || Object.keys(data as object).length > 0);
  const out = hasData ? data : "";

  switch (level) {
    case "debug":
    case "info":
      console.log(formatted, out);
      break;
    case "warn":
      console.warn(formatted, out);
      break;
    case "error":
      console.error(formatted, out);
      break;
  }
}

/** IMP-50: Track error count for diagnostics */
let errorCount = 0;
export const getErrorCount = (): number => errorCount;
/* FUND-6: Allow resetting error count — useful for diagnostics after viewing errors */
export const resetErrorCount = (): void => { errorCount = 0; };

export const logger = {
  debug: (message: string, context?: string, data?: unknown) => log("debug", message, context, data),
  info: (message: string, context?: string, data?: unknown) => log("info", message, context, data),
  warn: (message: string, context?: string, data?: unknown) => log("warn", message, context, data),
  error: (message: string, context?: string, data?: unknown) => { errorCount++; log("error", message, context, data); },
};
