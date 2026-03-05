/**
 * MOB3-1: Mobile Sticky Action Bar
 * Fixed action bar at bottom of screen with context-dependent buttons.
 * Replaces hard-to-reach top buttons on mobile.
 * Safari-safe: uses env(safe-area-inset-bottom) for notch devices.
 */
import { memo, type ReactNode } from "react";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";

export interface StickyAction {
  id: string;
  label: string;
  icon: ReactNode;
  onClick: () => void;
  variant?: "default" | "primary" | "destructive";
  disabled?: boolean;
}

interface MobileStickyActionBarProps {
  actions: StickyAction[];
  visible?: boolean;
  className?: string;
}

export const MobileStickyActionBar = memo(function MobileStickyActionBar({
  actions, visible = true, className,
}: MobileStickyActionBarProps) {
  const isMobile = useIsMobile();
  if (!isMobile || !visible || actions.length === 0) return null;

  return (
    <div
      className={cn(
        "fixed bottom-0 left-0 right-0 z-[200] bg-background/95 backdrop-blur-md border-t border-border",
        "flex items-center justify-around gap-1 px-2 py-2",
        "transition-transform duration-300",
        /* Safari safe area */
        className,
      )}
      style={{ paddingBottom: "max(0.5rem, env(safe-area-inset-bottom, 0px))" }}
      role="toolbar"
      aria-label="Aktionsleiste"
    >
      {actions.map((action) => (
        <button
          key={action.id}
          onClick={action.onClick}
          disabled={action.disabled}
          className={cn(
            "flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-lg text-[10px] font-medium transition-all active:scale-95",
            "min-w-[60px]",
            action.variant === "primary" && "text-primary",
            action.variant === "destructive" && "text-destructive",
            !action.variant || action.variant === "default" ? "text-muted-foreground" : "",
            action.disabled && "opacity-40 pointer-events-none",
            "hover:bg-secondary/80",
            /* WebKit tap highlight removal for Safari */
            "[&]:-webkit-tap-highlight-color:transparent",
          )}
          aria-label={action.label}
        >
          <span className="h-5 w-5 flex items-center justify-center">{action.icon}</span>
          <span className="truncate max-w-[64px]">{action.label}</span>
        </button>
      ))}
    </div>
  );
});
