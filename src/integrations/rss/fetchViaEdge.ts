/**
 * Server-side RSS fetch via Supabase Edge Function (preferred when user is logged in).
 */
import { supabase, isSupabaseConfigured, getSupabaseEnv } from "@/integrations/supabase/client";

export async function fetchRssTextViaEdge(feedUrl: string): Promise<string | null> {
  if (!isSupabaseConfigured()) return null;
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) return null;

  const { url, anonKey } = getSupabaseEnv();
  try {
    const res = await fetch(`${url}/functions/v1/rss-fetch`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.access_token}`,
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
