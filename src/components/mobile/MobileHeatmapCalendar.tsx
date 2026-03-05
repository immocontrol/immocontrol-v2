/**
 * MOB5-17: Mobile Heatmap Calendar
 * GitHub-style heatmap calendar for activity visualization.
 * Shows payment receipts, viewings, maintenance activities etc.
 * Touch-optimized with tap-to-show details.
 */
import { useState, useMemo, useCallback, memo } from "react";
import { useIsMobile } from "@/hooks/use-mobile";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

export interface HeatmapDataPoint {
  /** Date (ISO string or Date) */
  date: string | Date;
  /** Count / intensity value */
  count: number;
  /** Optional label */
  label?: string;
  /** Details for tooltip */
  details?: string[];
}

interface MobileHeatmapCalendarProps {
  /** Data points */
  data: HeatmapDataPoint[];
  /** Number of weeks to show */
  weeks?: number;
  /** Color scheme */
  colorScheme?: "green" | "blue" | "orange" | "purple";
  /** Title */
  title?: string;
  /** Suffix for count (e.g., "Zahlungen", "Aktivitäten") */
  countSuffix?: string;
  /** Cell click handler */
  onCellClick?: (date: Date, data: HeatmapDataPoint | undefined) => void;
  /** Additional class */
  className?: string;
}

const WEEKDAY_LABELS = ["Mo", "", "Mi", "", "Fr", "", "So"];
const MONTH_LABELS = ["Jan", "Feb", "Mär", "Apr", "Mai", "Jun", "Jul", "Aug", "Sep", "Okt", "Nov", "Dez"];

const colorSchemes: Record<string, string[]> = {
  green: ["bg-gray-100 dark:bg-gray-800", "bg-green-200 dark:bg-green-900", "bg-green-400 dark:bg-green-700", "bg-green-600 dark:bg-green-500", "bg-green-800 dark:bg-green-300"],
  blue: ["bg-gray-100 dark:bg-gray-800", "bg-blue-200 dark:bg-blue-900", "bg-blue-400 dark:bg-blue-700", "bg-blue-600 dark:bg-blue-500", "bg-blue-800 dark:bg-blue-300"],
  orange: ["bg-gray-100 dark:bg-gray-800", "bg-orange-200 dark:bg-orange-900", "bg-orange-400 dark:bg-orange-700", "bg-orange-600 dark:bg-orange-500", "bg-orange-800 dark:bg-orange-300"],
  purple: ["bg-gray-100 dark:bg-gray-800", "bg-purple-200 dark:bg-purple-900", "bg-purple-400 dark:bg-purple-700", "bg-purple-600 dark:bg-purple-500", "bg-purple-800 dark:bg-purple-300"],
};

function getDateKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export const MobileHeatmapCalendar = memo(function MobileHeatmapCalendar({
  data,
  weeks = 20,
  colorScheme = "green",
  title,
  countSuffix = "Aktivitäten",
  onCellClick,
  className,
}: MobileHeatmapCalendarProps) {
  const isMobile = useIsMobile();
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [offset, setOffset] = useState(0);

  const colors = colorSchemes[colorScheme] || colorSchemes.green;

  // Build data map
  const dataMap = useMemo(() => {
    const map = new Map<string, HeatmapDataPoint>();
    for (const point of data) {
      const d = new Date(point.date);
      map.set(getDateKey(d), point);
    }
    return map;
  }, [data]);

  // Calculate max count for color scaling
  const maxCount = useMemo(() => {
    return Math.max(1, ...data.map(d => d.count));
  }, [data]);

  // Generate grid of dates
  const grid = useMemo(() => {
    const today = new Date();
    const endDate = new Date(today);
    endDate.setDate(endDate.getDate() - offset * 7);

    // Go to the most recent Sunday
    const dayOfWeek = endDate.getDay();
    endDate.setDate(endDate.getDate() + (dayOfWeek === 0 ? 0 : 7 - dayOfWeek));

    const startDate = new Date(endDate);
    startDate.setDate(startDate.getDate() - weeks * 7 + 1);

    const weekColumns: Date[][] = [];
    let currentWeek: Date[] = [];

    const current = new Date(startDate);
    while (current <= endDate) {
      const dow = current.getDay();
      // Monday = index 0
      const isoDay = dow === 0 ? 6 : dow - 1;

      if (isoDay === 0 && currentWeek.length > 0) {
        weekColumns.push(currentWeek);
        currentWeek = [];
      }

      currentWeek.push(new Date(current));
      current.setDate(current.getDate() + 1);
    }

    if (currentWeek.length > 0) {
      weekColumns.push(currentWeek);
    }

    return weekColumns;
  }, [weeks, offset]);

  // Month labels for the top
  const monthLabels = useMemo(() => {
    const labels: { label: string; col: number }[] = [];
    let lastMonth = -1;
    grid.forEach((week, colIndex) => {
      const firstDay = week[0];
      if (firstDay && firstDay.getMonth() !== lastMonth) {
        lastMonth = firstDay.getMonth();
        labels.push({ label: MONTH_LABELS[lastMonth], col: colIndex });
      }
    });
    return labels;
  }, [grid]);

  const getColorLevel = useCallback((count: number): number => {
    if (count === 0) return 0;
    const ratio = count / maxCount;
    if (ratio <= 0.25) return 1;
    if (ratio <= 0.5) return 2;
    if (ratio <= 0.75) return 3;
    return 4;
  }, [maxCount]);

  // Total stats
  const totalCount = useMemo(() => data.reduce((sum, d) => sum + d.count, 0), [data]);

  const selectedData = selectedDate ? dataMap.get(selectedDate) : null;

  return (
    <div className={cn("w-full", className)}>
      {/* Header */}
      {title && (
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold">{title}</h3>
          <span className="text-xs text-muted-foreground">
            {totalCount} {countSuffix}
          </span>
        </div>
      )}

      {/* Navigation */}
      <div className="flex items-center justify-between mb-2">
        <button
          onClick={() => setOffset(prev => prev + 1)}
          className={cn(
            "p-1.5 rounded-md hover:bg-muted transition-colors",
            isMobile && "min-w-[36px] min-h-[36px] flex items-center justify-center"
          )}
          aria-label="Frühere Wochen"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
        {offset > 0 && (
          <button
            onClick={() => setOffset(0)}
            className="text-xs text-primary hover:underline"
          >
            Heute
          </button>
        )}
        <button
          onClick={() => setOffset(prev => Math.max(0, prev - 1))}
          disabled={offset === 0}
          className={cn(
            "p-1.5 rounded-md hover:bg-muted transition-colors disabled:opacity-30",
            isMobile && "min-w-[36px] min-h-[36px] flex items-center justify-center"
          )}
          aria-label="Neuere Wochen"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      {/* Heatmap grid */}
      <div
        className="flex gap-[2px] overflow-x-auto scrollbar-none"
        style={{ WebkitOverflowScrolling: "touch" }}
      >
        {/* Weekday labels */}
        <div className="flex flex-col gap-[2px] shrink-0 pr-1">
          {WEEKDAY_LABELS.map((label, i) => (
            <div
              key={i}
              className="h-3 flex items-center justify-end"
              style={{ width: 20 }}
            >
              <span className="text-[9px] text-muted-foreground">{label}</span>
            </div>
          ))}
        </div>

        {/* Week columns */}
        {grid.map((week, colIndex) => (
          <div key={colIndex} className="flex flex-col gap-[2px]">
            {week.map(day => {
              const dateKey = getDateKey(day);
              const point = dataMap.get(dateKey);
              const count = point?.count || 0;
              const level = getColorLevel(count);
              const isSelected = selectedDate === dateKey;

              return (
                <button
                  key={dateKey}
                  onClick={() => {
                    setSelectedDate(isSelected ? null : dateKey);
                    onCellClick?.(day, point);
                  }}
                  className={cn(
                    "w-3 h-3 rounded-[2px] transition-all",
                    colors[level],
                    isSelected && "ring-2 ring-foreground ring-offset-1"
                  )}
                  aria-label={`${day.toLocaleDateString("de-DE")}: ${count} ${countSuffix}`}
                  title={`${day.toLocaleDateString("de-DE")}: ${count}`}
                />
              );
            })}
          </div>
        ))}
      </div>

      {/* Month labels */}
      <div className="flex mt-1 ml-[24px]">
        {monthLabels.map((ml, i) => (
          <span
            key={i}
            className="text-[9px] text-muted-foreground"
            style={{
              position: "relative",
              left: `${ml.col * 14}px`,
              marginRight: i < monthLabels.length - 1
                ? `${((monthLabels[i + 1]?.col || 0) - ml.col) * 14 - 24}px`
                : 0,
            }}
          >
            {ml.label}
          </span>
        ))}
      </div>

      {/* Legend */}
      <div className="flex items-center justify-between mt-3">
        <div className="flex items-center gap-1">
          <span className="text-[10px] text-muted-foreground">Weniger</span>
          {colors.map((color, i) => (
            <span key={i} className={cn("w-3 h-3 rounded-[2px]", color)} />
          ))}
          <span className="text-[10px] text-muted-foreground">Mehr</span>
        </div>
      </div>

      {/* Selected date detail */}
      {selectedDate && (
        <div className="mt-3 p-2.5 rounded-lg bg-muted/50 border">
          <p className="text-xs font-medium">
            {new Date(selectedDate).toLocaleDateString("de-DE", {
              weekday: "long",
              day: "numeric",
              month: "long",
              year: "numeric",
            })}
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">
            {selectedData?.count || 0} {countSuffix}
            {selectedData?.label && ` — ${selectedData.label}`}
          </p>
          {selectedData?.details && selectedData.details.length > 0 && (
            <ul className="mt-1.5 space-y-0.5">
              {selectedData.details.map((detail, i) => (
                <li key={i} className="text-[10px] text-muted-foreground flex items-center gap-1">
                  <span className={cn("w-1.5 h-1.5 rounded-full", colors[3])} />
                  {detail}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
});
