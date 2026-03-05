/**
 * MOB3-12: Mobile Notification Badge System
 * Red badges on bottom tab bar items showing counts (overdue tasks, pending rents, new deals).
 * Integrates with the existing MobileBottomTabBar navigation.
 * Safari-safe: uses CSS transforms for badge positioning.
 */
import { memo, type ReactNode } from "react";
import { cn } from "@/lib/utils";

interface MobileNotificationBadgeProps {
  /** Badge count (0 = hidden) */
  count: number;
  /** Max display number (default: 99) */
  max?: number;
  /** Badge color variant */
  variant?: "destructive" | "warning" | "info" | "success";
  /** Show dot only (no number) */
  dot?: boolean;
  /** Pulse animation */
  pulse?: boolean;
  children: ReactNode;
  className?: string;
}

const VARIANT_COLORS = {
  destructive: "bg-destructive text-destructive-foreground",
  warning: "bg-amber-500 text-white",
  info: "bg-blue-500 text-white",
  success: "bg-emerald-500 text-white",
};

export const MobileNotificationBadge = memo(function MobileNotificationBadge({
  count, max = 99, variant = "destructive", dot, pulse, children, className,
}: MobileNotificationBadgeProps) {
  const showBadge = count > 0;
  const displayCount = count > max ? `${max}+` : String(count);

  return (
    <div className={cn("relative inline-flex", className)}>
      {children}
      {showBadge && (
        <span
          className={cn(
            "absolute z-10",
            dot
              ? "top-0 right-0 w-2 h-2 rounded-full -translate-y-0.5 translate-x-0.5"
              : "top-0 right-0 min-w-[16px] h-4 px-1 rounded-full -translate-y-1 translate-x-1 flex items-center justify-center",
            VARIANT_COLORS[variant],
            !dot && "text-[9px] font-bold leading-none",
            pulse && "animate-pulse",
            /* Safari: GPU compositing for badge */
            "transform-gpu",
          )}
          aria-label={`${count} Benachrichtigungen`}
        >
          {!dot && displayCount}
        </span>
      )}
    </div>
  );
});

/**
 * Hook-style badge data provider.
 * Returns badge counts for common navigation items.
 */
export interface BadgeCounts {
  aufgaben: number;
  mieten: number;
  deals: number;
  kontakte: number;
  dokumente: number;
  wartung: number;
}

/** Compute badge counts from raw data */
export function computeBadgeCounts(data: {
  overdueTodos?: number;
  pendingRents?: number;
  newDeals?: number;
  unreadContacts?: number;
  expiringDocs?: number;
  overdueMaintenance?: number;
}): BadgeCounts {
  return {
    aufgaben: data.overdueTodos ?? 0,
    mieten: data.pendingRents ?? 0,
    deals: data.newDeals ?? 0,
    kontakte: data.unreadContacts ?? 0,
    dokumente: data.expiringDocs ?? 0,
    wartung: data.overdueMaintenance ?? 0,
  };
}
