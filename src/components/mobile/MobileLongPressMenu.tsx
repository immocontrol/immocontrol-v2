/**
 * MOB3-5: Mobile Long-Press Context Menu
 * Long-press on cards/rows opens a native-style context menu.
 * Safari-safe: uses touchstart/touchend with timer, prevents context menu default.
 */
import { memo, useRef, useState, useCallback, useEffect, type ReactNode } from "react";
import { useHaptic } from "@/hooks/useHaptic";
import { cn } from "@/lib/utils";

export interface ContextMenuItem {
  id: string;
  label: string;
  icon?: ReactNode;
  variant?: "default" | "destructive";
  onAction: () => void;
}

interface MobileLongPressMenuProps {
  children: ReactNode;
  items: ContextMenuItem[];
  /** Long press duration in ms (default: 500) */
  duration?: number;
  disabled?: boolean;
  className?: string;
}

export const MobileLongPressMenu = memo(function MobileLongPressMenu({
  children, items, duration = 500, disabled, className,
}: MobileLongPressMenuProps) {
  const haptic = useHaptic();
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuPos, setMenuPos] = useState({ x: 0, y: 0 });
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const touchRef = useRef<{ x: number; y: number } | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (disabled || items.length === 0) return;
    const t = e.touches[0];
    touchRef.current = { x: t.clientX, y: t.clientY };
    timerRef.current = setTimeout(() => {
      haptic.medium();
      // Position menu near touch point
      const x = Math.min(t.clientX, window.innerWidth - 180);
      const y = Math.min(t.clientY, window.innerHeight - items.length * 44 - 20);
      setMenuPos({ x, y });
      setMenuOpen(true);
    }, duration);
  }, [disabled, items.length, duration, haptic]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!touchRef.current) return;
    const t = e.touches[0];
    const dx = Math.abs(t.clientX - touchRef.current.x);
    const dy = Math.abs(t.clientY - touchRef.current.y);
    // Cancel if moved more than 10px
    if (dx > 10 || dy > 10) {
      clearTimer();
    }
  }, [clearTimer]);

  const handleTouchEnd = useCallback(() => {
    clearTimer();
  }, [clearTimer]);

  // Close menu on outside click
  useEffect(() => {
    if (!menuOpen) return;
    const handler = (e: MouseEvent | TouchEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener("touchstart", handler, { passive: true });
    document.addEventListener("mousedown", handler);
    return () => {
      document.removeEventListener("touchstart", handler);
      document.removeEventListener("mousedown", handler);
    };
  }, [menuOpen]);

  // Cleanup timer on unmount
  useEffect(() => clearTimer, [clearTimer]);

  const handleAction = useCallback((item: ContextMenuItem) => {
    haptic.tap();
    setMenuOpen(false);
    item.onAction();
  }, [haptic]);

  return (
    <>
      <div
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onContextMenu={(e) => e.preventDefault()}
        className={cn("select-none", className)}
      >
        {children}
      </div>

      {/* Context Menu Overlay */}
      {menuOpen && (
        <>
          <div className="fixed inset-0 z-[300] bg-black/20" onClick={() => setMenuOpen(false)} />
          <div
            ref={menuRef}
            className="fixed z-[310] bg-background rounded-xl border border-border shadow-2xl min-w-[160px] py-1 animate-scale-in overflow-hidden"
            style={{
              left: `${menuPos.x}px`,
              top: `${menuPos.y}px`,
              /* Safari: hardware acceleration for smooth animation */
              transform: "translateZ(0)",
            }}
            role="menu"
            aria-label="Kontextmenü"
          >
            {items.map((item) => (
              <button
                key={item.id}
                onClick={() => handleAction(item)}
                className={cn(
                  "flex items-center gap-2.5 w-full px-3.5 py-2.5 text-sm font-medium transition-colors",
                  "active:bg-secondary/80",
                  item.variant === "destructive"
                    ? "text-destructive hover:bg-destructive/10"
                    : "text-foreground hover:bg-secondary",
                )}
                role="menuitem"
              >
                {item.icon && <span className="h-4 w-4 flex items-center justify-center shrink-0">{item.icon}</span>}
                {item.label}
              </button>
            ))}
          </div>
        </>
      )}
    </>
  );
});
