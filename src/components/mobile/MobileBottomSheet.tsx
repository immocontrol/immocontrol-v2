/**
 * MOB-14: Mobile Property-Detail als Bottom Sheet
 * Bottom sheet component (like Google Maps) that slides up from the bottom.
 * Multiple snap points: Peek (25%), Half (50%), Full (95%).
 * Dismiss via swipe-down gesture.
 */
import { memo, useState, useCallback, useRef, useEffect } from "react";
import { X } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";
import { useHaptic } from "@/hooks/useHaptic";
import { cn } from "@/lib/utils";

type SnapPoint = "peek" | "half" | "full" | "closed";

const SNAP_HEIGHTS: Record<SnapPoint, number> = {
  peek: 25,
  half: 50,
  full: 95,
  closed: 0,
};

interface MobileBottomSheetProps {
  open: boolean;
  onClose: () => void;
  /** Initial snap point (default: "half") */
  initialSnap?: SnapPoint;
  /** Title shown in the handle area */
  title?: string;
  /** Subtitle */
  subtitle?: string;
  children: React.ReactNode;
  className?: string;
}

export const MobileBottomSheet = memo(function MobileBottomSheet({
  open, onClose, initialSnap = "half", title, subtitle,
  children, className,
}: MobileBottomSheetProps) {
  const isMobile = useIsMobile();
  const haptic = useHaptic();
  const [currentSnap, setCurrentSnap] = useState<SnapPoint>(initialSnap);
  const [dragOffset, setDragOffset] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const startY = useRef(0);
  const startHeight = useRef(0);
  const sheetRef = useRef<HTMLDivElement>(null);

  // Reset snap point when sheet opens
  useEffect(() => {
    if (open) {
      setCurrentSnap(initialSnap);
      setDragOffset(0);
    }
  }, [open, initialSnap]);

  // Prevent body scroll when sheet is open
  useEffect(() => {
    if (open && isMobile) {
      document.body.style.overflow = "hidden";
      return () => { document.body.style.overflow = ""; };
    }
  }, [open, isMobile]);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    // Only initiate drag from the handle area or top of sheet
    const target = e.target as HTMLElement;
    if (!target.closest("[data-sheet-handle]")) return;

    startY.current = e.touches[0].clientY;
    startHeight.current = SNAP_HEIGHTS[currentSnap];
    setIsDragging(true);
  }, [currentSnap]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!isDragging) return;
    const diffY = e.touches[0].clientY - startY.current;
    const heightChange = (diffY / window.innerHeight) * 100;
    setDragOffset(heightChange);
  }, [isDragging]);

  const handleTouchEnd = useCallback(() => {
    if (!isDragging) return;
    setIsDragging(false);

    const currentHeight = startHeight.current - dragOffset;
    setDragOffset(0);

    // Determine closest snap point
    if (currentHeight < 10) {
      // Dismiss
      haptic.tap();
      onClose();
      return;
    }

    // Find nearest snap point
    const snapPoints: SnapPoint[] = ["peek", "half", "full"];
    let nearest: SnapPoint = "half";
    let minDist = Infinity;

    for (const sp of snapPoints) {
      const dist = Math.abs(currentHeight - SNAP_HEIGHTS[sp]);
      if (dist < minDist) {
        minDist = dist;
        nearest = sp;
      }
    }

    haptic.tap();
    setCurrentSnap(nearest);
  }, [isDragging, dragOffset, haptic, onClose]);

  const snapToPoint = useCallback((point: SnapPoint) => {
    haptic.tap();
    if (point === "closed") {
      onClose();
    } else {
      setCurrentSnap(point);
    }
  }, [haptic, onClose]);

  if (!open) return null;

  // Desktop: render as regular modal/dialog
  if (!isMobile) {
    return (
      <div className="fixed inset-0 z-[250] flex items-center justify-center bg-black/50 animate-fade-in" onClick={onClose}>
        <div
          className={cn("bg-background rounded-xl border border-border shadow-2xl w-full max-w-2xl max-h-[80vh] overflow-y-auto m-4", className)}
          onClick={e => e.stopPropagation()}
        >
          {title && (
            <div className="sticky top-0 bg-background border-b border-border px-4 py-3 flex items-center justify-between z-10">
              <div>
                <h3 className="font-semibold">{title}</h3>
                {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
              </div>
              <button onClick={onClose} className="p-2 rounded-md hover:bg-secondary">
                <X className="h-4 w-4" />
              </button>
            </div>
          )}
          <div className="p-4">{children}</div>
        </div>
      </div>
    );
  }

  const currentHeight = Math.max(0, SNAP_HEIGHTS[currentSnap] - dragOffset);

  return (
    <>
      {/* Backdrop */}
      <div
        className={cn(
          "fixed inset-0 z-[240] bg-black/50 transition-opacity duration-300",
          currentSnap === "peek" ? "opacity-30" : "opacity-50",
        )}
        onClick={() => snapToPoint("closed")}
      />

      {/* Sheet */}
      <div
        ref={sheetRef}
        className={cn(
          "fixed bottom-0 left-0 right-0 z-[250] bg-background rounded-t-2xl shadow-2xl flex flex-col",
          !isDragging && "transition-all duration-300 ease-out",
          className,
        )}
        style={{
          height: `${currentHeight}vh`,
          maxHeight: "95vh",
          paddingBottom: "env(safe-area-inset-bottom, 0px)",
        }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {/* Handle bar */}
        <div data-sheet-handle className="shrink-0 pt-3 pb-2 cursor-grab active:cursor-grabbing">
          <div className="w-10 h-1 bg-border rounded-full mx-auto" />
        </div>

        {/* Header */}
        {title && (
          <div data-sheet-handle className="shrink-0 px-4 pb-3 flex items-center justify-between border-b border-border cursor-grab">
            <div>
              <h3 className="font-semibold text-base">{title}</h3>
              {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
            </div>
            <button onClick={() => snapToPoint("closed")} className="p-2 -mr-2 rounded-md hover:bg-secondary">
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        {/* Snap point indicators */}
        <div data-sheet-handle className="shrink-0 flex items-center justify-center gap-2 py-1.5 cursor-grab">
          {(["peek", "half", "full"] as const).map((sp) => (
            <button
              key={sp}
              onClick={() => snapToPoint(sp)}
              className={cn(
                "w-2 h-2 rounded-full transition-all",
                currentSnap === sp ? "bg-primary scale-125" : "bg-border hover:bg-muted-foreground/50",
              )}
              aria-label={`${sp === "peek" ? "Klein" : sp === "half" ? "Mittel" : "Vollbild"}`}
            />
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto overscroll-contain px-4 py-2">
          {children}
        </div>
      </div>
    </>
  );
});
