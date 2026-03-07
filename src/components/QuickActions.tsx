import { useState, useRef, useEffect } from "react";
import { Plus, Wrench, MessageSquare, CreditCard, StickyNote, FileText, Camera, Landmark, BarChart3, Receipt, Sparkles, Store } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { ROUTES } from "@/lib/routes";

interface QuickActionsProps {
  onScrollTo: (section: string) => void;
  onNavigate?: (path: string) => void;
}

const QuickActions = ({ onScrollTo, onNavigate }: QuickActionsProps) => {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // Improvement 20: Keyboard shortcut Q
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "q" && !e.metaKey && !e.ctrlKey && !e.altKey) {
        const tag = (e.target as HTMLElement).tagName;
        if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
        e.preventDefault();
        setOpen(prev => !prev);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  const actions = [
    { id: "tickets", label: "Ticket erstellen", icon: Wrench, color: "text-gold", shortcut: "1", navigate: false },
    { id: "messages", label: "Nachricht senden", icon: MessageSquare, color: "text-primary", shortcut: "2", navigate: false },
    { id: "payments", label: "Zahlung erfassen", icon: CreditCard, color: "text-profit", shortcut: "3", navigate: false },
    { id: "notes", label: "Notiz hinzufügen", icon: StickyNote, color: "text-muted-foreground", shortcut: "4", navigate: false },
    { id: "documents", label: "Dokument hochladen", icon: FileText, color: "text-accent-foreground", shortcut: "5", navigate: false },
    { id: "viewings", label: "Besichtigung erfassen", icon: Camera, color: "text-accent", shortcut: "6", navigate: true, path: ROUTES.BESICHTIGUNGEN },
    { id: "deals", label: "Deal erstellen", icon: Landmark, color: "text-blue-500", shortcut: "7", navigate: true, path: ROUTES.DEALS },
    { id: "scout", label: "WGH-Scout", icon: Store, color: "text-emerald-600", shortcut: "S", navigate: true, path: ROUTES.CRM_SCOUT },
    { id: "rent", label: "Mietübersicht", icon: BarChart3, color: "text-amber-500", shortcut: "8", navigate: true, path: ROUTES.RENT },
    { id: "nebenkosten", label: "Nebenkosten", icon: Receipt, color: "text-emerald-500", shortcut: "9", navigate: true, path: ROUTES.NK },
    { id: "immo-ai", label: "Immo-AI", icon: Sparkles, color: "text-violet-500", shortcut: "0", navigate: true, path: ROUTES.AI },
  ];

  return (
    <div ref={ref} className="relative">
      {/* Improvement 20: Better styled quick action button */}
      {/* UI-UPDATE-49: Tooltip on quick action trigger */}
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            onClick={() => setOpen(!open)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium border border-primary/20 rounded-lg bg-primary/5 hover:bg-primary/10 text-primary transition-colors touch-target min-h-[44px]"
          >
            <Plus className="h-3.5 w-3.5" /> Schnellaktion
            <kbd className="hidden sm:inline text-[10px] ml-1 px-1 py-0.5 rounded bg-primary/10 text-primary/70">Q</kbd>
          </button>
        </TooltipTrigger>
        <TooltipContent>Schnellaktion (Q)</TooltipContent>
      </Tooltip>
      {open && (
        <div className="absolute right-0 top-full mt-1 w-52 p-1 bg-popover border border-border rounded-lg shadow-lg z-[9999] animate-fade-in">
          {actions.map(action => {
            const Icon = action.icon;
            const navAction = "navigate" in action && action.navigate && onNavigate;
            return (
              <button
                key={action.id}
                onClick={() => {
                  if (navAction && "path" in action && action.path) {
                    onNavigate(action.path);
                  } else {
                    onScrollTo(action.id);
                  }
                  setOpen(false);
                }}
                className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-sm hover:bg-accent transition-colors cursor-pointer group touch-target min-h-[44px]`}
              >
                <Icon className={`h-4 w-4 ${action.color}`} />
                <span className="flex-1 text-left">{action.label}</span>
                <kbd className="text-[10px] px-1 py-0.5 rounded bg-secondary text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity">{action.shortcut}</kbd>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};

/* OPT-37: Quick action categories */
const ACTION_CATEGORIES = {
  PROPERTY: "property",
  FINANCE: "finance",
  TENANT: "tenant",
  DOCUMENT: "document",
} as const;

/* FUNC-50: Quick action shortcut mapping */
const QUICK_ACTION_SHORTCUTS: Record<string, string> = {
  "Neues Objekt": "Ctrl+N",
  "Neue Aufgabe": "Enter",
  "Suche": "Ctrl+K",
};


export default QuickActions;
