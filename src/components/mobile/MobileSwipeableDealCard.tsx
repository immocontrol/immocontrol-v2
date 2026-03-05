/**
 * MOB2-2: Swipeable Deal-Karten im Kanban
 * On mobile, deal cards can be swiped left/right to move between stages.
 * Swipe-right advances to next stage, swipe-left goes back to previous stage.
 */
import { memo, useRef, useState, useCallback } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";
import { useHaptic } from "@/hooks/useHaptic";
import { cn } from "@/lib/utils";

interface Stage {
  key: string;
  label: string;
  color: string;
}

interface MobileSwipeableDealCardProps {
  children: React.ReactNode;
  currentStage: string;
  stages: readonly Stage[];
  onStageChange: (newStage: string) => void;
  className?: string;
}

export const MobileSwipeableDealCard = memo(function MobileSwipeableDealCard({
  children, currentStage, stages, onStageChange, className,
}: MobileSwipeableDealCardProps) {
  const isMobile = useIsMobile();
  const haptic = useHaptic();
  const startX = useRef(0);
  const startY = useRef(0);
  const swiping = useRef(false);
  const [offset, setOffset] = useState(0);
  const [swipeDirection, setSwipeDirection] = useState<"left" | "right" | null>(null);
  const threshold = 70;

  const currentIdx = stages.findIndex(s => s.key === currentStage);
  const prevStage = currentIdx > 0 ? stages[currentIdx - 1] : null;
  const nextStage = currentIdx < stages.length - 1 ? stages[currentIdx + 1] : null;

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    startX.current = e.touches[0].clientX;
    startY.current = e.touches[0].clientY;
    swiping.current = true;
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!swiping.current) return;
    const diffX = e.touches[0].clientX - startX.current;
    const diffY = e.touches[0].clientY - startY.current;

    if (Math.abs(diffY) > Math.abs(diffX) * 1.2) {
      swiping.current = false;
      setOffset(0);
      setSwipeDirection(null);
      return;
    }

    if (Math.abs(diffX) > 10) e.stopPropagation();

    const maxSwipe = threshold * 1.5;
    const clamped = Math.max(-maxSwipe, Math.min(maxSwipe, diffX));
    setOffset(clamped);

    if (clamped > 10 && prevStage) setSwipeDirection("right");
    else if (clamped < -10 && nextStage) setSwipeDirection("left");
    else setSwipeDirection(null);

    if (Math.abs(diffX) >= threshold && Math.abs(diffX) < threshold + 5) {
      haptic.tap();
    }
  }, [haptic, threshold, prevStage, nextStage]);

  const handleTouchEnd = useCallback(() => {
    if (!swiping.current) return;
    swiping.current = false;

    if (offset > threshold && prevStage) {
      haptic.success();
      onStageChange(prevStage.key);
    } else if (offset < -threshold && nextStage) {
      haptic.success();
      onStageChange(nextStage.key);
    }

    setOffset(0);
    setSwipeDirection(null);
  }, [offset, threshold, prevStage, nextStage, haptic, onStageChange]);

  if (!isMobile) return <>{children}</>;

  return (
    <div className={cn("relative overflow-hidden rounded-xl", className)}>
      {/* Stage indicators */}
      {swipeDirection === "right" && prevStage && (
        <div className="absolute inset-y-0 left-0 flex items-center pl-2 z-0">
          <div className="flex items-center gap-1 text-xs font-medium text-muted-foreground">
            <ChevronLeft className="h-4 w-4" />
            <div className={cn("w-2 h-2 rounded-full", prevStage.color)} />
            <span>{prevStage.label}</span>
          </div>
        </div>
      )}
      {swipeDirection === "left" && nextStage && (
        <div className="absolute inset-y-0 right-0 flex items-center pr-2 z-0">
          <div className="flex items-center gap-1 text-xs font-medium text-muted-foreground">
            <span>{nextStage.label}</span>
            <div className={cn("w-2 h-2 rounded-full", nextStage.color)} />
            <ChevronRight className="h-4 w-4" />
          </div>
        </div>
      )}

      {/* Content */}
      <div
        className="relative z-10 bg-background"
        style={{
          transform: `translateX(${offset}px)`,
          transition: swiping.current ? "none" : "transform 0.3s ease-out",
        }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {children}
      </div>
    </div>
  );
});
