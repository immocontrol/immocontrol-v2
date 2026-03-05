/**
 * MOB4-5: Mobile Bottom Navigation Context Menu
 * Long-press on bottom tab shows shortcuts.
 * Saves taps by providing direct actions from navigation.
 */
import { useState, useRef, useCallback, memo, type ReactNode } from "react";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";
import { useHaptic } from "@/hooks/useHaptic";

export interface NavContextAction {
  id: string;
  label: string;
  icon?: ReactNode;
  onClick: () => void;
}

interface MobileBottomNavContextProps {
  /** The tab element to wrap */
  children: ReactNode;
  /** Context menu actions shown on long press */
  actions: NavContextAction[];
  /** Label for the tab (shown in menu header) */
  tabLabel: string;
  /** Additional className */
  className?: string;
}

export const MobileBottomNavContext = memo(function MobileBottomNavContext({
  children,
  actions,
  tabLabel,
  className,
}: MobileBottomNavContextProps) {
  const isMobile = useIsMobile();
  const [isOpen, setIsOpen] = useState(false);
  const [menuPosition, setMenuPosition] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const touchRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const haptic = useHaptic();

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    const touch = e.touches[0];
    touchRef.current = { x: touch.clientX, y: touch.clientY };

    longPressTimer.current = setTimeout(() => {
      haptic.medium();
      setMenuPosition({
        x: Math.min(touch.clientX, window.innerWidth - 200),
        y: touch.clientY - 10,
      });
      setIsOpen(true);
    }, 500);
  }, [haptic]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    const touch = e.touches[0];
    const dx = Math.abs(touch.clientX - touchRef.current.x);
    const dy = Math.abs(touch.clientY - touchRef.current.y);
    if (dx > 10 || dy > 10) {
      if (longPressTimer.current) {
        clearTimeout(longPressTimer.current);
        longPressTimer.current = null;
      }
    }
  }, []);

  const handleTouchEnd = useCallback(() => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  }, []);

  const handleActionClick = useCallback((action: NavContextAction) => {
    haptic.tap();
    action.onClick();
    setIsOpen(false);
  }, [haptic]);

  if (!isMobile) {
    return <>{children}</>;
  }

  return (
    <>
      <div
        className={cn("relative", className)}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {children}
      </div>

      {/* Context menu overlay */}
      {isOpen && (
        <div className="fixed inset-0 z-50" role="dialog" aria-label={`${tabLabel} Aktionen`}>
          <div
            className="absolute inset-0"
            onClick={() => setIsOpen(false)}
          />
          <div
            className="absolute bg-background rounded-xl shadow-2xl border overflow-hidden min-w-[180px] animate-in zoom-in-95 fade-in duration-150"
            style={{
              left: `${menuPosition.x}px`,
              bottom: `${window.innerHeight - menuPosition.y + 10}px`,
            }}
          >
            {/* Header */}
            <div className="px-3 py-2 border-b bg-muted/50">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                {tabLabel}
              </span>
            </div>

            {/* Actions */}
            <div className="py-1">
              {actions.map((action) => (
                <button
                  key={action.id}
                  onClick={() => handleActionClick(action)}
                  className="flex items-center gap-3 w-full px-3 py-2.5 text-sm hover:bg-muted active:bg-muted/80 transition-colors"
                >
                  {action.icon && (
                    <span className="text-muted-foreground shrink-0">{action.icon}</span>
                  )}
                  <span>{action.label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
});
