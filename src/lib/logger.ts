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

function log(level: LogLevel, message: string, context?: string, data?: unknown): void {
  if (!isDev && level !== "error") return;

  const entry: LogEntry = {
    level,
    message,
    context,
    data,
    timestamp: new Date().toISOString(),
  };

  const formatted = formatEntry(entry);

  switch (level) {
    case "debug":
    case "info":
      // eslint-disable-next-line no-console
      console.log(formatted, data ?? "");
      break;
    case "warn":
      // eslint-disable-next-line no-console
      console.warn(formatted, data ?? "");
      break;
    case "error":
      // eslint-disable-next-line no-console
      console.error(formatted, data ?? "");
      break;
  }
}

/** IMP-50: Track error count for diagnostics */
let errorCount = 0;
export const getErrorCount = (): number => errorCount;

export const logger = {
  debug: (message: string, context?: string, data?: unknown) => log("debug", message, context, data),
  info: (message: string, context?: string, data?: unknown) => log("info", message, context, data),
  warn: (message: string, context?: string, data?: unknown) => log("warn", message, context, data),
  error: (message: string, context?: string, data?: unknown) => { errorCount++; log("error", message, context, data); },
};
