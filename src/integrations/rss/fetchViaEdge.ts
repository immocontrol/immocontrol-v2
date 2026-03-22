/**
 * RSS-Fetch über Supabase Edge Function (serverseitig, kein CORS).
 * – Eingeloggt: Nutzer-JWT.
 * – Ohne Login: anon + apikey; Server erlaubt nur bekannte Newsticker-Feed-Hosts.
 */
import { supabase, isSupabaseConfigured, getSupabaseEnv } from "@/integrations/supabase/client";

export async function fetchRssTextViaEdge(feedUrl: string): Promise<string | null> {
  if (!isSupabaseConfigured()) return null;

  const { url, anonKey } = getSupabaseEnv();
  const { data: { session } } = await supabase.auth.getSession();
  const authBearer = session?.access_token
    ? session.access_token
    : anonKey;

  try {
    const res = await fetch(`${url}/functions/v1/rss-fetch`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${authBearer}`,
        apikey: anonKey,
      },
      body: JSON.stringify({ url: feedUrl }),
      signal: AbortSignal.timeout(22_000),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { body?: string; error?: string };
    if (typeof data.body === "string" && data.body.length >= 80) return data.body;
  } catch {
    /* network / parse */
  }
  return null;
}
