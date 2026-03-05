/**
 * MOB5-6: Mobile Infinite Scroll
 * Lazy-loading for long lists with intersection observer.
 * Shows loading indicator and supports pull-to-refresh pattern.
 */
import { useRef, useEffect, useCallback, useState, memo, type ReactNode } from "react";
import { useIsMobile } from "@/hooks/use-mobile";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface MobileInfiniteScrollProps {
  /** Content to render */
  children: ReactNode;
  /** Whether more data can be loaded */
  hasMore: boolean;
  /** Loading state */
  isLoading: boolean;
  /** Callback to load more data */
  onLoadMore: () => void;
  /** Threshold in pixels before reaching bottom to trigger load */
  threshold?: number;
  /** Custom loading indicator */
  loadingIndicator?: ReactNode;
  /** Custom end-of-list message */
  endMessage?: ReactNode;
  /** Additional class */
  className?: string;
}

export const MobileInfiniteScroll = memo(function MobileInfiniteScroll({
  children,
  hasMore,
  isLoading,
  onLoadMore,
  threshold = 200,
  loadingIndicator,
  endMessage,
  className,
}: MobileInfiniteScrollProps) {
  const isMobile = useIsMobile();
  const sentinelRef = useRef<HTMLDivElement>(null);
  const loadMoreRef = useRef(onLoadMore);

  // Keep ref up to date
  useEffect(() => {
    loadMoreRef.current = onLoadMore;
  }, [onLoadMore]);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel || !hasMore || isLoading) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          loadMoreRef.current();
        }
      },
      {
        rootMargin: `0px 0px ${threshold}px 0px`,
      }
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasMore, isLoading, threshold]);

  return (
    <div className={cn("w-full", className)}>
      {children}

      {/* Sentinel element for intersection observer */}
      <div ref={sentinelRef} className="w-full h-1" />

      {/* Loading indicator */}
      {isLoading && (
        <div className={cn(
          "flex items-center justify-center py-6",
          isMobile && "py-4"
        )}>
          {loadingIndicator || (
            <div className="flex items-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin text-primary" />
              <span className="text-xs text-muted-foreground">Lade weitere Einträge...</span>
            </div>
          )}
        </div>
      )}

      {/* End of list */}
      {!hasMore && !isLoading && (
        <div className="flex items-center justify-center py-4">
          {endMessage || (
            <span className="text-xs text-muted-foreground">
              Alle Einträge geladen
            </span>
          )}
        </div>
      )}
    </div>
  );
});

/**
 * Hook for managing infinite scroll state.
 */
export function useInfiniteScroll<T>(
  fetchFn: (page: number) => Promise<{ items: T[]; hasMore: boolean }>,
  pageSize: number = 20
) {
  const [items, setItems] = useState<T[]>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadMore = useCallback(async () => {
    if (isLoading || !hasMore) return;
    setIsLoading(true);
    setError(null);

    try {
      const result = await fetchFn(page);
      setItems(prev => [...prev, ...result.items]);
      setHasMore(result.hasMore);
      setPage(prev => prev + 1);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Fehler beim Laden");
    } finally {
      setIsLoading(false);
    }
  }, [fetchFn, page, hasMore, isLoading]);

  const reset = useCallback(() => {
    setItems([]);
    setPage(1);
    setHasMore(true);
    setError(null);
  }, []);

  return { items, hasMore, isLoading, error, loadMore, reset };
}
