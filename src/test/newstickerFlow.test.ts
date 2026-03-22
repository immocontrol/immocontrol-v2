/**
 * Smoke-Logik Newsticker ohne Netzwerk: Dedupe + Tages-Top.
 */
import { describe, expect, it } from "vitest";
import { dedupeNewsItems } from "@/pages/newsticker/newsDedup";
import { computeDailyTopPicks } from "@/pages/newsticker/dailyTopPicks";
import type { NewsItem } from "@/pages/newsticker/newsUtils";

function ni(partial: Partial<NewsItem> & Pick<NewsItem, "id" | "title">): NewsItem {
  return {
    description: "x",
    url: `https://example.com/${partial.id}`,
    source: "S",
    publishedAt: new Date().toISOString(),
    category: "markt",
    region: "berlin",
    sentiment: "neutral",
    ...partial,
  };
}

describe("Newsticker Flow (ohne RSS-Fetch)", () => {
  it("Dedupe + computeDailyTopPicks läuft durch", () => {
    const raw: NewsItem[] = [
      ni({
        id: "a",
        title: "Destatis: Index in Deutschland",
        description: "bundesweit",
        publishedAt: new Date().toISOString(),
      }),
      ni({
        id: "b",
        title: "Berlin: Mieten steigen",
        description: "investition rendite berlin",
        publishedAt: new Date().toISOString(),
      }),
    ];
    const deduped = dedupeNewsItems(raw);
    expect(deduped.length).toBeGreaterThan(0);
    const top = computeDailyTopPicks(deduped, Date.now());
    expect(top.deutschland.length + top.vorOrt.length).toBeGreaterThan(0);
  });
});
