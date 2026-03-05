/**
 * MOB5-13: Mobile Progress Tracker
 * Visual property lifecycle progress tracker.
 * Shows stages: Suche → Kauf → Renovierung → Vermietung → Optimierung.
 * Touch-optimized with expandable stage details.
 */
import { useState, useCallback, memo, type ReactNode } from "react";
import { useIsMobile } from "@/hooks/use-mobile";
import {
  Search, Key, Hammer, Home, TrendingUp,
  Check, Circle, ChevronDown, ChevronUp,
} from "lucide-react";
import { cn } from "@/lib/utils";

export interface ProgressStage {
  /** Stage key */
  key: string;
  /** Stage label */
  label: string;
  /** Stage description */
  description?: string;
  /** Icon */
  icon?: ReactNode;
  /** Status */
  status: "completed" | "current" | "upcoming";
  /** Completion percentage (0-100) */
  progress?: number;
  /** Substeps */
  substeps?: { label: string; completed: boolean }[];
  /** Date completed or expected */
  date?: string;
}

interface MobileProgressTrackerProps {
  /** Progress stages */
  stages: ProgressStage[];
  /** Layout orientation */
  orientation?: "horizontal" | "vertical";
  /** Show percentages */
  showProgress?: boolean;
  /** Stage click handler */
  onStageClick?: (stage: ProgressStage) => void;
  /** Additional class */
  className?: string;
}

const DEFAULT_ICONS: Record<string, ReactNode> = {
  suche: <Search className="w-4 h-4" />,
  kauf: <Key className="w-4 h-4" />,
  renovierung: <Hammer className="w-4 h-4" />,
  vermietung: <Home className="w-4 h-4" />,
  optimierung: <TrendingUp className="w-4 h-4" />,
};

const statusStyles = {
  completed: {
    dot: "bg-green-500 text-white",
    line: "bg-green-500",
    text: "text-foreground",
    badge: "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300",
  },
  current: {
    dot: "bg-primary text-primary-foreground ring-4 ring-primary/20",
    line: "bg-primary/30",
    text: "text-primary font-semibold",
    badge: "bg-primary/10 text-primary",
  },
  upcoming: {
    dot: "bg-muted text-muted-foreground border-2 border-border",
    line: "bg-border",
    text: "text-muted-foreground",
    badge: "bg-muted text-muted-foreground",
  },
};

export const MobileProgressTracker = memo(function MobileProgressTracker({
  stages,
  orientation = "horizontal",
  showProgress = false,
  onStageClick,
  className,
}: MobileProgressTrackerProps) {
  const isMobile = useIsMobile();
  const [expandedStage, setExpandedStage] = useState<string | null>(null);

  const effectiveOrientation = isMobile ? "horizontal" : orientation;

  const toggleExpand = useCallback((key: string) => {
    setExpandedStage(prev => (prev === key ? null : key));
  }, []);

  if (effectiveOrientation === "horizontal") {
    return (
      <div className={cn("w-full", className)}>
        {/* Horizontal progress bar */}
        <div
          className="flex items-start overflow-x-auto scrollbar-none pb-2 -mx-1 px-1"
          style={{ WebkitOverflowScrolling: "touch" }}
        >
          {stages.map((stage, index) => {
            const styles = statusStyles[stage.status];
            const icon = stage.icon || DEFAULT_ICONS[stage.key.toLowerCase()] || <Circle className="w-4 h-4" />;
            const isLast = index === stages.length - 1;

            return (
              <div key={stage.key} className="flex items-start shrink-0">
                <button
                  onClick={() => {
                    toggleExpand(stage.key);
                    onStageClick?.(stage);
                  }}
                  className="flex flex-col items-center gap-1.5 px-2 min-w-[72px]"
                >
                  {/* Icon circle */}
                  <div className={cn(
                    "w-10 h-10 rounded-full flex items-center justify-center transition-all",
                    styles.dot,
                    isMobile && "w-11 h-11"
                  )}>
                    {stage.status === "completed" ? <Check className="w-4 h-4" /> : icon}
                  </div>

                  {/* Label */}
                  <span className={cn("text-[10px] text-center leading-tight", styles.text)}>
                    {stage.label}
                  </span>

                  {/* Progress percentage */}
                  {showProgress && stage.progress !== undefined && (
                    <span className={cn("text-[10px] px-1.5 py-0.5 rounded-full", styles.badge)}>
                      {stage.progress}%
                    </span>
                  )}
                </button>

                {/* Connector line */}
                {!isLast && (
                  <div className="flex items-center mt-5 -mx-1">
                    <div className={cn("h-0.5 w-6", styles.line)} />
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Expanded stage details */}
        {expandedStage && (
          <div className="mt-3 pt-3 border-t">
            {(() => {
              const stage = stages.find(s => s.key === expandedStage);
              if (!stage) return null;
              return <StageDetails stage={stage} />;
            })()}
          </div>
        )}
      </div>
    );
  }

  // Vertical layout
  return (
    <div className={cn("w-full", className)}>
      {stages.map((stage, index) => {
        const styles = statusStyles[stage.status];
        const icon = stage.icon || DEFAULT_ICONS[stage.key.toLowerCase()] || <Circle className="w-4 h-4" />;
        const isLast = index === stages.length - 1;
        const isExpanded = expandedStage === stage.key;

        return (
          <div key={stage.key} className="relative flex gap-3">
            {/* Vertical line + dot */}
            <div className="flex flex-col items-center">
              <div className={cn(
                "w-10 h-10 rounded-full flex items-center justify-center shrink-0",
                styles.dot,
                isMobile && "w-11 h-11"
              )}>
                {stage.status === "completed" ? <Check className="w-4 h-4" /> : icon}
              </div>
              {!isLast && (
                <div className={cn("w-0.5 flex-1 min-h-[24px]", styles.line)} />
              )}
            </div>

            {/* Content */}
            <div className={cn("flex-1 pb-4", isLast && "pb-0")}>
              <button
                onClick={() => {
                  toggleExpand(stage.key);
                  onStageClick?.(stage);
                }}
                className="w-full text-left"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className={cn("text-sm", styles.text)}>{stage.label}</p>
                    {stage.date && (
                      <p className="text-[10px] text-muted-foreground mt-0.5">{stage.date}</p>
                    )}
                  </div>
                  {stage.substeps && stage.substeps.length > 0 && (
                    isExpanded ? (
                      <ChevronUp className="w-4 h-4 text-muted-foreground" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-muted-foreground" />
                    )
                  )}
                </div>
              </button>

              {isExpanded && <StageDetails stage={stage} />}
            </div>
          </div>
        );
      })}
    </div>
  );
});

/** Stage detail content */
const StageDetails = memo(function StageDetails({ stage }: { stage: ProgressStage }) {
  return (
    <div className="mt-2 space-y-2">
      {stage.description && (
        <p className="text-xs text-muted-foreground">{stage.description}</p>
      )}
      {stage.substeps && stage.substeps.length > 0 && (
        <div className="space-y-1">
          {stage.substeps.map((substep, i) => (
            <div key={i} className="flex items-center gap-2">
              <div className={cn(
                "w-4 h-4 rounded-full flex items-center justify-center",
                substep.completed
                  ? "bg-green-500 text-white"
                  : "border border-border"
              )}>
                {substep.completed && <Check className="w-2.5 h-2.5" />}
              </div>
              <span className={cn(
                "text-xs",
                substep.completed ? "text-foreground line-through" : "text-muted-foreground"
              )}>
                {substep.label}
              </span>
            </div>
          ))}
        </div>
      )}
      {stage.progress !== undefined && (
        <div className="mt-2">
          <div className="flex justify-between text-[10px] text-muted-foreground mb-1">
            <span>Fortschritt</span>
            <span>{stage.progress}%</span>
          </div>
          <div className="h-1.5 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-primary rounded-full transition-all"
              style={{ width: `${stage.progress}%` }}
            />
          </div>
        </div>
      )}
    </div>
  );
});
