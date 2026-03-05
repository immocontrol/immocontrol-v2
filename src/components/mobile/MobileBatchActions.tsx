/**
 * MOB4-17: Mobile Batch Actions
 * Multi-select mode for lists. Long-press activates selection,
 * then batch delete/archive/move. Saves individual editing.
 */
import { useState, useCallback, useRef, memo, type ReactNode } from "react";
import { useIsMobile } from "@/hooks/use-mobile";
import { Trash2, Archive, FolderOpen, X, CheckSquare, Square } from "lucide-react";
import { cn } from "@/lib/utils";
import { useHaptic } from "@/hooks/useHaptic";
import { Button } from "@/components/ui/button";

export interface BatchAction {
  id: string;
  label: string;
  icon: ReactNode;
  /** Action handler receives selected item IDs */
  onAction: (selectedIds: string[]) => void | Promise<void>;
  /** Color variant */
  variant?: "default" | "destructive";
}

interface MobileBatchActionsProps<T> {
  /** Items in the list */
  items: T[];
  /** Extract unique ID from item */
  keyExtractor: (item: T) => string;
  /** Render each item row */
  renderItem: (item: T, isSelected: boolean, toggleSelect: () => void) => ReactNode;
  /** Available batch actions */
  actions: BatchAction[];
  /** Whether batch mode is enabled */
  enabled?: boolean;
  /** Additional class */
  className?: string;
  /** Long-press duration in ms */
  longPressDuration?: number;
  /** Called when selection mode changes */
  onSelectionModeChange?: (active: boolean) => void;
}

export const MobileBatchActions = memo(function MobileBatchActions<T>({
  items,
  keyExtractor,
  renderItem,
  actions,
  enabled = true,
  className,
  longPressDuration = 500,
  onSelectionModeChange,
}: MobileBatchActionsProps<T>) {
  const isMobile = useIsMobile();
  const haptic = useHaptic();
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const touchMoved = useRef(false);

  const enterSelectionMode = useCallback((itemId: string) => {
    haptic.medium();
    setSelectionMode(true);
    setSelectedIds(new Set([itemId]));
    onSelectionModeChange?.(true);
  }, [haptic, onSelectionModeChange]);

  const exitSelectionMode = useCallback(() => {
    setSelectionMode(false);
    setSelectedIds(new Set());
    onSelectionModeChange?.(false);
  }, [onSelectionModeChange]);

  const toggleItem = useCallback((itemId: string) => {
    if (!selectionMode) return;
    haptic.tap();
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(itemId)) {
        next.delete(itemId);
      } else {
        next.add(itemId);
      }
      // Exit selection mode if nothing is selected
      if (next.size === 0) {
        setSelectionMode(false);
        onSelectionModeChange?.(false);
      }
      return next;
    });
  }, [selectionMode, haptic, onSelectionModeChange]);

  const selectAll = useCallback(() => {
    haptic.tap();
    setSelectedIds(new Set(items.map(keyExtractor)));
  }, [items, keyExtractor, haptic]);

  const deselectAll = useCallback(() => {
    haptic.tap();
    setSelectedIds(new Set());
  }, [haptic]);

  const handleAction = useCallback(async (action: BatchAction) => {
    if (selectedIds.size === 0) return;
    haptic.medium();
    await action.onAction(Array.from(selectedIds));
    exitSelectionMode();
  }, [selectedIds, haptic, exitSelectionMode]);

  const handleTouchStart = useCallback((itemId: string) => {
    if (!enabled || selectionMode) return;
    touchMoved.current = false;
    longPressTimer.current = setTimeout(() => {
      if (!touchMoved.current) {
        enterSelectionMode(itemId);
      }
    }, longPressDuration);
  }, [enabled, selectionMode, longPressDuration, enterSelectionMode]);

  const handleTouchMove = useCallback(() => {
    touchMoved.current = true;
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  }, []);

  const handleTouchEnd = useCallback(() => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  }, []);

  return (
    <div className={cn("relative", className)}>
      {/* Selection mode toolbar */}
      {selectionMode && (
        <div className="sticky top-0 z-30 flex items-center justify-between gap-2 px-3 py-2 bg-primary text-primary-foreground rounded-lg mb-2 animate-in slide-in-from-top duration-200">
          <div className="flex items-center gap-2">
            <button
              onClick={exitSelectionMode}
              className="p-1.5 rounded-full hover:bg-primary-foreground/20 transition-colors"
              aria-label="Auswahl beenden"
            >
              <X className="w-4 h-4" />
            </button>
            <span className="text-sm font-semibold">
              {selectedIds.size} ausgewählt
            </span>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={selectedIds.size === items.length ? deselectAll : selectAll}
              className="px-2 py-1 text-xs rounded-md hover:bg-primary-foreground/20 transition-colors"
            >
              {selectedIds.size === items.length ? "Keine" : "Alle"}
            </button>
          </div>
        </div>
      )}

      {/* Items list */}
      <div className="space-y-1">
        {items.map((item) => {
          const id = keyExtractor(item);
          const isSelected = selectedIds.has(id);

          return (
            <div
              key={id}
              className={cn(
                "relative transition-colors rounded-lg",
                selectionMode && isSelected && "bg-primary/5 ring-1 ring-primary/20"
              )}
              onTouchStart={() => handleTouchStart(id)}
              onTouchMove={handleTouchMove}
              onTouchEnd={handleTouchEnd}
              onClick={selectionMode ? () => toggleItem(id) : undefined}
            >
              {/* Selection checkbox */}
              {selectionMode && (
                <div className="absolute left-2 top-1/2 -translate-y-1/2 z-10">
                  {isSelected ? (
                    <CheckSquare className="w-5 h-5 text-primary" />
                  ) : (
                    <Square className="w-5 h-5 text-muted-foreground" />
                  )}
                </div>
              )}

              <div className={cn(selectionMode && "pl-9")}>
                {renderItem(item, isSelected, () => toggleItem(id))}
              </div>
            </div>
          );
        })}
      </div>

      {/* Batch action bar */}
      {selectionMode && selectedIds.size > 0 && (
        <div className="fixed bottom-0 left-0 right-0 z-40 bg-background border-t shadow-lg px-4 py-3 pb-safe animate-in slide-in-from-bottom duration-200">
          <div className="flex items-center justify-center gap-3">
            {actions.map((action) => (
              <Button
                key={action.id}
                variant={action.variant === "destructive" ? "destructive" : "outline"}
                size="sm"
                onClick={() => handleAction(action)}
                className="flex items-center gap-1.5"
              >
                {action.icon}
                <span className="text-xs">{action.label}</span>
              </Button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}) as <T>(props: MobileBatchActionsProps<T>) => JSX.Element;
