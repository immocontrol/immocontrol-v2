/**
 * Visual feedback for pull-to-refresh: circular progress → check when ready to release → spinner while refreshing.
 */
import type { RefObject } from "react";
import { Check, RefreshCw } from "lucide-react";

const R = 10;
const C = 2 * Math.PI * R;

export interface PullToRefreshIndicatorProps {
  rootRef: RefObject<HTMLDivElement | null>;
  opacity: number;
  translateY: number;
  progress: number;
  ready: boolean;
  refreshing: boolean;
}

export function PullToRefreshIndicator({
  rootRef,
  opacity,
  translateY,
  progress,
  ready,
  refreshing,
}: PullToRefreshIndicatorProps) {
  return (
    <div
      ref={rootRef}
      className="pointer-events-none fixed left-1/2 top-0 z-[300] flex h-11 w-11 items-center justify-center rounded-full border border-border bg-background text-primary shadow-xl"
      style={{
        opacity,
        transform: `translateX(-50%) translateY(${translateY}px)`,
        transition: opacity === 0 ? "opacity 220ms ease-out, transform 220ms ease-out" : undefined,
      }}
      aria-hidden
    >
      {refreshing ? (
        <RefreshCw className="h-5 w-5 animate-spin text-primary" />
      ) : ready ? (
        <Check className="h-6 w-6 text-primary" strokeWidth={2.5} aria-hidden />
      ) : (
        <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" aria-hidden>
          <circle cx="12" cy="12" r={R} stroke="currentColor" strokeWidth="2" className="text-muted-foreground/30" />
          <circle
            cx="12"
            cy="12"
            r={R}
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeDasharray={C}
            strokeDashoffset={C * (1 - Math.min(1, Math.max(0, progress)))}
            className="text-primary transition-[stroke-dashoffset] duration-75 ease-out"
          />
        </svg>
      )}
    </div>
  );
}
