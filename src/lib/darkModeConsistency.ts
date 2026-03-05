/**
 * FUND-20: Dark/Light mode consistency — utility functions and CSS custom
 * property mappings to ensure consistent theming across all components.
 */

/** FUND-20: Semantic color tokens that work in both light and dark mode */
export const SEMANTIC_COLORS = {
  /** Positive values (green in light, emerald in dark) */
  positive: "text-green-600 dark:text-emerald-400",
  positiveBg: "bg-green-50 dark:bg-emerald-950/30",
  positiveBorder: "border-green-200 dark:border-emerald-800",

  /** Negative values (red in light, rose in dark) */
  negative: "text-red-600 dark:text-rose-400",
  negativeBg: "bg-red-50 dark:bg-rose-950/30",
  negativeBorder: "border-red-200 dark:border-rose-800",

  /** Warning (amber in light, yellow in dark) */
  warning: "text-amber-600 dark:text-yellow-400",
  warningBg: "bg-amber-50 dark:bg-yellow-950/30",
  warningBorder: "border-amber-200 dark:border-yellow-800",

  /** Info (blue in light, sky in dark) */
  info: "text-blue-600 dark:text-sky-400",
  infoBg: "bg-blue-50 dark:bg-sky-950/30",
  infoBorder: "border-blue-200 dark:border-sky-800",

  /** Neutral / muted */
  muted: "text-muted-foreground",
  mutedBg: "bg-muted",
  mutedBorder: "border-border",

  /** Surface levels for layered UI */
  surface0: "bg-background",
  surface1: "bg-card",
  surface2: "bg-muted/50",
  surface3: "bg-accent/50",
} as const;

/**
 * FUND-20: Chart color palette that works in both light and dark mode.
 * Uses CSS custom properties for dynamic theming.
 */
export const CHART_COLORS = {
  light: [
    "#2563eb", // blue-600
    "#16a34a", // green-600
    "#dc2626", // red-600
    "#d97706", // amber-600
    "#7c3aed", // violet-600
    "#0891b2", // cyan-600
    "#ea580c", // orange-600
    "#4f46e5", // indigo-600
  ],
  dark: [
    "#60a5fa", // blue-400
    "#4ade80", // green-400
    "#f87171", // red-400
    "#fbbf24", // amber-400
    "#a78bfa", // violet-400
    "#22d3ee", // cyan-400
    "#fb923c", // orange-400
    "#818cf8", // indigo-400
  ],
} as const;

/**
 * FUND-20: Get chart colors based on current theme.
 */
export function getChartColors(): string[] {
  if (typeof document === "undefined") return CHART_COLORS.light;
  const isDark = document.documentElement.classList.contains("dark");
  return isDark ? [...CHART_COLORS.dark] : [...CHART_COLORS.light];
}

/**
 * FUND-20: Get a semantic color class for a numeric value.
 */
export function getValueColor(value: number, neutral = false): string {
  if (neutral || value === 0) return SEMANTIC_COLORS.muted;
  return value > 0 ? SEMANTIC_COLORS.positive : SEMANTIC_COLORS.negative;
}

/**
 * FUND-20: Get a semantic background class for a status.
 */
export function getStatusClasses(status: "success" | "warning" | "error" | "info" | "neutral"): string {
  const map = {
    success: `${SEMANTIC_COLORS.positiveBg} ${SEMANTIC_COLORS.positiveBorder} ${SEMANTIC_COLORS.positive}`,
    warning: `${SEMANTIC_COLORS.warningBg} ${SEMANTIC_COLORS.warningBorder} ${SEMANTIC_COLORS.warning}`,
    error: `${SEMANTIC_COLORS.negativeBg} ${SEMANTIC_COLORS.negativeBorder} ${SEMANTIC_COLORS.negative}`,
    info: `${SEMANTIC_COLORS.infoBg} ${SEMANTIC_COLORS.infoBorder} ${SEMANTIC_COLORS.info}`,
    neutral: `${SEMANTIC_COLORS.mutedBg} ${SEMANTIC_COLORS.mutedBorder} ${SEMANTIC_COLORS.muted}`,
  };
  return map[status];
}
