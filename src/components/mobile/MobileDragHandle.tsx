/**
 * MOB3-6: Mobile Drag Handle for Sorting
 * Vertical drag handles on mobile lists with touch-optimized drag & drop + auto-scroll.
 * Safari-safe: uses touch events with requestAnimationFrame for smooth performance.
 */
import { memo, useRef, useState, useCallback, useEffect, type ReactNode } from "react";
import { GripVertical } from "lucide-react";
import { useHaptic } from "@/hooks/useHaptic";
import { cn } from "@/lib/utils";
import { appScrollBy } from "@/lib/appScrollContainer";

interface MobileDragHandleProps<T> {
  items: T[];
  onReorder: (items: T[]) => void;
  renderItem: (item: T, index: number, isDragging: boolean) => ReactNode;
  keyExtractor: (item: T) => string;
  className?: string;
}

export const MobileDragHandle = memo(function MobileDragHandle<T>({
  items, onReorder, renderItem, keyExtractor, className,
}: MobileDragHandleProps<T>) {
  const haptic = useHaptic();
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<Map<number, HTMLDivElement>>(new Map());
  const touchStartY = useRef(0);
  const autoScrollRef = useRef<number | null>(null);

  const stopAutoScroll = useCallback(() => {
    if (autoScrollRef.current) {
      cancelAnimationFrame(autoScrollRef.current);
      autoScrollRef.current = null;
    }
  }, []);

  useEffect(() => () => stopAutoScroll(), [stopAutoScroll]);

  const handleDragStart = useCallback((idx: number, e: React.TouchEvent) => {
    haptic.medium();
    setDragIdx(idx);
    setDragOverIdx(idx);
    touchStartY.current = e.touches[0].clientY;
  }, [haptic]);

  const handleDragMove = useCallback((e: React.TouchEvent) => {
    if (dragIdx === null) return;
    const touchY = e.touches[0].clientY;

    // Auto-scroll near edges
    const edgeThreshold = 60;
    const scrollSpeed = 4;
    stopAutoScroll();

    if (touchY < edgeThreshold) {
      const scroll = () => {
        appScrollBy(-scrollSpeed, "auto");
        autoScrollRef.current = requestAnimationFrame(scroll);
      };
      autoScrollRef.current = requestAnimationFrame(scroll);
    } else if (touchY > window.innerHeight - edgeThreshold) {
      const scroll = () => {
        appScrollBy(scrollSpeed, "auto");
        autoScrollRef.current = requestAnimationFrame(scroll);
      };
      autoScrollRef.current = requestAnimationFrame(scroll);
    }

    // Find which item we're over
    for (const [idx, el] of itemRefs.current) {
      const rect = el.getBoundingClientRect();
      if (touchY >= rect.top && touchY <= rect.bottom) {
        if (idx !== dragOverIdx) {
          setDragOverIdx(idx);
          haptic.tap();
        }
        break;
      }
    }
  }, [dragIdx, dragOverIdx, haptic, stopAutoScroll]);

  const handleDragEnd = useCallback(() => {
    stopAutoScroll();
    if (dragIdx !== null && dragOverIdx !== null && dragIdx !== dragOverIdx) {
      const newItems = [...items];
      const [moved] = newItems.splice(dragIdx, 1);
      newItems.splice(dragOverIdx, 0, moved);
      onReorder(newItems);
      haptic.success();
    }
    setDragIdx(null);
    setDragOverIdx(null);
  }, [dragIdx, dragOverIdx, items, onReorder, haptic, stopAutoScroll]);

  return (
    <div ref={listRef} className={cn("space-y-1", className)} role="list" aria-label="Sortierbare Liste">
      {items.map((item, idx) => {
        const isDragging = dragIdx === idx;
        const isOver = dragOverIdx === idx && dragIdx !== null && dragIdx !== idx;
        return (
          <div
            key={keyExtractor(item)}
            ref={(el) => { if (el) itemRefs.current.set(idx, el); else itemRefs.current.delete(idx); }}
            className={cn(
              "flex items-center gap-2 transition-all duration-150",
              isDragging && "opacity-50 scale-[0.98]",
              isOver && "border-t-2 border-primary",
            )}
            role="listitem"
          >
            {/* Drag handle */}
            <div
              onTouchStart={(e) => handleDragStart(idx, e)}
              onTouchMove={handleDragMove}
              onTouchEnd={handleDragEnd}
              className="flex items-center justify-center w-8 h-8 shrink-0 cursor-grab active:cursor-grabbing touch-none"
              aria-label="Verschieben"
              role="button"
            >
              <GripVertical className="h-4 w-4 text-muted-foreground" />
            </div>
            <div className="flex-1 min-w-0">
              {renderItem(item, idx, isDragging)}
            </div>
          </div>
        );
      })}
    </div>
  );
}) as <T>(props: {
  items: T[];
  onReorder: (items: T[]) => void;
  renderItem: (item: T, index: number, isDragging: boolean) => ReactNode;
  keyExtractor: (item: T) => string;
  className?: string;
}) => React.ReactElement | null;
