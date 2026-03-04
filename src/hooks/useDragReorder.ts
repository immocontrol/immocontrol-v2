import { useState, useRef, useCallback, useEffect } from "react";

/**
 * Custom drag & drop reorder hook using pointer events only.
 * Works on both desktop and mobile, supports scrolling while dragging.
 *
 * Fixed: removed HTML5 drag (draggable/onDragStart/onDragOver/onDragEnd) to
 * prevent dual-event conflicts with pointer events on the grip handle.
 * Fixed: skip dragged item during hit-testing to prevent jitter loop.
 * Fixed: check both clientX & clientY for 2-column grid layouts.
 *
 * @param items - The array of items to reorder
 * @param onReorder - Callback when items are reordered
 * @param storageKey - Optional localStorage key to persist order
 */
export function useDragReorder<T>(
  items: T[],
  onReorder: (newItems: T[]) => void,
  storageKey?: string,
) {
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [overIdx, setOverIdx] = useState<number | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const dragItemRef = useRef<number | null>(null);
  const overIdxRef = useRef<number | null>(null);
  const autoScrollRef = useRef<number | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  /* Track latest clientY for auto-scroll (updated every pointerMove) */
  const lastClientY = useRef(0);

  // Keep overIdxRef in sync with state
  useEffect(() => { overIdxRef.current = overIdx; }, [overIdx]);

  // Auto-scroll when pointer is near viewport edges during drag.
  // Uses a ref for clientY so only one rAF loop runs (no restart per move).
  const startAutoScroll = useCallback(() => {
    if (autoScrollRef.current) return; // already running
    const EDGE_ZONE = 80; // px from edge to start scrolling
    const MAX_SPEED = 12; // max px per frame

    const tick = () => {
      const y = lastClientY.current;
      const vh = window.innerHeight;
      let speed = 0;
      if (y < EDGE_ZONE) {
        speed = -MAX_SPEED * (1 - y / EDGE_ZONE);
      } else if (y > vh - EDGE_ZONE) {
        speed = MAX_SPEED * (1 - (vh - y) / EDGE_ZONE);
      }
      if (speed !== 0) window.scrollBy(0, speed);
      autoScrollRef.current = requestAnimationFrame(tick);
    };
    autoScrollRef.current = requestAnimationFrame(tick);
  }, []);

  const stopAutoScroll = useCallback(() => {
    if (autoScrollRef.current) {
      cancelAnimationFrame(autoScrollRef.current);
      autoScrollRef.current = null;
    }
  }, []);

  // Cleanup on unmount
  useEffect(() => () => stopAutoScroll(), [stopAutoScroll]);

  /* STR-8: Haptic feedback on drag start for mobile devices */
  const handleDragStart = useCallback((idx: number) => {
    dragItemRef.current = idx;
    setDragIdx(idx);
    setIsDragging(true);
    if (navigator.vibrate) navigator.vibrate(30);
  }, []);

  const handleDragOver = useCallback((idx: number) => {
    if (dragItemRef.current === null) return;
    if (idx !== overIdxRef.current) {
      overIdxRef.current = idx;
      setOverIdx(idx);
      /* iOS-style: light haptic on hover change */
      if (navigator.vibrate) navigator.vibrate(10);
    }
  }, []);

  /** Compute the preview order during drag (iOS-style live reorder) */
  const getPreviewOrder = useCallback((): T[] => {
    if (dragItemRef.current === null || overIdx === null || dragItemRef.current === overIdx) return items;
    const next = [...items];
    const [removed] = next.splice(dragItemRef.current, 1);
    next.splice(overIdx, 0, removed);
    return next;
  }, [items, overIdx]);

  const handleDragEnd = useCallback(() => {
    const from = dragItemRef.current;
    const to = overIdxRef.current;
    if (from !== null && to !== null && from !== to) {
      const next = [...items];
      const [removed] = next.splice(from, 1);
      next.splice(to, 0, removed);
      onReorder(next);
      if (storageKey) {
        try { localStorage.setItem(storageKey, JSON.stringify(next)); } catch { /* */ }
      }
    }
    dragItemRef.current = null;
    overIdxRef.current = null;
    setDragIdx(null);
    setOverIdx(null);
    setIsDragging(false);
    stopAutoScroll();
    /* STR-8: Short haptic pulse on drop */
    if (navigator.vibrate && from !== null && to !== null && from !== to) {
      navigator.vibrate(15);
    }
  }, [items, onReorder, storageKey, stopAutoScroll]);

  /**
   * Hit-test: find which grid child the pointer is over.
   * Checks both X and Y for correct behaviour in multi-column grids.
   * Skips the dragged item to prevent a jitter feedback loop where
   * hovering over the dragged item resets the preview order, causing
   * the DOM to reorder, causing a new hover target, etc.
   */
  const hitTest = useCallback((clientX: number, clientY: number) => {
    if (!containerRef.current) return;
    const children = Array.from(containerRef.current.children) as HTMLElement[];
    for (let i = 0; i < children.length; i++) {
      const attr = children[i].dataset.dragIdx;
      const origIdx = attr !== undefined ? Number(attr) : i;
      // Skip the item being dragged to prevent jitter
      if (origIdx === dragItemRef.current) continue;
      const rect = children[i].getBoundingClientRect();
      if (
        clientX >= rect.left && clientX <= rect.right &&
        clientY >= rect.top && clientY <= rect.bottom
      ) {
        handleDragOver(origIdx);
        return;
      }
    }
  }, [handleDragOver]);

  /** Props to spread on the drag handle element (the grip icon) — pointer events only */
  const getHandleProps = useCallback((idx: number) => ({
    onPointerDown: (e: React.PointerEvent) => {
      // Only primary button
      if (e.button !== 0) return;
      e.preventDefault();
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
      lastClientY.current = e.clientY;
      handleDragStart(idx);
      startAutoScroll();
    },
    onPointerMove: (e: React.PointerEvent) => {
      if (dragItemRef.current === null) return;
      lastClientY.current = e.clientY;
      hitTest(e.clientX, e.clientY);
    },
    onPointerUp: () => {
      handleDragEnd();
    },
    onPointerCancel: () => {
      handleDragEnd();
    },
    style: { touchAction: "none" as const, cursor: isDragging ? "grabbing" : "grab" },
  }), [handleDragStart, handleDragEnd, hitTest, startAutoScroll, isDragging]);

  /**
   * Props to spread on each draggable item container.
   * No HTML5 drag — avoids dual-event conflict with pointer events on the handle.
   * Items must set data-drag-idx={originalIndex} for hit-testing.
   */
  const getItemProps = useCallback((_idx: number) => ({}), []);

  return {
    dragIdx,
    overIdx,
    isDragging,
    containerRef,
    getHandleProps,
    getItemProps,
    getPreviewOrder,
  };
}
