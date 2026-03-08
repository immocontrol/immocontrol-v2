import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useProperties } from "@/context/PropertyContext";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Search, Building2, Users, Phone, MapPin, FileText, Landmark, X, Loader2, Camera } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { ROUTES, dealsWithId } from "@/lib/routes";

interface SearchResult {
  id: string;
  title: string;
  subtitle?: string;
  category: string;
  icon: React.ReactNode;
  action: () => void;
}

export const GlobalSearch = () => {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const navigate = useNavigate();
  const { properties } = useProperties();
  const { user } = useAuth();
  const wrapperRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // Cmd+K to focus
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        inputRef.current?.focus();
        setOpen(true);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  const go = useCallback((path: string) => {
    navigate(path);
    setOpen(false);
    setQuery("");
  }, [navigate]);

  // Navigation items (static)
  const navResults = useMemo<SearchResult[]>(() => {
    const items = [
      { id: "nav-portfolio", title: "Portfolio", subtitle: "Dashboard & Übersicht", path: ROUTES.HOME },
      { id: "nav-finanzen", title: "Finanzen", subtitle: "Darlehen & Kredite", path: ROUTES.LOANS },
      { id: "nav-mieten", title: "Mieten", subtitle: "Mietübersicht", path: ROUTES.RENT },
      { id: "nav-nebenkosten", title: "Nebenkosten", subtitle: "Nebenkostenabrechnung", path: ROUTES.NK },
      { id: "nav-vertraege", title: "Verträge", subtitle: "Vertragsverwaltung", path: ROUTES.CONTRACTS },
      { id: "nav-dokumente", title: "Dokumente", subtitle: "Dokumentenverwaltung", path: ROUTES.DOKUMENTE },
      { id: "nav-kontakte", title: "Kontakte", subtitle: "Handwerker & Partner", path: ROUTES.CONTACTS },
      { id: "nav-aufgaben", title: "Aufgaben", subtitle: "Todos & Projekte", path: ROUTES.TODOS },
      { id: "nav-berichte", title: "Berichte", subtitle: "Auswertungen", path: ROUTES.REPORTS },
      { id: "nav-crm", title: "CRM", subtitle: "Leads & Akquise", path: ROUTES.CRM },
      { id: "nav-deals", title: "Deals", subtitle: "Deal Pipeline", path: ROUTES.DEALS },
      { id: "nav-besichtigungen", title: "Besichtigungen", subtitle: "Notizen, Bilder & Videos", path: ROUTES.BESICHTIGUNGEN },
      { id: "nav-settings", title: "Einstellungen", subtitle: "Profil & Theme", path: ROUTES.SETTINGS },
    ];
    return items.map(i => ({
      id: i.id,
      title: i.title,
      subtitle: i.subtitle,
      category: "Seiten",
      icon: <FileText className="h-4 w-4" />,
      action: () => go(i.path),
    }));
  }, [go]);

  // Property results (static)
  const propertyResults = useMemo<SearchResult[]>(() => {
    return properties.map(p => ({
      id: `prop-${p.id}`,
      title: p.name,
      subtitle: p.address || p.location,
      category: "Objekte",
      icon: <Building2 className="h-4 w-4" />,
      action: () => go(`${ROUTES.PROPERTY}/${p.id}`),
    }));
  }, [properties, go]);

  // Search DB
  const searchDB = useCallback(async (q: string) => {
    if (!user || q.length < 2) return [];
    const lowerQ = `%${q}%`;
    const dbResults: SearchResult[] = [];

    try {
      // Search tenants
      const { data: tenants } = await supabase
        .from("tenants")
        .select("id, first_name, last_name, email, phone, property_id")
        .or(`first_name.ilike.${lowerQ},last_name.ilike.${lowerQ},email.ilike.${lowerQ},phone.ilike.${lowerQ}`)
        .limit(5);

      tenants?.forEach(t => {
        dbResults.push({
          id: `tenant-${t.id}`,
          title: `${t.first_name} ${t.last_name}`,
          subtitle: [t.email, t.phone].filter(Boolean).join(" · "),
          category: "Mieter",
          icon: <Users className="h-4 w-4" />,
          action: () => go(`${ROUTES.PROPERTY}/${t.property_id}`),
        });
      });

      // Search contacts
      const { data: contacts } = await supabase
        .from("contacts")
        .select("id, name, phone, email, company, category")
        .or(`name.ilike.${lowerQ},phone.ilike.${lowerQ},email.ilike.${lowerQ},company.ilike.${lowerQ}`)
        .limit(5);

      contacts?.forEach(c => {
        dbResults.push({
          id: `contact-${c.id}`,
          title: c.name,
          subtitle: [c.company, c.phone, c.email].filter(Boolean).join(" · "),
          category: "Kontakte",
          icon: <Phone className="h-4 w-4" />,
          action: () => go(`/kontakte?highlight=${c.id}`),
        });
      });

      // Search CRM leads
      const { data: leads } = await supabase
        .from("crm_leads")
        .select("id, name, company, phone, address")
        .or(`name.ilike.${lowerQ},company.ilike.${lowerQ},phone.ilike.${lowerQ},address.ilike.${lowerQ}`)
        .limit(5);

      leads?.forEach(l => {
        dbResults.push({
          id: `lead-${l.id}`,
          title: l.name,
          subtitle: [l.company, l.phone].filter(Boolean).join(" · "),
          category: "CRM Leads",
          icon: <MapPin className="h-4 w-4" />,
          action: () => go("/crm"),
        });
      });

      // Search deals
      const { data: deals } = await supabase
        .from("deals")
        .select("id, title, address, stage")
        .or(`title.ilike.${lowerQ},address.ilike.${lowerQ},contact_name.ilike.${lowerQ}`)
        .limit(5);

      deals?.forEach(d => {
        dbResults.push({
          id: `deal-${d.id}`,
          title: d.title,
          subtitle: [d.address, d.stage].filter(Boolean).join(" · "),
          category: "Deals",
          icon: <Landmark className="h-4 w-4" />,
          action: () => go(dealsWithId(d.id)),
        });
      });

      // Search Besichtigungen
      const { data: viewings } = await supabase
        .from("property_viewings")
        .select("id, title, address, visited_at")
        .or(`title.ilike.${lowerQ},address.ilike.${lowerQ},notes.ilike.${lowerQ},pro_points.ilike.${lowerQ},contra_points.ilike.${lowerQ}`)
        .limit(5);

      viewings?.forEach(v => {
        dbResults.push({
          id: `viewing-${v.id}`,
          title: v.title,
          subtitle: [v.address, v.visited_at ? new Date(v.visited_at).toLocaleDateString("de-DE") : null].filter(Boolean).join(" · "),
          category: "Besichtigungen",
          icon: <Camera className="h-4 w-4" />,
          action: () => go(`/besichtigungen?id=${v.id}`),
        });
      });

      // Search loans
      const { data: loans } = await supabase
        .from("loans")
        .select("id, bank_name, property_id")
        .ilike("bank_name", lowerQ)
        .limit(5);

      loans?.forEach(l => {
        dbResults.push({
          id: `loan-${l.id}`,
          title: l.bank_name,
          subtitle: "Darlehen",
          category: "Darlehen",
          icon: <Landmark className="h-4 w-4" />,
          action: () => go("/darlehen"),
        });
      });
    } catch {
      // silently fail
    }

    return dbResults;
  }, [user, go]);

  // Main search effect
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (!query.trim()) {
      setResults([]);
      setLoading(false);
      return;
    }

    const q = query.toLowerCase();

    // Filter static results immediately
    const filteredNav = navResults.filter(r =>
      r.title.toLowerCase().includes(q) || r.subtitle?.toLowerCase().includes(q)
    );
    const filteredProps = propertyResults.filter(r =>
      r.title.toLowerCase().includes(q) || r.subtitle?.toLowerCase().includes(q)
    );
    setResults([...filteredNav, ...filteredProps]);

    // Debounce DB search
    setLoading(true);
    debounceRef.current = setTimeout(async () => {
      const dbResults = await searchDB(query);
      setResults(prev => {
        const staticIds = new Set(prev.map(r => r.id));
        return [...prev, ...dbResults.filter(r => !staticIds.has(r.id))];
      });
      setLoading(false);
    }, 250);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, navResults, propertyResults, searchDB]);

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
      inputRef.current?.blur();
    }
  };

  /* IMPROVE-10: Show total result count for screen readers */
  const resultCount = results.length;

  // Group results by category
  const grouped = useMemo(() => {
    const groups: Record<string, SearchResult[]> = {};
    results.forEach(r => {
      if (!groups[r.category]) groups[r.category] = [];
      groups[r.category].push(r);
    });
    return groups;
  }, [results]);

  let flatIndex = -1;

  return (
    <div ref={wrapperRef} className="relative hidden md:block">
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
        <Input
          ref={inputRef}
          value={query}
          onChange={e => { setQuery(e.target.value); setOpen(true); }}
          onFocus={() => { if (query.trim()) setOpen(true); }}
          onKeyDown={handleKeyDown}
          placeholder="Suchen…"
          className="h-8 w-48 lg:w-64 pl-8 pr-16 text-sm bg-secondary/50 border-border/50 focus:bg-background focus:w-72 lg:focus:w-80 transition-all"
          autoComplete="off"
          aria-label="Globale Suche"
          /* IMPROVE-11: aria-expanded for accessibility */
          aria-expanded={open && !!query.trim()}
          role="combobox"
        />
        {query ? (
          <button
            onClick={() => { setQuery(""); setResults([]); setOpen(false); }}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            aria-label="Suche leeren"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        ) : (
          <kbd className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none hidden lg:inline-flex h-5 items-center gap-0.5 rounded border border-border/60 bg-muted/50 px-1.5 text-[10px] font-medium text-muted-foreground">
            ⌘K
          </kbd>
        )}
      </div>

      {open && query.trim() && (
        <div className="absolute top-full mt-1 right-0 w-96 bg-popover border border-border rounded-lg shadow-xl z-50 overflow-hidden">
          {loading && results.length === 0 ? (
            <div className="flex items-center justify-center gap-2 py-8 text-muted-foreground text-sm">
              <Loader2 className="h-4 w-4 animate-spin" /> Suche…
            </div>
          ) : results.length === 0 ? (
            <div className="py-8 text-center text-sm text-muted-foreground">
              Keine Ergebnisse für „{query}"
            </div>
          ) : (
            <div className="max-h-80 overflow-y-auto py-1">
              {Object.entries(grouped).map(([category, items]) => (
                <div key={category}>
                  <p className="px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
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
                          "w-full flex items-center gap-3 px-3 py-2 text-sm transition-colors",
                          idx === selectedIndex ? "bg-primary/10 text-primary" : "text-foreground hover:bg-secondary"
                        )}
                      >
                        <span className="text-muted-foreground shrink-0">{item.icon}</span>
                        <div className="flex-1 text-left min-w-0">
                          <span className="font-medium">{item.title}</span>
                          {item.subtitle && (
                            <span className="text-xs text-muted-foreground ml-2 truncate">{item.subtitle}</span>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              ))}
              {loading && (
                <div className="flex items-center gap-2 px-3 py-2 text-xs text-muted-foreground">
                  <Loader2 className="h-3 w-3 animate-spin" /> Weitere Ergebnisse laden…
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
