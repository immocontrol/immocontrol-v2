/**
 * #1: Page-Splitting — Keyboard Shortcuts section extracted from Settings.tsx
 */
import { Keyboard, Edit2, Check, X, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useState, useCallback } from "react";
import { toast } from "sonner";

const DEFAULT_SHORTCUTS: Record<string, string> = {
  "Navigation: Portfolio": "Alt+1",
  "Navigation: Darlehen": "Alt+2",
  "Navigation: Mieten": "Alt+3",
  "Navigation: Verträge": "Alt+4",
  "Navigation: Kontakte": "Alt+5",
  "Navigation: Aufgaben": "Alt+6",
  "Navigation: Berichte": "Alt+7",
  "Navigation: CRM": "Alt+8",
  "Navigation: Deals": "Alt+0",
  "Navigation: Einstellungen": "Alt+9",
  "Suche öffnen": "Ctrl+K",
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

export function KeyboardShortcutSettings() {
  const [shortcuts, setShortcuts] = useState<Record<string, string>>(loadCustomShortcuts());
  const [editingShortcut, setEditingShortcut] = useState<string | null>(null);
  const [editingValue, setEditingValue] = useState("");
  const [shortcutWarning, setShortcutWarning] = useState("");

  const startEditShortcut = (action: string) => {
    setEditingShortcut(action);
    setEditingValue(shortcuts[action] || "");
    setShortcutWarning("");
  };

  const saveShortcut = useCallback(() => {
    if (!editingShortcut || !editingValue.trim()) return;
    const duplicate = Object.entries(shortcuts).find(
      ([action, combo]) => action !== editingShortcut && combo === editingValue
    );
    if (duplicate) {
      toast.error(`"${editingValue}" wird bereits für "${duplicate[0]}" verwendet`);
      return;
    }
    const updated = { ...shortcuts, [editingShortcut]: editingValue.trim() };
    setShortcuts(updated);
    saveCustomShortcuts(updated);
    setEditingShortcut(null);
    setEditingValue("");
    setShortcutWarning("");
    toast.success("Tastenkombination gespeichert");
  }, [editingShortcut, editingValue, shortcuts]);

  const validateShortcutInput = (val: string) => {
    setEditingValue(val);
    if (CRITICAL_KEYS.includes(val)) {
      const dup = Object.entries(shortcuts).find(([, combo]) => combo === val);
      setShortcutWarning(
        dup ? `⚠ Achtung: "${val}" überschreibt "${dup[0]}" und ist ein kritischer Browser-Shortcut!`
            : `⚠ Achtung: "${val}" ist ein kritischer Browser-Shortcut und könnte Probleme verursachen!`
      );
    } else {
      setShortcutWarning("");
    }
  };

  const resetShortcuts = () => {
    setShortcuts({ ...DEFAULT_SHORTCUTS });
    saveCustomShortcuts({ ...DEFAULT_SHORTCUTS });
    toast.success("Tastenkombinationen zurückgesetzt");
  };

  return (
    <div className="gradient-card rounded-xl border border-border p-5 space-y-4 animate-fade-in scroll-mt-20">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold flex items-center gap-2">
          <Keyboard className="h-4 w-4 text-muted-foreground" /> Tastenkombinationen
        </h2>
        <Button variant="ghost" size="sm" className="h-7 text-xs gap-1" onClick={resetShortcuts}>
          <RotateCcw className="h-3 w-3" /> Zurücksetzen
        </Button>
      </div>
      <div className="space-y-1.5">
        {Object.entries(shortcuts).map(([action, combo]) => (
          <div key={action} className="flex items-center justify-between text-xs py-1.5 px-2 rounded hover:bg-secondary/30 transition-colors">
            <span className="text-muted-foreground">{action}</span>
            {editingShortcut === action ? (
              <div className="flex items-center gap-1.5">
                <Input
                  value={editingValue}
                  onChange={(e) => validateShortcutInput(e.target.value)}
                  className="h-6 w-28 text-[11px] text-center"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === "Enter") saveShortcut();
                    if (e.key === "Escape") { setEditingShortcut(null); setShortcutWarning(""); }
                  }}
                />
                <Button variant="ghost" size="icon" className="h-5 w-5" onClick={saveShortcut}>
                  <Check className="h-3 w-3" />
                </Button>
                <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => { setEditingShortcut(null); setShortcutWarning(""); }}>
                  <X className="h-3 w-3" />
                </Button>
              </div>
            ) : (
              <button
                className="flex items-center gap-1.5 group"
                onClick={() => startEditShortcut(action)}
              >
                <kbd className="px-1.5 py-0.5 bg-secondary rounded text-[11px] font-mono">{combo}</kbd>
                <Edit2 className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground" />
              </button>
            )}
          </div>
        ))}
      </div>
      {shortcutWarning && (
        <p className="text-[11px] text-gold">{shortcutWarning}</p>
      )}
    </div>
  );
}
