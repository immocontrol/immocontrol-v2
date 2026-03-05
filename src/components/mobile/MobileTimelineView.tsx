/**
 * MOB5-1: Mobile Timeline View
 * Vertical timeline for property history (Kaufdatum, Renovierung, Mietbeginn etc.).
 * Touch-optimized with collapsible details and smooth animations.
 * Replaces MOB5-1 StepProgress (MobileFormWizard already covers that).
 */
import { useState, useCallback, memo, type ReactNode } from "react";
import { useIsMobile } from "@/hooks/use-mobile";
import { ChevronDown, ChevronUp, Circle, CheckCircle2, Clock, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

export interface TimelineEvent {
  /** Unique ID */
  id: string;
  /** Event title */
  title: string;
  /** Date string (formatted) */
  date: string;
  /** Optional description */
  description?: string;
  /** Optional icon */
  icon?: ReactNode;
  /** Status of this event */
  status?: "completed" | "current" | "upcoming" | "warning";
  /** Optional metadata key-value pairs */
  metadata?: Record<string, string>;
}

interface MobileTimelineViewProps {
  /** Timeline events in chronological order */
  events: TimelineEvent[];
  /** Title above the timeline */
  title?: string;
  /** Whether to show newest first */
  reversed?: boolean;
  /** Additional class */
  className?: string;
  /** Callback when an event is tapped */
  onEventTap?: (event: TimelineEvent) => void;
}

const statusConfig = {
  completed: {
    color: "text-green-600 dark:text-green-400",
    bgColor: "bg-green-100 dark:bg-green-900/30",
    borderColor: "border-green-500",
    icon: CheckCircle2,
  },
  current: {
    color: "text-blue-600 dark:text-blue-400",
    bgColor: "bg-blue-100 dark:bg-blue-900/30",
    borderColor: "border-blue-500",
    icon: Circle,
  },
  upcoming: {
    color: "text-muted-foreground",
    bgColor: "bg-muted",
    borderColor: "border-muted-foreground/30",
    icon: Clock,
  },
  warning: {
    color: "text-orange-600 dark:text-orange-400",
    bgColor: "bg-orange-100 dark:bg-orange-900/30",
    borderColor: "border-orange-500",
    icon: AlertCircle,
  },
};

export const MobileTimelineView = memo(function MobileTimelineView({
  events,
  title,
  reversed = false,
  className,
  onEventTap,
}: MobileTimelineViewProps) {
  const isMobile = useIsMobile();
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const sortedEvents = reversed ? [...events].reverse() : events;

  const toggleExpand = useCallback((id: string) => {
    setExpandedId(prev => (prev === id ? null : id));
  }, []);

  return (
    <div className={cn("w-full", className)}>
      {title && (
        <h3 className="text-sm font-semibold mb-3">{title}</h3>
      )}

      <div className="relative">
        {/* Vertical line */}
        <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-border" />

        <div className="space-y-0">
          {sortedEvents.map((event, index) => {
            const status = event.status || "completed";
            const config = statusConfig[status];
            const StatusIcon = event.icon ? null : config.icon;
            const isExpanded = expandedId === event.id;
            const isLast = index === sortedEvents.length - 1;

            return (
              <div key={event.id} className={cn("relative", !isLast && "pb-4")}>
                {/* Dot / Icon */}
                <div
                  className={cn(
                    "absolute left-2 w-5 h-5 rounded-full flex items-center justify-center z-10",
                    config.bgColor,
                    "border-2",
                    config.borderColor
                  )}
                >
                  {event.icon || (StatusIcon && <StatusIcon className={cn("w-3 h-3", config.color)} />)}
                </div>

                {/* Content */}
                <button
                  className={cn(
                    "ml-10 w-[calc(100%-2.5rem)] text-left rounded-lg border p-3 transition-colors",
                    "hover:bg-muted/50 active:bg-muted",
                    status === "current" && "border-blue-200 dark:border-blue-800 bg-blue-50/50 dark:bg-blue-950/20",
                    isMobile && "min-h-[44px]"
                  )}
                  onClick={() => {
                    toggleExpand(event.id);
                    onEventTap?.(event);
                  }}
                  aria-expanded={isExpanded}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className={cn("text-sm font-medium", config.color)}>
                        {event.title}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {event.date}
                      </p>
                    </div>

                    {(event.description || event.metadata) && (
                      <span className="shrink-0 mt-0.5">
                        {isExpanded ? (
                          <ChevronUp className="w-4 h-4 text-muted-foreground" />
                        ) : (
                          <ChevronDown className="w-4 h-4 text-muted-foreground" />
                        )}
                      </span>
                    )}
                  </div>

                  {/* Expanded content */}
                  {isExpanded && (
                    <div className="mt-2 pt-2 border-t border-border/50">
                      {event.description && (
                        <p className="text-xs text-muted-foreground leading-relaxed">
                          {event.description}
                        </p>
                      )}
                      {event.metadata && (
                        <div className="mt-2 space-y-1">
                          {Object.entries(event.metadata).map(([key, value]) => (
                            <div key={key} className="flex justify-between text-xs">
                              <span className="text-muted-foreground">{key}</span>
                              <span className="font-medium">{value}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
});
