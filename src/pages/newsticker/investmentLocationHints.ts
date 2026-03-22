/**
 * Orts-/Investitions-Hinweise aus Portfolio-Objekten und Deals für Newsticker-Personalisierung.
 */
import type { Property } from "@/data/mockData";

export interface DealForLocation {
  title?: string | null;
  address?: string | null;
  description?: string | null;
  notes?: string | null;
  stage?: string | null;
}

export interface PortfolioLocationHints {
  /** Normalisierte Suchstrings (Kleinbuchstaben), Phrasen und Einzelbegriffe */
  matchTerms: string[];
  /** Kurzliste für UI (max. einige Orte) */
  summaryLabel: string;
  /** Mind. ein Objekt oder ein aktiver Deal mit extrahierbarem Ort */
  hasPortfolioData: boolean;
}

const GENERIC_STOP = new Set([
  "deutschland", "germany", "etw", "whg", "wohnung", "wohnungen", "haus", "objekt", "objekte",
  "privat", "privatanbieter", "immobilie", "immobilien", "vermietet", "unvermietet", "kauf",
  "miete", "nr", "zg", "zzgl", "inkl", "ca", "ca.",
]);

/** Typische Bundesland-/Regionalnamen (als Zusatz-Treffer zum Freitext) */
const EXTRA_REGION_TERMS = [
  "berlin", "brandenburg", "mecklenburg-vorpommern", "hamburg", "bremen", "bayern", "baden-württemberg",
  "nordrhein-westfalen", "nrw", "hessen", "sachsen", "sachsen-anhalt", "thüringen", "schleswig-holstein",
  "niedersachsen", "rheinland-pfalz", "saarland",
];

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Ein Wort/Gemeindename behalten (nach Normalisierung lower) */
function keepAsTerm(normalized: string): boolean {
  if (normalized.length < 2 || normalized.length > 42) return false;
  if (GENERIC_STOP.has(normalized)) return false;
  if (/^\d+$/.test(normalized)) return false;
  if (/^q[m²]|m²|qm$/i.test(normalized)) return false;
  return true;
}

/** Segmente aus Freitext: Komma, Semikolon, Pipe, Slash (vorsichtig) */
function splitLocationChunks(raw: string): string[] {
  const t = raw.trim();
  if (!t) return [];
  const parts = t.split(/[,;|]/).map((p) => p.trim()).filter(Boolean);
  const out: string[] = [];
  for (const p of parts) {
    out.push(p);
    /* "Musterstraße 12 / 12345 Stadt" */
    const slashes = p.split("/").map((x) => x.trim()).filter(Boolean);
    if (slashes.length > 1) out.push(...slashes);
  }
  return out;
}

/** PLZ + Ort → Ort; reine PLZ-Zeilen verwerben */
function stripPlz(segment: string): string {
  const s = segment.trim();
  const m = s.match(/^(?:\d{5})\s+(.+)$/);
  if (m) return m[1].trim();
  if (/^\d{5}$/.test(s)) return "";
  return s;
}

/**
 * Aus einem Feld einen oder mehrere Suchbegriffe ableiten (Anzeige + Matching).
 */
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

function collectFromProperty(p: Property, displayNames: Map<string, string>): void {
  termsFromField(p.location || "", displayNames);
  termsFromField(p.address || "", displayNames);
  /* Objektname oft "MFH Berlin-Mitte" o. Ä. — nur wenn kurz */
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

/** Matching-Strings: Phrasen (mit Leerzeichen) und Einzelbegriffe */
function toMatchTerms(displayNames: Map<string, string>): string[] {
  const terms = new Set<string>();
  for (const key of displayNames.keys()) {
    terms.add(key);
    /* "berlin mitte" → auch "mitte" wenn eindeutig genug */
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

/**
 * Baut Suchbegriffe aus angelegten Objekten und Deals (ohne abgelehnte Deals).
 */
export function buildPortfolioLocationHints(
  properties: Property[],
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

/**
 * Prüft, ob ein Artikeltext zu Portfolio-Orten passt (Wortgrenzen / Phrasen).
 */
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
