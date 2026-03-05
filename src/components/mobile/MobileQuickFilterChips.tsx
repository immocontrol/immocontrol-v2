/**
 * MOB3-4: Mobile Quick-Filter Chips
 * Horizontal scrollable filter chips replacing Select dropdowns on mobile.
 * Touch-friendly, visible state, Safari-safe scrolling.
 */
import { memo, useRef, useCallback } from "react";
import { X } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";
import { useHaptic } from "@/hooks/useHaptic";
import { cn } from "@/lib/utils";

export interface FilterChip {
  id: string;
  label: string;
  count?: number;
  color?: string; // tailwind class
}

interface MobileQuickFilterChipsProps {
  chips: FilterChip[];
  selected: Set<string>;
  onToggle: (id: string) => void;
  onClearAll?: () => void;
  /** Allow multiple selections (default: true) */
  multiple?: boolean;
  className?: string;
}

export const MobileQuickFilterChips = memo(function MobileQuickFilterChips({
  chips, selected, onToggle, onClearAll, multiple = true, className,
}: MobileQuickFilterChipsProps) {
  const isMobile = useIsMobile();
  const haptic = useHaptic();
  const scrollRef = useRef<HTMLDivElement>(null);

  const handleToggle = useCallback((id: string) => {
    haptic.tap();
    onToggle(id);
  }, [haptic, onToggle]);

  if (!isMobile) return null;

  return (
    <div className={cn("relative", className)}>
      <div
        ref={scrollRef}
        className="flex items-center gap-1.5 overflow-x-auto scrollbar-hide py-1 px-1"
        style={{ WebkitOverflowScrolling: "touch" }}
        role="group"
        aria-label="Filter"
      >
        {/* Clear all button */}
        {selected.size > 0 && onClearAll && (
          <button
            onClick={() => { haptic.tap(); onClearAll(); }}
            className="flex items-center gap-1 px-2 py-1 rounded-full bg-destructive/10 text-destructive text-[11px] font-medium shrink-0 active:scale-95 transition-transform"
            aria-label="Alle Filter entfernen"
          >
            <X className="h-3 w-3" />
            Alle
          </button>
        )}

        {chips.map((chip) => {
          const isSelected = selected.has(chip.id);
          return (
            <button
              key={chip.id}
              onClick={() => handleToggle(chip.id)}
              className={cn(
                "flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium shrink-0",
                "transition-all active:scale-95",
                isSelected
                  ? cn("ring-1 ring-primary/40 shadow-sm", chip.color || "bg-primary/15 text-primary")
                  : "bg-secondary text-muted-foreground",
              )}
              aria-pressed={isSelected}
            >
              {chip.label}
              {chip.count !== undefined && (
                <span className={cn(
                  "ml-0.5 px-1 rounded-full text-[9px]",
                  isSelected ? "bg-primary/20" : "bg-muted",
                )}>
                  {chip.count}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
});
