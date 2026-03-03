import { useState, useRef, useCallback, useEffect } from "react";

/**
 * Custom drag & drop reorder hook using pointer events.
 * Works on both desktop and mobile, supports scrolling while dragging.
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
  const autoScrollRef = useRef<number | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Auto-scroll when pointer is near viewport edges during drag
  const startAutoScroll = useCallback((clientY: number) => {
    if (autoScrollRef.current) cancelAnimationFrame(autoScrollRef.current);

    const EDGE_ZONE = 80; // px from edge to start scrolling
    const MAX_SPEED = 12; // max px per frame

    const tick = () => {
      const vh = window.innerHeight;
      let speed = 0;
      if (clientY < EDGE_ZONE) {
        speed = -MAX_SPEED * (1 - clientY / EDGE_ZONE);
      } else if (clientY > vh - EDGE_ZONE) {
        speed = MAX_SPEED * (1 - (vh - clientY) / EDGE_ZONE);
      }
      if (speed !== 0) {
        window.scrollBy(0, speed);
      }
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
  useEffect(() => {
    return () => stopAutoScroll();
  }, [stopAutoScroll]);

  const handleDragStart = useCallback((idx: number) => {
    dragItemRef.current = idx;
    setDragIdx(idx);
    setIsDragging(true);
  }, []);

  const handleDragOver = useCallback((idx: number) => {
    if (dragItemRef.current === null) return;
    setOverIdx(idx);
  }, []);

  const handleDragEnd = useCallback(() => {
    const from = dragItemRef.current;
    const to = overIdx;
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
    setDragIdx(null);
    setOverIdx(null);
    setIsDragging(false);
    stopAutoScroll();
  }, [items, overIdx, onReorder, storageKey, stopAutoScroll]);

  /** Props to spread on the drag handle element (the grip icon) */
  const getHandleProps = useCallback((idx: number) => ({
    onPointerDown: (e: React.PointerEvent) => {
      // Only primary button
      if (e.button !== 0) return;
      e.preventDefault();
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
      handleDragStart(idx);
      startAutoScroll(e.clientY);
    },
    onPointerMove: (e: React.PointerEvent) => {
      if (dragItemRef.current === null) return;
      // Update auto-scroll based on pointer position
      stopAutoScroll();
      startAutoScroll(e.clientY);

      // Find which item we're over based on pointer position
      if (!containerRef.current) return;
      const children = Array.from(containerRef.current.children) as HTMLElement[];
      for (let i = 0; i < children.length; i++) {
        const rect = children[i].getBoundingClientRect();
        if (e.clientY >= rect.top && e.clientY <= rect.bottom) {
          handleDragOver(i);
          break;
        }
      }
    },
    onPointerUp: () => {
      handleDragEnd();
    },
    onPointerCancel: () => {
      handleDragEnd();
    },
    style: { touchAction: "none" as const, cursor: "grab" },
  }), [handleDragStart, handleDragOver, handleDragEnd, startAutoScroll, stopAutoScroll]);

  /** Also support native HTML5 drag for desktop (better UX with drag ghost) */
  const getItemProps = useCallback((idx: number) => ({
    draggable: true,
    onDragStart: (e: React.DragEvent) => {
      e.dataTransfer.effectAllowed = "move";
      handleDragStart(idx);
    },
    onDragOver: (e: React.DragEvent) => {
      e.preventDefault();
      handleDragOver(idx);
    },
    onDragEnd: () => {
      handleDragEnd();
    },
  }), [handleDragStart, handleDragOver, handleDragEnd]);

  return {
    dragIdx,
    overIdx,
    isDragging,
    containerRef,
    getHandleProps,
    getItemProps,
  };
}
