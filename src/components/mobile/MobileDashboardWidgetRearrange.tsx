/**
 * MOB3-19: Mobile Dashboard Widget Rearrange
 * Touch-optimized widget reordering on Dashboard with visual drop-zones and preview.
 * Safari-safe: uses touch events with requestAnimationFrame for smooth performance.
 */
import { memo, useRef, useState, useCallback, useEffect, type ReactNode } from "react";
import { GripVertical, Check, X } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";
import { useHaptic } from "@/hooks/useHaptic";
import { cn } from "@/lib/utils";

export interface Widget {
  id: string;
  title: string;
  visible: boolean;
}

interface MobileDashboardWidgetRearrangeProps {
  widgets: Widget[];
  onReorder: (widgets: Widget[]) => void;
  onToggleVisibility: (widgetId: string) => void;
  renderPreview?: (widget: Widget) => ReactNode;
  className?: string;
}

export const MobileDashboardWidgetRearrange = memo(function MobileDashboardWidgetRearrange({
  widgets, onReorder, onToggleVisibility, renderPreview, className,
}: MobileDashboardWidgetRearrangeProps) {
  const isMobile = useIsMobile();
  const haptic = useHaptic();
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [dropIdx, setDropIdx] = useState<number | null>(null);
  const [editing, setEditing] = useState(false);
  const itemRefs = useRef<Map<number, HTMLDivElement>>(new Map());
  const autoScrollRef = useRef<number | null>(null);

  const stopAutoScroll = useCallback(() => {
    if (autoScrollRef.current) {
      cancelAnimationFrame(autoScrollRef.current);
      autoScrollRef.current = null;
    }
  }, []);

  useEffect(() => () => stopAutoScroll(), [stopAutoScroll]);

  const handleDragStart = useCallback((idx: number) => {
    haptic.medium();
    setDragIdx(idx);
    setDropIdx(idx);
  }, [haptic]);

  const handleDragMove = useCallback((e: React.TouchEvent) => {
    if (dragIdx === null) return;
    const touchY = e.touches[0].clientY;

    // Auto-scroll near edges
    const edgeThreshold = 60;
    stopAutoScroll();
    if (touchY < edgeThreshold) {
      const scroll = () => { window.scrollBy(0, -4); autoScrollRef.current = requestAnimationFrame(scroll); };
      autoScrollRef.current = requestAnimationFrame(scroll);
    } else if (touchY > window.innerHeight - edgeThreshold) {
      const scroll = () => { window.scrollBy(0, 4); autoScrollRef.current = requestAnimationFrame(scroll); };
      autoScrollRef.current = requestAnimationFrame(scroll);
    }

    // Detect drop target
    for (const [idx, el] of itemRefs.current) {
      const rect = el.getBoundingClientRect();
      if (touchY >= rect.top && touchY <= rect.bottom && idx !== dropIdx) {
        setDropIdx(idx);
        haptic.tap();
        break;
      }
    }
  }, [dragIdx, dropIdx, haptic, stopAutoScroll]);

  const handleDragEnd = useCallback(() => {
    stopAutoScroll();
    if (dragIdx !== null && dropIdx !== null && dragIdx !== dropIdx) {
      const newWidgets = [...widgets];
      const [moved] = newWidgets.splice(dragIdx, 1);
      newWidgets.splice(dropIdx, 0, moved);
      onReorder(newWidgets);
      haptic.success();
    }
    setDragIdx(null);
    setDropIdx(null);
  }, [dragIdx, dropIdx, widgets, onReorder, haptic, stopAutoScroll]);

  if (!isMobile) return null;

  return (
    <div className={cn("space-y-2", className)}>
      {/* Edit mode toggle */}
      <button
        onClick={() => { haptic.tap(); setEditing(!editing); }}
        className={cn(
          "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all",
          editing ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground",
        )}
      >
        {editing ? <Check className="h-3.5 w-3.5" /> : <GripVertical className="h-3.5 w-3.5" />}
        {editing ? "Fertig" : "Widgets anordnen"}
      </button>

      {/* Widget list */}
      {editing && (
        <div className="space-y-1 animate-fade-in" role="list" aria-label="Widgets anordnen">
          {widgets.map((widget, idx) => {
            const isDragging = dragIdx === idx;
            const isDropTarget = dropIdx === idx && dragIdx !== null && dragIdx !== idx;

            return (
              <div
                key={widget.id}
                ref={(el) => { if (el) itemRefs.current.set(idx, el); else itemRefs.current.delete(idx); }}
                className={cn(
                  "flex items-center gap-2 p-2.5 rounded-lg border transition-all",
                  isDragging && "opacity-50 scale-[0.97] border-primary bg-primary/5",
                  isDropTarget && "border-primary border-dashed bg-primary/5",
                  !isDragging && !isDropTarget && "border-border bg-background",
                )}
                role="listitem"
              >
                {/* Drag handle */}
                <div
                  onTouchStart={() => handleDragStart(idx)}
                  onTouchMove={handleDragMove}
                  onTouchEnd={handleDragEnd}
                  className="flex items-center justify-center w-8 h-8 shrink-0 cursor-grab active:cursor-grabbing touch-none rounded-lg hover:bg-secondary"
                  aria-label={`${widget.title} verschieben`}
                  role="button"
                >
                  <GripVertical className="h-4 w-4 text-muted-foreground" />
                </div>

                {/* Widget info */}
                <div className="flex-1 min-w-0">
                  <span className={cn(
                    "text-sm font-medium truncate block",
                    !widget.visible && "text-muted-foreground line-through",
                  )}>
                    {widget.title}
                  </span>
                  {renderPreview && widget.visible && (
                    <div className="mt-1 text-[10px] text-muted-foreground">
                      {renderPreview(widget)}
                    </div>
                  )}
                </div>

                {/* Visibility toggle */}
                <button
                  onClick={() => { haptic.tap(); onToggleVisibility(widget.id); }}
                  className={cn(
                    "w-8 h-8 rounded-lg flex items-center justify-center shrink-0 transition-colors",
                    widget.visible ? "bg-primary/10 text-primary" : "bg-secondary text-muted-foreground",
                  )}
                  aria-label={widget.visible ? `${widget.title} ausblenden` : `${widget.title} einblenden`}
                >
                  {widget.visible ? <Check className="h-4 w-4" /> : <X className="h-4 w-4" />}
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
});
