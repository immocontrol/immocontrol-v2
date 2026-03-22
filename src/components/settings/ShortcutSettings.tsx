/**
 * Settings Page-Splitting — Keyboard Shortcuts section extracted from Settings.tsx
 */
import { useState } from "react";
import { Keyboard, Check, X, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { toast } from "sonner";

const DEFAULT_SHORTCUTS: Record<string, string> = {
  "Navigation: Newsticker": "Alt+1",
  "Navigation: Portfolio": "Alt+Shift+1",
  "Navigation: Objekte": "Alt+O",
  "Navigation: Darlehen": "Alt+2",
  "Navigation: Mieten": "Alt+3",
  "Navigation: Vertr\u00e4ge": "Alt+4",
  "Navigation: Kontakte": "Alt+5",
  "Navigation: Aufgaben": "Alt+6",
  "Navigation: Berichte": "Alt+7",
  "Navigation: CRM": "Alt+8",
  "Navigation: Deals": "Alt+0",
  "Navigation: Einstellungen": "Alt+9",
  "Befehlspalette": "Ctrl+K",
  "Globale Suche fokussieren": "Alt+S",
  "Neues Objekt": "Ctrl+N",
};

const CRITICAL_KEYS = ["Ctrl+S", "Ctrl+W", "Ctrl+Q", "Ctrl+T", "Ctrl+N", "Alt+F4", "Ctrl+Shift+I", "Ctrl+Shift+J"];

function loadCustomShortcuts(): Record<string, string> {
  try {
    const stored = localStorage.getItem("immocontrol_shortcuts");
    if (stored) return JSON.parse(stored) as Record<string, string>;
  } catch { /* ignore */ }
  return { ...DEFAULT_SHORTCUTS };
}

function saveCustomShortcuts(sc: Record<string, string>) {
  localStorage.setItem("immocontrol_shortcuts", JSON.stringify(sc));
  window.dispatchEvent(new Event("shortcuts-updated"));
}

interface ShortcutSettingsProps {
  sectionRef: (el: HTMLElement | null) => void;
}

export function ShortcutSettings({ sectionRef }: ShortcutSettingsProps) {
  const [shortcuts, setShortcuts] = useState<Record<string, string>>(loadCustomShortcuts());
  const [editingShortcut, setEditingShortcut] = useState<string | null>(null);
  const [editingValue, setEditingValue] = useState("");
  const [shortcutWarning, setShortcutWarning] = useState("");

  const startEditShortcut = (action: string) => {
    setEditingShortcut(action);
    setEditingValue(shortcuts[action] || "");
    setShortcutWarning("");
  };

  const saveShortcut = (action: string, value: string) => {
    const trimmed = value.trim();
    if (!trimmed) { toast.error("Tastenkombination darf nicht leer sein"); return; }
    const duplicate = Object.entries(shortcuts).find(
      ([key, val]) => key !== action && val.toLowerCase() === trimmed.toLowerCase()
    );
    if (duplicate) { toast.error(`Diese Kombination wird bereits f\u00fcr: ${duplicate[0]} verwendet`); return; }
    const updated = { ...shortcuts, [action]: trimmed };
    setShortcuts(updated);
    saveCustomShortcuts(updated);
    setEditingShortcut(null);
    setEditingValue("");
    setShortcutWarning("");
    toast.success("Tastenkombination gespeichert");
  };

  const validateShortcutInput = (value: string) => {
    setEditingValue(value);
    const upper = value.toUpperCase().replace(/\s/g, "");
    if (CRITICAL_KEYS.some(k => k.toUpperCase().replace(/\s/g, "") === upper)) {
      setShortcutWarning("Achtung: Diese Tastenkombination wird vom Browser verwendet und k\u00f6nnte Konflikte verursachen!");
    } else {
      const dup = Object.entries(shortcuts).find(
        ([key, val]) => key !== editingShortcut && val.toLowerCase().replace(/\s/g, "") === upper.toLowerCase()
      );
      if (dup) {
        setShortcutWarning(`Duplikat: Wird bereits f\u00fcr "${dup[0]}" verwendet`);
      } else {
        setShortcutWarning("");
      }
    }
  };

  const resetShortcuts = () => {
    setShortcuts({ ...DEFAULT_SHORTCUTS });
    saveCustomShortcuts({ ...DEFAULT_SHORTCUTS });
    toast.success("Tastenkombinationen zur\u00fcckgesetzt");
  };

  return (
    <div id="tastenkombinationen" ref={sectionRef} className="gradient-card rounded-xl border border-border p-5 space-y-4 animate-fade-in [animation-delay:130ms] scroll-mt-20">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold flex items-center gap-2">
          <Keyboard className="h-4 w-4 text-muted-foreground" /> Tastenkombinationen
        </h2>
        <Button variant="ghost" size="sm" className="h-7 text-[10px] text-muted-foreground" onClick={resetShortcuts}>
          Zur\u00fccksetzen
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">
        Klicke auf eine Tastenkombination, um sie anzupassen.
      </p>
      <div className="space-y-1.5">
        {Object.entries(shortcuts).map(([action, keys]) => (
          <div key={action} className="flex items-center justify-between p-2 rounded-lg bg-secondary/30 hover:bg-secondary/50 transition-colors">
            <span className="text-xs text-muted-foreground flex-1 truncate mr-2">{action}</span>
            {editingShortcut === action ? (
              <div className="flex items-center gap-1.5">
                <Input
                  value={editingValue}
                  onChange={(e) => validateShortcutInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") { e.preventDefault(); saveShortcut(action, editingValue); }
                    if (e.key === "Escape") { setEditingShortcut(null); setShortcutWarning(""); }
                  }}
                  className="h-7 w-28 text-[10px] font-mono text-center"
                  autoFocus
                  placeholder="z.B. Alt+1"
                />
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-profit" onClick={() => saveShortcut(action, editingValue)}>
                      <Check className="h-3 w-3" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Speichern</TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-muted-foreground" onClick={() => { setEditingShortcut(null); setShortcutWarning(""); }}>
                      <X className="h-3 w-3" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Abbrechen</TooltipContent>
                </Tooltip>
              </div>
            ) : (
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={() => startEditShortcut(action)}
                    className="px-2 py-0.5 rounded bg-muted hover:bg-muted/80 text-[10px] font-mono transition-colors cursor-pointer"
                  >
                    {keys}
                  </button>
                </TooltipTrigger>
                <TooltipContent>Klicken zum Bearbeiten</TooltipContent>
              </Tooltip>
            )}
          </div>
        ))}
      </div>
      {shortcutWarning && (
        <div className="flex items-start gap-2 p-2.5 rounded-lg bg-gold/10 border border-gold/20">
          <AlertTriangle className="h-3.5 w-3.5 text-gold shrink-0 mt-0.5" />
          <p className="text-[10px] text-gold">{shortcutWarning}</p>
        </div>
      )}
    </div>
  );
}
