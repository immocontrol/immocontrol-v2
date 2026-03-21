/**
 * MOB3-16: Mobile Quick-Add Sheet
 * Bottom sheet with quick entry for common actions: New Task, New Contact, New Note, New Document.
 * Safari-safe: uses env(safe-area-inset-bottom) and touch events.
 */
import { memo, useState, useCallback } from "react";
import { Plus, CheckSquare, Users, FileText, StickyNote, X } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";
import { useHaptic } from "@/hooks/useHaptic";
import { cn } from "@/lib/utils";

export interface QuickAddOption {
  id: string;
  label: string;
  icon: React.ReactNode;
  color: string;
  onAction: () => void;
}

const DEFAULT_OPTIONS: QuickAddOption[] = [
  { id: "task", label: "Neue Aufgabe", icon: <CheckSquare className="h-5 w-5" />, color: "bg-blue-500/15 text-blue-600", onAction: () => {} },
  { id: "contact", label: "Neuer Kontakt", icon: <Users className="h-5 w-5" />, color: "bg-emerald-500/15 text-emerald-600", onAction: () => {} },
  { id: "note", label: "Neue Notiz", icon: <StickyNote className="h-5 w-5" />, color: "bg-amber-500/15 text-amber-600", onAction: () => {} },
  { id: "document", label: "Neues Dokument", icon: <FileText className="h-5 w-5" />, color: "bg-purple-500/15 text-purple-600", onAction: () => {} },
];

interface MobileQuickAddSheetProps {
  options?: QuickAddOption[];
  className?: string;
}

export const MobileQuickAddSheet = memo(function MobileQuickAddSheet({
  options = DEFAULT_OPTIONS, className,
}: MobileQuickAddSheetProps) {
  const isMobile = useIsMobile();
  const haptic = useHaptic();
  const [open, setOpen] = useState(false);

  const toggleSheet = useCallback(() => {
    haptic.tap();
    setOpen(prev => !prev);
  }, [haptic]);

  const handleAction = useCallback((option: QuickAddOption) => {
    haptic.medium();
    setOpen(false);
    option.onAction();
  }, [haptic]);

  if (!isMobile) return null;

  return (
    <>
      {/* FAB trigger */}
      <button
        onClick={toggleSheet}
        className={cn(
          "fixed right-4 z-[180] rounded-full bg-primary text-primary-foreground shadow-xl",
          "flex items-center justify-center w-12 h-12",
          "transition-all duration-300 active:scale-90",
          "transform-gpu",
          open && "rotate-45",
          className,
        )}
        style={{ bottom: "max(80px, calc(64px + env(safe-area-inset-bottom, 0px)))" }}
        aria-label={open ? "Schließen" : "Schnell hinzufügen"}
        aria-expanded={open}
      >
        {open ? <X className="h-5 w-5" /> : <Plus className="h-5 w-5" />}
      </button>

      {/* Backdrop */}
      {open && (
        <div
          className="fixed inset-0 z-[170] bg-black/30 animate-fade-in"
          onClick={() => { setOpen(false); }}
        />
      )}

      {/* Sheet content */}
      {open && (
        <div
          className="fixed z-[175] left-0 right-0 bg-background rounded-t-2xl border-t border-border shadow-2xl animate-slide-up"
          style={{
            bottom: 0,
            paddingBottom: "max(1rem, env(safe-area-inset-bottom, 0px))",
          }}
          role="dialog"
          aria-label="Schnell hinzufügen"
        >
          {/* Drag indicator */}
          <div className="flex justify-center py-2">
            <div className="w-10 h-1 rounded-full bg-border" />
          </div>

          <div className="px-4 pb-4">
            <h3 className="text-sm font-semibold mb-3">Schnell hinzufügen</h3>
            <div className="grid grid-cols-2 gap-2">
              {options.map((option) => (
                <button
                  key={option.id}
                  onClick={() => handleAction(option)}
                  className={cn(
                    "flex items-center gap-3 p-3 rounded-xl transition-all active:scale-95",
                    option.color,
                  )}
                >
                  {option.icon}
                  <span className="text-xs font-medium">{option.label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
});
