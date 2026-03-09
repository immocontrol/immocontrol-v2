import { useState } from "react";
import { Keyboard } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

const shortcuts = [
  { category: "Navigation", items: [
    { keys: ["Alt", "1–7"], desc: "Zwischen Seiten wechseln" },
    { keys: ["⌘/Ctrl", "K"], desc: "Suchpalette öffnen" },
  ]},
  { category: "Aktionen", items: [
    { keys: ["Q"], desc: "Schnell-Aufgabe erstellen" },
    { keys: ["⌘/Ctrl", "N"], desc: "Neues Objekt hinzufügen" },
  ]},
  { category: "Allgemein", items: [
    { keys: ["?"], desc: "Tastaturkürzel anzeigen" },
    { keys: ["Esc"], desc: "Dialog/Suche schließen" },
  ]},
];

export const KeyboardShortcutHelp = () => {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground hidden md:flex" aria-label="Tastenkürzel">
          <Keyboard className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Keyboard className="h-5 w-5" /> Tastaturkürzel
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {shortcuts.map(group => (
            <div key={group.category}>
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">{group.category}</h3>
              <div className="space-y-1.5">
                {group.items.map(item => (
                  <div key={item.desc} className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">{item.desc}</span>
                    <div className="flex items-center gap-1">
                      {item.keys.map(k => (
                        <kbd key={k} className="px-1.5 py-0.5 text-[10px] font-mono bg-secondary text-secondary-foreground rounded border border-border">
                          {k}
                        </kbd>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
};
