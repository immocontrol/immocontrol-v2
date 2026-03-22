import { useState, useRef, useCallback, useEffect } from "react";
import { appScrollBy } from "@/lib/appScrollContainer";

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
      if (speed !== 0) appScrollBy(speed, "auto");
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
   * Must be declared before the useEffect that uses it (avoids TDZ "Cannot access before initialization").
   */
  const hitTest = useCallback((clientX: number, clientY: number) => {
    if (!containerRef.current) return;
    const children = Array.from(containerRef.current.children) as HTMLElement[];
    for (let i = 0; i < children.length; i++) {
      const attr = children[i].dataset.dragIdx;
      const origIdx = attr !== undefined ? Number(attr) : i;
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

  /* Document-level pointer listeners when dragging — allows long-press on card to start drag (iOS-style) */
  useEffect(() => {
    if (!isDragging) return;
    const onMove = (e: PointerEvent) => {
      lastClientY.current = e.clientY;
      hitTest(e.clientX, e.clientY);
    };
    const onUp = () => handleDragEnd();
    document.addEventListener("pointermove", onMove, { capture: true });
    document.addEventListener("pointerup", onUp, { capture: true });
    document.addEventListener("pointercancel", onUp, { capture: true });
    return () => {
      document.removeEventListener("pointermove", onMove, { capture: true });
      document.removeEventListener("pointerup", onUp, { capture: true });
      document.removeEventListener("pointercancel", onUp, { capture: true });
    };
  }, [isDragging, handleDragEnd, hitTest]);

  /** Props to spread on the drag handle element (the grip icon). Document listeners handle move/up when dragging. */
  const getHandleProps = useCallback((idx: number) => ({
    onPointerDown: (e: React.PointerEvent) => {
      if (e.button !== 0) return;
      e.preventDefault();
      lastClientY.current = e.clientY;
      handleDragStart(idx);
      startAutoScroll();
    },
    style: { touchAction: "none" as const, cursor: isDragging ? "grabbing" : "grab" },
  }), [handleDragStart, startAutoScroll, isDragging]);

  /**
   * Props to spread on each draggable item container.
   * No HTML5 drag — avoids dual-event conflict with pointer events on the handle.
   * Items must set data-drag-idx={originalIndex} for hit-testing.
   */
  const getItemProps = useCallback((_idx: number) => ({}), []);

  /** Start drag programmatically (e.g. after long-press on card). Use with document listeners. */
  const startDrag = useCallback((idx: number) => {
    handleDragStart(idx);
    startAutoScroll();
  }, [handleDragStart, startAutoScroll]);

  return {
    dragIdx,
    overIdx,
    isDragging,
    containerRef,
    getHandleProps,
    getItemProps,
    getPreviewOrder,
    startDrag,
  };
}
