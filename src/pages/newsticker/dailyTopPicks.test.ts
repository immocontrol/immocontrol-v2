import { describe, expect, it } from "vitest";
import {
  computeDailyTopPicks,
  scoreLocalInvestment,
  scoreNationalRelevance,
} from "./dailyTopPicks";
import type { NewsItem } from "./newsUtils";

function item(partial: Partial<NewsItem> & Pick<NewsItem, "id" | "title">): NewsItem {
  return {
    description: "",
    url: "https://example.com/a",
    source: "Test",
    publishedAt: new Date().toISOString(),
    category: "sonstiges",
    region: "berlin",
    sentiment: "neutral",
    ...partial,
  };
}

describe("dailyTopPicks", () => {
  const now = new Date("2026-03-22T12:00:00.000Z").getTime();

  it("preferiert Destatis/Deutschland für national", () => {
    const a = item({
      id: "a",
      title: "Destatis: Immobilienpreise in Deutschland steigen",
      description: "Bundesweite Auswertung",
      source: "Destatis",
      category: "markt",
      publishedAt: new Date(now - 2 * 60 * 60 * 1000).toISOString(),
    });
    const b = item({
      id: "b",
      title: "Kiezfest in Neukölln",
      description: "",
      publishedAt: new Date(now - 1 * 60 * 60 * 1000).toISOString(),
    });
    expect(scoreNationalRelevance(a, now)).toBeGreaterThan(scoreNationalRelevance(b, now));
  });

  it("erkennt lokale Investitions-Signale (Brandenburg)", () => {
    const a = item({
      id: "a",
      title: "Rendite bei Gewerbe in Potsdam",
      description: "Transaktion am Markt",
      region: "brandenburg",
      category: "investment",
      publishedAt: new Date(now - 3 * 60 * 60 * 1000).toISOString(),
    });
    const b = item({
      id: "b",
      title: "Allgemeine Wirtschaftsnachricht",
      description: "Ohne Region",
      region: "berlin",
      publishedAt: new Date(now - 1 * 60 * 60 * 1000).toISOString(),
    });
    expect(scoreLocalInvestment(a, now)).toBeGreaterThan(scoreLocalInvestment(b, now));
  });

  it("liefert bis zu 3 + 3 Einträge und trennt Schwerpunkte", () => {
    const items: NewsItem[] = [
      item({
        id: "n1",
        title: "EZB senkt Leitzins – Auswirkungen auf den deutschen Wohnungsmarkt",
        description: "Bundesweit",
        source: "Spiegel Wirtschaft",
        category: "markt",
        publishedAt: new Date(now - 1 * 60 * 60 * 1000).toISOString(),
      }),
      item({
        id: "n2",
        title: "Destatis meldet neue Zahlen zum Immobilienpreisindex",
        description: "Deutschland",
        source: "Destatis",
        category: "markt",
        publishedAt: new Date(now - 2 * 60 * 60 * 1000).toISOString(),
      }),
      item({
        id: "n3",
        title: "Mietpreisbremse: Bund plant Verschärfung",
        description: "Politik in Deutschland",
        source: "n-tv Wirtschaft",
        category: "politik",
        publishedAt: new Date(now - 4 * 60 * 60 * 1000).toISOString(),
      }),
      item({
        id: "l1",
        title: "Investoren kaufen Portfolio in Cottbus",
        description: "Rendite und Transaktion",
        source: "Brandenburg Nord",
        region: "brandenburg",
        category: "investment",
        publishedAt: new Date(now - 5 * 60 * 60 * 1000).toISOString(),
      }),
      item({
        id: "l2",
        title: "Neubauprojekt in Bernau: Wohnungen am Markt",
        description: "",
        source: "rbb24",
        region: "brandenburg",
        category: "neubau",
        publishedAt: new Date(now - 6 * 60 * 60 * 1000).toISOString(),
      }),
      item({
        id: "l3",
        title: "Mietspiegel Berlin: neue Werte für Mitte",
        description: "Bezirk",
        source: "Google News",
        region: "berlin",
        category: "markt",
        publishedAt: new Date(now - 7 * 60 * 60 * 1000).toISOString(),
      }),
    ];
    const { deutschland, vorOrt, dateLabelDE, vorOrtPortfolioLine } = computeDailyTopPicks(items, now);
    expect(dateLabelDE.length).toBeGreaterThan(5);
    expect(vorOrtPortfolioLine).toBeNull();
    expect(deutschland.length).toBeGreaterThanOrEqual(1);
    expect(vorOrt.length).toBeGreaterThanOrEqual(1);
    expect(deutschland.length).toBeLessThanOrEqual(3);
    expect(vorOrt.length).toBeLessThanOrEqual(3);
  });
});
