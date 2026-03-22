/**
 * Täglicher Morgen-Push (Cron ~9:00 Europe/Berlin): Top 6 Meldungen der letzten 24h
 * — 3 bundesweit, 3 „vor Ort“ (gleiche Heuristik wie Newsticker Tages-Top).
 * Nur Nutzer mit profiles.morning_news_push_enabled = true und device_tokens.
 *
 * POST mit Authorization: Bearer <SUPABASE_SERVICE_ROLE_KEY>
 *
 * Hinweis: iOS via APNs (wie send-push-ios). Android-Token werden erkannt, FCM-Versand optional später.
 */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import * as jose from "https://deno.land/x/jose@v5.2.0/index.ts";

import {
  buildPortfolioLocationHints,
  categoriseNews,
  computeDailyTopPicks,
  detectRegion,
  detectSentiment,
  isEconomicallyRelevant,
  MORNING_DIGEST_MAX_AGE_MS,
  normTitleKey,
  type DealForLocation,
  type NewsItem,
  type PropertyRow,
} from "../_shared/morningNewsDigest.ts";

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const FETCH_TIMEOUT_MS = 22_000;

/** Hosts — parallel zu supabase/functions/rss-fetch + newsFetch.ts */
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

/** Feed-Liste — bei Änderungen an src/pages/newsticker/newsFetch.ts (RSS_FEEDS) spiegeln */
const FEEDS: { url: string; source: string }[] = [
  { url: "https://news.google.com/rss/search?q=immobilien+markt+berlin+OR+brandenburg+investition+OR+rendite+OR+preis+OR+mietspiegel&hl=de&gl=DE&ceid=DE:de", source: "Google News" },
  { url: "https://www.tagesspiegel.de/contentexport/feed/wirtschaft/immobilien", source: "Tagesspiegel" },
  { url: "https://www.iz.de/news/feed/", source: "Immobilien Zeitung" },
  { url: "https://www.spiegel.de/wirtschaft/index.rss", source: "Spiegel Wirtschaft" },
  { url: "https://rss.sueddeutsche.de/rss/Wirtschaft", source: "Süddeutsche Wirtschaft" },
  { url: "https://www.n-tv.de/wirtschaft/rss", source: "n-tv Wirtschaft" },
  { url: "https://www.welt.de/feeds/section/finanzen.rss", source: "Welt Finanzen" },
  { url: "https://www.focus.de/immobilien/rss", source: "Focus Immobilien" },
  { url: "https://news.google.com/rss/search?q=site:morgenpost.de+berlin+immobilien&hl=de&gl=DE&ceid=DE:de", source: "Berliner Morgenpost (via Google)" },
  { url: "https://www.rbb24.de/aktuell/index.html/feed/", source: "rbb24" },
  { url: "https://news.google.com/rss/search?q=site:iz.de+berlin+OR+brandenburg&hl=de&gl=DE&ceid=DE:de", source: "IZ Berlin/Brandenburg (via Google)" },
  { url: "https://news.google.com/rss/search?q=site:haufe.de+immobilien+berlin+OR+markt+OR+statistik&hl=de&gl=DE&ceid=DE:de", source: "Haufe (via Google)" },
  { url: "https://news.google.com/rss/search?q=site:handelsblatt.com+immobilien+berlin+OR+investition+OR+rendite&hl=de&gl=DE&ceid=DE:de", source: "Handelsblatt" },
  { url: "https://news.google.com/rss/search?q=site:capital.de+immobilien+berlin+OR+brandenburg+OR+rendite&hl=de&gl=DE&ceid=DE:de", source: "Capital" },
  { url: "https://news.google.com/rss/search?q=site:bz-berlin.de+immobilien+OR+wohnungsmarkt+OR+mietspiegel&hl=de&gl=DE&ceid=DE:de", source: "BZ Berlin" },
  { url: "https://news.google.com/rss/search?q=site:berliner-zeitung.de+immobilien+OR+wohnungsmarkt+OR+mietspiegel&hl=de&gl=DE&ceid=DE:de", source: "Berliner Zeitung" },
  { url: "https://news.google.com/rss/search?q=site:wiwo.de+immobilien+berlin+OR+investition+OR+rendite&hl=de&gl=DE&ceid=DE:de", source: "WirtschaftsWoche" },
  { url: "https://news.google.com/rss/search?q=site:iwkoeln.de+immobilien+OR+wohnungsmarkt&hl=de&gl=DE&ceid=DE:de", source: "IW Köln" },
  { url: "https://news.google.com/rss/search?q=site:destatis.de+immobilienpreisindex+OR+baugenehmigungen&hl=de&gl=DE&ceid=DE:de", source: "Destatis" },
  { url: "https://news.google.com/rss/search?q=site:manager-magazin.de+immobilien+berlin+OR+investment&hl=de&gl=DE&ceid=DE:de", source: "Manager Magazin" },
  { url: "https://news.google.com/rss/search?q=site:faz.net+immobilien+berlin+OR+wohnungsmarkt+OR+rendite&hl=de&gl=DE&ceid=DE:de", source: "FAZ" },
  { url: "https://news.google.com/rss/search?q=immobilien+OR+wohnungsmarkt+OR+mietspiegel+bernau+OR+eberswalde+OR+oranienburg+OR+luckenwalde+OR+barnim&hl=de&gl=DE&ceid=DE:de", source: "Brandenburg Nord" },
  { url: "https://news.google.com/rss/search?q=immobilien+OR+wohnungsmarkt+OR+mietspiegel+strausberg+OR+f%C3%BCrstenwalde+OR+neuruppin+OR+wittenberge+OR+rathenow&hl=de&gl=DE&ceid=DE:de", source: "Brandenburg West/Ost" },
  { url: "https://news.google.com/rss/search?q=immobilien+OR+wohnungsmarkt+OR+mietspiegel+%22brandenburg+havel%22+OR+werder+OR+teltow+OR+kleinmachnow+OR+stahnsdorf+OR+blankenfelde&hl=de&gl=DE&ceid=DE:de", source: "Brandenburg Süd" },
];

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const APPLE_TEAM_ID = Deno.env.get("APPLE_TEAM_ID");
const APPLE_KEY_ID = Deno.env.get("APPLE_KEY_ID");
const APPLE_P8_KEY = Deno.env.get("APPLE_P8_KEY");
const APPLE_BUNDLE_ID = Deno.env.get("APPLE_BUNDLE_ID") ?? "com.immocontrol.app";
const APNS_HOST = "api.push.apple.com";

function stripTags(s: string): string {
  return s.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/gi, "$1").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function parseRssItemsFull(xml: string): Array<{ title: string; description: string; link: string; pubDate: string }> {
  const items: Array<{ title: string; description: string; link: string; pubDate: string }> = [];
  const itemRe = /<item\b[^>]*>([\s\S]*?)<\/item>/gi;
  let im: RegExpExecArray | null;
  while ((im = itemRe.exec(xml)) !== null) {
    const block = im[1];
    const tm = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(block);
    const dm = /<description[^>]*>([\s\S]*?)<\/description>/i.exec(block);
    let link = "";
    const lm = /<link[^>]*>([\s\S]*?)<\/link>/i.exec(block);
    if (lm) link = stripTags(lm[1]).trim();
    if (!link) {
      const la = /<link[^>]+href=["']([^"']+)["']/i.exec(block);
      if (la) link = la[1].trim();
    }
    if (!link) {
      const gm = /<guid[^>]*>([\s\S]*?)<\/guid>/i.exec(block);
      if (gm) link = stripTags(gm[1]).trim();
    }
    const pm = /<pubDate[^>]*>([\s\S]*?)<\/pubDate>/i.exec(block);
    let pubDate = new Date().toISOString();
    if (pm) {
      const d = new Date(stripTags(pm[1]));
      if (!Number.isNaN(d.getTime())) pubDate = d.toISOString();
    }
    const title = tm ? stripTags(tm[1]) : "";
    const description = dm ? stripTags(dm[1]) : "";
    if (title.length > 5) items.push({ title, description, link: link || "https://news.google.com", pubDate });
  }
  return items;
}

function toNewsItem(
  raw: { title: string; description: string; link: string; pubDate: string },
  source: string,
): NewsItem {
  const title = raw.title;
  const description = raw.description.slice(0, 400);
  const url = raw.link || "https://news.google.com";
  const id = `${source}-${encodeURIComponent(url).slice(0, 120)}`;
  return {
    id,
    title,
    description,
    url,
    source,
    publishedAt: raw.pubDate,
    category: categoriseNews(title, description),
    region: detectRegion(title, description),
    sentiment: detectSentiment(title, description),
  };
}

async function fetchRss(url: string): Promise<string | null> {
  try {
    const h = new URL(url).hostname.toLowerCase();
    if (!ALLOWED_HOSTS.has(h) && !ALLOWED_HOSTS.has(h.replace(/^www\./, ""))) return null;
    const ctrl = new AbortController();
    const id = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: { "User-Agent": "ImmoControl-morning-news-push/1.0", Accept: "application/rss+xml, application/xml, text/xml, */*" },
    });
    clearTimeout(id);
    if (!res.ok) return null;
    const t = await res.text();
    return t.length > 80 ? t : null;
  } catch {
    return null;
  }
}

function dedupeByTitle(items: NewsItem[]): NewsItem[] {
  const seen = new Set<string>();
  const sorted = [...items].sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime());
  const out: NewsItem[] = [];
  for (const it of sorted) {
    const k = normTitleKey(it.title);
    if (k.length >= 8 && seen.has(k)) continue;
    if (k.length >= 8) seen.add(k);
    out.push(it);
  }
  return out;
}

function truncate(s: string, max: number): string {
  const t = s.trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max - 1)}…`;
}

function formatDigestBody(picks: ReturnType<typeof computeDailyTopPicks>): string {
  const lines: string[] = [];
  lines.push("Bundesweit:");
  if (picks.deutschland.length === 0) lines.push("• Keine passende Meldung.");
  else {
    for (const e of picks.deutschland) lines.push(`• ${truncate(e.item.title, 88)}`);
  }
  lines.push("");
  lines.push("Vor Ort:");
  if (picks.vorOrt.length === 0) lines.push("• Keine passende Meldung.");
  else {
    for (const e of picks.vorOrt) lines.push(`• ${truncate(e.item.title, 88)}`);
  }
  lines.push("");
  lines.push("Newsticker in der App öffnen.");
  return lines.join("\n").slice(0, 3800);
}

async function getApnsJwt(): Promise<string> {
  if (!APPLE_TEAM_ID || !APPLE_KEY_ID || !APPLE_P8_KEY) {
    throw new Error("APPLE_* secrets missing");
  }
  const key = await jose.importPKCS8(APPLE_P8_KEY.trim(), "ES256");
  return await new jose.SignJWT({})
    .setProtectedHeader({ alg: "ES256", kid: APPLE_KEY_ID })
    .setIssuer(APPLE_TEAM_ID)
    .setIssuedAt(Math.floor(Date.now() / 1000))
    .sign(key);
}

async function sendApns(deviceToken: string, title: string, body: string, url: string, bearer: string): Promise<boolean> {
  const payload = {
    aps: {
      alert: { title, body },
      sound: "default",
      "interruption-level": "time-sensitive",
    },
    url,
  };
  const res = await fetch(`https://${APNS_HOST}/3/device/${deviceToken}`, {
    method: "POST",
    headers: {
      authorization: `bearer ${bearer}`,
      "apns-topic": APPLE_BUNDLE_ID,
      "apns-push-type": "alert",
      "apns-priority": "10",
      "content-type": "application/json",
    },
    body: JSON.stringify(payload),
  });
  return res.ok;
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });
}

async function fetchAllNews(): Promise<NewsItem[]> {
  const concurrency = 5;
  const out: NewsItem[] = [];
  for (let i = 0; i < FEEDS.length; i += concurrency) {
    const chunk = FEEDS.slice(i, i + concurrency);
    const results = await Promise.all(
      chunk.map(async ({ url, source }) => {
        const xml = await fetchRss(url);
        if (!xml) return [] as NewsItem[];
        const parsed = parseRssItemsFull(xml);
        const items: NewsItem[] = [];
        for (const raw of parsed) {
          const n = toNewsItem(raw, source);
          if (!isEconomicallyRelevant(n.title, n.description)) continue;
          items.push(n);
        }
        return items;
      }),
    );
    for (const arr of results) out.push(...arr);
  }
  return dedupeByTitle(out);
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const auth = req.headers.get("Authorization") ?? "";
  if (!serviceKey || auth !== `Bearer ${serviceKey}`) {
    return json({ error: "Unauthorized" }, 401);
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  const news = await fetchAllNews();
  if (news.length === 0) {
    return json({ ok: true, message: "No RSS items parsed", users: 0 });
  }

  const { data: profiles, error: pErr } = await supabase
    .from("profiles")
    .select("user_id")
    .eq("morning_news_push_enabled", true);

  if (pErr) return json({ error: pErr.message }, 500);

  const userIds = (profiles ?? []).map((p) => p.user_id as string);
  if (userIds.length === 0) {
    return json({ ok: true, newsItems: news.length, users: 0, message: "No subscribers" });
  }

  let apnsBearer: string | null = null;
  try {
    if (APPLE_TEAM_ID && APPLE_KEY_ID && APPLE_P8_KEY) {
      apnsBearer = await getApnsJwt();
    }
  } catch {
    apnsBearer = null;
  }

  let sentIos = 0;
  let skippedAndroid = 0;
  let errors = 0;

  const now = Date.now();

  for (const userId of userIds) {
    const { data: tokens } = await supabase
      .from("device_tokens")
      .select("token, platform")
      .eq("user_id", userId);

    if (!tokens?.length) continue;

    const { data: props } = await supabase
      .from("properties")
      .select("name, location, address")
      .eq("user_id", userId);

    const { data: deals } = await supabase
      .from("deals")
      .select("title, address, description, notes, stage")
      .eq("user_id", userId);

    const hints = buildPortfolioLocationHints(
      (props ?? []) as PropertyRow[],
      (deals ?? []) as DealForLocation[],
    );

    const picks = computeDailyTopPicks(news, now, {
      portfolioHints: hints,
      maxAgeMs: MORNING_DIGEST_MAX_AGE_MS,
      calendarDayBerlinOnly: false,
    });

    const title = "ImmoControl · Morgen-News";
    const body = formatDigestBody(picks);
    const url = "/";

    for (const row of tokens) {
      const platform = (row.platform as string)?.toLowerCase();
      const token = row.token as string;
      if (platform === "android") {
        skippedAndroid++;
        continue;
      }
      if (platform !== "ios") continue;
      if (!apnsBearer) {
        errors++;
        continue;
      }
      const ok = await sendApns(token, title, body, url, apnsBearer);
      if (ok) sentIos++;
      else errors++;
    }
  }

  return json({
    ok: true,
    newsItems: news.length,
    subscriberProfiles: userIds.length,
    sentIos,
    skippedAndroid,
    apnsConfigured: !!apnsBearer,
    errors,
  });
});
