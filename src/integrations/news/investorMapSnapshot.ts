/**
 * Täglicher Server-Snapshot: Bundesland-Scores aus aggregierten RSS-Daten (Tabelle `news_investor_map_snapshots`).
 * Öffentlich lesbar (RLS); Schreiben nur via Edge Function `news-daily-aggregate` (Service Role).
 */
import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";

export interface InvestorMapBlEntry {
  code: string;
  label: string;
  lat: number;
  lng: number;
  score: number;
  articleCount: number;
  sampleTitles: string[];
}

export interface InvestorMapPayload {
  meta: {
    fetchedAt: string;
    day: string;
    feedsAttempted: number;
    feedsOk: number;
    rawItems: number;
    uniqueItems: number;
    algorithm: string;
    note?: string;
  };
  bundeslaender: Record<string, InvestorMapBlEntry>;
  maxScore: number;
}

export interface InvestorMapSnapshotRow {
  day: string;
  payload: InvestorMapPayload;
}

function isPayload(v: Json | null | undefined): v is InvestorMapPayload {
  return (
    typeof v === "object" &&
    v !== null &&
    "bundeslaender" in v &&
    "maxScore" in v &&
    "meta" in v
  );
}

export async function fetchLatestInvestorMapSnapshot(): Promise<InvestorMapSnapshotRow | null> {
  const { data, error } = await supabase
    .from("news_investor_map_snapshots")
    .select("day, payload")
    .order("day", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data?.payload || !isPayload(data.payload)) return null;

  return { day: data.day, payload: data.payload };
}
