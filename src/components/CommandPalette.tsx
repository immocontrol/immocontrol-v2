import { useState, useEffect, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useProperties } from "@/context/PropertyContext";
import {
  LayoutDashboard, Calculator, Users, Landmark, CalendarDays, CheckSquare,
  Settings, Building2, Search, Command,
} from "lucide-react";
import {
  Dialog, DialogContent,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface PaletteItem {
  id: string;
  label: string;
  sublabel?: string;
  icon: React.ReactNode;
  action: () => void;
  category: string;
}

export const CommandPalette = () => {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const navigate = useNavigate();
  const { properties } = useProperties();

  // Open on Cmd+K / Ctrl+K
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen(true);
        setQuery("");
        setSelectedIndex(0);
      }
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  const go = useCallback((path: string) => {
    navigate(path);
    setOpen(false);
  }, [navigate]);

  const items = useMemo<PaletteItem[]>(() => {
    const navItems: PaletteItem[] = [
      { id: "nav-dashboard", label: "Portfolio", sublabel: "Dashboard & Übersicht", icon: <LayoutDashboard className="h-4 w-4" />, action: () => go("/"), category: "Navigation" },
      { id: "nav-loans", label: "Darlehen", sublabel: "Finanzierungen verwalten", icon: <Landmark className="h-4 w-4" />, action: () => go("/darlehen"), category: "Navigation" },
      { id: "nav-forecast", label: "Cashforecast", sublabel: "Liquiditätsplanung", icon: <CalendarDays className="h-4 w-4" />, action: () => go("/forecast"), category: "Navigation" },
      { id: "nav-contacts", label: "Kontakte", sublabel: "Handwerker & Partner", icon: <Users className="h-4 w-4" />, action: () => go("/kontakte"), category: "Navigation" },
      { id: "nav-todos", label: "Aufgaben", sublabel: "Todos & Projekte", icon: <CheckSquare className="h-4 w-4" />, action: () => go("/aufgaben"), category: "Navigation" },
      { id: "nav-analysis", label: "Analyse", sublabel: "Objektanalyse-Rechner", icon: <Calculator className="h-4 w-4" />, action: () => go("/analyse"), category: "Navigation" },
      { id: "nav-settings", label: "Einstellungen", sublabel: "Profil & Theme", icon: <Settings className="h-4 w-4" />, action: () => go("/einstellungen"), category: "Navigation" },
    ];

    const propertyItems: PaletteItem[] = properties.map(p => ({
      id: `prop-${p.id}`,
      label: p.name,
      sublabel: p.address || p.location,
      icon: <Building2 className="h-4 w-4" />,
      action: () => go(`/objekt/${p.id}`),
      category: "Objekte",
    }));

    return [...navItems, ...propertyItems];
  }, [properties, go]);

  const filtered = useMemo(() => {
    if (!query.trim()) return items;
    const q = query.toLowerCase();
    return items.filter(i =>
      i.label.toLowerCase().includes(q) ||
      i.sublabel?.toLowerCase().includes(q) ||
      i.category.toLowerCase().includes(q)
    );
  }, [items, query]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex(i => Math.min(i + 1, filtered.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex(i => Math.max(i - 1, 0));
    } else if (e.key === "Enter" && filtered[selectedIndex]) {
      e.preventDefault();
      filtered[selectedIndex].action();
    }
  }, [filtered, selectedIndex]);

  // Group by category
  const grouped = useMemo(() => {
    const groups: Record<string, PaletteItem[]> = {};
    filtered.forEach(item => {
      if (!groups[item.category]) groups[item.category] = [];
      groups[item.category].push(item);
    });
    return groups;
  }, [filtered]);

  let flatIndex = -1;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-md p-0 gap-0 overflow-hidden" aria-label="Befehlspalette">
        <div className="flex items-center gap-2 px-3 border-b border-border">
          <Search className="h-4 w-4 text-muted-foreground shrink-0" />
          <Input
            placeholder="Seite oder Objekt suchen…"
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            className="h-11 border-0 bg-transparent shadow-none focus-visible:ring-0 text-sm px-0"
            autoFocus
          />
          <kbd className="text-[10px] text-muted-foreground bg-secondary px-1.5 py-0.5 rounded shrink-0">ESC</kbd>
        </div>
        <div className="max-h-72 overflow-y-auto py-2">
          {filtered.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-muted-foreground">
              Keine Ergebnisse für „{query}"
            </div>
          ) : (
            Object.entries(grouped).map(([category, items]) => (
              <div key={category}>
                <p className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  {category}
                </p>
                {items.map(item => {
                  flatIndex++;
                  const idx = flatIndex;
                  return (
                    <button
                      key={item.id}
                      onClick={() => item.action()}
                      className={cn(
                        "w-full flex items-center gap-3 px-3 py-2 text-sm transition-colors",
                        idx === selectedIndex
                          ? "bg-primary/10 text-primary"
                          : "text-foreground hover:bg-secondary"
                      )}
                      onMouseEnter={() => setSelectedIndex(idx)}
                    >
                      <span className="text-muted-foreground">{item.icon}</span>
                      <div className="flex-1 text-left min-w-0">
                        <span className="font-medium">{item.label}</span>
                        {item.sublabel && (
                          <span className="text-xs text-muted-foreground ml-2 truncate">
                            {item.sublabel}
                          </span>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            ))
          )}
        </div>
        <div className="border-t border-border px-3 py-2 flex items-center gap-3 text-[10px] text-muted-foreground">
          <span>↑↓ Navigieren</span>
          <span>↵ Öffnen</span>
          <span>ESC Schließen</span>
        </div>
      </DialogContent>
    </Dialog>
  );
};
