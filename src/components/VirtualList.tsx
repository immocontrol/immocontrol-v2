/**
 * IMP-6: Lightweight virtual list component for rendering long lists efficiently.
 * Only renders items visible in the viewport + a small overscan buffer.
 * No external dependencies — uses native IntersectionObserver + CSS transforms.
 */

import { useState, useRef, useEffect, useCallback, memo } from "react";

interface VirtualListProps<T> {
  items: T[];
  itemHeight: number;
  overscan?: number;
  renderItem: (item: T, index: number) => React.ReactNode;
  className?: string;
  /** Maximum height of the scroll container */
  maxHeight?: number;
  /** Unique key extractor */
  getKey?: (item: T, index: number) => string | number;
  /** Fallback when items is empty */
  emptyMessage?: string;
}

function VirtualListInner<T>({
  items,
  itemHeight,
  overscan = 5,
  renderItem,
  className = "",
  maxHeight = 600,
  getKey,
  emptyMessage = "Keine Einträge",
}: VirtualListProps<T>) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [containerHeight, setContainerHeight] = useState(maxHeight);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const obs = new ResizeObserver((entries) => {
      const last = entries[entries.length - 1];
      if (last) requestAnimationFrame(() => setContainerHeight(last.contentRect.height));
    });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  const handleScroll = useCallback(() => {
    if (containerRef.current) {
      setScrollTop(containerRef.current.scrollTop);
    }
  }, []);

  if (items.length === 0) {
    return (
      <div className={`flex items-center justify-center py-8 text-sm text-muted-foreground ${className}`}>
        {emptyMessage}
      </div>
    );
  }

  const totalHeight = items.length * itemHeight;
  const startIndex = Math.max(0, Math.floor(scrollTop / itemHeight) - overscan);
  const endIndex = Math.min(
    items.length,
    Math.ceil((scrollTop + containerHeight) / itemHeight) + overscan
  );

  const visibleItems = items.slice(startIndex, endIndex);

  return (
    <div
      ref={containerRef}
      onScroll={handleScroll}
      className={`overflow-auto ${className}`}
      style={{ maxHeight }}
    >
      <div style={{ height: totalHeight, position: "relative" }}>
        {visibleItems.map((item, i) => {
          const actualIndex = startIndex + i;
          const key = getKey ? getKey(item, actualIndex) : actualIndex;
          return (
            <div
              key={key}
              style={{
                position: "absolute",
                top: actualIndex * itemHeight,
                left: 0,
                right: 0,
                height: itemHeight,
              }}
            >
              {renderItem(item, actualIndex)}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export const VirtualList = memo(VirtualListInner) as typeof VirtualListInner;
