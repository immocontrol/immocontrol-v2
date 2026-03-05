/**
 * MOB5-14: Mobile Countdown Timer
 * Countdown for deadlines (Vertragsfrist, Kündigungsfrist, etc.).
 * Visual urgency indicators with color-coded time remaining.
 * Replaces MOB5-14 AlertBanner (MobileOfflineBanner already covers alerts).
 */
import { useState, useEffect, useMemo, memo } from "react";
import { useIsMobile } from "@/hooks/use-mobile";
import { Clock, AlertTriangle, CheckCircle2, Bell } from "lucide-react";
import { cn } from "@/lib/utils";

export interface Deadline {
  /** Unique ID */
  id: string;
  /** Deadline title */
  title: string;
  /** Target date (ISO string or Date) */
  targetDate: string | Date;
  /** Category */
  category?: "vertrag" | "kuendigung" | "wartung" | "steuer" | "sonstig";
  /** Description */
  description?: string;
  /** Whether the deadline has been completed */
  completed?: boolean;
}

interface MobileCountdownTimerProps {
  /** Deadlines to display */
  deadlines: Deadline[];
  /** Click handler */
  onDeadlineClick?: (deadline: Deadline) => void;
  /** Warning threshold in days */
  warningDays?: number;
  /** Critical threshold in days */
  criticalDays?: number;
  /** Compact mode (single line per deadline) */
  compact?: boolean;
  /** Additional class */
  className?: string;
}

const categoryLabels: Record<string, string> = {
  vertrag: "Vertrag",
  kuendigung: "Kündigung",
  wartung: "Wartung",
  steuer: "Steuer",
  sonstig: "Sonstiges",
};

const categoryColors: Record<string, string> = {
  vertrag: "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300",
  kuendigung: "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300",
  wartung: "bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300",
  steuer: "bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300",
  sonstig: "bg-muted text-muted-foreground",
};

function getTimeRemaining(targetDate: Date): { days: number; hours: number; minutes: number; total: number } {
  const now = Date.now();
  const total = targetDate.getTime() - now;
  const days = Math.floor(total / (1000 * 60 * 60 * 24));
  const hours = Math.floor((total % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minutes = Math.floor((total % (1000 * 60 * 60)) / (1000 * 60));
  return { days, hours, minutes, total };
}

function formatCountdown(days: number, hours: number, minutes: number): string {
  if (days > 30) {
    const months = Math.floor(days / 30);
    return `${months} Monat${months > 1 ? "e" : ""}`;
  }
  if (days > 0) return `${days} Tag${days > 1 ? "e" : ""} ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}min`;
  return `${minutes} Min.`;
}

export const MobileCountdownTimer = memo(function MobileCountdownTimer({
  deadlines,
  onDeadlineClick,
  warningDays = 14,
  criticalDays = 3,
  compact = false,
  className,
}: MobileCountdownTimerProps) {
  const isMobile = useIsMobile();
  const [now, setNow] = useState(Date.now());

  // Update every minute
  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(interval);
  }, []);

  // Sort by urgency (soonest first, completed last)
  const sortedDeadlines = useMemo(() => {
    return [...deadlines].sort((a, b) => {
      if (a.completed && !b.completed) return 1;
      if (!a.completed && b.completed) return -1;
      return new Date(a.targetDate).getTime() - new Date(b.targetDate).getTime();
    });
  }, [deadlines]);

  if (deadlines.length === 0) return null;

  return (
    <div className={cn("w-full space-y-2", className)}>
      {sortedDeadlines.map(deadline => {
        const target = new Date(deadline.targetDate);
        const remaining = getTimeRemaining(target);
        const isPast = remaining.total < 0;
        const isCritical = !isPast && remaining.days <= criticalDays;
        const isWarning = !isPast && !isCritical && remaining.days <= warningDays;

        const urgencyColor = deadline.completed
          ? "border-green-200 dark:border-green-800"
          : isPast
            ? "border-red-300 dark:border-red-700 bg-red-50/50 dark:bg-red-950/20"
            : isCritical
              ? "border-red-200 dark:border-red-800 bg-red-50/30 dark:bg-red-950/10"
              : isWarning
                ? "border-orange-200 dark:border-orange-800"
                : "border-border";

        const urgencyIcon = deadline.completed
          ? <CheckCircle2 className="w-4 h-4 text-green-500" />
          : isPast || isCritical
            ? <AlertTriangle className="w-4 h-4 text-red-500" />
            : isWarning
              ? <Bell className="w-4 h-4 text-orange-500" />
              : <Clock className="w-4 h-4 text-muted-foreground" />;

        if (compact) {
          return (
            <button
              key={deadline.id}
              onClick={() => onDeadlineClick?.(deadline)}
              className={cn(
                "w-full flex items-center gap-2 px-3 py-2 rounded-lg border transition-colors",
                "hover:bg-muted/50 active:bg-muted text-left",
                urgencyColor,
                isMobile && "min-h-[44px]"
              )}
            >
              {urgencyIcon}
              <span className={cn(
                "text-xs flex-1 truncate",
                deadline.completed && "line-through text-muted-foreground"
              )}>
                {deadline.title}
              </span>
              <span className={cn(
                "text-xs font-mono shrink-0",
                isPast ? "text-red-600 dark:text-red-400 font-semibold" :
                  isCritical ? "text-red-500" :
                    isWarning ? "text-orange-500" :
                      "text-muted-foreground"
              )}>
                {deadline.completed
                  ? "Erledigt"
                  : isPast
                    ? `${Math.abs(remaining.days)}T überfällig`
                    : formatCountdown(remaining.days, remaining.hours, remaining.minutes)
                }
              </span>
            </button>
          );
        }

        return (
          <button
            key={deadline.id}
            onClick={() => onDeadlineClick?.(deadline)}
            className={cn(
              "w-full rounded-lg border p-3 transition-colors text-left",
              "hover:bg-muted/50 active:bg-muted",
              urgencyColor,
              isMobile && "min-h-[44px]"
            )}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-start gap-2 min-w-0">
                {urgencyIcon}
                <div className="min-w-0">
                  <p className={cn(
                    "text-sm font-medium",
                    deadline.completed && "line-through text-muted-foreground"
                  )}>
                    {deadline.title}
                  </p>
                  {deadline.description && (
                    <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
                      {deadline.description}
                    </p>
                  )}
                  <div className="flex items-center gap-2 mt-1.5">
                    {deadline.category && (
                      <span className={cn(
                        "text-[10px] px-1.5 py-0.5 rounded-full",
                        categoryColors[deadline.category] || categoryColors.sonstig
                      )}>
                        {categoryLabels[deadline.category] || deadline.category}
                      </span>
                    )}
                    <span className="text-[10px] text-muted-foreground">
                      {target.toLocaleDateString("de-DE", {
                        day: "2-digit",
                        month: "2-digit",
                        year: "numeric",
                      })}
                    </span>
                  </div>
                </div>
              </div>

              {/* Countdown */}
              <div className={cn(
                "text-right shrink-0",
                isPast ? "text-red-600 dark:text-red-400" :
                  isCritical ? "text-red-500" :
                    isWarning ? "text-orange-500" :
                      "text-muted-foreground"
              )}>
                {deadline.completed ? (
                  <span className="text-xs text-green-600 dark:text-green-400">Erledigt</span>
                ) : isPast ? (
                  <>
                    <p className="text-lg font-bold tabular-nums">{Math.abs(remaining.days)}</p>
                    <p className="text-[10px]">Tage überfällig</p>
                  </>
                ) : (
                  <>
                    <p className="text-lg font-bold tabular-nums">{remaining.days}</p>
                    <p className="text-[10px]">
                      {remaining.days === 1 ? "Tag" : "Tage"}
                    </p>
                  </>
                )}
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
});
