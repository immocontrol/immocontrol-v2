/**
 * useVirtualList — lightweight virtual scrolling hook for long lists.
 * Improvement 5: VirtualList usage for performance with large datasets.
 * Only renders items visible in the viewport + buffer.
 */
import { useState, useCallback, useMemo, useRef, useEffect } from "react";

interface VirtualListOptions {
  /** Height of each item in pixels */
  itemHeight: number;
  /** Number of items to render above/below visible area (default: 5) */
  overscan?: number;
}

interface VirtualListResult<T> {
  /** Items currently visible (sliced from full list) */
  visibleItems: T[];
  /** Total height of the virtual container in pixels */
  totalHeight: number;
  /** Offset from top for the first visible item */
  offsetTop: number;
  /** Start index in the original array */
  startIndex: number;
  /** Ref callback to attach to the scroll container */
  containerRef: (node: HTMLElement | null) => void;
  /** Scroll to a specific index */
  scrollToIndex: (index: number) => void;
}

export function useVirtualList<T>(
  items: T[],
  options: VirtualListOptions,
): VirtualListResult<T> {
  const { itemHeight, overscan = 5 } = options;
  const [scrollTop, setScrollTop] = useState(0);
  const [containerHeight, setContainerHeight] = useState(0);
  const containerRef = useRef<HTMLElement | null>(null);

  const handleScroll = useCallback(() => {
    if (containerRef.current) {
      setScrollTop(containerRef.current.scrollTop);
    }
  }, []);

  const refCallback = useCallback(
    (node: HTMLElement | null) => {
      // Cleanup old listener
      if (containerRef.current) {
        containerRef.current.removeEventListener("scroll", handleScroll);
      }
      containerRef.current = node;
      if (node) {
        setContainerHeight(node.clientHeight);
        node.addEventListener("scroll", handleScroll, { passive: true });
      }
    },
    [handleScroll],
  );

  // Observe container resize
  useEffect(() => {
    const node = containerRef.current;
    if (!node) return;
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setContainerHeight(entry.contentRect.height);
      }
    });
    ro.observe(node);
    return () => ro.disconnect();
  }, []);

  const { visibleItems, startIndex, offsetTop } = useMemo(() => {
    const totalItems = items.length;
    if (totalItems === 0 || containerHeight === 0) {
      return { visibleItems: [] as T[], startIndex: 0, offsetTop: 0 };
    }

    const visibleCount = Math.ceil(containerHeight / itemHeight);
    const rawStart = Math.floor(scrollTop / itemHeight);
    const start = Math.max(0, rawStart - overscan);
    const end = Math.min(totalItems, rawStart + visibleCount + overscan);

    return {
      visibleItems: items.slice(start, end),
      startIndex: start,
      offsetTop: start * itemHeight,
    };
  }, [items, itemHeight, overscan, scrollTop, containerHeight]);

  const totalHeight = items.length * itemHeight;

  const scrollToIndex = useCallback(
    (index: number) => {
      if (containerRef.current) {
        containerRef.current.scrollTop = index * itemHeight;
      }
    },
    [itemHeight],
  );

  return {
    visibleItems,
    totalHeight,
    offsetTop,
    startIndex,
    containerRef: refCallback,
    scrollToIndex,
  };
}
