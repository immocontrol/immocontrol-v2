/**
 * MOB-15: Intelligente Mobile Suche
 * Fullscreen search overlay on mobile with categories (Objekte, Mieter, Dokumente, Deals),
 * recent searches, and live suggestions while typing. Similar to Spotlight on iOS.
 */
import { memo, useState, useCallback, useRef, useEffect, useMemo } from "react";
import { Search, X, Clock, Building2, Users, FileText, Handshake, ArrowRight, Trash2, TrendingUp, Mic, MicOff } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useIsMobile } from "@/hooks/use-mobile";
import { useProperties } from "@/context/PropertyContext";
import { useHaptic } from "@/hooks/useHaptic";
import { useDebounce } from "@/hooks/useDebounce";
import { normalizeString } from "@/lib/formatters";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { ROUTES } from "@/lib/routes";

const RECENT_KEY = "immo-mobile-search-recent";
const MAX_RECENT = 8;

interface SearchResult {
  id: string;
  title: string;
  subtitle?: string;
  category: string;
  categoryIcon: React.ReactNode;
  path: string;
}

function loadRecent(): string[] {
  try {
    const stored = localStorage.getItem(RECENT_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch { return []; }
}

function saveRecent(query: string) {
  try {
    const recent = loadRecent().filter(r => r !== query);
    recent.unshift(query);
    localStorage.setItem(RECENT_KEY, JSON.stringify(recent.slice(0, MAX_RECENT)));
  } catch { /* noop */ }
}

function clearRecent() {
  try { localStorage.removeItem(RECENT_KEY); } catch { /* noop */ }
}

interface MobileSearchOverlayProps {
  open: boolean;
  onClose: () => void;
}

export const MobileSearchOverlay = memo(function MobileSearchOverlay({
  open, onClose,
}: MobileSearchOverlayProps) {
  const isMobile = useIsMobile();
  const navigate = useNavigate();
  const haptic = useHaptic();
  const { properties } = useProperties();
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const debouncedQuery = useDebounce(query, 150);
  const [recentSearches, setRecentSearches] = useState<string[]>(loadRecent);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  // Focus input when opened; stop voice recognition when closed
  useEffect(() => {
    if (open) {
      setQuery("");
      setSelectedCategory(null);
      setRecentSearches(loadRecent());
      /* FIX: Use longer delay + click() to force virtual keyboard open on mobile.
         On iOS/Android, focus() alone may not open the keyboard unless it's
         triggered within a user-gesture context. We use a two-stage approach:
         1. Short delay to let animation complete
         2. Click + focus + setSelectionRange to ensure keyboard opens */
      const timer1 = setTimeout(() => {
        if (inputRef.current) {
          inputRef.current.focus();
          inputRef.current.click();
          // setSelectionRange forces cursor position which triggers keyboard on some devices
          try { inputRef.current.setSelectionRange(0, 0); } catch { /* noop */ }
        }
      }, 200);
      // Second attempt for stubborn devices
      const timer2 = setTimeout(() => {
        if (inputRef.current && document.activeElement !== inputRef.current) {
          inputRef.current.focus();
        }
      }, 500);
      return () => { clearTimeout(timer1); clearTimeout(timer2); };
    } else {
      // Stop voice recognition when overlay closes
      recognitionRef.current?.stop();
      setVoiceListening(false);
    }
  }, [open]);

  // Generate results from properties
  const results = useMemo<SearchResult[]>(() => {
    if (!debouncedQuery || debouncedQuery.length < 2) return [];
    const q = normalizeString(debouncedQuery);

    const propertyResults: SearchResult[] = properties
      .filter(p => {
        const searchable = normalizeString(`${p.name} ${p.address || ""} ${p.location} ${p.type}`);
        return searchable.includes(q);
      })
      .map(p => ({
        id: `prop-${p.id}`,
        title: p.name,
        subtitle: `${p.address || p.location} · ${p.type}`,
        category: "Objekte",
        categoryIcon: <Building2 className="h-4 w-4" />,
        path: `${ROUTES.PROPERTY}/${p.id}`,
      }));

    // Static page results
    const pages: SearchResult[] = [
      { id: "page-portfolio", title: "Portfolio", subtitle: "Dashboard & Übersicht", category: "Seiten", categoryIcon: <TrendingUp className="h-4 w-4" />, path: ROUTES.HOME },
      { id: "page-darlehen", title: "Darlehen", subtitle: "Kredite verwalten", category: "Seiten", categoryIcon: <TrendingUp className="h-4 w-4" />, path: ROUTES.LOANS },
      { id: "page-mieten", title: "Mietübersicht", subtitle: "Mieten & Zahlungen", category: "Seiten", categoryIcon: <TrendingUp className="h-4 w-4" />, path: ROUTES.RENT },
      { id: "page-vertraege", title: "Verträge", subtitle: "Mietverträge", category: "Seiten", categoryIcon: <FileText className="h-4 w-4" />, path: ROUTES.CONTRACTS },
      { id: "page-kontakte", title: "Kontakte", subtitle: "Handwerker & Partner", category: "Seiten", categoryIcon: <Users className="h-4 w-4" />, path: ROUTES.CONTACTS },
      { id: "page-aufgaben", title: "Aufgaben", subtitle: "Todos & Projekte", category: "Seiten", categoryIcon: <FileText className="h-4 w-4" />, path: ROUTES.TODOS },
      { id: "page-dokumente", title: "Dokumente", subtitle: "Dateien & OCR", category: "Seiten", categoryIcon: <FileText className="h-4 w-4" />, path: ROUTES.DOKUMENTE },
      { id: "page-crm", title: "CRM", subtitle: "Leads & Akquise", category: "Seiten", categoryIcon: <Handshake className="h-4 w-4" />, path: ROUTES.CRM },
      { id: "page-deals", title: "Deals", subtitle: "Deal Pipeline", category: "Seiten", categoryIcon: <Handshake className="h-4 w-4" />, path: ROUTES.DEALS },
    ].filter(p => normalizeString(`${p.title} ${p.subtitle}`).includes(q));

    return [...propertyResults, ...pages];
  }, [debouncedQuery, properties]);

  // Group results by category
  const groupedResults = useMemo(() => {
    const groups: Record<string, SearchResult[]> = {};
    const filtered = selectedCategory
      ? results.filter(r => r.category === selectedCategory)
      : results;

    for (const r of filtered) {
      if (!groups[r.category]) groups[r.category] = [];
      groups[r.category].push(r);
    }
    return groups;
  }, [results, selectedCategory]);

  const categories = useMemo(() => {
    const cats = new Set(results.map(r => r.category));
    return Array.from(cats);
  }, [results]);

  const handleSelect = useCallback((result: SearchResult) => {
    haptic.tap();
    saveRecent(result.title);
    navigate(result.path);
    onClose();
  }, [haptic, navigate, onClose]);

  const handleRecentSelect = useCallback((query: string) => {
    haptic.tap();
    setQuery(query);
  }, [haptic]);

  const handleClearRecent = useCallback(() => {
    haptic.tap();
    clearRecent();
    setRecentSearches([]);
  }, [haptic]);

  /* Voice input — inline implementation to avoid broken component */
  const [voiceListening, setVoiceListening] = useState(false);
  const [voiceDenied, setVoiceDenied] = useState(false);
  const recognitionRef = useRef<SpeechRecognition | null>(null);

  const getSpeechRecognition = useCallback((): (new () => SpeechRecognition) | null => {
    if (typeof window === "undefined") return null;
    const w = window as unknown as Record<string, unknown>;
    return (w.SpeechRecognition || w.webkitSpeechRecognition) as (new () => SpeechRecognition) | null;
  }, []);

  const toggleVoice = useCallback(() => {
    if (voiceListening) {
      recognitionRef.current?.stop();
      setVoiceListening(false);
      return;
    }

    const SpeechRecognitionClass = getSpeechRecognition();
    if (!SpeechRecognitionClass) {
      toast.error("Spracheingabe wird von diesem Browser nicht unterstützt");
      return;
    }

    haptic.medium();
    const recognition = new SpeechRecognitionClass();
    recognition.lang = "de-DE";
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => setVoiceListening(true);
    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let transcript = "";
      for (let i = 0; i < event.results.length; i++) {
        transcript += event.results[i][0].transcript;
      }
      if (transcript) setQuery(transcript.trim());
    };
    recognition.onerror = (e: SpeechRecognitionErrorEvent) => {
      haptic.error();
      setVoiceListening(false);
      if (e.error === "not-allowed") {
        setVoiceDenied(true);
        toast.error("Mikrofon-Zugriff verweigert. Bitte in den Browser-Einstellungen erlauben.");
      }
    };
    recognition.onend = () => setVoiceListening(false);

    recognitionRef.current = recognition;
    try {
      recognition.start();
      // Reset denied state on successful start attempt
      setVoiceDenied(false);
    } catch {
      setVoiceListening(false);
      toast.error("Spracheingabe konnte nicht gestartet werden");
    }
  }, [voiceListening, getSpeechRecognition, haptic]);

  /* Cleanup recognition on unmount */
  useEffect(() => {
    return () => {
      recognitionRef.current?.stop();
    };
  }, []);

  /* Close overlay on backdrop click */
  const backdropRef = useRef<HTMLDivElement>(null);
  const handleBackdropClick = useCallback((e: React.MouseEvent) => {
    if (e.target === backdropRef.current) {
      onClose();
    }
  }, [onClose]);

  if (!open) return null;

  // Desktop: don't show (use SpotlightSearch instead)
  if (!isMobile) return null;

  const hasResults = debouncedQuery && results.length > 0;
  const noResults = debouncedQuery && results.length === 0;

  return (
    <div
      ref={backdropRef}
      className="fixed inset-0 z-[260] bg-black/50 backdrop-blur-md flex flex-col justify-end animate-fade-in"
      onClick={handleBackdropClick}
    >
      {/* Content panel — slides up from bottom */}
      <div className="bg-background rounded-t-2xl max-h-[85vh] flex flex-col animate-in slide-in-from-bottom duration-200">
        {/* Results / recent searches area */}
        <div className="flex-1 overflow-y-auto px-4 py-3 min-h-0">
          {/* No query: show recent searches */}
          {!debouncedQuery && recentSearches.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Letzte Suchen</span>
                <button onClick={handleClearRecent} className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1">
                  <Trash2 className="h-3 w-3" />
                  Löschen
                </button>
              </div>
              <div className="space-y-1">
                {recentSearches.map((recent, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleRecentSelect(recent)}
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-secondary text-left transition-colors active:scale-[0.98]"
                  >
                    <Clock className="h-4 w-4 text-muted-foreground shrink-0" />
                    <span className="text-sm truncate">{recent}</span>
                    <ArrowRight className="h-3.5 w-3.5 text-muted-foreground ml-auto shrink-0" />
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* No query, no recent: show hint */}
          {!debouncedQuery && recentSearches.length === 0 && (
            <div className="text-center py-8">
              <Search className="h-10 w-10 text-muted-foreground/30 mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">Suche nach Objekten, Mietern, Dokumenten oder Seiten</p>
            </div>
          )}

          {/* Category filter chips */}
          {categories.length > 1 && (
            <div className="flex gap-1.5 mb-3 overflow-x-auto scrollbar-hide" style={{ scrollbarWidth: "none" }}>
              <button
                onClick={() => setSelectedCategory(null)}
                className={cn(
                  "shrink-0 px-3 py-1 rounded-full text-xs font-medium transition-all",
                  !selectedCategory
                    ? "bg-primary text-primary-foreground"
                    : "bg-secondary text-muted-foreground",
                )}
              >
                Alle
              </button>
              {categories.map(cat => (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat === selectedCategory ? null : cat)}
                  className={cn(
                    "shrink-0 px-3 py-1 rounded-full text-xs font-medium transition-all",
                    selectedCategory === cat
                      ? "bg-primary text-primary-foreground"
                      : "bg-secondary text-muted-foreground",
                  )}
                >
                  {cat}
                </button>
              ))}
            </div>
          )}

          {/* No results */}
          {noResults && (
            <div className="text-center py-8">
              <Search className="h-10 w-10 text-muted-foreground/30 mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">Keine Ergebnisse für &ldquo;{debouncedQuery}&rdquo;</p>
            </div>
          )}

          {/* Results */}
          {hasResults && Object.entries(groupedResults).map(([category, items]) => (
            <div key={category} className="mb-4">
              <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">{category}</span>
              <div className="space-y-0.5 mt-1">
                {items.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => handleSelect(item)}
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-secondary text-left transition-colors active:scale-[0.98]"
                  >
                    <span className="text-muted-foreground shrink-0">{item.categoryIcon}</span>
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium truncate">{item.title}</div>
                      {item.subtitle && (
                        <div className="text-[10px] text-muted-foreground truncate">{item.subtitle}</div>
                      )}
                    </div>
                    <ArrowRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Search input bar — fixed at bottom of the panel */}
        <div className="border-t border-border px-4 py-3 bg-background" style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 12px)" }}>
          <div className="flex items-center gap-2">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input
                ref={inputRef}
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="Objekte, Mieter, Dokumente suchen..."
                className="w-full h-11 pl-9 pr-3 rounded-xl bg-secondary border-0 text-base outline-none focus:ring-2 focus:ring-primary/30"
                autoComplete="off"
                autoCorrect="off"
                spellCheck={false}
              />
            </div>
            {/* Voice input button — always clickable, re-prompts permission after denial */}
            <button
              type="button"
              onClick={toggleVoice}
              className={cn(
                "h-10 w-10 rounded-full flex items-center justify-center transition-all active:scale-95 shrink-0",
                voiceListening
                  ? "bg-destructive text-destructive-foreground animate-pulse shadow-lg"
                  : voiceDenied
                    ? "bg-amber-500/20 text-amber-600 hover:bg-amber-500/30"
                    : "bg-secondary text-secondary-foreground hover:bg-secondary/80",
              )}
              aria-label={voiceListening ? "Spracheingabe stoppen" : voiceDenied ? "Mikrofon erneut anfragen" : "Spracheingabe starten"}
            >
              {voiceListening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
            </button>
            <button
              onClick={onClose}
              className="h-10 px-3 rounded-xl bg-secondary text-sm font-medium text-muted-foreground hover:text-foreground transition-colors shrink-0"
            >
              Abbrechen
            </button>
          </div>
        </div>
      </div>
    </div>
  );
});
