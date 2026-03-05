/**
 * MOB-3: Swipe-Gesten auf Karten
 * Swipe-left for quick actions (edit, delete, share), swipe-right for favorite.
 * Similar to iOS Mail swipe pattern.
 */
import { memo, useRef, useState, useCallback } from "react";
import { Edit, Trash2, Share2, Star } from "lucide-react";
import { useHaptic } from "@/hooks/useHaptic";
import { cn } from "@/lib/utils";

interface SwipeAction {
  icon: React.ReactNode;
  label: string;
  color: string;
  onClick: () => void;
}

interface SwipeableCardProps {
  children: React.ReactNode;
  onEdit?: () => void;
  onDelete?: () => void;
  onShare?: () => void;
  onFavorite?: () => void;
  isFavorite?: boolean;
  /** Custom left-swipe actions (override defaults) */
  leftActions?: SwipeAction[];
  className?: string;
  disabled?: boolean;
}

export const SwipeableCard = memo(function SwipeableCard({
  children, onEdit, onDelete, onShare, onFavorite,
  isFavorite = false, leftActions, className, disabled = false,
}: SwipeableCardProps) {
  const haptic = useHaptic();
  const containerRef = useRef<HTMLDivElement>(null);
  const startX = useRef(0);
  const startY = useRef(0);
  const currentX = useRef(0);
  const swiping = useRef(false);
  const [offset, setOffset] = useState(0);
  const [direction, setDirection] = useState<"left" | "right" | null>(null);
  const threshold = 80;

  const defaultLeftActions: SwipeAction[] = [
    ...(onEdit ? [{ icon: <Edit className="h-4 w-4" />, label: "Bearbeiten", color: "bg-blue-500", onClick: onEdit }] : []),
    ...(onShare ? [{ icon: <Share2 className="h-4 w-4" />, label: "Teilen", color: "bg-violet-500", onClick: onShare }] : []),
    ...(onDelete ? [{ icon: <Trash2 className="h-4 w-4" />, label: "Löschen", color: "bg-red-500", onClick: onDelete }] : []),
  ];

  const actions = leftActions || defaultLeftActions;

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (disabled) return;
    startX.current = e.touches[0].clientX;
    startY.current = e.touches[0].clientY;
    swiping.current = true;
  }, [disabled]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!swiping.current || disabled) return;
    const diffX = e.touches[0].clientX - startX.current;
    const diffY = e.touches[0].clientY - startY.current;

    // Cancel if vertical scroll dominates
    if (Math.abs(diffY) > Math.abs(diffX) * 1.2) {
      swiping.current = false;
      setOffset(0);
      setDirection(null);
      return;
    }

    // Prevent default horizontal scroll
    if (Math.abs(diffX) > 10) {
      e.stopPropagation();
    }

    currentX.current = diffX;
    const maxSwipe = threshold * 1.5;
    const clampedOffset = Math.max(-maxSwipe, Math.min(maxSwipe, diffX));
    setOffset(clampedOffset);
    setDirection(clampedOffset < -10 ? "left" : clampedOffset > 10 ? "right" : null);

    // Haptic at threshold
    if (Math.abs(diffX) >= threshold && Math.abs(diffX) < threshold + 5) {
      haptic.tap();
    }
  }, [disabled, haptic, threshold]);

  const handleTouchEnd = useCallback(() => {
    if (!swiping.current || disabled) return;
    swiping.current = false;

    if (currentX.current < -threshold && actions.length > 0) {
      // Swipe left — show actions briefly then reset
      haptic.medium();
      setOffset(-threshold * 1.2);
      setTimeout(() => { setOffset(0); setDirection(null); }, 2000);
    } else if (currentX.current > threshold && onFavorite) {
      // Swipe right — toggle favorite
      haptic.success();
      onFavorite();
      setOffset(0);
      setDirection(null);
    } else {
      setOffset(0);
      setDirection(null);
    }
    currentX.current = 0;
  }, [disabled, haptic, threshold, actions.length, onFavorite]);

  const handleActionClick = useCallback((action: SwipeAction) => {
    haptic.tap();
    action.onClick();
    setOffset(0);
    setDirection(null);
  }, [haptic]);

  return (
    <div className={cn("relative overflow-hidden rounded-xl", className)}>
      {/* Right-side actions (shown on swipe left) */}
      <div className="absolute inset-y-0 right-0 flex items-center gap-1 pr-2 z-0">
        {actions.map((action, idx) => (
          <button
            key={idx}
            onClick={() => handleActionClick(action)}
            className={cn(
              "flex flex-col items-center justify-center gap-0.5 w-14 h-full text-white text-[9px] font-medium transition-opacity",
              action.color,
              direction === "left" ? "opacity-100" : "opacity-0",
            )}
            aria-label={action.label}
          >
            {action.icon}
            <span>{action.label}</span>
          </button>
        ))}
      </div>

      {/* Left-side favorite indicator (shown on swipe right) */}
      {onFavorite && (
        <div className={cn(
          "absolute inset-y-0 left-0 flex items-center pl-4 z-0 transition-opacity",
          direction === "right" ? "opacity-100" : "opacity-0",
        )}>
          <div className="flex flex-col items-center gap-0.5 text-amber-500">
            <Star className={cn("h-6 w-6", isFavorite ? "fill-amber-500" : "")} />
            <span className="text-[9px] font-medium">{isFavorite ? "Entfernen" : "Favorit"}</span>
          </div>
        </div>
      )}

      {/* Content layer */}
      <div
        ref={containerRef}
        className="relative z-10 bg-background transition-transform duration-200 ease-out"
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
