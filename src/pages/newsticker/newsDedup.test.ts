import { describe, expect, it } from "vitest";
import { canonicalUrlForDedup, dedupeNewsItems } from "./newsDedup";
import type { NewsItem } from "./newsUtils";

function base(partial: Partial<NewsItem> & Pick<NewsItem, "id" | "title" | "url">): NewsItem {
  return {
    description: "",
    source: "T",
    publishedAt: new Date().toISOString(),
    category: "sonstiges",
    region: "berlin",
    sentiment: "neutral",
    ...partial,
  };
}

describe("newsDedup", () => {
  it("kanonisiert Google-Redirect-URLs für Vergleich", () => {
    const g =
      "https://news.google.com/rss/articles/CBMi?url=https%3A%2F%2Fwww.tagesspiegel.de%2Fa%2F123";
    expect(canonicalUrlForDedup(g)).toContain("tagesspiegel.de");
  });

  it("entfernt fast gleiche Überschriften (neueste behalten)", () => {
    const t = new Date("2026-01-15T10:00:00.000Z").toISOString();
    const older = new Date("2026-01-15T08:00:00.000Z").toISOString();
    const items = [
      base({
        id: "1",
        title: "Immobilienpreise in Berlin steigen weiter",
        url: "https://a.de/1",
        publishedAt: t,
      }),
      base({
        id: "2",
        title: "Immobilienpreise in Berlin steigen weiter — Analyse",
        url: "https://b.de/2",
        publishedAt: older,
      }),
    ];
    const d = dedupeNewsItems(items);
    expect(d.length).toBe(1);
    expect(d[0].id).toBe("1");
  });
});
