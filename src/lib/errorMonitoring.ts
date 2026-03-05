/**
 * FUND-30: Error monitoring — lightweight Sentry-like error tracking.
 * Captures unhandled errors, promise rejections, and manual reports.
 * Stores in localStorage with rotation and provides export capability.
 * Can be upgraded to Sentry/Datadog by swapping the transport.
 */

import { trackError } from "@/lib/errorTracking";

export interface ErrorReport {
  id: string;
  message: string;
  stack?: string;
  source: "unhandled" | "promise" | "manual" | "network" | "render";
  url: string;
  userAgent: string;
  timestamp: string;
  metadata?: Record<string, string>;
}

const STORAGE_KEY = "immocontrol_error_reports";
const MAX_REPORTS = 200;

/**
 * FUND-30: Initialize global error monitoring.
 * Call once at app startup (e.g. in main.tsx).
 */
export function initErrorMonitoring(): () => void {
  const handleError = (event: ErrorEvent) => {
    captureError({
      message: event.message,
      stack: event.error?.stack,
      source: "unhandled",
      url: window.location.href,
      userAgent: navigator.userAgent,
      timestamp: new Date().toISOString(),
      id: crypto.randomUUID(),
    });
    // Also track in existing errorTracking system
    if (event.error instanceof Error) {
      trackError(event.error, "auto", `unhandled: ${event.filename}:${event.lineno}`);
    }
  };

  const handleRejection = (event: PromiseRejectionEvent) => {
    const reason = event.reason;
    const message = reason instanceof Error ? reason.message : String(reason);
    const stack = reason instanceof Error ? reason.stack : undefined;
    captureError({
      message,
      stack,
      source: "promise",
      url: window.location.href,
      userAgent: navigator.userAgent,
      timestamp: new Date().toISOString(),
      id: crypto.randomUUID(),
    });
    if (reason instanceof Error) {
      trackError(reason, "auto", "unhandled promise rejection");
    }
  };

  window.addEventListener("error", handleError);
  window.addEventListener("unhandledrejection", handleRejection);

  return () => {
    window.removeEventListener("error", handleError);
    window.removeEventListener("unhandledrejection", handleRejection);
  };
}

/**
 * FUND-30: Capture an error report.
 */
export function captureError(report: ErrorReport): void {
  try {
    const reports = getErrorReports();
    reports.unshift(report);
    const trimmed = reports.slice(0, MAX_REPORTS);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
  } catch {
    // Storage full — silently drop
  }
}

/**
 * FUND-30: Manually capture an exception with metadata.
 */
export function captureException(
  error: Error,
  metadata?: Record<string, string>,
): void {
  captureError({
    id: crypto.randomUUID(),
    message: error.message,
    stack: error.stack,
    source: "manual",
    url: window.location.href,
    userAgent: navigator.userAgent,
    timestamp: new Date().toISOString(),
    metadata,
  });
}

/**
 * FUND-30: Get all stored error reports.
 */
export function getErrorReports(): ErrorReport[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

/**
 * FUND-30: Get error reports grouped by message (deduplication).
 */
export function getGroupedErrorReports(): Array<{
  message: string;
  count: number;
  lastSeen: string;
  firstSeen: string;
  source: string;
}> {
  const reports = getErrorReports();
  const groups = new Map<string, { count: number; lastSeen: string; firstSeen: string; source: string }>();

  for (const report of reports) {
    const key = report.message;
    const existing = groups.get(key);
    if (existing) {
      existing.count++;
      if (report.timestamp > existing.lastSeen) existing.lastSeen = report.timestamp;
      if (report.timestamp < existing.firstSeen) existing.firstSeen = report.timestamp;
    } else {
      groups.set(key, {
        count: 1,
        lastSeen: report.timestamp,
        firstSeen: report.timestamp,
        source: report.source,
      });
    }
  }

  return Array.from(groups.entries())
    .map(([message, data]) => ({ message, ...data }))
    .sort((a, b) => b.count - a.count);
}

/**
 * FUND-30: Export error reports as JSON.
 */
export function exportErrorReports(): string {
  return JSON.stringify(getErrorReports(), null, 2);
}

/**
 * FUND-30: Clear all error reports.
 */
export function clearErrorReports(): void {
  localStorage.removeItem(STORAGE_KEY);
}

/**
 * FUND-30: Get error rate (errors per hour over last 24h).
 */
export function getErrorRate(): number {
  const reports = getErrorReports();
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const recent = reports.filter((r) => r.timestamp >= oneDayAgo);
  return Math.round((recent.length / 24) * 10) / 10;
}
