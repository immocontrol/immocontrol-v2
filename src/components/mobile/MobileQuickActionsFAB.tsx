/**
 * MOB2-3: Mobile Quick-Actions FAB-Menü
 * Expandable floating action button with context-aware actions.
 * Shows: new property, new deal, scan document, new contact.
 */
import { memo, useState, useCallback, useEffect } from "react";
import { Plus, Building2, Handshake, Camera, Users, X } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";
import { useHaptic } from "@/hooks/useHaptic";
import { cn } from "@/lib/utils";

interface QuickAction {
  id: string;
  label: string;
  icon: React.ReactNode;
  color: string;
  onClick: () => void;
}

interface MobileQuickActionsFABProps {
  onNewProperty?: () => void;
  onNewDeal?: () => void;
  onScanDocument?: () => void;
  onNewContact?: () => void;
  /** Custom actions (override defaults) */
  actions?: QuickAction[];
  className?: string;
}

export const MobileQuickActionsFAB = memo(function MobileQuickActionsFAB({
  onNewProperty, onNewDeal, onScanDocument, onNewContact, actions: customActions, className,
}: MobileQuickActionsFABProps) {
  const isMobile = useIsMobile();
  const haptic = useHaptic();
  const [expanded, setExpanded] = useState(false);

  const defaultActions: QuickAction[] = [
    ...(onNewProperty ? [{ id: "property", label: "Neues Objekt", icon: <Building2 className="h-4 w-4" />, color: "bg-blue-500", onClick: onNewProperty }] : []),
    ...(onNewDeal ? [{ id: "deal", label: "Neuer Deal", icon: <Handshake className="h-4 w-4" />, color: "bg-purple-500", onClick: onNewDeal }] : []),
    ...(onScanDocument ? [{ id: "scan", label: "Dokument scannen", icon: <Camera className="h-4 w-4" />, color: "bg-emerald-500", onClick: onScanDocument }] : []),
    ...(onNewContact ? [{ id: "contact", label: "Neuer Kontakt", icon: <Users className="h-4 w-4" />, color: "bg-orange-500", onClick: onNewContact }] : []),
  ];

  const fabActions = customActions || defaultActions;

  // Close on Escape
  useEffect(() => {
    if (!expanded) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") { setExpanded(false); }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [expanded]);

  const toggle = useCallback(() => {
    haptic.tap();
    setExpanded(prev => !prev);
  }, [haptic]);

  const handleAction = useCallback((action: QuickAction) => {
    haptic.medium();
    setExpanded(false);
    // Small delay so animation finishes
    setTimeout(() => action.onClick(), 150);
  }, [haptic]);

  if (!isMobile || fabActions.length === 0) return null;

  return (
    <>
      {/* Backdrop */}
      {expanded && (
        <div
          className="fixed inset-0 z-[170] bg-black/30 animate-fade-in"
          onClick={() => setExpanded(false)}
        />
      )}

      <div
        className={cn("fixed z-[180] right-4", className)}
        style={{ bottom: "calc(80px + env(safe-area-inset-bottom, 0px))" }}
      >
        {/* Speed dial actions */}
        {expanded && (
          <div className="flex flex-col-reverse gap-3 mb-4 animate-fade-in">
            {fabActions.map((action, idx) => (
              <button
                key={action.id}
                onClick={() => handleAction(action)}
                className="flex items-center gap-3 animate-fade-in"
                style={{ animationDelay: `${idx * 60}ms` }}
              >
                <span className="whitespace-nowrap rounded-xl border border-border/80 bg-background/95 px-3 py-2 text-sm font-medium shadow-md backdrop-blur-sm">
                  {action.label}
                </span>
                <div className={cn(
                  "flex h-12 w-12 items-center justify-center rounded-full text-white shadow-xl transition-transform duration-base ease-out-modern active:scale-90",
                  action.color,
                )}>
                  {action.icon}
                </div>
              </button>
            ))}
          </div>
        )}

        {/* Main FAB */}
        <button
          onClick={toggle}
          className={cn(
            "w-14 h-14 rounded-full bg-primary text-primary-foreground shadow-xl flex items-center justify-center transition-all duration-300 active:scale-95",
            expanded && "rotate-45 bg-destructive",
          )}
          aria-label={expanded ? "Menü schließen" : "Schnellaktionen"}
          aria-expanded={expanded}
        >
          {expanded ? <X className="h-6 w-6" /> : <Plus className="h-6 w-6" />}
        </button>
      </div>
    </>
  );
});
