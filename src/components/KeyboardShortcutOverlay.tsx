/**
 * #13: Keyboard Shortcut Overlay — press "?" to see all available shortcuts.
 * Similar to GitHub's shortcut overlay.
 */
import { useState, useEffect } from "react";
import { Keyboard, X } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

const SHORTCUT_GROUPS: { title: string; shortcuts: { keys: string; description: string }[] }[] = [
  {
    title: "Navigation",
    shortcuts: [
      { keys: "Alt+1", description: "Portfolio" },
      { keys: "Alt+2", description: "Darlehen" },
      { keys: "Alt+3", description: "Mieten" },
      { keys: "Alt+4", description: "Verträge" },
      { keys: "Alt+5", description: "Kontakte" },
      { keys: "Alt+6", description: "Aufgaben" },
      { keys: "Alt+7", description: "Berichte" },
      { keys: "Alt+8", description: "CRM" },
      { keys: "Alt+9", description: "Einstellungen" },
      { keys: "Alt+0", description: "Deals" },
    ],
  },
  {
    title: "Aktionen",
    shortcuts: [
      { keys: "Ctrl+K", description: "Suche öffnen / Spotlight" },
      { keys: "Cmd+K", description: "Globale Suche (Desktop)" },
      { keys: "Ctrl+N", description: "Neues Objekt anlegen" },
      { keys: "n", description: "Neue Besichtigung (auf /besichtigungen)" },
      { keys: "Alt+I", description: "Immo AI öffnen" },
      { keys: "Q", description: "Schnellaktion öffnen (Objekt-Detail)" },
      { keys: "?", description: "Tastenkürzel anzeigen" },
    ],
  },
  {
    title: "Dashboard",
    shortcuts: [
      { keys: "Ctrl+K", description: "Objekt suchen" },
      { keys: "Esc", description: "Suche/Dialog schließen" },
    ],
  },
];

function ShortcutKey({ text }: { text: string }) {
  const parts = text.split("+");
  return (
    <span className="flex items-center gap-0.5">
      {parts.map((part, i) => (
        <span key={i}>
          {i > 0 && <span className="text-muted-foreground mx-0.5">+</span>}
          <kbd className="inline-flex items-center justify-center min-w-[24px] h-6 px-1.5 text-[11px] font-medium bg-secondary border border-border rounded-md shadow-sm">
            {part}
          </kbd>
        </span>
      ))}
    </span>
  );
}

export function KeyboardShortcutOverlay() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Don't trigger when typing in inputs
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      if ((e.target as HTMLElement)?.isContentEditable) return;

      if (e.key === "?" && !e.metaKey && !e.ctrlKey && !e.altKey) {
        e.preventDefault();
        setOpen(prev => !prev);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Keyboard className="h-4 w-4" />
            Tastenkürzel
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-5 max-h-[60vh] overflow-y-auto pr-2">
          {SHORTCUT_GROUPS.map((group) => (
            <div key={group.title}>
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                {group.title}
              </h3>
              <div className="space-y-1.5">
                {group.shortcuts.map((sc) => (
                  <div key={sc.keys} className="flex items-center justify-between py-1">
                    <span className="text-sm">{sc.description}</span>
                    <ShortcutKey text={sc.keys} />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
        <p className="text-[10px] text-muted-foreground text-center mt-2">
          Drücke <ShortcutKey text="?" /> um dieses Overlay zu schließen
        </p>
      </DialogContent>
    </Dialog>
  );
}

export default KeyboardShortcutOverlay;
