/**
 * RSS fetch logic for Newsticker.
 * Edge Function (preferred) + CORS proxies + rss2json fallback.
 */
import { fetchRssTextViaEdge } from "@/integrations/rss/fetchViaEdge";
import { mapPool } from "@/lib/mapPool";
import type { NewsItem } from "./newsUtils";
import { categoriseNews, detectRegion, detectSentiment, isEconomicallyRelevant, looksLikeXmlFeed, parseRSSItems } from "./newsUtils";

export const RSS_FEEDS = [
  { url: "https://news.google.com/rss/search?q=immobilien+markt+berlin+OR+brandenburg+investition+OR+rendite+OR+preis+OR+mietspiegel&hl=de&gl=DE&ceid=DE:de", source: "Google News", icon: "\uD83D\uDD0D" },
  { url: "https://www.tagesspiegel.de/contentexport/feed/wirtschaft/immobilien", source: "Tagesspiegel", icon: "\uD83D\uDCF0" },
  { url: "https://www.iz.de/news/feed/", source: "Immobilien Zeitung", icon: "\uD83C\uDFE2" },
  { url: "https://www.spiegel.de/wirtschaft/index.rss", source: "Spiegel Wirtschaft", icon: "\uD83D\uDCF0" },
  { url: "https://rss.sueddeutsche.de/rss/Wirtschaft", source: "Süddeutsche Wirtschaft", icon: "\uD83D\uDCF0" },
  { url: "https://www.n-tv.de/wirtschaft/rss", source: "n-tv Wirtschaft", icon: "\uD83D\uDCFA" },
  { url: "https://www.welt.de/feeds/section/finanzen.rss", source: "Welt Finanzen", icon: "\uD83D\uDCB0" },
  { url: "https://www.focus.de/immobilien/rss", source: "Focus Immobilien", icon: "\uD83C\uDFE2" },
  { url: "https://news.google.com/rss/search?q=site:morgenpost.de+berlin+immobilien&hl=de&gl=DE&ceid=DE:de", source: "Berliner Morgenpost (via Google)", icon: "\uD83D\uDCF0" },
  { url: "https://www.rbb24.de/aktuell/index.html/feed/", source: "rbb24", icon: "\uD83D\uDCFA" },
  { url: "https://news.google.com/rss/search?q=site:iz.de+berlin+OR+brandenburg&hl=de&gl=DE&ceid=DE:de", source: "IZ Berlin/Brandenburg (via Google)", icon: "\uD83C\uDFE2" },
  { url: "https://news.google.com/rss/search?q=site:haufe.de+immobilien+berlin+OR+markt+OR+statistik&hl=de&gl=DE&ceid=DE:de", source: "Haufe (via Google)", icon: "\uD83D\uDCCA" },
  { url: "https://news.google.com/rss/search?q=site:handelsblatt.com+immobilien+berlin+OR+investition+OR+rendite&hl=de&gl=DE&ceid=DE:de", source: "Handelsblatt", icon: "\uD83D\uDCBC" },
  { url: "https://news.google.com/rss/search?q=site:capital.de+immobilien+berlin+OR+brandenburg+OR+rendite&hl=de&gl=DE&ceid=DE:de", source: "Capital", icon: "\uD83D\uDCB0" },
  { url: "https://news.google.com/rss/search?q=site:bz-berlin.de+immobilien+OR+wohnungsmarkt+OR+mietspiegel&hl=de&gl=DE&ceid=DE:de", source: "BZ Berlin", icon: "\uD83D\uDDDE\uFE0F" },
  { url: "https://news.google.com/rss/search?q=site:berliner-zeitung.de+immobilien+OR+wohnungsmarkt+OR+mietspiegel&hl=de&gl=DE&ceid=DE:de", source: "Berliner Zeitung", icon: "\uD83D\uDCF0" },
  { url: "https://news.google.com/rss/search?q=site:wiwo.de+immobilien+berlin+OR+investition+OR+rendite&hl=de&gl=DE&ceid=DE:de", source: "WirtschaftsWoche", icon: "\uD83D\uDCC8" },
  { url: "https://news.google.com/rss/search?q=site:iwkoeln.de+immobilien+OR+wohnungsmarkt&hl=de&gl=DE&ceid=DE:de", source: "IW Köln", icon: "\uD83D\uDCCA" },
  { url: "https://news.google.com/rss/search?q=site:destatis.de+immobilienpreisindex+OR+baugenehmigungen&hl=de&gl=DE&ceid=DE:de", source: "Destatis", icon: "\uD83D\uDCC8" },
  { url: "https://news.google.com/rss/search?q=site:manager-magazin.de+immobilien+berlin+OR+investment&hl=de&gl=DE&ceid=DE:de", source: "Manager Magazin", icon: "\uD83D\uDCBC" },
  { url: "https://news.google.com/rss/search?q=site:faz.net+immobilien+berlin+OR+wohnungsmarkt+OR+rendite&hl=de&gl=DE&ceid=DE:de", source: "FAZ", icon: "\uD83D\uDCF0" },
  { url: "https://news.google.com/rss/search?q=immobilien+OR+wohnungsmarkt+OR+mietspiegel+bernau+OR+eberswalde+OR+oranienburg+OR+luckenwalde+OR+barnim&hl=de&gl=DE&ceid=DE:de", source: "Brandenburg Nord", icon: "\uD83C\uDFE1" },
  { url: "https://news.google.com/rss/search?q=immobilien+OR+wohnungsmarkt+OR+mietspiegel+strausberg+OR+f%C3%BCrstenwalde+OR+neuruppin+OR+wittenberge+OR+rathenow&hl=de&gl=DE&ceid=DE:de", source: "Brandenburg West/Ost", icon: "\uD83C\uDFE1" },
  { url: "https://news.google.com/rss/search?q=immobilien+OR+wohnungsmarkt+OR+mietspiegel+%22brandenburg+havel%22+OR+werder+OR+teltow+OR+kleinmachnow+OR+stahnsdorf+OR+blankenfelde&hl=de&gl=DE&ceid=DE:de", source: "Brandenburg Süd", icon: "\uD83C\uDFE1" },
];

export const RSS_FETCH_CONCURRENCY = 5;

/** Kostenloser Dienst (Browser-CORS-fähig); optional VITE_RSS2JSON_API_KEY für höheres Kontingent */
function rss2JsonUrl(feedUrl: string): string {
  const base = `https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(feedUrl)}`;
  const key = typeof import.meta.env.VITE_RSS2JSON_API_KEY === "string"
    ? import.meta.env.VITE_RSS2JSON_API_KEY.trim()
    : "";
  return key ? `${base}&api_key=${encodeURIComponent(key)}` : base;
}

async function fetchNewsItemsViaRss2Json(
  feedUrl: string,
  source: string,
  icon: string,
): Promise<NewsItem[]> {
  try {
    const resp = await fetch(rss2JsonUrl(feedUrl), { signal: AbortSignal.timeout(12_000) });
    if (!resp.ok) return [];
    const data = await resp.json();
    if (data.status !== "ok" || !Array.isArray(data.items) || data.items.length === 0) return [];
    return data.items
      .map((item: { title?: string; link?: string; description?: string; pubDate?: string; thumbnail?: string }, idx: number) => {
        const title = item.title?.trim() || "";
        const description = (item.description || "").replace(/<[^>]+>/g, "").slice(0, 300);
        return {
          id: `${source}-rss2json-${idx}`,
          title,
          description,
          url: item.link || "",
          source,
          sourceIcon: icon,
          publishedAt: (() => {
            try {
              return item.pubDate ? new Date(item.pubDate).toISOString() : new Date().toISOString();
            } catch {
              return new Date().toISOString();
            }
          })(),
          category: categoriseNews(title, description),
          region: detectRegion(title, description),
          sentiment: detectSentiment(title, description),
          imageUrl: item.thumbnail && /\.(jpg|jpeg|png|webp|gif)/i.test(item.thumbnail) ? item.thumbnail : undefined,
        } satisfies NewsItem;
      })
      .filter((n: NewsItem) => n.title && n.url);
  } catch {
    return [];
  }
}

async function fetchRSSViaAllOriginsJson(feedUrl: string): Promise<string | null> {
  try {
    const u = `https://api.allorigins.win/get?url=${encodeURIComponent(feedUrl)}`;
    const resp = await fetch(u, { signal: AbortSignal.timeout(15000) });
    if (!resp.ok) return null;
    const data = (await resp.json()) as { contents?: string };
    if (typeof data.contents !== "string" || data.contents.length < 80) return null;
    if (!looksLikeXmlFeed(data.contents)) return null;
    return data.contents;
  } catch {
    return null;
  }
}

const CORS_PROXIES = [
  (url: string) => `https://corsproxy.io/?url=${encodeURIComponent(url)}`,
  (url: string) => `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`,
  (url: string) => `https://api.codetabs.com/v1/proxy/?quest=${encodeURIComponent(url)}`,
  (url: string) => `https://api.cors.lol/?url=${encodeURIComponent(url)}`,
];

async function fetchViaCorsProxy(feedUrl: string): Promise<string | null> {
  try {
    const u = `https://corsproxy.io/?url=${encodeURIComponent(feedUrl)}`;
    const resp = await fetch(u, { signal: AbortSignal.timeout(12000) });
    if (!resp.ok) return null;
    const text = await resp.text();
    if (!text || text.length < 100 || !looksLikeXmlFeed(text)) return null;
    return text;
  } catch {
    return null;
  }
}

async function fetchRSSFeed(feedUrl: string, source: string, icon: string): Promise<NewsItem[]> {
  const viaEdge = await fetchRssTextViaEdge(feedUrl);
  if (viaEdge && looksLikeXmlFeed(viaEdge)) {
    const parsed = parseRSSItems(viaEdge, source, icon);
    if (parsed.length > 0) return parsed;
  }
  const viaRss2Json = await fetchNewsItemsViaRss2Json(feedUrl, source, icon);
  if (viaRss2Json.length > 0) return viaRss2Json;
  const viaCorsProxy = await fetchViaCorsProxy(feedUrl);
  if (viaCorsProxy) {
    const parsed = parseRSSItems(viaCorsProxy, source, icon);
    if (parsed.length > 0) return parsed;
  }
  const viaJson = await fetchRSSViaAllOriginsJson(feedUrl);
  if (viaJson) {
    const parsed = parseRSSItems(viaJson, source, icon);
    if (parsed.length > 0) return parsed;
  }
  for (const buildProxyUrl of CORS_PROXIES) {
    try {
      const proxyUrl = buildProxyUrl(feedUrl);
      const resp = await fetch(proxyUrl, { signal: AbortSignal.timeout(8000) });
      if (!resp.ok) continue;
      const text = await resp.text();
      if (!text || text.length < 100) continue;
      if (!looksLikeXmlFeed(text)) continue;
      const items = parseRSSItems(text, source, icon);
      if (items.length > 0) return items;
    } catch {
      continue;
    }
  }
  return [];
}

/** Fetch all feeds, deduplicate by title, filter crime, sort by date. */
export async function fetchAllRssNews(): Promise<NewsItem[]> {
  const feedResults = await mapPool(RSS_FEEDS, RSS_FETCH_CONCURRENCY, (f) => fetchRSSFeed(f.url, f.source, f.icon));
  const allItems: NewsItem[] = [];
  feedResults.forEach((items) => allItems.push(...items));
  const seen = new Set<string>();
  const deduped = allItems.filter((item) => {
    const key = item.title.toLowerCase().replace(/[^a-zäöü0-9]/g, "").slice(0, 60);
    if (seen.has(key)) return false;
    if (!isEconomicallyRelevant(item.title, item.description)) return false;
    seen.add(key);
    return true;
  });
  deduped.sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime());
  return deduped;
}
