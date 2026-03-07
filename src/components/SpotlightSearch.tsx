/**
 * SPOTLIGHT-1: Globale Suche / Spotlight
 * 
 * Features:
 * - Cmd+K shortcut opens fullscreen modal
 * - Search across all entities (tenants, properties, documents, payments)
 * - Fuzzy search with normalizeString
 * - Recently used items
 * - Quick actions (navigate, create, export)
 */

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useProperties } from "@/context/PropertyContext";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import {
  Search, Building2, Users, Phone, MapPin, FileText, Landmark,
  X, Loader2, Clock, Zap, ArrowRight, Command, Plus, Download,
  Settings, BarChart3, Calculator, CheckSquare, Wrench, Target,
  Handshake, FolderOpen, Receipt, PieChart, TrendingUp, Activity,
  Map, PiggyBank, Banknote, LineChart, Shield, Calendar, Lightbulb,
  Camera, Store,
} from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { normalizeString } from "@/lib/formatters";
import { ROUTES } from "@/lib/routes";

interface SpotlightResult {
  id: string;
  title: string;
  subtitle?: string;
  category: string;
  icon: React.ReactNode;
  action: () => void;
  keywords?: string;
}

const RECENT_KEY = "immo-spotlight-recent";
const MAX_RECENT = 5;

/** SPOTLIGHT-2: Load recent items from localStorage */
function loadRecent(): string[] {
  try {
    const stored = localStorage.getItem(RECENT_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch { return []; }
}

function saveRecent(id: string) {
  try {
    const recent = loadRecent().filter(r => r !== id);
    recent.unshift(id);
    localStorage.setItem(RECENT_KEY, JSON.stringify(recent.slice(0, MAX_RECENT)));
  } catch { /* noop */ }
}

export default function SpotlightSearch() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SpotlightResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const navigate = useNavigate();
  const { properties } = useProperties();
  const { user } = useAuth();
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  // Cmd+K to open
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen(true);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  // Focus input when opened
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 50);
      setQuery("");
      setResults([]);
      setSelectedIndex(0);
    }
  }, [open]);

  const go = useCallback((path: string, id?: string) => {
    if (id) saveRecent(id);
    navigate(path);
    setOpen(false);
    setQuery("");
  }, [navigate]);

  /** SPOTLIGHT-3: Quick actions */
  const quickActions = useMemo<SpotlightResult[]>(() => [
    { id: "qa-add-property", title: "Neues Objekt anlegen", subtitle: "Immobilie hinzufügen", category: "Schnellaktionen", icon: <Plus className="h-4 w-4" />, action: () => { go(ROUTES.HOME); setTimeout(() => document.querySelector<HTMLButtonElement>("[data-add-property]")?.click(), 300); }, keywords: "objekt immobilie anlegen erstellen neu" },
    { id: "qa-export-csv", title: "Portfolio als CSV exportieren", subtitle: "Alle Objekte exportieren", category: "Schnellaktionen", icon: <Download className="h-4 w-4" />, action: () => go(ROUTES.HOME), keywords: "export csv download" },
    { id: "qa-hockey-stick", title: "Hockey Stick Simulator", subtitle: "Rendite-Prognose berechnen", category: "Schnellaktionen", icon: <Calculator className="h-4 w-4" />, action: () => go(ROUTES.ANALYSE), keywords: "rechner simulation hockey stick prognose" },
    { id: "qa-settings", title: "Einstellungen öffnen", subtitle: "Theme, Profil, Shortcuts", category: "Schnellaktionen", icon: <Settings className="h-4 w-4" />, action: () => go(ROUTES.SETTINGS), keywords: "einstellungen settings profil theme" },
  ], [go]);

  /** SPOTLIGHT-4: Navigation items */
  const navResults = useMemo<SpotlightResult[]>(() => {
    const items = [
      { id: "nav-portfolio", title: "Portfolio", subtitle: "Dashboard & Übersicht", path: ROUTES.HOME, icon: <BarChart3 className="h-4 w-4" />, keywords: "dashboard portfolio übersicht home" },
      { id: "nav-finanzen", title: "Darlehen & Finanzen", subtitle: "Kredite verwalten", path: ROUTES.LOANS, icon: <Landmark className="h-4 w-4" />, keywords: "darlehen kredit finanzen bank" },
      { id: "nav-mieten", title: "Mietübersicht", subtitle: "Mieten & Zahlungen", path: ROUTES.RENT, icon: <Receipt className="h-4 w-4" />, keywords: "miete mieten zahlung mietübersicht" },
      { id: "nav-vertraege", title: "Verträge", subtitle: "Miet- & Dienstleisterverträge", path: ROUTES.CONTRACTS, icon: <FileText className="h-4 w-4" />, keywords: "vertrag verträge mietvertrag" },
      { id: "nav-kontakte", title: "Kontakte", subtitle: "Handwerker & Partner", path: ROUTES.CONTACTS, icon: <Users className="h-4 w-4" />, keywords: "kontakte handwerker partner telefon" },
      { id: "nav-aufgaben", title: "Aufgaben", subtitle: "Todos & Projekte", path: ROUTES.TODOS, icon: <CheckSquare className="h-4 w-4" />, keywords: "aufgaben todo projekt" },
      { id: "nav-berichte", title: "Berichte", subtitle: "Auswertungen & Reports", path: ROUTES.REPORTS, icon: <BarChart3 className="h-4 w-4" />, keywords: "berichte report auswertung" },
      { id: "nav-dokumente", title: "Dokumente", subtitle: "Dateien & OCR", path: ROUTES.DOKUMENTE, icon: <FolderOpen className="h-4 w-4" />, keywords: "dokumente dateien upload ocr" },
      { id: "nav-wartung", title: "Wartungsplaner", subtitle: "Instandhaltung", path: ROUTES.WARTUNG, icon: <Wrench className="h-4 w-4" />, keywords: "wartung instandhaltung reparatur" },
      { id: "nav-crm", title: "CRM", subtitle: "Leads & Akquise", path: ROUTES.CRM, icon: <Target className="h-4 w-4" />, keywords: "crm leads akquise" },
      { id: "nav-scout", title: "WGH-Scout", subtitle: "Wohn- und Geschäftshäuser nach Ort/Umkreis finden", path: ROUTES.CRM_SCOUT, icon: <Store className="h-4 w-4" />, keywords: "wgh scout gewerbe akquise ort umkreis wohn geschäftshaus finden" },
      { id: "nav-deals", title: "Deals", subtitle: "Deal Pipeline", path: ROUTES.DEALS, icon: <Handshake className="h-4 w-4" />, keywords: "deals pipeline" },
      { id: "nav-besichtigungen", title: "Besichtigungen", subtitle: "Notizen, Bilder & Videos", path: ROUTES.BESICHTIGUNGEN, icon: <Camera className="h-4 w-4" />, keywords: "besichtigung besichtigungen notizen fotos videos immo viewing" },
      { id: "nav-analyse", title: "Rechner & Analyse", subtitle: "Kalkulatoren", path: ROUTES.ANALYSE, icon: <Calculator className="h-4 w-4" />, keywords: "rechner analyse kalkulator berechnung" },
    ];
    return items.map(i => ({
      id: i.id, title: i.title, subtitle: i.subtitle, category: "Seiten",
      icon: i.icon, action: () => go(i.path, i.id), keywords: i.keywords,
    }));
  }, [go]);

  /** SPOTLIGHT-NEW: Dashboard widgets & charts — searchable by name and keywords */
  const widgetResults = useMemo<SpotlightResult[]>(() => {
    const widgets = [
      { id: "widget-euribor", title: "Euribor / Zinsmonitor", subtitle: "Aktuelle Zinssätze & EZB-Leitzins", icon: <TrendingUp className="h-4 w-4" />, keywords: "euribor zins zinsen ezb leitzins zinsmonitor interest rate bauzins" },
      { id: "widget-cashflow", title: "Cashflow-Übersicht", subtitle: "Monatlicher Cashflow aller Objekte", icon: <LineChart className="h-4 w-4" />, keywords: "cashflow einnahmen ausgaben netto brutto" },
      { id: "widget-portfolio", title: "Portfolio-Verteilung", subtitle: "Objektverteilung nach Typ & Wert", icon: <PieChart className="h-4 w-4" />, keywords: "portfolio verteilung chart torte" },
      { id: "widget-monthly", title: "Monatsübersicht", subtitle: "Trends über die letzten 12 Monate", icon: <BarChart3 className="h-4 w-4" />, keywords: "monat trend übersicht monthly" },
      { id: "widget-map", title: "Standortkarte", subtitle: "Alle Objekte auf der Karte", icon: <Map className="h-4 w-4" />, keywords: "karte map standort geolocation" },
      { id: "widget-networth", title: "Vermögensaufbau", subtitle: "Eigenkapital-Entwicklung", icon: <PiggyBank className="h-4 w-4" />, keywords: "vermögen eigenkapital nettovermögen equity wealth" },
      { id: "widget-health", title: "Portfolio Health Score", subtitle: "Gesundheitsbewertung des Portfolios", icon: <Activity className="h-4 w-4" />, keywords: "health score gesundheit bewertung portfolio" },
      { id: "widget-annual", title: "Jahresübersicht", subtitle: "Jährliche Einnahmen, Kosten, Cashflow", icon: <Calendar className="h-4 w-4" />, keywords: "jahresübersicht annual jahres zusammenfassung" },
      { id: "widget-dscr", title: "DSCR-Analyse", subtitle: "Debt Service Coverage Ratio", icon: <Shield className="h-4 w-4" />, keywords: "dscr debt service coverage schuldendienstdeckung" },
      { id: "widget-breakeven", title: "Break-Even-Analyse", subtitle: "Wann sich ein Objekt rechnet", icon: <Target className="h-4 w-4" />, keywords: "breakeven break even amortisation" },
      { id: "widget-forecast", title: "Portfolio-Prognose", subtitle: "Wertentwicklung in 5-30 Jahren", icon: <TrendingUp className="h-4 w-4" />, keywords: "prognose forecast zukunft wertentwicklung" },
      { id: "widget-scenarios", title: "Cashflow-Szenarien", subtitle: "Best/Worst/Base Case Simulation", icon: <Lightbulb className="h-4 w-4" />, keywords: "szenario simulation best worst case" },
      { id: "widget-rent-timeline", title: "Mieterhöhungs-Timeline", subtitle: "Nächste Mieterhöhungen", icon: <Calendar className="h-4 w-4" />, keywords: "mieterhöhung timeline miete erhöhung" },
      { id: "widget-loan-countdown", title: "Zinsbindungs-Countdown", subtitle: "Ablauf der Zinsbindung", icon: <Banknote className="h-4 w-4" />, keywords: "zinsbindung countdown kredit ablauf" },
      { id: "widget-bulk-rent", title: "Mietanpassung (Bulk)", subtitle: "Sammel-Mieterhöhung für mehrere Objekte", icon: <TrendingUp className="h-4 w-4" />, keywords: "mietanpassung bulk sammel mieterhöhung" },
      { id: "widget-privacy", title: "Datenschutzmodus", subtitle: "Sensible Daten ausblenden", icon: <Shield className="h-4 w-4" />, keywords: "datenschutz privacy modus ausblenden" },
      { id: "widget-favorites", title: "Favoriten-Leiste", subtitle: "Schnellzugriff auf häufig genutzte Funktionen", icon: <Activity className="h-4 w-4" />, keywords: "favoriten schnellzugriff leiste" },
      { id: "widget-presets", title: "Dashboard-Presets", subtitle: "Vorgefertigte Dashboard-Layouts", icon: <PieChart className="h-4 w-4" />, keywords: "presets layouts vorlagen dashboard" },
    ];
    return widgets.map(w => ({
      ...w, category: "Dashboard-Widgets",
      action: () => { go("/"); /* Scroll to widget after navigation */ },
    }));
  }, [go]);

  /** SPOTLIGHT-5: Property results */
  const propertyResults = useMemo<SpotlightResult[]>(() => {
    return properties.map(p => ({
      id: `prop-${p.id}`,
      title: p.name,
      subtitle: `${p.address || p.location} · ${p.type} · ${p.units} Einheiten`,
      category: "Objekte",
      icon: <Building2 className="h-4 w-4" />,
      action: () => go(`${ROUTES.PROPERTY}/${p.id}`, `prop-${p.id}`),
      keywords: `${p.name} ${p.address} ${p.location} ${p.type}`.toLowerCase(),
    }));
  }, [properties, go]);

  /** SPOTLIGHT-6: Fuzzy match */
  const fuzzyMatch = useCallback((item: SpotlightResult, q: string): boolean => {
    const normalized = normalizeString(q);
    const fields = [item.title, item.subtitle || "", item.keywords || ""].join(" ");
    const normalizedFields = normalizeString(fields);
    // Simple fuzzy: all query words must appear somewhere
    return normalized.split(/\s+/).every(word => normalizedFields.includes(word));
  }, []);

  /** SPOTLIGHT-7: Search DB for tenants, contacts, leads */
  const searchDB = useCallback(async (q: string) => {
    if (!user || q.length < 2) return [];
    const lowerQ = `%${q}%`;
    const dbResults: SpotlightResult[] = [];

    try {
      const [tenants, contacts, leads, deals] = await Promise.all([
        supabase.from("tenants").select("id, first_name, last_name, email, phone, property_id")
          .or(`first_name.ilike.${lowerQ},last_name.ilike.${lowerQ},email.ilike.${lowerQ}`).limit(5),
        supabase.from("contacts").select("id, name, phone, email, company, category")
          .or(`name.ilike.${lowerQ},phone.ilike.${lowerQ},email.ilike.${lowerQ},company.ilike.${lowerQ}`).limit(5),
        supabase.from("crm_leads").select("id, name, company, phone, address")
          .or(`name.ilike.${lowerQ},company.ilike.${lowerQ},address.ilike.${lowerQ}`).limit(5),
        supabase.from("deals").select("id, title, address, stage")
          .or(`title.ilike.${lowerQ},address.ilike.${lowerQ}`).limit(5),
      ]);

      tenants.data?.forEach(t => {
        dbResults.push({
          id: `tenant-${t.id}`, title: `${t.first_name} ${t.last_name}`,
          subtitle: [t.email, t.phone].filter(Boolean).join(" · "),
          category: "Mieter", icon: <Users className="h-4 w-4" />,
          action: () => go(`${ROUTES.PROPERTY}/${t.property_id}`, `tenant-${t.id}`),
        });
      });

      contacts.data?.forEach(c => {
        dbResults.push({
          id: `contact-${c.id}`, title: c.name,
          subtitle: [c.company, c.phone].filter(Boolean).join(" · "),
          category: "Kontakte", icon: <Phone className="h-4 w-4" />,
          action: () => go("/kontakte", `contact-${c.id}`),
        });
      });

      leads.data?.forEach(l => {
        dbResults.push({
          id: `lead-${l.id}`, title: l.name,
          subtitle: [l.company, l.address].filter(Boolean).join(" · "),
          category: "CRM Leads", icon: <MapPin className="h-4 w-4" />,
          action: () => go("/crm", `lead-${l.id}`),
        });
      });

      deals.data?.forEach(d => {
        dbResults.push({
          id: `deal-${d.id}`, title: d.title,
          subtitle: [d.address, d.stage].filter(Boolean).join(" · "),
          category: "Deals", icon: <Landmark className="h-4 w-4" />,
          action: () => go("/deals", `deal-${d.id}`),
        });
      });
    } catch { /* silently fail */ }
    return dbResults;
  }, [user, go]);

  /** SPOTLIGHT-8: Main search effect */
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (!query.trim()) {
      // Show recent + quick actions when no query
      const recent = loadRecent();
      const recentResults = [...navResults, ...propertyResults].filter(r => recent.includes(r.id));
      setResults([...quickActions, ...recentResults.map(r => ({ ...r, category: "Zuletzt verwendet" }))]);
      setLoading(false);
      return;
    }

    const q = query.trim();
    const filteredNav = navResults.filter(r => fuzzyMatch(r, q));
    const filteredProps = propertyResults.filter(r => fuzzyMatch(r, q));
    const filteredActions = quickActions.filter(r => fuzzyMatch(r, q));
    const filteredWidgets = widgetResults.filter(r => fuzzyMatch(r, q));
    setResults([...filteredActions, ...filteredNav, ...filteredWidgets, ...filteredProps]);

    setLoading(true);
    debounceRef.current = setTimeout(async () => {
      const dbResults = await searchDB(q);
      setResults(prev => {
        const ids = new Set(prev.map(r => r.id));
        return [...prev, ...dbResults.filter(r => !ids.has(r.id))];
      });
      setLoading(false);
    }, 200);

    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [query, navResults, propertyResults, quickActions, widgetResults, searchDB, fuzzyMatch]);

  useEffect(() => { setSelectedIndex(0); }, [results]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex(i => Math.min(i + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex(i => Math.max(i - 1, 0));
    } else if (e.key === "Enter" && results[selectedIndex]) {
      e.preventDefault();
      results[selectedIndex].action();
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  };

  // Group results by category
  const grouped = useMemo(() => {
    const groups: Record<string, SpotlightResult[]> = {};
    results.forEach(r => {
      if (!groups[r.category]) groups[r.category] = [];
      groups[r.category].push(r);
    });
    return groups;
  }, [results]);

  let flatIndex = -1;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-xl p-0 gap-0 overflow-hidden [&>button]:hidden" aria-label="Spotlight-Suche">
        {/* Search Input */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-border">
          <Search className="h-5 w-5 text-muted-foreground shrink-0" />
          <input
            ref={inputRef}
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Suche nach Objekten, Mietern, Seiten, Aktionen…"
            className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            autoComplete="off"
            autoFocus
          />
          {query && (
            <button onClick={() => setQuery("")} className="text-muted-foreground hover:text-foreground">
              <X className="h-4 w-4" />
            </button>
          )}
          <kbd className="hidden sm:inline-flex h-5 items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] text-muted-foreground">
            ESC
          </kbd>
        </div>

        {/* Results */}
        <div className="max-h-[60vh] overflow-y-auto">
          {loading && results.length === 0 ? (
            <div className="flex items-center justify-center gap-2 py-12 text-muted-foreground text-sm">
              <Loader2 className="h-4 w-4 animate-spin" /> Suche…
            </div>
          ) : results.length === 0 && query.trim() ? (
            <div className="py-8 text-center">
              <div className="text-sm text-muted-foreground mb-3">
                Keine Ergebnisse für „{query}“
              </div>
              <p className="text-xs text-muted-foreground mb-2">Versuche stattdessen:</p>
              <div className="flex flex-wrap justify-center gap-1.5">
                {["Euribor", "Cashflow", "Portfolio", "Zinsen", "Miete", "Wartung", "DSCR", "Break-Even", "Vermögen", "Prognose"].map(suggestion => (
                  <button
                    key={suggestion}
                    onClick={() => setQuery(suggestion)}
                    className="text-[10px] px-2 py-1 rounded-full bg-secondary text-muted-foreground hover:bg-primary/10 hover:text-primary transition-colors"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="py-2">
              {Object.entries(grouped).map(([category, items]) => (
                <div key={category}>
                  <p className="px-4 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    {category}
                  </p>
                  {items.map(item => {
                    flatIndex++;
                    const idx = flatIndex;
                    return (
                      <button
                        key={item.id}
                        onClick={() => item.action()}
                        onMouseEnter={() => setSelectedIndex(idx)}
                        className={cn(
                          "w-full flex items-center gap-3 px-4 py-2.5 text-sm transition-colors",
                          idx === selectedIndex ? "bg-primary/10 text-primary" : "text-foreground hover:bg-secondary/50"
                        )}
                      >
                        <span className="text-muted-foreground shrink-0">{item.icon}</span>
                        <div className="flex-1 text-left min-w-0">
                          <span className="font-medium">{item.title}</span>
                          {item.subtitle && (
                            <span className="text-xs text-muted-foreground ml-2 truncate">{item.subtitle}</span>
                          )}
                        </div>
                        <ArrowRight className="h-3 w-3 text-muted-foreground shrink-0 opacity-0 group-hover:opacity-100" />
                      </button>
                    );
                  })}
                </div>
              ))}
              {loading && (
                <div className="flex items-center gap-2 px-4 py-2 text-xs text-muted-foreground">
                  <Loader2 className="h-3 w-3 animate-spin" /> Weitere Ergebnisse laden…
                </div>
              )}
            </div>
          )}
        </div>

        {/* IMP-41-8: Enhanced footer with search tip and result count */}
        <div className="border-t border-border px-4 py-2 flex items-center justify-between text-[10px] text-muted-foreground">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1"><Command className="h-3 w-3" />K öffnen</span>
            <span>↑↓ navigieren</span>
            <span>↵ auswählen</span>
          </div>
          {/* IMP-44-13: Add aria-live to result count so screen readers announce changes */}
          <span aria-live="polite">{results.length} Ergebnis{results.length !== 1 ? "se" : ""}</span>
        </div>
      </DialogContent>
    </Dialog>
  );
}
