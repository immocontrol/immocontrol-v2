/**
 * Fetches RSS/Atom XML server-side for the Newsticker (CORS-frei).
 * – Eingeloggte Nutzer: beliebige erlaubte http(s)-URL (SSRF-Schutz).
 * – Ohne Login: nur Hosts aus ALLOWED_RSS_HOSTS (gleiche Feeds wie im Client).
 */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const MAX_BODY_BYTES = 2_000_000;
const FETCH_TIMEOUT_MS = 18_000;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

/** Muss mit den URLs in src/pages/newsticker/newsFetch.ts übereinstimmen */
const ALLOWED_RSS_HOSTS = new Set([
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

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

/** Basic SSRF hardening — only public http(s) targets */
function isAllowedFetchUrl(raw: string): boolean {
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    return false;
  }
  if (u.protocol !== "http:" && u.protocol !== "https:") return false;
  if (raw.length > 2048) return false;
  const h = u.hostname.toLowerCase();
  if (h === "localhost" || h === "0.0.0.0" || h === "[::1]") return false;
  if (h.startsWith("127.")) return false;
  if (h.endsWith(".localhost") || h.endsWith(".local")) return false;
  if (h === "169.254.169.254" || h === "metadata.google.internal") return false;
  const m = /^(\d+)\.(\d+)\.(\d+)\.(\d+)$/.exec(h);
  if (m) {
    const a = Number(m[1]);
    const b = Number(m[2]);
    if (a === 10) return false;
    if (a === 172 && b >= 16 && b <= 31) return false;
    if (a === 192 && b === 168) return false;
    if (a === 169 && b === 254) return false;
    if (a === 127) return false;
  }
  return true;
}

function isAllowlistedNewstickerHost(hostname: string): boolean {
  const h = hostname.toLowerCase();
  if (ALLOWED_RSS_HOSTS.has(h)) return true;
  return false;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
    const authHeader = req.headers.get("Authorization");
    const apikeyHeader = req.headers.get("apikey");

    const body = (await req.json().catch(() => null)) as { url?: string } | null;
    const target = typeof body?.url === "string" ? body.url.trim() : "";
    if (!target || !isAllowedFetchUrl(target)) {
      return json({ error: "Ungültige oder nicht erlaubte URL" }, 400);
    }

    let targetHost: string;
    try {
      targetHost = new URL(target).hostname.toLowerCase();
    } catch {
      return json({ error: "Ungültige URL" }, 400);
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader ?? "" } },
    });
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    let authorized = false;
    if (!userError && user) {
      authorized = true;
    } else if (
      apikeyHeader === SUPABASE_ANON_KEY &&
      isAllowlistedNewstickerHost(targetHost)
    ) {
      authorized = true;
    }

    if (!authorized) {
      return json({ error: "Nicht authentifiziert" }, 401);
    }

    const ac = new AbortController();
    const t = setTimeout(() => ac.abort(), FETCH_TIMEOUT_MS);
    let upstream: Response;
    try {
      upstream = await fetch(target, {
        method: "GET",
        redirect: "follow",
        signal: ac.signal,
        headers: {
          "User-Agent": "ImmoControl-RSS-Fetch/1.0",
          Accept: "application/rss+xml, application/atom+xml, application/xml, text/xml, */*",
        },
      });
    } finally {
      clearTimeout(t);
    }

    if (!upstream.ok) {
      return json({ error: `Upstream ${upstream.status}` }, 502);
    }

    const buf = new Uint8Array(await upstream.arrayBuffer());
    if (buf.byteLength > MAX_BODY_BYTES) {
      return json({ error: "Antwort zu groß" }, 413);
    }
    const text = new TextDecoder("utf-8", { fatal: false }).decode(buf);
    return json({ body: text });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return json({ error: msg || "Fetch fehlgeschlagen" }, 500);
  }
});
