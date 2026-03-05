/**
 * MOB4-14: Mobile Quick Stats Widget
 * Mini-dashboard shown at the top of each page.
 * Shows context-dependent KPIs based on current page.
 */
import { memo, useMemo, type ReactNode } from "react";
import { useIsMobile } from "@/hooks/use-mobile";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import { cn } from "@/lib/utils";

export interface QuickStat {
  id: string;
  label: string;
  value: string | number;
  /** Previous value for comparison */
  previousValue?: number;
  /** Icon */
  icon?: ReactNode;
  /** Color for the value */
  color?: "default" | "success" | "warning" | "destructive";
  /** Suffix (e.g. "€", "%") */
  suffix?: string;
  /** Prefix (e.g. "€") */
  prefix?: string;
}

interface MobileQuickStatsProps {
  stats: QuickStat[];
  /** Max stats to show (default: 4) */
  maxVisible?: number;
  /** Additional class */
  className?: string;
  /** Whether to show trend indicators */
  showTrends?: boolean;
}

function formatNumber(value: string | number): string {
  if (typeof value === "string") return value;
  if (Math.abs(value) >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(1)}M`;
  }
  if (Math.abs(value) >= 1_000) {
    return `${(value / 1_000).toFixed(1)}k`;
  }
  return value.toFixed(value % 1 === 0 ? 0 : 1);
}

function getTrend(current: string | number, previous?: number): "up" | "down" | "flat" {
  if (previous === undefined || typeof current === "string") return "flat";
  if (current > previous) return "up";
  if (current < previous) return "down";
  return "flat";
}

function getTrendPercent(current: string | number, previous?: number): string {
  if (previous === undefined || previous === 0 || typeof current === "string") return "";
  const change = ((Number(current) - previous) / Math.abs(previous)) * 100;
  return `${change > 0 ? "+" : ""}${change.toFixed(1)}%`;
}

const colorMap = {
  default: "text-foreground",
  success: "text-green-600 dark:text-green-400",
  warning: "text-amber-600 dark:text-amber-400",
  destructive: "text-red-600 dark:text-red-400",
};

export const MobileQuickStats = memo(function MobileQuickStats({
  stats,
  maxVisible = 4,
  className,
  showTrends = true,
}: MobileQuickStatsProps) {
  const isMobile = useIsMobile();

  const visibleStats = useMemo(() => stats.slice(0, maxVisible), [stats, maxVisible]);

  if (!isMobile || visibleStats.length === 0) return null;

  const gridCols = visibleStats.length <= 2 ? "grid-cols-2" : visibleStats.length === 3 ? "grid-cols-3" : "grid-cols-4";

  return (
    <div className={cn("grid gap-2 mb-4", gridCols, className)}>
      {visibleStats.map((stat) => {
        const trend = showTrends ? getTrend(stat.value, stat.previousValue) : "flat";
        const trendPercent = showTrends ? getTrendPercent(stat.value, stat.previousValue) : "";

        return (
          <div
            key={stat.id}
            className="bg-card border rounded-lg p-2.5 space-y-0.5"
          >
            <div className="flex items-center gap-1">
              {stat.icon && (
                <span className="text-muted-foreground shrink-0">{stat.icon}</span>
              )}
              <span className="text-[10px] text-muted-foreground uppercase tracking-wider truncate font-medium">
                {stat.label}
              </span>
            </div>
            <div className="flex items-baseline gap-1">
              <span className={cn(
                "text-lg font-bold tabular-nums leading-tight",
                colorMap[stat.color ?? "default"]
              )}>
                {stat.prefix}{formatNumber(stat.value)}{stat.suffix}
              </span>
            </div>
            {showTrends && trendPercent && (
              <div className="flex items-center gap-0.5">
                {trend === "up" && <TrendingUp className="w-3 h-3 text-green-500" />}
                {trend === "down" && <TrendingDown className="w-3 h-3 text-red-500" />}
                {trend === "flat" && <Minus className="w-3 h-3 text-muted-foreground" />}
                <span className={cn(
                  "text-[10px] font-medium",
                  trend === "up" && "text-green-500",
                  trend === "down" && "text-red-500",
                  trend === "flat" && "text-muted-foreground"
                )}>
                  {trendPercent}
                </span>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
});
