import { useState, useRef, useEffect } from "react";
import { Plus, Wrench, MessageSquare, CreditCard, StickyNote, FileText } from "lucide-react";

interface QuickActionsProps {
  onScrollTo: (section: string) => void;
}

const QuickActions = ({ onScrollTo }: QuickActionsProps) => {
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
    { id: "tickets", label: "Ticket erstellen", icon: Wrench, color: "text-gold", shortcut: "1" },
    { id: "messages", label: "Nachricht senden", icon: MessageSquare, color: "text-primary", shortcut: "2" },
    { id: "payments", label: "Zahlung erfassen", icon: CreditCard, color: "text-profit", shortcut: "3" },
    { id: "notes", label: "Notiz hinzufügen", icon: StickyNote, color: "text-muted-foreground", shortcut: "4" },
    { id: "documents", label: "Dokument hochladen", icon: FileText, color: "text-accent-foreground", shortcut: "5" },
  ];

  return (
    <div ref={ref} className="relative">
      {/* Improvement 20: Better styled quick action button */}
      <button
        onClick={() => setOpen(!open)}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium border border-primary/20 rounded-lg bg-primary/5 hover:bg-primary/10 text-primary transition-colors"
        title="Schnellaktion (Q)"
      >
        <Plus className="h-3.5 w-3.5" /> Schnellaktion
        <kbd className="hidden sm:inline text-[10px] ml-1 px-1 py-0.5 rounded bg-primary/10 text-primary/70">Q</kbd>
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1 w-52 p-1 bg-popover border border-border rounded-lg shadow-lg z-50 animate-fade-in">
          {actions.map(action => {
            const Icon = action.icon;
            return (
              <button
                key={action.id}
                onClick={() => { onScrollTo(action.id); setOpen(false); }}
                className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-sm hover:bg-accent transition-colors cursor-pointer group"
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

export default QuickActions;
