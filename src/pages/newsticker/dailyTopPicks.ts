/**
 * Tages-Top: die wichtigsten Meldungen aus dem aktuellen Feed,
 * getrennt in bundesweite (Deutschland) und regionale Investitions-/Standort-News
 * (Standard: Berlin & Brandenburg; optional: Portfolio-Orte aus Objekten & Deals).
 * Heuristik: Score + Aktualität; kein externes LLM.
 */
import type { NewsItem } from "./newsUtils";
import { detectCity } from "./newsUtils";
import type { PortfolioLocationHints } from "./investmentLocationHints";
import { portfolioLocationMatchScore } from "./investmentLocationHints";

/** Artikel höchstens so alt berücksichtigen (RSS-Verzögerung, Wochenenden) */
const MAX_AGE_MS = 72 * 60 * 60 * 1000;

/** Quellen, die oft bundesweiten Wirtschafts-/Markt-Kontext liefern */
const NATIONAL_SOURCE_PATTERN =
  /Destatis|IW Köln|Spiegel|Handelsblatt|Capital|Manager Magazin|n-tv Wirtschaft|Welt Finanzen|Focus Immobilien|Süddeutsche Wirtschaft|FAZ|Immobilien Zeitung|WiWo|WirtschaftsWoche|Manager Magazin/i;

/** Quellen mit klarem Berlin/Brandenburg-Fokus */
const LOCAL_SOURCE_PATTERN =
  /rbb|Brandenburg Nord|Brandenburg Süd|Brandenburg West|Morgenpost|BZ Berlin|Berliner Zeitung|IZ Berlin|IZ Berlin\/Brandenburg|Berlin\/Brandenburg/i;

/** Bundesweite Begriffe (Markt, Geldpolitik, Statistik) */
const DE_WIDE_PATTERN =
  /deutschland|bundesweit|bundesrepublik|\bezb\b|europäische zentralbank|leitzins|bundesbank|destatis|statistisches bundesamt|statistische[s]? bundesamt|ifo institut|grundsteuer|wohnungsmarkt.*deutschland|in deutschland|deutsche[s]? wohn|preisindex|immobilienpreisindex|baugenehmigung.*deutschland|mietpreisbremse|wohnungsnot|bauzins/i;

/** Region Berlin/BB / Investition vor Ort */
const LOCAL_PLACE_PATTERN =
  /berlin|brandenburg|potsdam|cottbus|frankfurt \(oder\)|oranienburg|bernau|falkensee|eberswalde|havelland|barnim|märkisch|oberhavel|spreewald|teltow|kleinmachnow|stahnsdorf|nauen|luckenwalde|strausberg|fürstenwalde|neuruppin|wittenberge|rathenow|werder|blankenfelde|mahlow|rangsdorf|zossen|baruth|jüterbog|spandau|neukölln|mitte|charlottenburg|kreuzberg|pankow|lichtenberg|treptow|marzahn|reinickendorf|wedding|prenzlauer|friedrichshain|tempelhof|steglitz/i;

const INVESTMENT_PATTERN =
  /investition|investor|rendite|portfolio|transaktion|ankauf|verkauf|fonds|gewerbeimmobil|grundstück|neubauprojekt|mietspiegel|wohnungsmarkt|zinssatz|objekt|deal|millionen|milliarde/i;

export interface DailyTopPicks {
  /** Bis zu 3 Meldungen mit Deutschland-/Markt-Bezug */
  deutschland: NewsItem[];
  /** Bis zu 3 Meldungen für Berlin & Brandenburg / lokale Investition */
  vorOrt: NewsItem[];
  /** Anzeige-Datum (Europe/Berlin) */
  dateLabelDE: string;
  /** Kurzzeile unter „vor Ort“, z. B. Orte aus dem Portfolio; null = Standard-Region */
  vorOrtPortfolioLine: string | null;
}

function publishedTime(item: NewsItem): number {
  const t = new Date(item.publishedAt).getTime();
  return Number.isNaN(t) ? 0 : t;
}

function isRecent(item: NewsItem, now: number): boolean {
  const t = publishedTime(item);
  if (t <= 0) return false;
  return now - t <= MAX_AGE_MS;
}

/** Frische: jüngere Artikel leicht bevorzugen */
function freshnessBonus(item: NewsItem, now: number): number {
  const ageH = (now - publishedTime(item)) / (60 * 60 * 1000);
  if (ageH <= 12) return 2;
  if (ageH <= 24) return 1;
  if (ageH <= 48) return 0.5;
  return 0;
}

export function scoreNationalRelevance(item: NewsItem, now: number): number {
  const text = `${item.title} ${item.description}`.toLowerCase();
  let s = freshnessBonus(item, now);
  if (DE_WIDE_PATTERN.test(text)) s += 5;
  if (item.category === "markt" || item.category === "investment") s += 2;
  if (item.category === "politik") s += 1;
  if (NATIONAL_SOURCE_PATTERN.test(item.source)) s += 2;
  /* Reine Bezirks-/Stadtmeldung ohne bundesweiten Hook etwas runter */
  if (/^berlin:\s|^bezirk|^stadtteil/i.test(item.title.trim()) && !DE_WIDE_PATTERN.test(text)) s -= 1;
  return s;
}

export function scoreLocalInvestment(
  item: NewsItem,
  now: number,
  portfolioHints?: PortfolioLocationHints | null,
): number {
  const text = `${item.title} ${item.description}`.toLowerCase();
  let s = freshnessBonus(item, now);
  if (item.region === "brandenburg" || item.region === "both") s += 3;
  else if (item.region === "berlin") s += 1.5;
  if (detectCity(item.title, item.description)) s += 2;
  if (LOCAL_PLACE_PATTERN.test(text)) s += 2;
  if (INVESTMENT_PATTERN.test(text)) s += 2;
  if (LOCAL_SOURCE_PATTERN.test(item.source)) s += 2;
  if (item.category === "investment" || item.category === "markt") s += 1;
  if (portfolioHints?.hasPortfolioData) {
    s += portfolioLocationMatchScore(text, portfolioHints);
  }
  return s;
}

function uniqueById(items: NewsItem[]): NewsItem[] {
  const seen = new Set<string>();
  const out: NewsItem[] = [];
  for (const it of items) {
    if (seen.has(it.id)) continue;
    seen.add(it.id);
    out.push(it);
  }
  return out;
}

function pickTop(
  items: NewsItem[],
  scoreFn: (item: NewsItem) => number,
  count: number,
  minScoreStart: number,
): NewsItem[] {
  const scored = items.map((item) => ({ item, score: scoreFn(item) }));
  let min = minScoreStart;
  for (let step = 0; step < 8; step++) {
    const sorted = scored
      .filter((x) => x.score >= min)
      .sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        return publishedTime(b.item) - publishedTime(a.item);
      })
      .map((x) => x.item);
    const uniq = uniqueById(sorted);
    if (uniq.length >= count || min <= 0) return uniq.slice(0, count);
    min -= 0.75;
  }
  return uniqueById(
    scored.sort((a, b) => (b.score !== a.score ? b.score - a.score : publishedTime(b.item) - publishedTime(a.item))).map((x) => x.item),
  ).slice(0, count);
}

export function formatTopPicksDateDE(now: Date = new Date()): string {
  return now.toLocaleDateString("de-DE", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Europe/Berlin",
  });
}

/**
 * Aus dem geladenen Feed: bis zu 3 „Deutschland“- und 3 „vor Ort“-Meldungen.
 * Zweite Liste ist zuerst disjunkt zur ersten; bei wenig Treffern wird der Schwellenwert gesenkt.
 */
export interface ComputeDailyTopPicksOptions {
  portfolioHints?: PortfolioLocationHints | null;
}

export function computeDailyTopPicks(
  news: NewsItem[],
  now: number = Date.now(),
  options?: ComputeDailyTopPicksOptions,
): DailyTopPicks {
  const hints = options?.portfolioHints ?? null;
  const scoreLocal = (item: NewsItem) => scoreLocalInvestment(item, now, hints);

  const recent = news.filter((n) => isRecent(n, now));
  const deutschland = pickTop(recent, (item) => scoreNationalRelevance(item, now), 3, 4);
  const nationalIds = new Set(deutschland.map((n) => n.id));

  const poolNoNationalDup = recent.filter((n) => !nationalIds.has(n.id));
  let vorOrt = pickTop(poolNoNationalDup, scoreLocal, 3, 4);
  if (vorOrt.length < 3) {
    vorOrt = pickTop(poolNoNationalDup, scoreLocal, 3, 2);
  }
  if (vorOrt.length < 3) {
    vorOrt = pickTop(poolNoNationalDup, scoreLocal, 3, 0.5);
  }
  /* Letzte Auffüllung: auch aus dem Gesamtpool nach lokalem Score, ohne Duplikate */
  if (vorOrt.length < 3) {
    const used = new Set(vorOrt.map((n) => n.id));
    const extra = pickTop(recent, scoreLocal, 9, 0);
    for (const item of extra) {
      if (vorOrt.length >= 3) break;
      if (!used.has(item.id)) {
        used.add(item.id);
        vorOrt.push(item);
      }
    }
  }

  const vorOrtPortfolioLine =
    hints?.hasPortfolioData && hints.summaryLabel.trim().length > 0
      ? `Basierend auf deinen Objekten & Deals: ${hints.summaryLabel}`
      : null;

  return {
    deutschland,
    vorOrt: vorOrt.slice(0, 3),
    dateLabelDE: formatTopPicksDateDE(new Date(now)),
    vorOrtPortfolioLine,
  };
}
