/**
 * Newsticker — Immobilien-News für Berlin & Brandenburg
 * Features: Sentiment-Analyse, Lesezeichen, Trending Topics, Kompakt/Karten-Ansicht
 */
import { useState, useEffect, useMemo, useCallback } from "react";
import {
  Newspaper, ExternalLink, RefreshCw, Filter, Search, Clock, MapPin, Tag,
  ChevronDown, AlertCircle, Globe, Bookmark, BookmarkCheck,
  Share2, TrendingUp, Minus, LayoutGrid, List, BarChart3,
  ThumbsUp, ThumbsDown, Flame,
} from "lucide-react";
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
  sentiment: "positive" | "negative" | "neutral";
}

type NewsCategory =
  | "markt"
  | "neubau"
  | "politik"
  | "gewerbe"
  | "wohnen"
  | "investment"
  | "stadtentwicklung"
  | "sonstiges";

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

const SENTIMENT_CONFIG = {
  positive: { icon: ThumbsUp, label: "Positiv", color: "text-emerald-500", bg: "bg-emerald-500/10" },
  negative: { icon: ThumbsDown, label: "Negativ", color: "text-red-500", bg: "bg-red-500/10" },
  neutral: { icon: Minus, label: "Neutral", color: "text-gray-400", bg: "bg-gray-500/10" },
} as const;

/* ─── RSS Feed Sources (11 sources) ─── */
const RSS_FEEDS = [
  { url: "https://news.google.com/rss/search?q=immobilien+berlin+OR+brandenburg+wohnung+OR+miete+OR+neubau&hl=de&gl=DE&ceid=DE:de", source: "Google News", icon: "\uD83D\uDD0D" },
  { url: "https://www.tagesspiegel.de/wirtschaft/immobilien/rss", source: "Tagesspiegel", icon: "\uD83D\uDCF0" },
  { url: "https://www.morgenpost.de/berlin/feed.rss", source: "Berliner Morgenpost", icon: "\uD83D\uDCF0" },
  { url: "https://www.rbb24.de/wirtschaft/index.xml/feed=rss.xml", source: "rbb24", icon: "\uD83D\uDCFA" },
  { url: "https://news.google.com/rss/search?q=site:iz.de+berlin+OR+brandenburg&hl=de&gl=DE&ceid=DE:de", source: "IZ (via Google)", icon: "\uD83C\uDFE2" },
  { url: "https://news.google.com/rss/search?q=site:haufe.de+immobilien+berlin&hl=de&gl=DE&ceid=DE:de", source: "Haufe (via Google)", icon: "\uD83D\uDCCA" },
  { url: "https://news.google.com/rss/search?q=site:handelsblatt.com+immobilien+berlin+OR+wohnen&hl=de&gl=DE&ceid=DE:de", source: "Handelsblatt", icon: "\uD83D\uDCBC" },
  { url: "https://news.google.com/rss/search?q=site:capital.de+immobilien+berlin+OR+brandenburg&hl=de&gl=DE&ceid=DE:de", source: "Capital", icon: "\uD83D\uDCB0" },
  { url: "https://news.google.com/rss/search?q=site:bz-berlin.de+immobilien+OR+wohnung+OR+miete&hl=de&gl=DE&ceid=DE:de", source: "BZ Berlin", icon: "\uD83D\uDDDE\uFE0F" },
  { url: "https://news.google.com/rss/search?q=site:berliner-zeitung.de+immobilien+OR+wohnen+OR+miete&hl=de&gl=DE&ceid=DE:de", source: "Berliner Zeitung", icon: "\uD83D\uDCF0" },
  { url: "https://news.google.com/rss/search?q=site:wiwo.de+immobilien+berlin+OR+wohnen&hl=de&gl=DE&ceid=DE:de", source: "WirtschaftsWoche", icon: "\uD83D\uDCC8" },
];

/* ─── Categorise news by keywords ─── */
function categoriseNews(title: string, description: string): NewsCategory {
  const text = `${title} ${description}`.toLowerCase();
  if (/marktbericht|preisentwicklung|immobilienpreise|quadratmeterpreis|mietpreisspiegel|preisindex|statistik/.test(text)) return "markt";
  if (/neubau|bauprojekt|bauvorhaben|richtfest|grundsteinlegung|baugenehmigung|wohnungsbau/.test(text)) return "neubau";
  if (/mietendeckel|mietpreisbremse|regulierung|verordnung|gesetz|senat|bezirksamt|politik|koalition/.test(text)) return "politik";
  if (/gewerbe|b\u00fcro|office|einzelhandel|logistik|gewerbefl\u00e4che/.test(text)) return "gewerbe";
  if (/investment|transaktion|ankauf|verkauf|portfolio|fonds|rendite|investor/.test(text)) return "investment";
  if (/stadtentwicklung|quartier|infrastruktur|verkehr|bahn|flughafen|ber\b/.test(text)) return "stadtentwicklung";
  if (/wohnung|miete|eigentum|wohnraum|mietwohnung|eigentumswohnung|wohnen/.test(text)) return "wohnen";
  return "sonstiges";
}

/* ─── Sentiment analysis via keyword matching ─── */
const POSITIVE_KEYWORDS = [
  "steigt", "steigerung", "wachstum", "boom", "rekord", "nachfrage", "positiv",
  "erholung", "gewinn", "chancen", "zunahme", "aufwind", "erfolgreich", "attraktiv",
  "g\u00fcnstig", "bezahlbar", "f\u00f6rderung", "subvention", "entlastung", "investition",
  "neubau", "richtfest", "grundsteinlegung", "ausbau", "modernisierung",
];
const NEGATIVE_KEYWORDS = [
  "sinkt", "r\u00fcckgang", "krise", "einbruch", "verlust", "mangel", "knappheit",
  "teuer", "unbezahlbar", "leerstand", "insolvenz", "pleite", "stagnation",
  "r\u00fcckl\u00e4ufig", "negativ", "warnung", "risiko", "problem", "sorge", "angst",
  "mietpreisbremse", "zwangsversteigerung", "abriss", "verbot", "baustopp",
  "enteignung", "mietendeckel", "versch\u00e4rfung", "belastung",
];

function detectSentiment(title: string, description: string): "positive" | "negative" | "neutral" {
  const text = `${title} ${description}`.toLowerCase();
  let score = 0;
  for (const kw of POSITIVE_KEYWORDS) { if (text.includes(kw)) score++; }
  for (const kw of NEGATIVE_KEYWORDS) { if (text.includes(kw)) score--; }
  if (score >= 2) return "positive";
  if (score <= -2) return "negative";
  return "neutral";
}

/* ─── Detect region ─── */
function detectRegion(title: string, description: string): "berlin" | "brandenburg" | "both" {
  const text = `${title} ${description}`.toLowerCase();
  const hasBerlin = /berlin|charlottenburg|kreuzberg|mitte|neuk\u00f6lln|prenzlauer|friedrichshain|tempelhof|spandau|steglitz|pankow|lichtenberg|treptow|marzahn|reinickendorf|wedding/.test(text);
  const hasBrandenburg = /brandenburg|potsdam|cottbus|frankfurt.*oder|oranienburg|bernau|falkensee|eberswalde|ludwigsfelde|k\u00f6nigs wusterhausen|wildau|sch\u00f6nefeld/.test(text);
  if (hasBerlin && hasBrandenburg) return "both";
  if (hasBrandenburg) return "brandenburg";
  return "berlin";
}

/* ─── Parse RSS XML ─── */
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
      const mediaUrl = entry.querySelector("media\\:content, content")?.getAttribute("url")
        || entry.querySelector("enclosure")?.getAttribute("url")
        || undefined;
      const imageUrl = mediaUrl && /\.(jpg|jpeg|png|webp|gif)/i.test(mediaUrl) ? mediaUrl : undefined;
      if (title && link) {
        try {
          const category = categoriseNews(title, description);
          const region = detectRegion(title, description);
          const sentiment = detectSentiment(title, description);
          const safeId = `${source}-${encodeURIComponent(link).slice(0, 120)}`;
          let publishedAt: string;
          try {
            publishedAt = pubDate ? new Date(pubDate).toISOString() : new Date().toISOString();
            if (publishedAt === "Invalid Date") throw new Error();
          } catch {
            publishedAt = new Date().toISOString();
          }
          items.push({ id: safeId, title, description, url: link, source, sourceIcon: icon, publishedAt, category, region, imageUrl, sentiment });
        } catch {
          /* skip malformed item */
        }
      }
    });
  } catch {
    /* RSS parse error */
  }
  return items;
}

/* ─── Fetch RSS via CORS proxy ─── */
const CORS_PROXIES = [
  (url: string) => `https://api.codetabs.com/v1/proxy/?quest=${encodeURIComponent(url)}`,
  (url: string) => `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`,
  (url: string) => `https://corsproxy.io/?${encodeURIComponent(url)}`,
];

async function fetchRSSFeed(feedUrl: string, source: string, icon: string): Promise<NewsItem[]> {
  for (const buildProxyUrl of CORS_PROXIES) {
    try {
      const resp = await fetch(buildProxyUrl(feedUrl), { signal: AbortSignal.timeout(10000) });
      if (!resp.ok) continue;
      const text = await resp.text();
      const items = parseRSSItems(text, source, icon);
      if (items.length > 0) return items;
    } catch {
      continue;
    }
  }
  /* Last resort: rss2json API */
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
          return {
            id: `${source}-rss2json-${idx}`,
            title,
            description,
            url: item.link || "",
            source,
            sourceIcon: icon,
            publishedAt: (() => { try { return item.pubDate ? new Date(item.pubDate).toISOString() : new Date().toISOString(); } catch { return new Date().toISOString(); } })(),
            category: categoriseNews(title, description),
            region: detectRegion(title, description),
            sentiment: detectSentiment(title, description),
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

/* ─── Relative time in German ─── */
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

/* ─── Bookmarks persistence ─── */
const BOOKMARKS_KEY = "immocontrol_news_bookmarks";

function loadBookmarks(): Set<string> {
  try {
    const raw = localStorage.getItem(BOOKMARKS_KEY);
    return raw ? new Set(JSON.parse(raw) as string[]) : new Set();
  } catch {
    return new Set();
  }
}

function saveBookmarks(ids: Set<string>) {
  try {
    localStorage.setItem(BOOKMARKS_KEY, JSON.stringify([...ids]));
  } catch {
    /* localStorage quota exceeded */
  }
}

/* ─── View mode persistence ─── */
const VIEW_MODE_KEY = "immocontrol_news_view";

/* ─── Component ─── */
const Newsticker = () => {
  const [news, setNews] = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 300);
  const [selectedCategories, setSelectedCategories] = useState<Set<NewsCategory>>(new Set());
  const [selectedRegion, setSelectedRegion] = useState<string>("all");
  const [selectedSentiment, setSelectedSentiment] = useState<string>("all");
  const [showFilters, setShowFilters] = useState(false);
  const [displayCount, setDisplayCount] = useState(20);
  const [lastFetched, setLastFetched] = useState<Date | null>(null);
  const [bookmarks, setBookmarks] = useState<Set<string>>(loadBookmarks);
  const [showBookmarksOnly, setShowBookmarksOnly] = useState(false);
  const [viewMode, setViewMode] = useState<"cards" | "compact">(
    () => (localStorage.getItem(VIEW_MODE_KEY) as "cards" | "compact") || "cards"
  );

  useEffect(() => { document.title = "Newsticker \u2013 ImmoControl"; }, []);

  /* Fetch all RSS feeds */
  const fetchAllNews = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true); else setLoading(true);
    try {
      const results = await Promise.allSettled(
        RSS_FEEDS.map(f => fetchRSSFeed(f.url, f.source, f.icon))
      );
      const allItems: NewsItem[] = [];
      results.forEach(r => { if (r.status === "fulfilled") allItems.push(...r.value); });
      /* Deduplicate by title similarity */
      const seen = new Set<string>();
      const deduped = allItems.filter(item => {
        const key = item.title.toLowerCase().replace(/[^a-z\u00e4\u00f6\u00fc0-9]/g, "").slice(0, 60);
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
      deduped.sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime());
      setNews(deduped);
      setLastFetched(new Date());
      if (isRefresh) toast.success(`${deduped.length} Nachrichten aus ${RSS_FEEDS.length} Quellen aktualisiert`);
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
    const iv = setInterval(() => fetchAllNews(true), 10 * 60 * 1000);
    return () => clearInterval(iv);
  }, [fetchAllNews]);

  /* Bookmark toggle */
  const toggleBookmark = useCallback((id: string) => {
    setBookmarks(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
        toast("Lesezeichen entfernt");
      } else {
        next.add(id);
        toast.success("Lesezeichen gespeichert");
      }
      saveBookmarks(next);
      return next;
    });
  }, []);

  /* Share article */
  const shareArticle = useCallback(async (item: NewsItem) => {
    const text = `${item.title}\n${item.url}`;
    if (navigator.share) {
      try { await navigator.share({ title: item.title, url: item.url }); } catch { /* cancelled */ }
    } else {
      try { await navigator.clipboard.writeText(text); toast.success("Link kopiert!"); } catch { toast.error("Kopieren fehlgeschlagen"); }
    }
  }, []);

  /* View mode toggle */
  const toggleViewMode = useCallback(() => {
    setViewMode(prev => {
      const next = prev === "cards" ? "compact" as const : "cards" as const;
      localStorage.setItem(VIEW_MODE_KEY, next);
      return next;
    });
  }, []);

  /* Filter and search */
  const filteredNews = useMemo(() => {
    let result = [...news];
    if (showBookmarksOnly) result = result.filter(n => bookmarks.has(n.id));
    if (debouncedSearch) {
      const q = debouncedSearch.toLowerCase();
      result = result.filter(n =>
        n.title.toLowerCase().includes(q) ||
        n.description.toLowerCase().includes(q) ||
        n.source.toLowerCase().includes(q)
      );
    }
    if (selectedCategories.size > 0) result = result.filter(n => selectedCategories.has(n.category));
    if (selectedRegion !== "all") result = result.filter(n => n.region === selectedRegion || n.region === "both");
    if (selectedSentiment !== "all") result = result.filter(n => n.sentiment === selectedSentiment);
    return result;
  }, [news, debouncedSearch, selectedCategories, selectedRegion, selectedSentiment, showBookmarksOnly, bookmarks]);

  const displayedNews = useMemo(() => filteredNews.slice(0, displayCount), [filteredNews, displayCount]);

  /* Stats */
  const categoryStats = useMemo(() => {
    const c: Record<string, number> = {};
    news.forEach(n => { c[n.category] = (c[n.category] || 0) + 1; });
    return c;
  }, [news]);

  const sourceStats = useMemo(() => {
    const c: Record<string, number> = {};
    news.forEach(n => { c[n.source] = (c[n.source] || 0) + 1; });
    return c;
  }, [news]);

  const sentimentStats = useMemo(() => {
    const c = { positive: 0, negative: 0, neutral: 0 };
    news.forEach(n => { c[n.sentiment]++; });
    return c;
  }, [news]);

  /* Trending topics from recent headlines */
  const trendingTopics = useMemo(() => {
    const stopWords = new Set([
      "der", "die", "das", "und", "in", "von", "f\u00fcr", "mit", "auf", "den", "dem", "des",
      "ein", "eine", "einer", "einem", "ist", "wird", "werden", "hat", "haben", "aus", "an",
      "am", "als", "auch", "bei", "bis", "nach", "nicht", "noch", "nur", "oder", "sich", "so",
      "\u00fcber", "um", "wie", "zur", "zum", "zu", "vor", "es", "im", "war", "sind", "was",
      "kann", "mehr", "neue", "neuer", "neues", "ihre", "ihr", "wir", "sie", "ich", "man",
      "alle", "aber", "seine", "seinen", "seiner", "diese", "dieser", "dieses", "soll", "will",
      "via", "google", "news",
    ]);
    const wc: Record<string, number> = {};
    news.slice(0, 50).forEach(item => {
      const words = item.title.toLowerCase()
        .replace(/[^a-z\u00e4\u00f6\u00fc\u00df\s-]/g, "")
        .split(/\s+/)
        .filter(w => w.length > 3 && !stopWords.has(w));
      const seen = new Set<string>();
      words.forEach(w => {
        if (!seen.has(w)) { wc[w] = (wc[w] || 0) + 1; seen.add(w); }
      });
    });
    return Object.entries(wc)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([word, count]) => ({ word, count }));
  }, [news]);

  /* Today's activity */
  const todayStats = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    const tn = news.filter(n => n.publishedAt.startsWith(today));
    const c: Record<string, number> = {};
    tn.forEach(n => { c[n.category] = (c[n.category] || 0) + 1; });
    return { total: tn.length, counts: c };
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
            {news.length} Nachrichten aus {Object.keys(sourceStats).length} Quellen
            {lastFetched && (
              <span className="ml-2 text-[10px]">
                {"\u00B7"} Aktualisiert {relativeTimeDE(lastFetched.toISOString())}
              </span>
            )}
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button
            variant={showBookmarksOnly ? "default" : "outline"}
            size="sm"
            className="gap-1.5"
            onClick={() => { setShowBookmarksOnly(!showBookmarksOnly); setDisplayCount(20); }}
          >
            <BookmarkCheck className="h-3.5 w-3.5" />
            Merkliste
            {bookmarks.size > 0 && (
              <span className="ml-1 px-1.5 py-0.5 rounded-full bg-primary/20 text-primary text-[10px]">
                {bookmarks.size}
              </span>
            )}
          </Button>
          <Button variant="outline" size="sm" className="gap-1.5" onClick={toggleViewMode}>
            {viewMode === "cards" ? <List className="h-3.5 w-3.5" /> : <LayoutGrid className="h-3.5 w-3.5" />}
            {viewMode === "cards" ? "Kompakt" : "Karten"}
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5"
            onClick={() => setShowFilters(!showFilters)}
          >
            <Filter className="h-3.5 w-3.5" />
            Filter
            {(selectedCategories.size > 0 || selectedSentiment !== "all") && (
              <span className="ml-1 px-1.5 py-0.5 rounded-full bg-primary text-primary-foreground text-[10px]">
                {selectedCategories.size + (selectedSentiment !== "all" ? 1 : 0)}
              </span>
            )}
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5"
            onClick={() => fetchAllNews(true)}
            disabled={refreshing}
          >
            <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`} />
            Aktualisieren
          </Button>
        </div>
      </div>

      {/* Dashboard cards */}
      {news.length > 0 && !showBookmarksOnly && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {/* Sentiment card */}
          <div className="gradient-card rounded-xl border border-border p-4">
            <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground uppercase mb-2">
              <BarChart3 className="h-3 w-3" /> Marktstimmung
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded-full bg-emerald-500" />
                <span className="text-xs font-medium">{sentimentStats.positive}</span>
                <span className="text-[10px] text-muted-foreground">positiv</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded-full bg-gray-400" />
                <span className="text-xs font-medium">{sentimentStats.neutral}</span>
                <span className="text-[10px] text-muted-foreground">neutral</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded-full bg-red-500" />
                <span className="text-xs font-medium">{sentimentStats.negative}</span>
                <span className="text-[10px] text-muted-foreground">negativ</span>
              </div>
            </div>
            <div className="flex h-2 rounded-full overflow-hidden mt-2 bg-secondary">
              {news.length > 0 && (
                <>
                  <div className="bg-emerald-500 transition-all" style={{ width: `${(sentimentStats.positive / news.length) * 100}%` }} />
                  <div className="bg-gray-400 transition-all" style={{ width: `${(sentimentStats.neutral / news.length) * 100}%` }} />
                  <div className="bg-red-500 transition-all" style={{ width: `${(sentimentStats.negative / news.length) * 100}%` }} />
                </>
              )}
            </div>
          </div>

          {/* Trending Topics card */}
          <div className="gradient-card rounded-xl border border-border p-4">
            <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground uppercase mb-2">
              <Flame className="h-3 w-3" /> Trending Topics
            </div>
            <div className="flex flex-wrap gap-1.5">
              {trendingTopics.map(({ word, count }) => (
                <button
                  key={word}
                  onClick={() => { setSearch(word); setDisplayCount(20); }}
                  className="px-2 py-0.5 rounded-full bg-primary/10 text-primary text-[10px] font-medium hover:bg-primary/20 transition-colors"
                >
                  {word} <span className="text-muted-foreground ml-0.5">({count})</span>
                </button>
              ))}
              {trendingTopics.length === 0 && (
                <span className="text-[10px] text-muted-foreground">Keine Trends erkannt</span>
              )}
            </div>
          </div>

          {/* Today card */}
          <div className="gradient-card rounded-xl border border-border p-4">
            <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground uppercase mb-2">
              <TrendingUp className="h-3 w-3" /> Heute
            </div>
            <div className="text-xl font-bold">{todayStats.total} Artikel</div>
            <div className="flex flex-wrap gap-1 mt-1.5">
              {Object.entries(todayStats.counts)
                .sort((a, b) => b[1] - a[1])
                .slice(0, 4)
                .map(([cat, count]) => (
                  <span
                    key={cat}
                    className={`px-1.5 py-0.5 rounded-full text-[9px] font-medium ${CATEGORY_COLORS[cat as NewsCategory] || "bg-gray-500/10 text-gray-500"}`}
                  >
                    {CATEGORY_LABELS[cat as NewsCategory] || cat}: {count}
                  </span>
                ))}
            </div>
          </div>
        </div>
      )}

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

      {/* Filters panel */}
      {showFilters && (
        <div className="space-y-4 p-4 rounded-xl border border-border bg-card animate-fade-in">
          {/* Category filter */}
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
                      ? `${CATEGORY_COLORS[cat]} ring-1 ring-current`
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

          {/* Sentiment filter */}
          <div>
            <p className="text-xs font-semibold text-muted-foreground mb-2 flex items-center gap-1.5">
              <BarChart3 className="h-3.5 w-3.5" /> Stimmung
            </p>
            <div className="flex gap-1.5">
              {(["all", "positive", "negative", "neutral"] as const).map(s => {
                const cfg = s === "all" ? null : SENTIMENT_CONFIG[s];
                return (
                  <button
                    key={s}
                    onClick={() => { setSelectedSentiment(s); setDisplayCount(20); }}
                    className={`px-2.5 py-1 rounded-full text-[11px] font-medium transition-all flex items-center gap-1 ${
                      selectedSentiment === s
                        ? "bg-primary/10 text-primary ring-1 ring-primary/30"
                        : "bg-secondary text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {cfg && <cfg.icon className="h-3 w-3" />}
                    {s === "all" ? "Alle" : cfg?.label}
                    {s !== "all" && ` (${sentimentStats[s]})`}
                  </button>
                );
              })}
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

          {/* Reset filters */}
          {(selectedCategories.size > 0 || selectedSentiment !== "all") && (
            <Button
              variant="ghost"
              size="sm"
              className="text-xs"
              onClick={() => { setSelectedCategories(new Set()); setSelectedSentiment("all"); }}
            >
              Alle Filter zur&#252;cksetzen
            </Button>
          )}
        </div>
      )}

      {/* Results count */}
      {(debouncedSearch || selectedCategories.size > 0 || selectedRegion !== "all" || selectedSentiment !== "all" || showBookmarksOnly) && (
        <p className="text-xs text-muted-foreground">
          {filteredNews.length} von {news.length} Nachrichten
          {showBookmarksOnly && " (nur Lesezeichen)"}
        </p>
      )}

      {/* News list */}
      {filteredNews.length === 0 ? (
        <div className="text-center py-12">
          <AlertCircle className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">
            {showBookmarksOnly
              ? "Keine Lesezeichen vorhanden."
              : news.length === 0
                ? "Keine Nachrichten verf\u00fcgbar."
                : "Keine Nachrichten f\u00fcr diese Filter."}
          </p>
        </div>
      ) : viewMode === "compact" ? (
        /* ─── Compact list view ─── */
        <div className="divide-y divide-border rounded-xl border border-border overflow-hidden">
          {displayedNews.map((item) => {
            const sc = SENTIMENT_CONFIG[item.sentiment];
            const SentimentIcon = sc.icon;
            const isBookmarked = bookmarks.has(item.id);
            return (
              <div key={item.id} className="flex items-center gap-3 px-3 py-2.5 hover:bg-secondary/50 transition-colors group">
                <SentimentIcon className={`h-3.5 w-3.5 shrink-0 ${sc.color}`} />
                <span className={`shrink-0 px-1.5 py-0.5 rounded text-[9px] font-medium ${CATEGORY_COLORS[item.category]}`}>
                  {CATEGORY_LABELS[item.category]}
                </span>
                <a
                  href={item.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 min-w-0 text-xs font-medium truncate hover:text-primary transition-colors"
                >
                  {item.title}
                </a>
                <span className="text-[10px] text-muted-foreground shrink-0 hidden sm:inline">
                  {item.source}
                </span>
                <span className="text-[10px] text-muted-foreground shrink-0 hidden sm:inline">
                  {relativeTimeDE(item.publishedAt)}
                </span>
                <button
                  onClick={() => toggleBookmark(item.id)}
                  className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
                  aria-label={isBookmarked ? "Lesezeichen entfernen" : "Lesezeichen setzen"}
                >
                  {isBookmarked
                    ? <BookmarkCheck className="h-3.5 w-3.5 text-primary" />
                    : <Bookmark className="h-3.5 w-3.5 text-muted-foreground hover:text-primary" />}
                </button>
                <button
                  onClick={() => shareArticle(item)}
                  className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
                  aria-label="Teilen"
                >
                  <Share2 className="h-3.5 w-3.5 text-muted-foreground hover:text-primary" />
                </button>
              </div>
            );
          })}
        </div>
      ) : (
        /* ─── Cards view ─── */
        <div className="space-y-3">
          {displayedNews.map((item, idx) => {
            const sc = SENTIMENT_CONFIG[item.sentiment];
            const SentimentIcon = sc.icon;
            const isBookmarked = bookmarks.has(item.id);
            return (
              <div
                key={item.id}
                className="group gradient-card rounded-xl border border-border p-4 hover:border-primary/30 hover:shadow-lg transition-all duration-300 animate-fade-in"
                style={{ animationDelay: `${Math.min(idx * 30, 300)}ms` }}
              >
                <div className="flex gap-4">
                  <div className="flex-1 min-w-0 space-y-1.5">
                    {/* Badges */}
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${CATEGORY_COLORS[item.category]}`}>
                        {CATEGORY_LABELS[item.category]}
                      </span>
                      <span className={`flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-medium ${sc.bg} ${sc.color}`}>
                        <SentimentIcon className="h-2.5 w-2.5" />
                        {sc.label}
                      </span>
                      <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                        <MapPin className="h-2.5 w-2.5" />
                        {REGION_LABELS[item.region]}
                      </span>
                    </div>
                    {/* Title */}
                    <a href={item.url} target="_blank" rel="noopener noreferrer" className="block">
                      <h3 className="text-sm font-semibold leading-tight hover:text-primary transition-colors line-clamp-2">
                        {item.title}
                      </h3>
                    </a>
                    {/* Description */}
                    {item.description && (
                      <p className="text-xs text-muted-foreground line-clamp-2">{item.description}</p>
                    )}
                    {/* Meta */}
                    <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
                      <span className="flex items-center gap-1">{item.sourceIcon} {item.source}</span>
                      <span className="flex items-center gap-1">
                        <Clock className="h-2.5 w-2.5" />
                        {relativeTimeDE(item.publishedAt)}
                      </span>
                      <a href={item.url} target="_blank" rel="noopener noreferrer" aria-label="Artikel oeffnen">
                        <ExternalLink className="h-2.5 w-2.5 opacity-0 group-hover:opacity-100 transition-opacity" />
                      </a>
                      <button
                        onClick={() => toggleBookmark(item.id)}
                        className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                        aria-label={isBookmarked ? "Lesezeichen entfernen" : "Lesezeichen setzen"}
                      >
                        {isBookmarked
                          ? <BookmarkCheck className="h-3 w-3 text-primary" />
                          : <Bookmark className="h-3 w-3 hover:text-primary" />}
                      </button>
                      <button
                        onClick={() => shareArticle(item)}
                        className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                        aria-label="Teilen"
                      >
                        <Share2 className="h-3 w-3 hover:text-primary" />
                      </button>
                    </div>
                  </div>
                  {/* Image */}
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
              </div>
            );
          })}
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

      {/* Footer */}
      <div className="text-center text-[10px] text-muted-foreground space-y-1 pb-4">
        <p>
          Nachrichten aus {RSS_FEEDS.length} Quellen (Google News, Tagesspiegel, Morgenpost, rbb24,
          Handelsblatt, Capital, BZ, Berliner Zeitung, WiWo u.a.)
        </p>
        <p>
          Automatische Aktualisierung alle 10 Min. {"\u00B7"} Sentiment-Analyse per Keyword-Matching{" "}
          {"\u00B7"} Alle Rechte bei den jeweiligen Quellen
        </p>
      </div>
    </div>
  );
};

export default Newsticker;
