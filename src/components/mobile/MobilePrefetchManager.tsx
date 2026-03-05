/**
 * MOB6-11: Mobile Prefetch Manager
 * Predictive prefetching based on user behavior (preload next likely page).
 * Tracks navigation patterns and preloads resources for faster transitions.
 */
import { useEffect, useCallback, useRef, useMemo, memo } from "react";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";

export interface PrefetchRoute {
  /** Route path */
  path: string;
  /** Prefetch priority (0-1) */
  priority: number;
  /** Resource URLs to prefetch */
  resources?: string[];
  /** Component to lazy-load */
  preloadFn?: () => Promise<unknown>;
}

interface NavigationEvent {
  from: string;
  to: string;
  timestamp: number;
}

interface MobilePrefetchManagerProps {
  /** Current route path */
  currentPath: string;
  /** Available routes with prefetch config */
  routes: PrefetchRoute[];
  /** Max concurrent prefetches */
  maxConcurrent?: number;
  /** Only prefetch on WiFi */
  wifiOnly?: boolean;
  /** Enable prediction based on history */
  enablePrediction?: boolean;
  /** Minimum probability to trigger prefetch (0-1) */
  minProbability?: number;
  /** Additional class (for debug overlay) */
  className?: string;
  /** Show debug info */
  debug?: boolean;
}

const STORAGE_KEY = "prefetch_nav_history";
const MAX_HISTORY = 100;

function getNavHistory(): NavigationEvent[] {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

function saveNavEvent(event: NavigationEvent) {
  try {
    const history = getNavHistory();
    history.push(event);
    // Keep only last N events
    const trimmed = history.slice(-MAX_HISTORY);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
  } catch {
    // Storage not available
  }
}

function predictNextRoutes(currentPath: string, history: NavigationEvent[]): Map<string, number> {
  const predictions = new Map<string, number>();
  const fromCurrent = history.filter(e => e.from === currentPath);
  const total = fromCurrent.length;

  if (total === 0) return predictions;

  const counts = new Map<string, number>();
  for (const event of fromCurrent) {
    counts.set(event.to, (counts.get(event.to) || 0) + 1);
  }

  for (const [path, count] of counts) {
    predictions.set(path, count / total);
  }

  return predictions;
}

export function usePrefetch(routes: PrefetchRoute[], currentPath: string, options?: {
  maxConcurrent?: number;
  wifiOnly?: boolean;
  enablePrediction?: boolean;
  minProbability?: number;
}) {
  const {
    maxConcurrent = 2,
    wifiOnly = false,
    enablePrediction = true,
    minProbability = 0.3,
  } = options || {};

  const prevPathRef = useRef(currentPath);
  const prefetchedRef = useRef(new Set<string>());
  const activeRef = useRef(0);

  // Record navigation event
  useEffect(() => {
    if (prevPathRef.current !== currentPath) {
      saveNavEvent({
        from: prevPathRef.current,
        to: currentPath,
        timestamp: Date.now(),
      });
      prevPathRef.current = currentPath;
    }
  }, [currentPath]);

  // Prefetch logic
  const doPrefetch = useCallback(async (route: PrefetchRoute) => {
    if (prefetchedRef.current.has(route.path)) return;
    if (activeRef.current >= maxConcurrent) return;

    // Check connection
    if (wifiOnly && "connection" in navigator) {
      const conn = (navigator as unknown as { connection: { effectiveType: string } }).connection;
      if (conn.effectiveType !== "4g" && conn.effectiveType !== "wifi") return;
    }

    prefetchedRef.current.add(route.path);
    activeRef.current++;

    try {
      // Prefetch component
      if (route.preloadFn) {
        await route.preloadFn();
      }

      // Prefetch resources
      if (route.resources) {
        for (const url of route.resources) {
          const link = document.createElement("link");
          link.rel = "prefetch";
          link.href = url;
          link.as = url.endsWith(".js") ? "script" : url.endsWith(".css") ? "style" : "fetch";
          document.head.appendChild(link);
        }
      }
    } catch {
      // Prefetch failed, remove from set to allow retry
      prefetchedRef.current.delete(route.path);
    } finally {
      activeRef.current--;
    }
  }, [maxConcurrent, wifiOnly]);

  // Trigger prefetching
  useEffect(() => {
    const timer = setTimeout(() => {
      // Priority-based prefetch
      const sortedRoutes = [...routes]
        .filter(r => r.path !== currentPath)
        .sort((a, b) => b.priority - a.priority);

      // Prediction-based prefetch
      if (enablePrediction) {
        const history = getNavHistory();
        const predictions = predictNextRoutes(currentPath, history);

        for (const route of sortedRoutes) {
          const probability = predictions.get(route.path) || 0;
          if (probability >= minProbability || route.priority >= 0.8) {
            doPrefetch(route);
          }
        }
      } else {
        // Just use priority
        for (const route of sortedRoutes.slice(0, maxConcurrent)) {
          if (route.priority >= 0.5) {
            doPrefetch(route);
          }
        }
      }
    }, 1000); // Delay to not interfere with current page load

    return () => clearTimeout(timer);
  }, [currentPath, routes, enablePrediction, minProbability, maxConcurrent, doPrefetch]);

  return {
    prefetch: doPrefetch,
    isPrefetched: (path: string) => prefetchedRef.current.has(path),
    prefetchedCount: prefetchedRef.current.size,
  };
}

export const MobilePrefetchManager = memo(function MobilePrefetchManager({
  currentPath,
  routes,
  maxConcurrent = 2,
  wifiOnly = false,
  enablePrediction = true,
  minProbability = 0.3,
  debug = false,
  className,
}: MobilePrefetchManagerProps) {
  const isMobile = useIsMobile();
  const { prefetchedCount, isPrefetched } = usePrefetch(routes, currentPath, {
    maxConcurrent,
    wifiOnly,
    enablePrediction,
    minProbability,
  });

  if (!debug) return null;

  return (
    <div className={cn(
      "fixed bottom-2 left-2 z-50 text-[9px] font-mono bg-black/80 text-green-400 rounded p-2 max-w-[200px]",
      className
    )}>
      <p>Prefetch: {prefetchedCount}/{routes.length}</p>
      <p>Path: {currentPath}</p>
      {routes.map(r => (
        <p key={r.path} className={isPrefetched(r.path) ? "text-green-400" : "text-gray-500"}>
          {isPrefetched(r.path) ? "✓" : "○"} {r.path} ({(r.priority * 100).toFixed(0)}%)
        </p>
      ))}
    </div>
  );
});
