/**
 * Newsticker — Immobilien-News für Berlin & Brandenburg
 * Aggregiert Nachrichten aus kostenlosen Quellen (RSS-Feeds, Google News).
 * Unterpunkt unter "Akquise" im Navigationsmenü.
 */
import { useState, useEffect, useMemo, useCallback } from "react";
import { Newspaper, ExternalLink, RefreshCw, Filter, Search, Clock, MapPin, Tag, ChevronDown, Loader2, AlertCircle, Globe } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { useDebounce } from "@/hooks/useDebounce";

/* ─── Types ─── */
interface NewsItem {
  id: string;
  title: string;
  description: string;
  url: string;
  source: string;
  sourceIcon?: string;
  publishedAt: string;
  category: NewsCategory;
  region: "berlin" | "brandenburg" | "both";
  imageUrl?: string;
}

type NewsCategory =
  | "markt"         // Marktberichte, Preisentwicklung
  | "neubau"        // Neubauprojekte
  | "politik"       // Mietenpolitik, Regulierung
  | "gewerbe"       // Gewerbeimmobilien
  | "wohnen"        // Wohnimmobilien allgemein
  | "investment"    // Investitionen, Transaktionen
  | "stadtentwicklung" // Infrastruktur, Quartiersentwicklung
  | "sonstiges";    // Sonstiges

const CATEGORY_LABELS: Record<NewsCategory, string> = {
  markt: "Marktberichte",
  neubau: "Neubauprojekte",
  politik: "Mietenpolitik",
  gewerbe: "Gewerbe",
  wohnen: "Wohnen",
  investment: "Investment",
  stadtentwicklung: "Stadtentwicklung",
  sonstiges: "Sonstiges",
};

const CATEGORY_COLORS: Record<NewsCategory, string> = {
  markt: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
  neubau: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  politik: "bg-red-500/10 text-red-600 dark:text-red-400",
  gewerbe: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  wohnen: "bg-violet-500/10 text-violet-600 dark:text-violet-400",
  investment: "bg-green-500/10 text-green-600 dark:text-green-400",
  stadtentwicklung: "bg-cyan-500/10 text-cyan-600 dark:text-cyan-400",
  sonstiges: "bg-gray-500/10 text-gray-600 dark:text-gray-400",
};

const REGION_LABELS: Record<string, string> = {
  berlin: "Berlin",
  brandenburg: "Brandenburg",
  both: "Berlin & Brandenburg",
};

/* ─── RSS Feed Sources ─── */
const RSS_FEEDS = [
  /* Google News — Berlin Immobilien */
  {
    url: "https://news.google.com/rss/search?q=immobilien+berlin+OR+brandenburg+wohnung+OR+miete+OR+neubau&hl=de&gl=DE&ceid=DE:de",
    source: "Google News",
    icon: "🔍",
  },
  /* Tagesspiegel — Berlin */
  {
    url: "https://www.tagesspiegel.de/wirtschaft/immobilien/rss",
    source: "Tagesspiegel",
    icon: "📰",
  },
  /* Berliner Morgenpost */
  {
    url: "https://www.morgenpost.de/berlin/feed.rss",
    source: "Berliner Morgenpost",
    icon: "📰",
  },
  /* rbb24 — Berlin-Brandenburg */
  {
    url: "https://www.rbb24.de/wirtschaft/index.xml/feed=rss.xml",
    source: "rbb24",
    icon: "📺",
  },
  /* Immobilien Zeitung */
  {
    url: "https://news.google.com/rss/search?q=site:iz.de+berlin+OR+brandenburg&hl=de&gl=DE&ceid=DE:de",
    source: "IZ (via Google)",
    icon: "🏢",
  },
  /* Haufe Immobilien */
  {
    url: "https://news.google.com/rss/search?q=site:haufe.de+immobilien+berlin&hl=de&gl=DE&ceid=DE:de",
    source: "Haufe (via Google)",
    icon: "📊",
  },
];

/* ─── Utility: Categorise news by keywords ─── */
function categoriseNews(title: string, description: string): NewsCategory {
  const text = `${title} ${description}`.toLowerCase();
  if (/marktbericht|preisentwicklung|immobilienpreise|quadratmeterpreis|mietpreisspiegel|preisindex|statistik/.test(text)) return "markt";
  if (/neubau|bauprojekt|bauvorhaben|richtfest|grundsteinlegung|baugenehmigung|wohnungsbau/.test(text)) return "neubau";
  if (/mietendeckel|mietpreisbremse|regulierung|verordnung|gesetz|senat|bezirksamt|politik|koalition/.test(text)) return "politik";
  if (/gewerbe|büro|office|einzelhandel|logistik|gewerbefläche/.test(text)) return "gewerbe";
  if (/investment|transaktion|ankauf|verkauf|portfolio|fonds|rendite|investor/.test(text)) return "investment";
  if (/stadtentwicklung|quartier|infrastruktur|verkehr|bahn|flughafen|ber\b/.test(text)) return "stadtentwicklung";
  if (/wohnung|miete|eigentum|wohnraum|mietwohnung|eigentumswohnung|wohnen/.test(text)) return "wohnen";
  return "sonstiges";
}

/* ─── Utility: Detect region ─── */
function detectRegion(title: string, description: string): "berlin" | "brandenburg" | "both" {
  const text = `${title} ${description}`.toLowerCase();
  const hasBerlin = /berlin|charlottenburg|kreuzberg|mitte|neukölln|prenzlauer|friedrichshain|tempelhof|spandau|steglitz|pankow|lichtenberg|treptow|marzahn|reinickendorf|wedding/.test(text);
  const hasBrandenburg = /brandenburg|potsdam|cottbus|frankfurt.*oder|oranienburg|bernau|falkensee|eberswalde|ludwigsfelde|königs wusterhausen|wildau|schönefeld/.test(text);
  if (hasBerlin && hasBrandenburg) return "both";
  if (hasBrandenburg) return "brandenburg";
  return "berlin";
}

/* ─── Utility: Parse RSS XML to items ─── */
function parseRSSItems(xml: string, source: string, icon: string): NewsItem[] {
  const items: NewsItem[] = [];
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(xml, "text/xml");
    const entries = doc.querySelectorAll("item, entry");
    entries.forEach((entry) => {
      const title = entry.querySelector("title")?.textContent?.trim() || "";
      const link = entry.querySelector("link")?.textContent?.trim()
        || entry.querySelector("link")?.getAttribute("href") || "";
      const description = (
        entry.querySelector("description")?.textContent?.trim()
        || entry.querySelector("summary")?.textContent?.trim()
        || entry.querySelector("content")?.textContent?.trim()
        || ""
      ).replace(/<[^>]+>/g, "").slice(0, 300);
      const pubDate = entry.querySelector("pubDate")?.textContent?.trim()
        || entry.querySelector("published")?.textContent?.trim()
        || entry.querySelector("updated")?.textContent?.trim()
        || "";
      /* Extract image from media:content or enclosure */
      const mediaUrl = entry.querySelector("media\\:content, content")?.getAttribute("url")
        || entry.querySelector("enclosure")?.getAttribute("url")
        || undefined;
      const imageUrl = mediaUrl && /\.(jpg|jpeg|png|webp|gif)/i.test(mediaUrl) ? mediaUrl : undefined;

      if (title && link) {
        try {
          const category = categoriseNews(title, description);
          const region = detectRegion(title, description);
          const safeId = `${source}-${encodeURIComponent(link).slice(0, 24)}`;
          let publishedAt: string;
          try {
            publishedAt = pubDate ? new Date(pubDate).toISOString() : new Date().toISOString();
            if (publishedAt === "Invalid Date") throw new Error();
          } catch {
            publishedAt = new Date().toISOString();
          }
          items.push({
            id: safeId,
            title,
            description,
            url: link,
            source,
            sourceIcon: icon,
            publishedAt,
            category,
            region,
            imageUrl,
          });
        } catch {
          /* skip this item — don't abort the entire feed */
        }
      }
    });
  } catch {
    /* RSS parse error — silently skip */
  }
  return items;
}

/* ─── Utility: Fetch RSS via public CORS proxy ─── */
const CORS_PROXIES = [
  (url: string) => `https://api.codetabs.com/v1/proxy/?quest=${encodeURIComponent(url)}`,
  (url: string) => `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`,
  (url: string) => `https://corsproxy.io/?${encodeURIComponent(url)}`,
];

async function fetchRSSFeed(feedUrl: string, source: string, icon: string): Promise<NewsItem[]> {
  for (const buildProxyUrl of CORS_PROXIES) {
    try {
      const resp = await fetch(buildProxyUrl(feedUrl), {
        signal: AbortSignal.timeout(10000),
      });
      if (!resp.ok) continue;
      const text = await resp.text();
      const items = parseRSSItems(text, source, icon);
      if (items.length > 0) return items;
    } catch {
      continue;
    }
  }

  /* Last resort: try rss2json API (returns JSON, not XML) */
  try {
    const resp = await fetch(
      `https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(feedUrl)}`,
      { signal: AbortSignal.timeout(10000) },
    );
    if (resp.ok) {
      const data = await resp.json();
      if (data.status === "ok" && Array.isArray(data.items)) {
        return data.items.map((item: { title?: string; link?: string; description?: string; pubDate?: string; thumbnail?: string }, idx: number) => {
          const title = item.title?.trim() || "";
          const description = (item.description || "").replace(/<[^>]+>/g, "").slice(0, 300);
          const category = categoriseNews(title, description);
          const region = detectRegion(title, description);
          return {
            id: `${source}-rss2json-${idx}`,
            title,
            description,
            url: item.link || "",
            source,
            sourceIcon: icon,
            publishedAt: item.pubDate ? new Date(item.pubDate).toISOString() : new Date().toISOString(),
            category,
            region,
            imageUrl: item.thumbnail && /\.(jpg|jpeg|png|webp|gif)/i.test(item.thumbnail) ? item.thumbnail : undefined,
          } satisfies NewsItem;
        }).filter((n: NewsItem) => n.title && n.url);
      }
    }
  } catch {
    /* rss2json also failed */
  }

  return [];
}

/* ─── Utility: Relative time in German ─── */
function relativeTimeDE(dateStr: string): string {
  const now = Date.now();
  const parsed = new Date(dateStr).getTime();
  if (isNaN(parsed)) return "";
  const diffMs = now - parsed;
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "Gerade eben";
  if (mins < 60) return `Vor ${mins} Min.`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `Vor ${hours} Std.`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "Gestern";
  if (days < 7) return `Vor ${days} Tagen`;
  if (days < 30) return `Vor ${Math.floor(days / 7)} Wochen`;
  return new Date(dateStr).toLocaleDateString("de-DE", { day: "2-digit", month: "short", year: "numeric" });
}

/* ─── Component ─── */
const Newsticker = () => {
  const [news, setNews] = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 300);
  const [selectedCategories, setSelectedCategories] = useState<Set<NewsCategory>>(new Set());
  const [selectedRegion, setSelectedRegion] = useState<string>("all");
  const [showFilters, setShowFilters] = useState(false);
  const [displayCount, setDisplayCount] = useState(20);
  const [lastFetched, setLastFetched] = useState<Date | null>(null);

  useEffect(() => { document.title = "Newsticker \u2013 ImmoControl"; }, []);

  /* Fetch all RSS feeds */
  const fetchAllNews = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true); else setLoading(true);
    try {
      const results = await Promise.allSettled(
        RSS_FEEDS.map(feed => fetchRSSFeed(feed.url, feed.source, feed.icon))
      );
      const allItems: NewsItem[] = [];
      results.forEach(r => {
        if (r.status === "fulfilled") allItems.push(...r.value);
      });
      /* Deduplicate by title similarity */
      const seen = new Set<string>();
      const deduped = allItems.filter(item => {
        const key = item.title.toLowerCase().replace(/[^a-zäöü0-9]/g, "").slice(0, 60);
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
      /* Sort by date descending */
      deduped.sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime());
      setNews(deduped);
      setLastFetched(new Date());
      if (isRefresh) toast.success(`${deduped.length} Nachrichten aktualisiert`);
    } catch {
      toast.error("Fehler beim Laden der Nachrichten");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { fetchAllNews(); }, [fetchAllNews]);

  /* Auto-refresh every 10 minutes */
  useEffect(() => {
    const interval = setInterval(() => fetchAllNews(true), 10 * 60 * 1000);
    return () => clearInterval(interval);
  }, [fetchAllNews]);

  /* Filter and search */
  const filteredNews = useMemo(() => {
    let result = [...news];
    if (debouncedSearch) {
      const q = debouncedSearch.toLowerCase();
      result = result.filter(n =>
        n.title.toLowerCase().includes(q) ||
        n.description.toLowerCase().includes(q) ||
        n.source.toLowerCase().includes(q)
      );
    }
    if (selectedCategories.size > 0) {
      result = result.filter(n => selectedCategories.has(n.category));
    }
    if (selectedRegion !== "all") {
      result = result.filter(n => n.region === selectedRegion || n.region === "both");
    }
    return result;
  }, [news, debouncedSearch, selectedCategories, selectedRegion]);

  const displayedNews = useMemo(() => filteredNews.slice(0, displayCount), [filteredNews, displayCount]);

  /* Category stats */
  const categoryStats = useMemo(() => {
    const counts: Record<string, number> = {};
    news.forEach(n => { counts[n.category] = (counts[n.category] || 0) + 1; });
    return counts;
  }, [news]);

  /* Source stats */
  const sourceStats = useMemo(() => {
    const counts: Record<string, number> = {};
    news.forEach(n => { counts[n.source] = (counts[n.source] || 0) + 1; });
    return counts;
  }, [news]);

  const toggleCategory = (cat: NewsCategory) => {
    setSelectedCategories(prev => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat); else next.add(cat);
      return next;
    });
    setDisplayCount(20);
  };

  /* Loading skeleton */
  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-64 bg-secondary animate-pulse rounded" />
        <div className="grid gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-28 bg-secondary animate-pulse rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6" role="main" aria-label="Immobilien-Newsticker">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight flex items-center gap-2">
            <Newspaper className="h-6 w-6 text-primary" />
            Immobilien-Newsticker
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {news.length} Nachrichten aus Berlin & Brandenburg
            {lastFetched && (
              <span className="ml-2 text-[10px]">
                · Aktualisiert {relativeTimeDE(lastFetched.toISOString())}
              </span>
            )}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setShowFilters(!showFilters)}>
            <Filter className="h-3.5 w-3.5" />
            Filter
            {selectedCategories.size > 0 && (
              <span className="ml-1 px-1.5 py-0.5 rounded-full bg-primary text-primary-foreground text-[10px]">
                {selectedCategories.size}
              </span>
            )}
          </Button>
          <Button variant="outline" size="sm" className="gap-1.5" onClick={() => fetchAllNews(true)} disabled={refreshing}>
            <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`} />
            Aktualisieren
          </Button>
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Nachrichten durchsuchen..."
          className="pl-10"
          value={search}
          onChange={(e) => { setSearch(e.target.value); setDisplayCount(20); }}
        />
      </div>

      {/* Filters */}
      {showFilters && (
        <div className="space-y-4 p-4 rounded-xl border border-border bg-card animate-fade-in">
          {/* Category filters */}
          <div>
            <p className="text-xs font-semibold text-muted-foreground mb-2 flex items-center gap-1.5">
              <Tag className="h-3.5 w-3.5" /> Kategorien
            </p>
            <div className="flex flex-wrap gap-1.5">
              {(Object.keys(CATEGORY_LABELS) as NewsCategory[]).map(cat => (
                <button
                  key={cat}
                  onClick={() => toggleCategory(cat)}
                  className={`px-2.5 py-1 rounded-full text-[11px] font-medium transition-all ${
                    selectedCategories.has(cat)
                      ? CATEGORY_COLORS[cat] + " ring-1 ring-current"
                      : "bg-secondary text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {CATEGORY_LABELS[cat]}
                  {categoryStats[cat] ? ` (${categoryStats[cat]})` : ""}
                </button>
              ))}
            </div>
          </div>

          {/* Region filter */}
          <div>
            <p className="text-xs font-semibold text-muted-foreground mb-2 flex items-center gap-1.5">
              <MapPin className="h-3.5 w-3.5" /> Region
            </p>
            <div className="flex gap-1.5">
              {["all", "berlin", "brandenburg"].map(r => (
                <button
                  key={r}
                  onClick={() => { setSelectedRegion(r); setDisplayCount(20); }}
                  className={`px-2.5 py-1 rounded-full text-[11px] font-medium transition-all ${
                    selectedRegion === r
                      ? "bg-primary/10 text-primary ring-1 ring-primary/30"
                      : "bg-secondary text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {r === "all" ? "Alle" : REGION_LABELS[r]}
                </button>
              ))}
            </div>
          </div>

          {/* Source stats */}
          <div>
            <p className="text-xs font-semibold text-muted-foreground mb-2 flex items-center gap-1.5">
              <Globe className="h-3.5 w-3.5" /> Quellen
            </p>
            <div className="flex flex-wrap gap-1.5">
              {Object.entries(sourceStats).map(([source, count]) => (
                <span key={source} className="px-2 py-0.5 rounded-full bg-secondary text-[10px] text-muted-foreground">
                  {source}: {count}
                </span>
              ))}
            </div>
          </div>

          {selectedCategories.size > 0 && (
            <Button variant="ghost" size="sm" className="text-xs" onClick={() => setSelectedCategories(new Set())}>
              Filter zurücksetzen
            </Button>
          )}
        </div>
      )}

      {/* Results count */}
      {(debouncedSearch || selectedCategories.size > 0 || selectedRegion !== "all") && (
        <p className="text-xs text-muted-foreground">
          {filteredNews.length} von {news.length} Nachrichten
        </p>
      )}

      {/* News list */}
      {filteredNews.length === 0 ? (
        <div className="text-center py-12">
          <AlertCircle className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">
            {news.length === 0
              ? "Keine Nachrichten verfügbar. Versuche es später erneut."
              : "Keine Nachrichten für diese Filter gefunden."}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {displayedNews.map((item, idx) => (
            <a
              key={item.id}
              href={item.url}
              target="_blank"
              rel="noopener noreferrer"
              className="group block gradient-card rounded-xl border border-border p-4 hover:border-primary/30 hover:shadow-lg transition-all duration-300 animate-fade-in"
              style={{ animationDelay: `${Math.min(idx * 30, 300)}ms` }}
            >
              <div className="flex gap-4">
                {/* Content */}
                <div className="flex-1 min-w-0 space-y-1.5">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${CATEGORY_COLORS[item.category]}`}>
                      {CATEGORY_LABELS[item.category]}
                    </span>
                    <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                      <MapPin className="h-2.5 w-2.5" />
                      {REGION_LABELS[item.region]}
                    </span>
                  </div>
                  <h3 className="text-sm font-semibold leading-tight group-hover:text-primary transition-colors line-clamp-2">
                    {item.title}
                  </h3>
                  {item.description && (
                    <p className="text-xs text-muted-foreground line-clamp-2">
                      {item.description}
                    </p>
                  )}
                  <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
                    <span className="flex items-center gap-1">
                      {item.sourceIcon} {item.source}
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock className="h-2.5 w-2.5" />
                      {relativeTimeDE(item.publishedAt)}
                    </span>
                    <ExternalLink className="h-2.5 w-2.5 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                </div>
                {/* Thumbnail */}
                {item.imageUrl && (
                  <div className="hidden sm:block w-24 h-20 rounded-lg overflow-hidden shrink-0 bg-secondary">
                    <img
                      src={item.imageUrl}
                      alt=""
                      className="w-full h-full object-cover"
                      loading="lazy"
                      onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                    />
                  </div>
                )}
              </div>
            </a>
          ))}
        </div>
      )}

      {/* Load more */}
      {displayCount < filteredNews.length && (
        <div className="text-center">
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5"
            onClick={() => setDisplayCount(prev => prev + 20)}
          >
            <ChevronDown className="h-3.5 w-3.5" />
            Weitere {Math.min(20, filteredNews.length - displayCount)} laden
          </Button>
        </div>
      )}

      {/* Footer info */}
      <div className="text-center text-[10px] text-muted-foreground space-y-1 pb-4">
        <p>Nachrichten werden aus kostenlosen RSS-Feeds aggregiert (Google News, Tagesspiegel, Berliner Morgenpost, rbb24, u.a.)</p>
        <p>Automatische Aktualisierung alle 10 Minuten · Alle Rechte bei den jeweiligen Quellen</p>
      </div>
    </div>
  );
};

export default Newsticker;
