/**
 * Newsticker — Immobilien-News für Berlin & Brandenburg
 * Features: Sentiment-Analyse, Lesezeichen, Trending Topics, Kompakt/Karten-Ansicht
 */
import { useState, useEffect, useMemo, useCallback } from "react";
import {
  Newspaper, ExternalLink, RefreshCw, Filter, Search, Clock, MapPin, Tag,
  ChevronDown, AlertCircle, Globe, Bookmark, BookmarkCheck,
  Share2, TrendingUp, LayoutGrid, List, BarChart3,   Flame, Archive, Loader2, Lock, LockOpen, Download, WifiOff, Star,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { toast } from "sonner";
import { useDebounce } from "@/hooks/useDebounce";
import { handleError } from "@/lib/handleError";
import { toastErrorWithRetry } from "@/lib/toastMessages";
import { ManusNewstickerIntelligence } from "@/components/manus/ManusNewstickerIntelligence";
import { PageHeader, PageHeaderActions, PageHeaderDescription, PageHeaderMain, PageHeaderTitle } from "@/components/ui/page-header";
import { MobilePagePullToRefresh } from "@/components/mobile/MobilePagePullToRefresh";
import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/lib/queryKeys";
import { useAuth } from "@/hooks/useAuth";
import { useProperties } from "@/context/PropertyContext";
import { supabase } from "@/integrations/supabase/client";
import {
  type NewsItem,
  type NewsCategory,
  CATEGORY_LABELS,
  CATEGORY_COLORS,
  REGION_LABELS,
  BERLIN_DISTRICTS,
  BRANDENBURG_CITIES,
  SENTIMENT_CONFIG,
  detectCity,
  relativeTimeDE,
  hasLikelyPaywall,
  estimateReadingTime,
} from "./newsticker/newsUtils";
import { fetchAllRssNews, RSS_FEEDS } from "./newsticker/newsFetch";
import { computeDailyTopPicks } from "./newsticker/dailyTopPicks";
import { loadNewsFeedCache, saveNewsFeedCache } from "./newsticker/newsCache";
import { buildPortfolioLocationHints, type DealForLocation } from "./newsticker/investmentLocationHints";
import {
  getNewsNotificationKeywords,
  setNewsNotificationKeywords,
  checkAndNotifyNewsKeywords,
} from "./newsticker/newsNotificationKeywords";
import {
  loadArchived,
  loadArchivedAsync,
  archiveItem,
  archiveWithFullText,
  downloadBlob,
  removeFromArchive,
  exportArchiveAsJson,
  exportArchiveAsCsv,
  type ArchivedNewsItem,
} from "./newsticker/newsArchive";

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

const TOP_PICKS_WINDOW_H_KEY = "immocontrol_newsticker_top_max_age_h";
const TOP_PICKS_CALENDAR_KEY = "immocontrol_newsticker_top_calendar_berlin";

function readTopPicksWindowHours(): number {
  try {
    const v = localStorage.getItem(TOP_PICKS_WINDOW_H_KEY);
    const n = v ? parseInt(v, 10) : 72;
    if (n === 48 || n === 72 || n === 168) return n;
  } catch {
    /* ignore */
  }
  return 72;
}

function readCalendarDayBerlin(): boolean {
  try {
    return localStorage.getItem(TOP_PICKS_CALENDAR_KEY) === "1";
  } catch {
    return false;
  }
}

/* ─── Component ─── */
const NEWSTICKER_STALE_MS = 5 * 60 * 1000; // 5 min cache

const Newsticker = () => {
  const { user } = useAuth();
  const { properties } = useProperties();
  const { data: dealsForLocation = [] } = useQuery({
    queryKey: [...queryKeys.deals.all, user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("deals")
        .select("title, address, description, notes, stage")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!user?.id,
    staleTime: 60_000,
  });

  const {
    data: news = [],
    isLoading: loading,
    isRefetching: refreshing,
    dataUpdatedAt,
    refetch,
  } = useQuery({
    queryKey: queryKeys.newsticker.all,
    queryFn: async () => {
      try {
        const items = await fetchAllRssNews();
        saveNewsFeedCache(items);
        return items;
      } catch (e) {
        const cached = loadNewsFeedCache();
        if (cached && cached.length > 0) return cached;
        throw e;
      }
    },
    staleTime: NEWSTICKER_STALE_MS,
    retry: 1,
  });

  const fetchAllNews = useCallback(async (isRefresh = false) => {
    try {
      const result = await refetch();
      if (result.data && result.data.length > 0) {
        checkAndNotifyNewsKeywords(result.data);
      }
      if (isRefresh && result.data) {
        toast.success(`${result.data.length} Nachrichten aus ${RSS_FEEDS.length} Quellen aktualisiert`);
      }
    } catch (e: unknown) {
      handleError(e, { context: "network", showToast: false });
      toastErrorWithRetry("Fehler beim Laden der Nachrichten", () => refetch());
    }
  }, [refetch]);

  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 300);
  const [selectedCategories, setSelectedCategories] = useState<Set<NewsCategory>>(new Set());
  const [selectedRegion, setSelectedRegion] = useState<string>("all");
  const [selectedCity, setSelectedCity] = useState<string>("all");
  const [selectedSentiment, setSelectedSentiment] = useState<string>("all");
  const [selectedPaywall, setSelectedPaywall] = useState<"all" | "free" | "paywall">("free");
  const [showFilters, setShowFilters] = useState(false);
  const [isOffline, setIsOffline] = useState(() => !navigator.onLine);
  const [notifyKeywords, setNotifyKeywords] = useState<string[]>(getNewsNotificationKeywords);
  const [newKeyword, setNewKeyword] = useState("");
  const [displayCount, setDisplayCount] = useState(20);
  const [bookmarks, setBookmarks] = useState<Set<string>>(loadBookmarks);
  const [showBookmarksOnly, setShowBookmarksOnly] = useState(false);
  const [archived, setArchived] = useState<ArchivedNewsItem[]>(loadArchived);

  useEffect(() => {
    loadArchivedAsync().then(setArchived);
  }, []);
  const [showArchivedOnly, setShowArchivedOnly] = useState(false);
  const [archivingId, setArchivingId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<"cards" | "compact">(
    () => (localStorage.getItem(VIEW_MODE_KEY) as "cards" | "compact") || "cards"
  );
  const [topPicksWindowHours, setTopPicksWindowHours] = useState<number>(() => readTopPicksWindowHours());
  const [calendarDayBerlin, setCalendarDayBerlin] = useState<boolean>(() => readCalendarDayBerlin());

  useEffect(() => { document.title = "Newsticker – ImmoControl"; }, []);

  useEffect(() => {
    const onOffline = () => setIsOffline(true);
    const onOnline = () => setIsOffline(false);
    window.addEventListener("offline", onOffline);
    window.addEventListener("online", onOnline);
    return () => {
      window.removeEventListener("offline", onOffline);
      window.removeEventListener("online", onOnline);
    };
  }, []);

  /* Auto-refresh every 10 minutes */
  useEffect(() => {
    const iv = setInterval(() => fetchAllNews(true), 10 * 60 * 1000);
    return () => clearInterval(iv);
  }, [fetchAllNews]);

  const lastFetched = dataUpdatedAt ? new Date(dataUpdatedAt) : null;

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

  /* Archive article (with optional full-text fetch + PDF/HTML download) */
  const handleArchive = useCallback(async (item: NewsItem) => {
    setArchivingId(item.id);
    try {
      const { archived: entry, pdfBlob, htmlContent } = await archiveWithFullText(item);
      setArchived(loadArchived());

      const safeTitle = item.title.replace(/[^a-zA-Z0-9äöüÄÖÜß\s-]/g, "").slice(0, 50).trim();
      const dateStr = new Date().toISOString().split("T")[0];

      if (pdfBlob) {
        downloadBlob(pdfBlob, `Artikel_${safeTitle}_${dateStr}.pdf`);
        toast.success("Archiviert inkl. Volltext als PDF gespeichert");
      }
      if (htmlContent) {
        const blob = new Blob([htmlContent], { type: "text/html;charset=utf-8" });
        downloadBlob(blob, `Artikel_${safeTitle}_${dateStr}.html`);
        if (!pdfBlob) toast.success("Archiviert inkl. Volltext als HTML gespeichert");
      }
      if (!pdfBlob && !htmlContent) {
        toast.success("Artikel archiviert (Volltext nicht verfügbar, z. B. Paywall)");
      }
    } catch (e) {
      handleError(e, { context: "archive", showToast: false });
      archiveItem(item);
      setArchived(loadArchived());
      toast.success("Artikel archiviert");
    } finally {
      setArchivingId(null);
    }
  }, []);

  /* Remove from archive */
  const handleUnarchive = useCallback((id: string) => {
    removeFromArchive(id);
    setArchived(loadArchived());
    toast("Aus Archiv entfernt");
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
    if (showArchivedOnly) {
      let result = [...archived]
        .sort((a, b) => new Date(b.archivedAt).getTime() - new Date(a.archivedAt).getTime())
        .map((a) => a.item);
      if (debouncedSearch) {
        const q = debouncedSearch.toLowerCase();
        result = archived
          .filter(
            (a) =>
              a.item.title.toLowerCase().includes(q) ||
              a.item.description.toLowerCase().includes(q) ||
              a.item.source.toLowerCase().includes(q) ||
              (a.fullContent && a.fullContent.toLowerCase().includes(q))
          )
          .map((a) => a.item);
      }
      return result;
    }
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
    if (selectedCity !== "all") {
      result = result.filter(n => {
        const city = detectCity(n.title, n.description);
        return city !== null && city === selectedCity;
      });
    }
    if (selectedSentiment !== "all") result = result.filter(n => n.sentiment === selectedSentiment);
    if (selectedPaywall !== "all") {
      result = result.filter(n => (selectedPaywall === "free" && !hasLikelyPaywall(n)) || (selectedPaywall === "paywall" && hasLikelyPaywall(n)));
    }
    return result;
  }, [news, debouncedSearch, selectedCategories, selectedRegion, selectedCity, selectedSentiment, selectedPaywall, showBookmarksOnly, bookmarks, showArchivedOnly, archived]);

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

  const trendingWords = useMemo(() => {
    return new Set(trendingTopics.filter((x) => x.count >= 2).map((x) => x.word.toLowerCase()));
  }, [trendingTopics]);

  const archivedFullContentMap = useMemo(() => {
    const m = new Map<string, string>();
    archived.forEach((a) => { if (a.fullContent) m.set(a.id, a.fullContent); });
    return m;
  }, [archived]);

  const isTrending = useCallback((item: NewsItem) => {
    const text = `${item.title} ${item.description}`.toLowerCase();
    return [...trendingWords].some((w) => text.includes(w));
  }, [trendingWords]);

  /* Today's activity */
  const todayStats = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    const tn = news.filter(n => n.publishedAt.startsWith(today));
    const c: Record<string, number> = {};
    tn.forEach(n => { c[n.category] = (c[n.category] || 0) + 1; });
    return { total: tn.length, counts: c };
  }, [news]);

  const portfolioLocationHints = useMemo(
    () => buildPortfolioLocationHints(properties, (dealsForLocation ?? []) as DealForLocation[]),
    [properties, dealsForLocation],
  );

  /** Tages-Top: Deutschland vs. regional (Portfolio-Orte aus Objekten & Deals, sonst BB-Schwerpunkt) */
  const dailyTopPicks = useMemo(
    () =>
      news.length > 0
        ? computeDailyTopPicks(news, Date.now(), {
            portfolioHints: portfolioLocationHints,
            maxAgeMs: topPicksWindowHours * 60 * 60 * 1000,
            calendarDayBerlinOnly: calendarDayBerlin,
          })
        : null,
    [news, portfolioLocationHints, topPicksWindowHours, calendarDayBerlin],
  );

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
      <MobilePagePullToRefresh onRefresh={() => fetchAllNews(true)}>
      <div className="space-y-6 animate-fade-in">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="space-y-2">
            <div className="h-7 w-56 bg-secondary animate-pulse rounded" />
            <div className="h-4 w-44 bg-secondary/70 animate-pulse rounded" />
          </div>
          <div className="flex gap-2 flex-wrap">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-9 w-24 bg-secondary animate-pulse rounded-md" />
            ))}
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="rounded-xl border border-border p-4 space-y-2">
              <div className="h-3 w-20 bg-secondary animate-pulse rounded" />
              <div className="h-4 w-full bg-secondary/80 animate-pulse rounded" />
              <div className="h-4 w-3/4 bg-secondary/60 animate-pulse rounded" />
            </div>
          ))}
        </div>
        <div className="h-10 w-full max-w-md bg-secondary/50 animate-pulse rounded-md" />
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="rounded-xl border border-border p-4 flex gap-4">
              <div className="flex-1 min-w-0 space-y-2">
                <div className="flex gap-2">
                  <div className="h-5 w-16 bg-secondary animate-pulse rounded-full" />
                  <div className="h-5 w-14 bg-secondary animate-pulse rounded-full" />
                </div>
                <div className="h-4 w-full bg-secondary/80 animate-pulse rounded" />
                <div className="h-4 w-4/5 bg-secondary/60 animate-pulse rounded" />
                <div className="h-3 w-32 bg-secondary/50 animate-pulse rounded" />
              </div>
              <div className="w-24 h-20 rounded-lg bg-secondary animate-pulse shrink-0 hidden sm:block" />
            </div>
          ))}
        </div>
      </div>
      </MobilePagePullToRefresh>
    );
  }

  return (
    <MobilePagePullToRefresh onRefresh={() => fetchAllNews(true)} disabled={refreshing}>
    <div className="space-y-6" role="main" aria-label="Immobilien-Newsticker">
      <PageHeader>
        <PageHeaderMain>
          <PageHeaderTitle>
            <Newspaper className="h-6 w-6 text-primary shrink-0" />
            Immobilien-Newsticker
          </PageHeaderTitle>
          <PageHeaderDescription>
            {news.length} Nachrichten aus {Object.keys(sourceStats).length} Quellen
            {lastFetched && (
              <span className="ml-2 text-[10px]">
                {"\u00B7"} Aktualisiert {relativeTimeDE(lastFetched.toISOString())}
              </span>
            )}
          </PageHeaderDescription>
        </PageHeaderMain>
        <PageHeaderActions>
          <Button
            variant={showBookmarksOnly ? "default" : "outline"}
            size="sm"
            className="gap-1.5"
            onClick={() => { setShowBookmarksOnly(!showBookmarksOnly); setShowArchivedOnly(false); setDisplayCount(20); }}
          >
            <BookmarkCheck className="h-3.5 w-3.5" />
            Merkliste
            {bookmarks.size > 0 && (
              <span className="ml-1 px-1.5 py-0.5 rounded-full bg-primary/20 text-primary text-[10px]">
                {bookmarks.size}
              </span>
            )}
          </Button>
          <Button
            variant={showArchivedOnly ? "default" : "outline"}
            size="sm"
            className="gap-1.5"
            onClick={() => { setShowArchivedOnly(!showArchivedOnly); setShowBookmarksOnly(false); setDisplayCount(20); }}
          >
            <Archive className="h-3.5 w-3.5" />
            Archiv
            {archived.length > 0 && (
              <span className="ml-1 px-1.5 py-0.5 rounded-full bg-primary/20 text-primary text-[10px]">
                {archived.length}
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
            {(selectedCategories.size > 0 || selectedSentiment !== "all" || selectedPaywall !== "all") && (
              <span className="ml-1 px-1.5 py-0.5 rounded-full bg-primary text-primary-foreground text-[10px]">
                {selectedCategories.size + (selectedSentiment !== "all" ? 1 : 0) + (selectedPaywall !== "all" ? 1 : 0)}
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
        </PageHeaderActions>
      </PageHeader>

      {/* Offline hint */}
      {isOffline && (
        <div className="flex items-center gap-2 p-3 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-700 dark:text-amber-400">
          <WifiOff className="h-5 w-5 shrink-0" />
          <p className="text-sm">Du bist offline. Nachrichten können erst geladen werden, wenn die Verbindung steht.</p>
        </div>
      )}

      {/* Archiv export when viewing archive */}
      {showArchivedOnly && archived.length > 0 && (
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" className="gap-1.5" onClick={exportArchiveAsJson}>
            <Download className="h-3.5 w-3.5" /> Als JSON exportieren
          </Button>
          <Button variant="outline" size="sm" className="gap-1.5" onClick={exportArchiveAsCsv}>
            <Download className="h-3.5 w-3.5" /> Als CSV exportieren
          </Button>
        </div>
      )}

      {/* Dashboard cards */}
      {news.length > 0 && !showBookmarksOnly && !showArchivedOnly && (
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

      {/* Tages-Top 3: Deutschland + vor Ort */}
      {dailyTopPicks && news.length > 0 && !showBookmarksOnly && !showArchivedOnly && (
        <section
          className="rounded-xl border border-border bg-gradient-to-br from-primary/5 via-card to-card p-4 sm:p-5 space-y-4"
          aria-labelledby="daily-top-heading"
        >
          <div className="flex flex-col gap-1 min-w-0">
            <h2 id="daily-top-heading" className="text-base font-semibold flex items-center gap-2 text-wrap-safe">
              <Star className="h-5 w-5 text-amber-500 shrink-0" aria-hidden />
              Tages-Top 3 — Deutschland &amp; vor Ort
            </h2>
            <p className="text-xs text-muted-foreground text-wrap-safe">
              {dailyTopPicks.dateLabelDE}
              {" · "}
              {dailyTopPicks.windowDescriptionDE}
              {" · "}
              Automatische Priorisierung (bundesweit vs. regional). „Vor Ort“ nutzt bei Objekten/Deals Orte aus Standort und Adresse. Gründe unter jeder Zeile = heuristische Treffer, keine Redaktion.
            </p>
            <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-center gap-3 pt-2">
              <div className="flex flex-col gap-1 min-w-0">
                <Label htmlFor="top-picks-window" className="text-[10px] text-muted-foreground">
                  Zeitfenster für Tages-Top
                </Label>
                <Select
                  value={String(topPicksWindowHours)}
                  onValueChange={(v) => {
                    const h = parseInt(v, 10);
                    if (h === 48 || h === 72 || h === 168) {
                      setTopPicksWindowHours(h);
                      try {
                        localStorage.setItem(TOP_PICKS_WINDOW_H_KEY, String(h));
                      } catch {
                        /* ignore */
                      }
                    }
                  }}
                >
                  <SelectTrigger id="top-picks-window" className="h-9 w-full sm:w-[220px] text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="48">48 Stunden</SelectItem>
                    <SelectItem value="72">72 Stunden (Standard)</SelectItem>
                    <SelectItem value="168">7 Tage</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-2 min-w-0">
                <Switch
                  id="top-picks-calendar"
                  checked={calendarDayBerlin}
                  onCheckedChange={(c) => {
                    setCalendarDayBerlin(c);
                    try {
                      localStorage.setItem(TOP_PICKS_CALENDAR_KEY, c ? "1" : "0");
                    } catch {
                      /* ignore */
                    }
                  }}
                />
                <Label htmlFor="top-picks-calendar" className="text-xs text-muted-foreground text-wrap-safe cursor-pointer">
                  Nur Meldungen vom heutigen Kalendertag (Europe/Berlin)
                </Label>
              </div>
            </div>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="rounded-lg border border-border/80 bg-background/60 p-3 min-w-0">
              <h3 className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1.5 mb-2">
                <Globe className="h-3.5 w-3.5 shrink-0" aria-hidden />
                Deutschland (Markt &amp; Rahmen)
              </h3>
              {dailyTopPicks.deutschland.length === 0 ? (
                <p className="text-sm text-muted-foreground text-wrap-safe">
                  Im gewählten Fenster keine bundesweit priorisierten Meldungen. Bitte „Aktualisieren“, anderes Zeitfenster oder Kalendertag-Filter prüfen.
                </p>
              ) : (
                <ol className="space-y-2 list-decimal list-inside marker:text-primary">
                  {dailyTopPicks.deutschland.map(({ item: n, reasons }) => (
                    <li key={n.id} className="text-sm min-w-0">
                      <a
                        href={n.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-medium text-primary hover:underline text-wrap-safe inline"
                      >
                        {n.title}
                      </a>
                      <span className="block text-[11px] text-muted-foreground mt-0.5 text-wrap-safe">
                        {n.source}
                        {" · "}
                        {relativeTimeDE(n.publishedAt)}
                        <span className="inline-flex ml-1 align-middle">
                          <ExternalLink className="h-3 w-3 opacity-60" aria-hidden />
                        </span>
                      </span>
                      {reasons.length > 0 && (
                        <span className="mt-1 flex flex-wrap gap-1">
                          {reasons.map((r) => (
                            <span
                              key={r}
                              className="text-[10px] px-1.5 py-0.5 rounded-full bg-muted/90 text-muted-foreground text-wrap-safe"
                              title={r}
                            >
                              {r}
                            </span>
                          ))}
                        </span>
                      )}
                    </li>
                  ))}
                </ol>
              )}
            </div>
            <div className="rounded-lg border border-border/80 bg-background/60 p-3 min-w-0">
              <h3 className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1.5 mb-1">
                <MapPin className="h-3.5 w-3.5 shrink-0" aria-hidden />
                Vor Ort — Investition &amp; Standort
              </h3>
              {dailyTopPicks.vorOrtPortfolioLine ? (
                <p className="text-[11px] text-muted-foreground text-wrap-safe mb-2">{dailyTopPicks.vorOrtPortfolioLine}</p>
              ) : (
                <p className="text-[11px] text-muted-foreground text-wrap-safe mb-2">
                  Ohne Einträge in Objekten/Deals: Schwerpunkt Berlin &amp; Brandenburg (RSS). Orte bei Objekten unter Standort/Adresse pflegen, um Treffer zu steuern.
                </p>
              )}
              {dailyTopPicks.vorOrt.length === 0 ? (
                <p className="text-sm text-muted-foreground text-wrap-safe">
                  Im gewählten Fenster keine regional priorisierten Meldungen. Mit Kalendertag-Filter oft weniger Treffer — ggf. deaktivieren oder Zeitfenster vergrößern.
                </p>
              ) : (
                <ol className="space-y-2 list-decimal list-inside marker:text-primary">
                  {dailyTopPicks.vorOrt.map(({ item: n, reasons }) => (
                    <li key={n.id} className="text-sm min-w-0">
                      <a
                        href={n.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-medium text-primary hover:underline text-wrap-safe inline"
                      >
                        {n.title}
                      </a>
                      <span className="block text-[11px] text-muted-foreground mt-0.5 text-wrap-safe">
                        {n.source}
                        {" · "}
                        {REGION_LABELS[n.region] ?? n.region}
                        {" · "}
                        {relativeTimeDE(n.publishedAt)}
                        <span className="inline-flex ml-1 align-middle">
                          <ExternalLink className="h-3 w-3 opacity-60" aria-hidden />
                        </span>
                      </span>
                      {reasons.length > 0 && (
                        <span className="mt-1 flex flex-wrap gap-1">
                          {reasons.map((r) => (
                            <span
                              key={r}
                              className="text-[10px] px-1.5 py-0.5 rounded-full bg-muted/90 text-muted-foreground text-wrap-safe"
                              title={r}
                            >
                              {r}
                            </span>
                          ))}
                        </span>
                      )}
                    </li>
                  ))}
                </ol>
              )}
            </div>
          </div>
        </section>
      )}

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="z. B. Zins oder Mietspiegel"
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
            <div className="flex gap-1.5 flex-wrap">
              {["all", "berlin", "brandenburg"].map(r => (
                <button
                  key={r}
                  onClick={() => { setSelectedRegion(r); setSelectedCity("all"); setDisplayCount(20); }}
                  className={`px-2.5 py-1 rounded-full text-[11px] font-medium transition-all ${
                    selectedRegion === r && selectedCity === "all"
                      ? "bg-primary/10 text-primary ring-1 ring-primary/30"
                      : "bg-secondary text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {r === "all" ? "Alle" : REGION_LABELS[r]}
                </button>
              ))}
            </div>
          </div>

          {/* City filter (MOB3 extension) */}
          <div>
            <p className="text-xs font-semibold text-muted-foreground mb-2 flex items-center gap-1.5">
              <MapPin className="h-3.5 w-3.5" /> Stadtteil / Stadt
            </p>
            <div className="flex gap-1.5 flex-wrap max-h-32 overflow-y-auto" style={{ WebkitOverflowScrolling: "touch" as unknown as string }}>
              <button
                onClick={() => { setSelectedCity("all"); setDisplayCount(20); }}
                className={`px-2 py-0.5 rounded-full text-[10px] font-medium transition-all ${
                  selectedCity === "all"
                    ? "bg-primary/10 text-primary ring-1 ring-primary/30"
                    : "bg-secondary text-muted-foreground hover:text-foreground"
                }`}
              >
                Alle
              </button>
              {(selectedRegion === "all" || selectedRegion === "berlin") && (
                <>
                  <span className="text-[9px] text-muted-foreground self-center px-1">Berlin:</span>
                  {BERLIN_DISTRICTS.map(d => (
                    <button
                      key={d}
                      onClick={() => { setSelectedCity(d); setSelectedRegion("berlin"); setDisplayCount(20); }}
                      className={`px-2 py-0.5 rounded-full text-[10px] font-medium transition-all ${
                        selectedCity === d
                          ? "bg-blue-500/15 text-blue-600 ring-1 ring-blue-500/30"
                          : "bg-secondary text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      {d}
                    </button>
                  ))}
                </>
              )}
              {(selectedRegion === "all" || selectedRegion === "brandenburg") && (
                <>
                  <span className="text-[9px] text-muted-foreground self-center px-1">Brandenburg:</span>
                  {BRANDENBURG_CITIES.map(c => (
                    <button
                      key={c}
                      onClick={() => { setSelectedCity(c); setSelectedRegion("brandenburg"); setDisplayCount(20); }}
                      className={`px-2 py-0.5 rounded-full text-[10px] font-medium transition-all ${
                        selectedCity === c
                          ? "bg-emerald-500/15 text-emerald-600 ring-1 ring-emerald-500/30"
                          : "bg-secondary text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      {c}
                    </button>
                  ))}
                </>
              )}
            </div>
          </div>

          {/* Paywall filter */}
          <div>
            <p className="text-xs font-semibold text-muted-foreground mb-2 flex items-center gap-1.5">
              <Lock className="h-3.5 w-3.5" /> Zugang
            </p>
            <div className="flex gap-1.5">
              {(["all", "free", "paywall"] as const).map((p) => (
                <button
                  key={p}
                  onClick={() => { setSelectedPaywall(p); setDisplayCount(20); }}
                  className={`px-2.5 py-1 rounded-full text-[11px] font-medium flex items-center gap-1 transition-all ${
                    selectedPaywall === p ? "bg-primary/10 text-primary ring-1 ring-primary/30" : "bg-secondary text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {p === "all" && "Alle"}
                  {p === "free" && <><LockOpen className="h-3 w-3" /> Nur frei</>}
                  {p === "paywall" && <><Lock className="h-3 w-3" /> Nur Paywall</>}
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

          {/* Notification keywords */}
          <div>
            <p className="text-xs font-semibold text-muted-foreground mb-2 flex items-center gap-1.5">
              <Flame className="h-3.5 w-3.5" /> Benachrichtigungen für Schlagwörter
            </p>
            <p className="text-[10px] text-muted-foreground mb-1.5">
              Bei neuen Artikeln mit diesen Begriffen erhältst du eine Benachrichtigung (max. 1/Tag).
            </p>
            <div className="flex flex-wrap gap-1.5 mb-1.5">
              {notifyKeywords.map((kw) => (
                <span
                  key={kw}
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary/10 text-primary text-[10px]"
                >
                  {kw}
                  <button
                    type="button"
                    onClick={() => {
                      const next = notifyKeywords.filter((k) => k !== kw);
                      setNotifyKeywords(next);
                      setNewsNotificationKeywords(next);
                    }}
                    className="hover:text-destructive"
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
            <div className="flex gap-1.5">
              <Input
                placeholder="z. B. Mietendeckel, Zins"
                value={newKeyword}
                onChange={(e) => setNewKeyword(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && newKeyword.trim()) {
                    const next = [...notifyKeywords, newKeyword.trim()].filter((k, i, a) => a.indexOf(k) === i);
                    setNotifyKeywords(next);
                    setNewsNotificationKeywords(next);
                    setNewKeyword("");
                  }
                }}
                className="h-8 text-sm flex-1"
              />
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-8"
                onClick={() => {
                  if (newKeyword.trim()) {
                    const next = [...notifyKeywords, newKeyword.trim()].filter((k, i, a) => a.indexOf(k) === i);
                    setNotifyKeywords(next);
                    setNewsNotificationKeywords(next);
                    setNewKeyword("");
                  }
                }}
              >
                Hinzufügen
              </Button>
            </div>
          </div>

          {/* Reset filters */}
          {(selectedCategories.size > 0 || selectedSentiment !== "all" || selectedPaywall !== "all" || selectedRegion !== "all" || selectedCity !== "all") && (
            <Button
              variant="ghost"
              size="sm"
              className="text-xs"
              onClick={() => { setSelectedCategories(new Set()); setSelectedSentiment("all"); setSelectedPaywall("all"); setSelectedRegion("all"); setSelectedCity("all"); }}
            >
              Alle Filter zurücksetzen
            </Button>
          )}
        </div>
      )}

      {/* Results count */}
      {(debouncedSearch || selectedCategories.size > 0 || selectedRegion !== "all" || selectedCity !== "all" || selectedSentiment !== "all" || selectedPaywall !== "all" || showBookmarksOnly || showArchivedOnly) && (
        <p className="text-xs text-muted-foreground">
          {filteredNews.length} von {showArchivedOnly ? archived.length : news.length} Nachrichten
          {showBookmarksOnly && " (nur Lesezeichen)"}
          {showArchivedOnly && " (Archiv)"}
        </p>
      )}

      {/* News list */}
      {filteredNews.length === 0 ? (
        <div className="text-center py-16 px-4 rounded-xl border border-dashed border-border bg-muted/20">
          <AlertCircle className="h-12 w-12 text-muted-foreground mx-auto mb-4" aria-hidden />
          <p className="text-sm font-medium text-foreground mb-1">
            {showArchivedOnly
              ? "Keine archivierten Artikel"
              : showBookmarksOnly
                ? "Keine Lesezeichen vorhanden"
                : news.length === 0
                  ? "Nachrichten konnten nicht geladen werden"
                  : "Keine Treffer für die gewählten Filter"}
          </p>
          <p className="text-xs text-muted-foreground mb-4 max-w-sm mx-auto text-pretty">
            {showArchivedOnly
              ? "Archiviere Artikel über das Archiv-Symbol. Bei paywall-freien Artikeln wird automatisch Volltext als PDF und HTML gespeichert."
              : showBookmarksOnly
                ? "Speichere Artikel über das Lesezeichen-Symbol, um sie hier wiederzufinden."
                : news.length === 0
                  ? "Zuerst „Erneut versuchen“. Wenn weiterhin keine Artikel: Supabase-Funktion rss-fetch deployen; optional Umgebungsvariable für rss2json (Hinweise in docs/OPERATIONS.md)."
                  : "Kategorien, Region oder Stimmung anpassen oder Suchbegriff ändern."}
          </p>
          {news.length === 0 && !showBookmarksOnly && (
            <Button variant="default" size="sm" className="gap-2" onClick={() => fetchAllNews(true)} disabled={refreshing}>
              <RefreshCw className={refreshing ? "h-4 w-4 animate-spin" : "h-4 w-4"} />
              Erneut versuchen
            </Button>
          )}
          {news.length > 0 && !showBookmarksOnly && (
            <Button variant="outline" size="sm" onClick={() => { setSelectedCategories(new Set()); setSelectedSentiment("all"); setSelectedRegion("all"); setSelectedCity("all"); setSearch(""); setDisplayCount(20); }}>
              Filter zurücksetzen
            </Button>
          )}
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
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="shrink-0 flex items-center" aria-hidden>
                      {hasLikelyPaywall(item)
                        ? <Lock className="h-3 w-3 text-amber-600 dark:text-amber-400" aria-label="Wahrscheinlich Paywall" />
                        : <LockOpen className="h-3 w-3 text-emerald-600 dark:text-emerald-400" aria-label="Wahrscheinlich frei" />}
                    </span>
                  </TooltipTrigger>
                  <TooltipContent side="top" className="text-xs">
                    {hasLikelyPaywall(item) ? "Wahrscheinlich Paywall (Abo nötig)" : "Wahrscheinlich frei zugänglich"}
                  </TooltipContent>
                </Tooltip>
                <a
                  href={item.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  title={item.title}
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
                <span className="text-[10px] text-muted-foreground shrink-0 hidden md:inline">
                  ca. {estimateReadingTime(item, archivedFullContentMap.get(item.id))} Min.
                </span>
                {isTrending(item) && (
                  <span className="shrink-0 px-1 py-0.5 rounded text-[9px] font-medium bg-orange-500/15 text-orange-600 dark:text-orange-400">
                    <Flame className="h-2.5 w-2.5 inline" /> Trend
                  </span>
                )}
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
                {!showArchivedOnly && (
                  <button
                    onClick={() => handleArchive(item)}
                    disabled={archivingId === item.id}
                    className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity disabled:opacity-50 mobile-action-row"
                    aria-label="Archivieren"
                    title="Artikel archivieren (Volltext als PDF/HTML wenn verfügbar)"
                  >
                    {archivingId === item.id
                      ? <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
                      : <Archive className="h-3.5 w-3.5 text-muted-foreground hover:text-primary" />}
                  </button>
                )}
                {showArchivedOnly && (
                  <button
                    onClick={() => handleUnarchive(item.id)}
                    className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity mobile-action-row"
                    aria-label="Aus Archiv entfernen"
                  >
                    <Archive className="h-3.5 w-3.5 text-primary" />
                  </button>
                )}
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
                className="group gradient-card animate-fade-in rounded-xl border border-border p-4 transition-all duration-300 ease-out-modern hover:border-primary/30 hover:shadow-xl"
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
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className="flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-secondary/80">
                            {hasLikelyPaywall(item)
                              ? <><Lock className="h-2.5 w-2.5 text-amber-600 dark:text-amber-400" /> Paywall</>
                              : <><LockOpen className="h-2.5 w-2.5 text-emerald-600 dark:text-emerald-400" /> Frei</>}
                          </span>
                        </TooltipTrigger>
                        <TooltipContent side="top" className="text-xs">
                          {hasLikelyPaywall(item) ? "Wahrscheinlich Paywall (Abo nötig)" : "Wahrscheinlich frei zugänglich"}
                        </TooltipContent>
                      </Tooltip>
                      {isTrending(item) && (
                        <span className="px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-orange-500/15 text-orange-600 dark:text-orange-400 flex items-center gap-0.5">
                          <Flame className="h-2.5 w-2.5" /> Trend
                        </span>
                      )}
                      <span className="text-[10px] text-muted-foreground">
                        ca. {estimateReadingTime(item, archivedFullContentMap.get(item.id))} Min.
                      </span>
                    </div>
                    {/* Title */}
                    <a href={item.url} target="_blank" rel="noopener noreferrer" className="block" title={item.title}>
                      <h3 className="text-sm font-semibold leading-tight hover:text-primary transition-colors line-clamp-2 text-wrap-safe">
                        {item.title}
                      </h3>
                    </a>
                    {/* Description */}
                    {item.description && (
                      <p className="text-xs text-muted-foreground line-clamp-3 text-wrap-safe hyphens-auto min-w-0" title={item.description}>
                        {item.description}
                      </p>
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
                      {!showArchivedOnly && (
                        <button
                          onClick={() => handleArchive(item)}
                          disabled={archivingId === item.id}
                          className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity disabled:opacity-50 mobile-action-row"
                          aria-label="Archivieren"
                          title="Archivieren (Volltext als PDF/HTML wenn verfügbar)"
                        >
                          {archivingId === item.id
                            ? <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
                            : <Archive className="h-3 w-3 hover:text-primary" />}
                        </button>
                      )}
                      {showArchivedOnly && (
                        <button
                          onClick={() => handleUnarchive(item.id)}
                          className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity mobile-action-row"
                          aria-label="Aus Archiv entfernen"
                        >
                          <Archive className="h-3 w-3 text-primary" />
                        </button>
                      )}
                    </div>
                  </div>
                  {/* Image */}
                  {item.imageUrl && (
                    <div className="hidden sm:block w-24 h-20 rounded-lg overflow-hidden shrink-0 bg-secondary">
                      <img
                        src={item.imageUrl}
                        alt={item.title ? `Artikelbild: ${item.title}` : "Artikelbild"}
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

      {/* Manus AI: Markt-Briefing */}
      {news.length > 0 && (
        <ManusNewstickerIntelligence
          recentHeadlines={news.slice(0, 30).map(n => n.title)}
          portfolioCities={["Berlin", "Brandenburg"]}
        />
      )}

      {/* Footer */}
      <div className="text-center text-[10px] text-muted-foreground space-y-1 pb-4">
        <p>
          Nachrichten aus {RSS_FEEDS.length} Quellen (Google News, Tagesspiegel, Morgenpost, rbb24,
          Handelsblatt, Capital, BZ, Berliner Zeitung, WiWo, Brandenburg-St\u00e4dte u.a.)
        </p>
        <p>
          Automatische Aktualisierung alle 10 Min. {"\u00B7"} Sentiment-Analyse per Keyword-Matching{" "}
          {"\u00B7"} Alle Rechte bei den jeweiligen Quellen
        </p>
      </div>
    </div>
    </MobilePagePullToRefresh>
  );
};

export default Newsticker;
