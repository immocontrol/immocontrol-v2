import { useState, useEffect, useCallback } from "react";
import { Keyboard, X } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

const shortcuts = [
  { keys: ["⌘/Ctrl", "K"], description: "Befehlspalette / Schnellsuche" },
  { keys: ["⌘/Ctrl", "N"], description: "Neues Objekt anlegen" },
  { keys: ["?"], description: "Tastaturkürzel anzeigen" },
  { keys: ["Alt", "1"], description: "Portfolio" },
  { keys: ["Alt", "2"], description: "Darlehen" },
  { keys: ["Alt", "3"], description: "Mieten & Betrieb" },
  { keys: ["Alt", "4"], description: "Verträge & Kontakte" },
  { keys: ["Alt", "6"], description: "Aufgaben & Dokumente" },
  { keys: ["Alt", "7"], description: "Analyse & Risiko" },
  { keys: ["Alt", "8"], description: "Deals & Bewertung" },
  { keys: ["Alt", "O"], description: "Objekte" },
];

const KeyboardShortcuts = () => {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      if (e.key === "?" && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault();
        setOpen(true);
      }
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  useEffect(() => {
    const handler = () => setOpen(true);
    window.addEventListener("open-keyboard-shortcuts", handler);
    return () => window.removeEventListener("open-keyboard-shortcuts", handler);
  }, []);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Keyboard className="h-4 w-4 text-primary" />
            Tastaturkürzel
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-1">
          {shortcuts.map((s, i) => (
            <div key={i} className="flex items-center justify-between py-2 px-1 rounded-lg hover:bg-secondary/50">
              <span className="text-sm text-muted-foreground">{s.description}</span>
              <div className="flex items-center gap-1">
                {s.keys.map((key, ki) => (
                  <kbd
                    key={ki}
                    className="px-2 py-0.5 text-[11px] font-mono bg-muted text-muted-foreground rounded border border-border"
                  >
                    {key}
                  </kbd>
                ))}
              </div>
            </div>
          ))}
        </div>
        <p className="text-[10px] text-muted-foreground text-center mt-2">
          Drücke <kbd className="px-1 py-0.5 text-[10px] font-mono bg-muted rounded border border-border">?</kbd> um dieses Menü zu öffnen ·{" "}
          <kbd className="px-1 py-0.5 text-[10px] font-mono bg-muted rounded border border-border">Esc</kbd> zum Schließen
        </p>
      </DialogContent>
    </Dialog>
  );
};

export default KeyboardShortcuts;
