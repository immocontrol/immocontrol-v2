/**
 * Tägliche Aggregation: RSS-Feeds (Allowlist) → Investor-Signal-Scores pro Bundesland → Supabase.
 * Aufruf: POST mit Authorization: Bearer <SERVICE_ROLE_KEY> (z. B. GitHub Actions Cron 1×/Tag).
 * Kein Login der Endnutzer nötig; Daten sind öffentlich lesbar (RLS SELECT).
 */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/** Gleiche Hosts wie supabase/functions/rss-fetch + newsFetch.ts */
const ALLOWED_HOSTS = new Set([
  "news.google.com",
  "www.tagesspiegel.de",
  "tagesspiegel.de",
  "www.iz.de",
  "iz.de",
  "www.spiegel.de",
  "spiegel.de",
  "rss.sueddeutsche.de",
  "www.sueddeutsche.de",
  "sueddeutsche.de",
  "www.n-tv.de",
  "n-tv.de",
  "www.welt.de",
  "welt.de",
  "www.focus.de",
  "focus.de",
  "www.rbb24.de",
  "rbb24.de",
]);

/** Feed-URLs — bei Änderungen an src/pages/newsticker/newsFetch.ts hier spiegeln */
const FEED_URLS: string[] = [
  "https://news.google.com/rss/search?q=immobilien+markt+deutschland+OR+investition+OR+gewerbe+OR+standort&hl=de&gl=DE&ceid=DE:de",
  "https://www.tagesspiegel.de/contentexport/feed/wirtschaft/immobilien",
  "https://www.iz.de/news/feed/",
  "https://www.spiegel.de/wirtschaft/index.rss",
  "https://rss.sueddeutsche.de/rss/Wirtschaft",
  "https://www.n-tv.de/wirtschaft/rss",
  "https://www.welt.de/feeds/section/finanzen.rss",
  "https://www.focus.de/immobilien/rss",
  "https://www.rbb24.de/aktuell/index.html/feed/",
  "https://news.google.com/rss/search?q=site:handelsblatt.com+immobilien+OR+gewerbe+OR+standort&hl=de&gl=DE&ceid=DE:de",
  "https://news.google.com/rss/search?q=site:wiwo.de+immobilien+OR+investition+OR+standort&hl=de&gl=DE&ceid=DE:de",
  "https://news.google.com/rss/search?q=site:iwkoeln.de+immobilien+OR+standort&hl=de&gl=DE&ceid=DE:de",
  "https://news.google.com/rss/search?q=site:destatis.de+immobilien+OR+baugenehmigung&hl=de&gl=DE&ceid=DE:de",
];

const FETCH_TIMEOUT_MS = 22_000;

type BlCode =
  | "DE-SH" | "DE-HH" | "DE-NI" | "DE-HB" | "DE-NW" | "DE-HE" | "DE-RP" | "DE-BW"
  | "DE-BY" | "DE-SL" | "DE-BE" | "DE-BB" | "DE-MV" | "DE-SN" | "DE-ST" | "DE-TH";

interface BlDef {
  code: BlCode;
  label: string;
  lat: number;
  lng: number;
  patterns: RegExp[];
}

const BUNDESLAENDER: BlDef[] = [
  { code: "DE-SH", label: "Schleswig-Holstein", lat: 54.186, lng: 9.822, patterns: [/schleswig-holstein|\bsh\b|kiel|lübeck|flensburg/i] },
  { code: "DE-HH", label: "Hamburg", lat: 53.551, lng: 9.994, patterns: [/hamburg|\bhh\b/i] },
  { code: "DE-NI", label: "Niedersachsen", lat: 52.637, lng: 9.845, patterns: [/niedersachsen|\bni\b|hannover|braunschweig|oldenburg|osnabrück|wolfsburg/i] },
  { code: "DE-HB", label: "Bremen", lat: 53.079, lng: 8.802, patterns: [/bremen|\bhb\b|bremerhaven/i] },
  { code: "DE-NW", label: "Nordrhein-Westfalen", lat: 51.433, lng: 7.661, patterns: [/nordrhein-westfalen|\bnrw\b|düsseldorf|köln|dortmund|essen|bonn|bielefeld/i] },
  { code: "DE-HE", label: "Hessen", lat: 50.652, lng: 9.162, patterns: [/hessen|\bhe\b|frankfurt|wiesbaden|kassel|darmstadt|offenbach/i] },
  { code: "DE-RP", label: "Rheinland-Pfalz", lat: 49.913, lng: 7.450, patterns: [/rheinland-pfalz|\brp\b|mainz|ludwigshafen|koblenz|trier/i] },
  { code: "DE-BW", label: "Baden-Württemberg", lat: 48.537, lng: 9.040, patterns: [/baden-württemberg|baden-wuerttemberg|\bbw\b|stuttgart|mannheim|karlsruhe|freiburg|heilbronn/i] },
  { code: "DE-BY", label: "Bayern", lat: 48.946, lng: 11.395, patterns: [/bayern|\bby\b|münchen|nürnberg|augsburg|regensburg|würzburg|ingolstadt/i] },
  { code: "DE-SL", label: "Saarland", lat: 49.384, lng: 6.953, patterns: [/saarland|\bsl\b|saarbrücken/i] },
  { code: "DE-BE", label: "Berlin", lat: 52.520, lng: 13.405, patterns: [/berlin|\bbe\b/i] },
  { code: "DE-BB", label: "Brandenburg", lat: 52.408, lng: 12.562, patterns: [/brandenburg|\bbb\b|potsdam|cottbus|frankfurt \(oder\)/i] },
  { code: "DE-MV", label: "Mecklenburg-Vorpommern", lat: 53.612, lng: 12.501, patterns: [/mecklenburg-vorpommern|\bmv\b|rostock|schwerin|neubrandenburg/i] },
  { code: "DE-SN", label: "Sachsen", lat: 51.105, lng: 13.202, patterns: [/sachsen(?!-anhalt)|\bsn\b|dresden|leipzig|chemnitz|zwickau/i] },
  { code: "DE-ST", label: "Sachsen-Anhalt", lat: 51.950, lng: 11.692, patterns: [/sachsen-anhalt|\bst\b|magdeburg|halle|dessau/i] },
  { code: "DE-TH", label: "Thüringen", lat: 50.985, lng: 11.232, patterns: [/thüringen|\bth\b|erfurt|jena|gera|weimar/i] },
];

/** Positive Investoren-/Standort-Signale (Wirtschaft, Ansiedlung, Infrastruktur) */
const POS_SIGNALS: RegExp[] = [
  /ansiedlung|ansiedeln|siedelt|gewerbegebiet|gewerbefläche|infrastruktur|verkehrsprojekt|autobahn|schienen|bahnhof|fernverkehr/i,
  /hauptsitz|europazentrale|standort|neuer standort|großauftrag|milliarden|millionen.*invest|investitions|expansion|wachstum/i,
  /forschungs|innovations|chipfab|rechenzentrum|cloud|datacenter|fabrik|werk.*eröffn|eröffnung|erweiterung|neubau.*gewerbe/i,
  /arbeitsplätze|jobs|fachkräfte|zuzug|zuzugs|konjunktur|aufschwung|boom|dynamik|attraktiv.*standort/i,
  /logistik|hafen|luftfracht|lieferkette|ansiedlungs|unternehmen.*zieht/i,
];

const NEG_SIGNALS: RegExp[] = [
  /massenentlassung|insolvenz|abwicklung|werksschließ|standort.*schließ/i,
];

function scoreText(text: string): { pos: number; neg: number } {
  const t = text.toLowerCase();
  let pos = 0;
  let neg = 0;
  for (const re of POS_SIGNALS) {
    const m = t.match(re);
    if (m) pos += m.length;
  }
  for (const re of NEG_SIGNALS) {
    if (re.test(t)) neg += 2;
  }
  return { pos, neg };
}

function detectBundeslaender(text: string): BlCode[] {
  const t = text.toLowerCase();
  const hit = new Set<BlCode>();
  for (const bl of BUNDESLAENDER) {
    for (const re of bl.patterns) {
      if (re.test(t)) {
        hit.add(bl.code);
        break;
      }
    }
  }
  return [...hit];
}

function stripTags(s: string): string {
  return s.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/gi, "$1").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function parseRssItems(xml: string): { title: string; description: string }[] {
  const items: { title: string; description: string }[] = [];
  const itemRe = /<item\b[^>]*>([\s\S]*?)<\/item>/gi;
  let im: RegExpExecArray | null;
  while ((im = itemRe.exec(xml)) !== null) {
    const block = im[1];
    const tm = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(block);
    const dm = /<description[^>]*>([\s\S]*?)<\/description>/i.exec(block);
    const title = tm ? stripTags(tm[1]) : "";
    const description = dm ? stripTags(dm[1]) : "";
    if (title.length > 5) items.push({ title, description });
  }
  return items;
}

function normTitleKey(title: string): string {
  return title.toLowerCase().replace(/[^a-zäöü0-9]/g, "").slice(0, 72);
}

function berlinToday(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Berlin",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

async function fetchRss(url: string): Promise<string | null> {
  try {
    const h = new URL(url).hostname.toLowerCase();
    if (!ALLOWED_HOSTS.has(h) && !ALLOWED_HOSTS.has(h.replace(/^www\./, ""))) return null;
    const ctrl = new AbortController();
    const id = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: { "User-Agent": "ImmoControl-news-daily-aggregate/1.0", Accept: "application/rss+xml, application/xml, text/xml, */*" },
    });
    clearTimeout(id);
    if (!res.ok) return null;
    const t = await res.text();
    return t.length > 80 ? t : null;
  } catch {
    return null;
  }
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const auth = req.headers.get("Authorization") ?? "";
  if (!serviceKey || auth !== `Bearer ${serviceKey}`) {
    return json({ error: "Unauthorized" }, 401);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabase = createClient(supabaseUrl, serviceKey);

  const seenKeys = new Set<string>();
  const blScores: Record<string, { score: number; articles: number; titles: string[] }> = {};
  for (const bl of BUNDESLAENDER) {
    blScores[bl.code] = { score: 0, articles: 0, titles: [] };
  }

  let feedsOk = 0;
  let rawItems = 0;

  for (const url of FEED_URLS) {
    const xml = await fetchRss(url);
    if (!xml) continue;
    feedsOk++;
    const items = parseRssItems(xml);
    for (const it of items) {
      rawItems++;
      const key = normTitleKey(it.title);
      if (key.length > 8 && seenKeys.has(key)) continue;
      if (key.length > 8) seenKeys.add(key);

      const text = `${it.title}\n${it.description}`.slice(0, 4000);
      const { pos, neg } = scoreText(text);
      const base = Math.max(0, pos * 2 - neg);
      if (base < 0.5) continue;

      const lands = detectBundeslaender(text);
      if (lands.length === 0) continue;
      const share = base / lands.length;
      for (const code of lands) {
        const b = blScores[code];
        if (!b) continue;
        b.score += share;
        b.articles += 1;
        if (b.titles.length < 4) b.titles.push(it.title.slice(0, 120));
      }
    }
  }

  const day = berlinToday();
  const bundeslaender: Record<string, { code: string; label: string; lat: number; lng: number; score: number; articleCount: number; sampleTitles: string[] }> = {};
  let maxScore = 0.01;
  for (const bl of BUNDESLAENDER) {
    const b = blScores[bl.code];
    const sc = Math.round(b.score * 10) / 10;
    if (sc > maxScore) maxScore = sc;
    bundeslaender[bl.code] = {
      code: bl.code,
      label: bl.label,
      lat: bl.lat,
      lng: bl.lng,
      score: sc,
      articleCount: b.articles,
      sampleTitles: b.titles,
    };
  }

  const payload = {
    meta: {
      fetchedAt: new Date().toISOString(),
      day,
      feedsAttempted: FEED_URLS.length,
      feedsOk,
      rawItems,
      uniqueItems: seenKeys.size,
      algorithm: "keyword-investor-signals-v1",
      note: "Heuristik aus Immo-/Wirtschafts-RSS; keine Anlageberatung.",
    },
    bundeslaender,
    maxScore,
  };

  const { error } = await supabase.from("news_investor_map_snapshots").upsert(
    {
      day,
      payload,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "day" },
  );

  if (error) return json({ error: error.message }, 500);
  return json({ ok: true, day, feedsOk, uniqueItems: seenKeys.size });
});
