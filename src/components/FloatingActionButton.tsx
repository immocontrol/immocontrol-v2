/**
 * UX-5: Floating Action Button (FAB) on Mobile
 * Central "+" button for quick creation on mobile devices.
 */
import React, { useState } from "react";
import { Plus } from "lucide-react";
import { useIsMobile } from "@/hooks/useMediaQuery";
import { cn } from "@/lib/utils";

interface FABAction {
  label: string;
  icon: React.ReactNode;
  onClick: () => void;
}

interface FloatingActionButtonProps {
  /** Primary action on single tap */
  onClick?: () => void;
  /** Multiple actions — shows a speed-dial menu */
  actions?: FABAction[];
  /** Custom class */
  className?: string;
  /** Only show on mobile (default: true) */
  mobileOnly?: boolean;
}

export function FloatingActionButton({
  onClick,
  actions,
  className,
  mobileOnly = true,
}: FloatingActionButtonProps) {
  const isMobile = useIsMobile();
  const [expanded, setExpanded] = useState(false);

  if (mobileOnly && !isMobile) return null;

  const handleClick = () => {
    if (actions && actions.length > 0) {
      setExpanded(!expanded);
    } else if (onClick) {
      onClick();
    }
  };

  return (
    <div className={cn("fixed z-[180] right-4", className)} style={{ bottom: "calc(80px + env(safe-area-inset-bottom, 0px))" }}>
      {/* Speed dial actions */}
      {expanded && actions && (
        <div className="flex flex-col-reverse gap-2 mb-3 animate-fade-in">
          {actions.map((action, idx) => (
            <button
              key={idx}
              onClick={() => { action.onClick(); setExpanded(false); }}
              className="flex items-center gap-2 bg-background border border-border rounded-full px-4 py-2.5 shadow-lg text-sm font-medium hover:bg-secondary transition-all"
              style={{ animationDelay: `${idx * 50}ms` }}
            >
              {action.icon}
              <span>{action.label}</span>
            </button>
          ))}
        </div>
      )}
      {/* Main FAB */}
      <button
        onClick={handleClick}
        className={cn(
          "w-14 h-14 rounded-full bg-primary text-primary-foreground shadow-xl flex items-center justify-center transition-all duration-200 active:scale-95",
          expanded && "rotate-45",
        )}
        aria-label="Neu erstellen"
      >
        <Plus className="h-6 w-6" />
      </button>
    </div>
  );
}
