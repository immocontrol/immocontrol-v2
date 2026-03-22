/**
 * Portable snapshot — keep aligned with:
 * - src/pages/newsticker/dailyTopPicks.ts
 * - src/pages/newsticker/investmentLocationHints.ts
 * - src/pages/newsticker/newsUtils.ts (subset)
 */
export type NewsCategory =
  | "markt"
  | "neubau"
  | "politik"
  | "gewerbe"
  | "wohnen"
  | "investment"
  | "stadtentwicklung"
  | "sonstiges";

export interface NewsItem {
  id: string;
  title: string;
  description: string;
  url: string;
  source: string;
  publishedAt: string;
  category: NewsCategory;
  region: "berlin" | "brandenburg" | "both";
  sentiment: "positive" | "negative" | "neutral";
}

export interface DealForLocation {
  title?: string | null;
  address?: string | null;
  description?: string | null;
  notes?: string | null;
  stage?: string | null;
}

/** Minimal fields from properties table */
export interface PropertyRow {
  name: string;
  location: string;
  address: string;
}

export interface PortfolioLocationHints {
  matchTerms: string[];
  summaryLabel: string;
  hasPortfolioData: boolean;
}

const GENERIC_STOP = new Set([
  "deutschland", "germany", "etw", "whg", "wohnung", "wohnungen", "haus", "objekt", "objekte",
  "privat", "privatanbieter", "immobilie", "immobilien", "vermietet", "unvermietet", "kauf",
  "miete", "nr", "zg", "zzgl", "inkl", "ca", "ca.",
]);

const EXTRA_REGION_TERMS = [
  "berlin", "brandenburg", "mecklenburg-vorpommern", "hamburg", "bremen", "bayern", "baden-württemberg",
  "nordrhein-westfalen", "nrw", "hessen", "sachsen", "sachsen-anhalt", "thüringen", "schleswig-holstein",
  "niedersachsen", "rheinland-pfalz", "saarland",
];

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function keepAsTerm(normalized: string): boolean {
  if (normalized.length < 2 || normalized.length > 42) return false;
  if (GENERIC_STOP.has(normalized)) return false;
  if (/^\d+$/.test(normalized)) return false;
  if (/^q[m²]|m²|qm$/i.test(normalized)) return false;
  return true;
}

function splitLocationChunks(raw: string): string[] {
  const t = raw.trim();
  if (!t) return [];
  const parts = t.split(/[,;|]/).map((p) => p.trim()).filter(Boolean);
  const out: string[] = [];
  for (const p of parts) {
    out.push(p);
    const slashes = p.split("/").map((x) => x.trim()).filter(Boolean);
    if (slashes.length > 1) out.push(...slashes);
  }
  return out;
}

function stripPlz(segment: string): string {
  const s = segment.trim();
  const m = s.match(/^(?:\d{5})\s+(.+)$/);
  if (m) return m[1].trim();
  if (/^\d{5}$/.test(s)) return "";
  return s;
}

function termsFromField(field: string, displayNames: Map<string, string>): void {
  for (let chunk of splitLocationChunks(field)) {
    chunk = stripPlz(chunk);
    if (!chunk) continue;
    const lower = chunk.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    if (!keepAsTerm(lower)) continue;
    if (!displayNames.has(lower)) {
      displayNames.set(lower, chunk.length <= 40 ? chunk : chunk.slice(0, 37) + "…");
    }
  }
}

function collectFromProperty(p: PropertyRow, displayNames: Map<string, string>): void {
  termsFromField(p.location || "", displayNames);
  termsFromField(p.address || "", displayNames);
  if (p.name && p.name.length <= 80) {
    termsFromField(p.name, displayNames);
  }
}

function dealIsLocationRelevant(d: DealForLocation): boolean {
  const st = (d.stage || "").toLowerCase();
  if (st === "abgelehnt") return false;
  return true;
}

function collectFromDeal(d: DealForLocation, displayNames: Map<string, string>): void {
  if (!dealIsLocationRelevant(d)) return;
  if (d.title) termsFromField(d.title, displayNames);
  if (d.address) termsFromField(d.address, displayNames);
  if (d.description) termsFromField(d.description, displayNames);
  if (d.notes) termsFromField(d.notes, displayNames);
}

function toMatchTerms(displayNames: Map<string, string>): string[] {
  const terms = new Set<string>();
  for (const key of displayNames.keys()) {
    terms.add(key);
    const words = key.split(/\s+/).filter((w) => w.length >= 4);
    for (const w of words) {
      if (keepAsTerm(w) && !GENERIC_STOP.has(w)) terms.add(w);
    }
  }
  for (const r of EXTRA_REGION_TERMS) {
    for (const key of displayNames.keys()) {
      if (key.includes(r)) terms.add(r);
    }
  }
  return [...terms].sort((a, b) => b.length - a.length);
}

function buildSummary(displayNames: Map<string, string>): string {
  const labels = [...displayNames.values()];
  if (labels.length === 0) return "";
  const unique = [...new Set(labels)];
  const short = unique.slice(0, 5);
  let s = short.join(", ");
  if (s.length > 90) s = `${short.slice(0, 3).join(", ")} …`;
  return s;
}

export function buildPortfolioLocationHints(
  properties: PropertyRow[],
  deals: DealForLocation[],
): PortfolioLocationHints {
  const displayNames = new Map<string, string>();
  for (const p of properties) collectFromProperty(p, displayNames);
  for (const d of deals) collectFromDeal(d, displayNames);

  const matchTerms = toMatchTerms(displayNames);
  const summaryLabel = buildSummary(displayNames);
  const hasPortfolioData = matchTerms.length > 0;

  return {
    matchTerms: hasPortfolioData ? matchTerms.slice(0, 40) : [],
    summaryLabel,
    hasPortfolioData,
  };
}

export function portfolioLocationMatchScore(textLower: string, hints: PortfolioLocationHints): number {
  if (!hints.hasPortfolioData || hints.matchTerms.length === 0) return 0;
  let bonus = 0;
  const seen = new Set<string>();
  for (const term of hints.matchTerms) {
    if (seen.has(term)) continue;
    if (term.includes(" ")) {
      if (textLower.includes(term)) {
        seen.add(term);
        bonus += 4;
      }
      continue;
    }
    if (term.length < 3) continue;
    const re = new RegExp(`(^|[^a-zäöüß0-9])${escapeRegex(term)}([^a-zäöüß0-9]|$)`, "i");
    if (re.test(textLower)) {
      seen.add(term);
      bonus += 3;
    }
  }
  return Math.min(bonus, 12);
}

export function getMatchedPortfolioTerms(
  textLower: string,
  hints: PortfolioLocationHints,
  max = 3,
): string[] {
  if (!hints.hasPortfolioData || hints.matchTerms.length === 0) return [];
  const out: string[] = [];
  const seen = new Set<string>();
  for (const term of hints.matchTerms) {
    if (out.length >= max) break;
    if (seen.has(term)) continue;
    let hit = false;
    if (term.includes(" ")) {
      hit = textLower.includes(term);
    } else if (term.length >= 3) {
      const re = new RegExp(`(^|[^a-zäöüß0-9])${escapeRegex(term)}([^a-zäöüß0-9]|$)`, "i");
      hit = re.test(textLower);
    }
    if (hit) {
      seen.add(term);
      out.push(term);
    }
  }
  return out;
}

const BERLIN_DISTRICTS = [
  "Charlottenburg", "Friedrichshain", "Kreuzberg", "Lichtenberg", "Marzahn",
  "Mitte", "Neukölln", "Pankow", "Prenzlauer Berg", "Reinickendorf",
  "Spandau", "Steglitz", "Tempelhof", "Treptow", "Wedding",
] as const;

const BRANDENBURG_CITIES = [
  "Potsdam", "Cottbus", "Frankfurt/Oder", "Oranienburg", "Bernau",
  "Falkensee", "Eberswalde", "Ludwigsfelde", "Königs Wusterhausen", "Wildau",
  "Schönefeld", "Luckenwalde", "Strausberg", "Fürstenwalde", "Neuruppin",
] as const;

const CRIME_BLACKLIST = /polizei|straftat|überfall|raub|\bmord\b|totschlag|\bmesser\b|festnahme|verhaftet|tatverdächtig|kriminalität|wohnungseinbruch|einbruchdiebstahl|diebstahl|brandstiftung|drogenhandel|schüsse|schießerei|leiche|verkehrsunfall|messerattacke|schlägerei|vergewaltigung|körperverletzung/i;

export function detectCity(title: string, description: string): string | null {
  const text = `${title} ${description}`.toLowerCase();
  for (const d of BERLIN_DISTRICTS) {
    if (text.includes(d.toLowerCase())) return d;
  }
  for (const c of BRANDENBURG_CITIES) {
    const searchTerm = c.includes("/") ? c.split("/")[0].toLowerCase() : c.toLowerCase();
    if (text.includes(searchTerm)) return c;
  }
  return null;
}

export function categoriseNews(title: string, description: string): NewsCategory {
  const text = `${title} ${description}`.toLowerCase();
  if (/marktbericht|preisentwicklung|immobilienpreise|quadratmeterpreis|mietpreisspiegel|preisindex|statistik|kaufpreise|angebotspreise/.test(text)) return "markt";
  if (/neubau|bauprojekt|bauvorhaben|richtfest|grundsteinlegung|baugenehmigung|wohnungsbau/.test(text)) return "neubau";
  if (/mietendeckel|mietpreisbremse|regulierung|verordnung|gesetz|senat|bezirksamt|politik|koalition/.test(text)) return "politik";
  if (/gewerbe|büro|office|einzelhandel|logistik|gewerbefläche/.test(text)) return "gewerbe";
  if (/investment|transaktion|ankauf|verkauf|portfolio|fonds|rendite|investor/.test(text)) return "investment";
  if (/stadtentwicklung|quartier|infrastruktur|verkehr|bahn|flughafen|ber\b/.test(text)) return "stadtentwicklung";
  if (/wohnung|miete|eigentum|wohnraum|mietwohnung|eigentumswohnung|wohnen/.test(text)) return "wohnen";
  return "sonstiges";
}

export function detectSentiment(title: string, description: string): "positive" | "negative" | "neutral" {
  const text = `${title} ${description}`.toLowerCase();
  const POS = [
    "steigt", "steigerung", "wachstum", "boom", "rekord", "nachfrage", "positiv",
    "erholung", "gewinn", "chancen", "zunahme", "aufwind", "erfolgreich", "attraktiv",
    "günstig", "bezahlbar", "förderung", "subvention", "entlastung", "investition",
    "neubau", "richtfest", "grundsteinlegung", "ausbau", "modernisierung",
  ];
  const NEG = [
    "sinkt", "rückgang", "krise", "einbruch", "verlust", "mangel", "knappheit",
    "teuer", "unbezahlbar", "leerstand", "insolvenz", "pleite", "stagnation",
    "rückläufig", "negativ", "warnung", "risiko", "problem", "sorge", "angst",
  ];
  let score = 0;
  for (const kw of POS) if (text.includes(kw)) score++;
  for (const kw of NEG) if (text.includes(kw)) score--;
  if (score >= 2) return "positive";
  if (score <= -2) return "negative";
  return "neutral";
}

export function detectRegion(title: string, description: string): "berlin" | "brandenburg" | "both" {
  const text = `${title} ${description}`.toLowerCase();
  const hasBerlin = /berlin|charlottenburg|kreuzberg|mitte|neukölln|prenzlauer|friedrichshain|tempelhof|spandau|steglitz|pankow|lichtenberg|treptow|marzahn|reinickendorf|wedding/.test(text);
  const hasBrandenburg = /brandenburg|potsdam|cottbus|frankfurt.*oder|oranienburg|bernau|falkensee|eberswalde|ludwigsfelde|königs.?wusterhausen|wildau|schönefeld|luckenwalde|strausberg|fürstenwalde|neuruppin|wittenberge|rathenow/.test(text);
  if (hasBerlin && hasBrandenburg) return "both";
  if (hasBrandenburg) return "brandenburg";
  return "berlin";
}

export function isEconomicallyRelevant(title: string, description: string): boolean {
  const text = `${title} ${description}`.toLowerCase();
  if (CRIME_BLACKLIST.test(text)) return false;
  return true;
}

export const MORNING_DIGEST_MAX_AGE_MS = 24 * 60 * 60 * 1000;

const DEFAULT_TOP_PICKS_MAX_AGE_MS = MORNING_DIGEST_MAX_AGE_MS;

const NATIONAL_SOURCE_PATTERN =
  /Destatis|IW Köln|Spiegel|Handelsblatt|Capital|Manager Magazin|n-tv Wirtschaft|Welt Finanzen|Focus Immobilien|Süddeutsche Wirtschaft|FAZ|Immobilien Zeitung|WiWo|WirtschaftsWoche|Manager Magazin/i;

const LOCAL_SOURCE_PATTERN =
  /rbb|Brandenburg Nord|Brandenburg Süd|Brandenburg West|Morgenpost|BZ Berlin|Berliner Zeitung|IZ Berlin|IZ Berlin\/Brandenburg|Berlin\/Brandenburg/i;

const DE_WIDE_PATTERN =
  /deutschland|bundesweit|bundesrepublik|\bezb\b|europäische zentralbank|leitzins|bundesbank|destatis|statistisches bundesamt|statistische[s]? bundesamt|ifo institut|grundsteuer|wohnungsmarkt.*deutschland|in deutschland|deutsche[s]? wohn|preisindex|immobilienpreisindex|baugenehmigung.*deutschland|mietpreisbremse|wohnungsnot|bauzins/i;

const LOCAL_PLACE_PATTERN =
  /berlin|brandenburg|potsdam|cottbus|frankfurt \(oder\)|oranienburg|bernau|falkensee|eberswalde|havelland|barnim|märkisch|oberhavel|spreewald|teltow|kleinmachnow|stahnsdorf|nauen|luckenwalde|strausberg|fürstenwalde|neuruppin|wittenberge|rathenow|werder|blankenfelde|mahlow|rangsdorf|zossen|baruth|jüterbog|spandau|neukölln|mitte|charlottenburg|kreuzberg|pankow|lichtenberg|treptow|marzahn|reinickendorf|wedding|prenzlauer|friedrichshain|tempelhof|steglitz/i;

const INVESTMENT_PATTERN =
  /investition|investor|rendite|portfolio|transaktion|ankauf|verkauf|fonds|gewerbeimmobil|grundstück|neubauprojekt|mietspiegel|wohnungsmarkt|zinssatz|objekt|deal|millionen|milliarde/i;

export interface TopPickEntry {
  item: NewsItem;
  reasons: string[];
}

export interface DailyTopPicks {
  deutschland: TopPickEntry[];
  vorOrt: TopPickEntry[];
  dateLabelDE: string;
  vorOrtPortfolioLine: string | null;
  windowDescriptionDE: string;
}

function publishedTime(item: NewsItem): number {
  const t = new Date(item.publishedAt).getTime();
  return Number.isNaN(t) ? 0 : t;
}

function berlinDateKey(ms: number): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Berlin",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(ms);
}

function isPublishedOnSameBerlinDay(publishedIso: string, nowMs: number): boolean {
  const t = new Date(publishedIso).getTime();
  if (Number.isNaN(t)) return false;
  return berlinDateKey(t) === berlinDateKey(nowMs);
}

function isInWindow(
  item: NewsItem,
  now: number,
  maxAgeMs: number,
  calendarDayBerlinOnly: boolean,
): boolean {
  const t = publishedTime(item);
  if (t <= 0) return false;
  if (now - t > maxAgeMs) return false;
  if (calendarDayBerlinOnly && !isPublishedOnSameBerlinDay(item.publishedAt, now)) return false;
  return true;
}

function freshnessBonus(item: NewsItem, now: number): number {
  const ageH = (now - publishedTime(item)) / (60 * 60 * 1000);
  if (ageH <= 12) return 2;
  if (ageH <= 24) return 1;
  if (ageH <= 48) return 0.5;
  return 0;
}

function freshnessReason(item: NewsItem, now: number): string | null {
  const ageH = (now - publishedTime(item)) / (60 * 60 * 1000);
  if (ageH <= 12) return "Sehr aktuell (unter 12 Std.)";
  if (ageH <= 24) return "Aktuell (unter 24 Std.)";
  if (ageH <= 48) return "Letzte 48 Std.";
  return null;
}

export function scoreNationalRelevance(item: NewsItem, now: number): number {
  const text = `${item.title} ${item.description}`.toLowerCase();
  let s = freshnessBonus(item, now);
  if (DE_WIDE_PATTERN.test(text)) s += 5;
  if (item.category === "markt" || item.category === "investment") s += 2;
  if (item.category === "politik") s += 1;
  if (NATIONAL_SOURCE_PATTERN.test(item.source)) s += 2;
  if (/^berlin:\s|^bezirk|^stadtteil/i.test(item.title.trim()) && !DE_WIDE_PATTERN.test(text)) s -= 1;
  return s;
}

export function explainNationalReasons(item: NewsItem, now: number): string[] {
  const text = `${item.title} ${item.description}`.toLowerCase();
  const reasons: string[] = [];
  const fr = freshnessReason(item, now);
  if (fr) reasons.push(fr);
  if (DE_WIDE_PATTERN.test(text)) reasons.push("Bundesweiter Bezug (Politik, Markt, Statistik, EZB …)");
  if (NATIONAL_SOURCE_PATTERN.test(item.source)) reasons.push(`Typische Bundesquelle: ${item.source}`);
  if (item.category === "markt" || item.category === "investment") {
    reasons.push(`Kategorie „${item.category === "markt" ? "Markt" : "Investment"}“`);
  } else if (item.category === "politik") reasons.push("Kategorie „Mietenpolitik / Politik“");
  return [...new Set(reasons)].slice(0, 4);
}

export function scoreLocalInvestment(
  item: NewsItem,
  now: number,
  portfolioHints: PortfolioLocationHints | null,
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

export function explainLocalReasons(
  item: NewsItem,
  now: number,
  portfolioHints: PortfolioLocationHints | null,
): string[] {
  const text = `${item.title} ${item.description}`.toLowerCase();
  const reasons: string[] = [];
  const fr = freshnessReason(item, now);
  if (fr) reasons.push(fr);

  const city = detectCity(item.title, item.description);
  if (city) reasons.push(`Ort/Bezirk im Text: ${city}`);

  if (portfolioHints?.hasPortfolioData) {
    const matched = getMatchedPortfolioTerms(text, portfolioHints, 3);
    for (const m of matched) reasons.push(`Passt zu deinem Portfolio („${m}“)`);
  }

  if (item.region === "brandenburg" || item.region === "both") reasons.push("Region: Brandenburg / Berlin+BB");
  else if (item.region === "berlin") reasons.push("Region: Berlin");

  if (LOCAL_PLACE_PATTERN.test(text)) reasons.push("Regionale Stichworte (Berlin/Brandenburg …)");
  if (INVESTMENT_PATTERN.test(text)) reasons.push("Investitions-/Marktbezug (Rendite, Transaktion …)");
  if (LOCAL_SOURCE_PATTERN.test(item.source)) reasons.push(`Regionale Quelle: ${item.source}`);

  return [...new Set(reasons)].slice(0, 5);
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

function formatWindowDescriptionDE(maxAgeMs: number, calendarDayBerlinOnly: boolean): string {
  const h = Math.round(maxAgeMs / (60 * 60 * 1000));
  const base = calendarDayBerlinOnly
    ? `Kalendertag Europe/Berlin, max. ${h}h zurück`
    : `Letzte ${h} Stunden (Europe/Berlin)`;
  return base;
}

export interface ComputeDailyTopPicksOptions {
  portfolioHints?: PortfolioLocationHints | null;
  maxAgeMs?: number;
  calendarDayBerlinOnly?: boolean;
}

export function computeDailyTopPicks(
  news: NewsItem[],
  now: number = Date.now(),
  options?: ComputeDailyTopPicksOptions,
): DailyTopPicks {
  const hints = options?.portfolioHints ?? null;
  const maxAgeMs = options?.maxAgeMs ?? DEFAULT_TOP_PICKS_MAX_AGE_MS;
  const calendarDayBerlinOnly = options?.calendarDayBerlinOnly ?? false;

  const scoreLocal = (item: NewsItem) => scoreLocalInvestment(item, now, hints);

  const recent = news.filter((n) => isInWindow(n, now, maxAgeMs, calendarDayBerlinOnly));

  const deutschlandItems = pickTop(recent, (item) => scoreNationalRelevance(item, now), 3, 4);
  const deutschland: TopPickEntry[] = deutschlandItems.map((item) => ({
    item,
    reasons: explainNationalReasons(item, now),
  }));

  const nationalIds = new Set(deutschlandItems.map((n) => n.id));
  const poolNoNationalDup = recent.filter((n) => !nationalIds.has(n.id));

  let vorOrtItems = pickTop(poolNoNationalDup, scoreLocal, 3, 4);
  if (vorOrtItems.length < 3) {
    vorOrtItems = pickTop(poolNoNationalDup, scoreLocal, 3, 2);
  }
  if (vorOrtItems.length < 3) {
    vorOrtItems = pickTop(poolNoNationalDup, scoreLocal, 3, 0.5);
  }
  if (vorOrtItems.length < 3) {
    const used = new Set(vorOrtItems.map((n) => n.id));
    const extra = pickTop(recent, scoreLocal, 9, 0);
    for (const item of extra) {
      if (vorOrtItems.length >= 3) break;
      if (!used.has(item.id)) {
        used.add(item.id);
        vorOrtItems.push(item);
      }
    }
  }

  const vorOrt: TopPickEntry[] = vorOrtItems.slice(0, 3).map((item) => ({
    item,
    reasons: explainLocalReasons(item, now, hints),
  }));

  const vorOrtPortfolioLine =
    hints?.hasPortfolioData && hints.summaryLabel.trim().length > 0
      ? `Basierend auf deinen Objekten & Deals: ${hints.summaryLabel}`
      : null;

  return {
    deutschland,
    vorOrt,
    dateLabelDE: formatTopPicksDateDE(new Date(now)),
    vorOrtPortfolioLine,
    windowDescriptionDE: formatWindowDescriptionDE(maxAgeMs, calendarDayBerlinOnly),
  };
}

export function normTitleKey(title: string): string {
  return title.toLowerCase().replace(/[^a-zäöü0-9]/g, "").slice(0, 72);
}
