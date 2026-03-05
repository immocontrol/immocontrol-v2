/**
 * FUND-6: Dynamic imports for heavy libraries — reduces initial bundle size
 * by code-splitting recharts, jspdf, and pdfjs-dist into separate chunks.
 */
import { lazy } from "react";

/* ── Recharts — ~200 KB gzipped ── */
export const LazyAreaChart = lazy(() =>
  import("recharts").then((m) => ({ default: m.AreaChart })),
);
export const LazyBarChart = lazy(() =>
  import("recharts").then((m) => ({ default: m.BarChart })),
);
export const LazyLineChart = lazy(() =>
  import("recharts").then((m) => ({ default: m.LineChart })),
);
export const LazyPieChart = lazy(() =>
  import("recharts").then((m) => ({ default: m.PieChart })),
);
export const LazyRadarChart = lazy(() =>
  import("recharts").then((m) => ({ default: m.RadarChart })),
);

/* ── jsPDF — ~100 KB gzipped ── */
export async function loadJsPDF() {
  const { default: jsPDF } = await import("jspdf");
  return jsPDF;
}

/* ── PDF.js — ~400 KB gzipped ── */
export async function loadPdfJs() {
  const pdfjs = await import("pdfjs-dist");
  return pdfjs;
}

/**
 * FUND-6: Generic dynamic import wrapper with error handling.
 * Retries once on failure (e.g. flaky network).
 */
export async function dynamicImport<T>(
  importFn: () => Promise<T>,
  label = "module",
): Promise<T> {
  try {
    return await importFn();
  } catch {
    // Retry once after 1s
    await new Promise((r) => setTimeout(r, 1000));
    try {
      return await importFn();
    } catch (err) {
      throw new Error(`Fehler beim Laden von ${label}: ${err instanceof Error ? err.message : "Unbekannt"}`);
    }
  }
}
