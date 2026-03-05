/**
 * Hockey Stick Simulator — AI Natural Language Parser
 * Extracted from HockeyStickSimulator.tsx for modularity.
 * Parses German natural language input into SimParams.
 */
import { type SimParams, SCENARIOS } from "./hockeyStickEngine";

/** Market-typical defaults used when user doesn't specify a parameter */
export const MARKET_DEFAULTS: Partial<SimParams> = {
  startCapital: 50000,
  monthlyInvestment: 500,
  years: 20,
  rentYield: 4,
  annualReturn: 3.5,
  leverageRatio: 75,
  annualAppreciation: 2,
  vacancyRate: 3,
  maintenancePct: 1,
  inflationRate: 2,
  taxRate: 25,
  rentGrowthRate: 1.5,
  managementFee: 5,
  insurancePct: 0.2,
};

export interface AiParseResult {
  updates: Partial<SimParams>;
  parsed: string[];
  assumed: string[];
  description: string;
}

/** Parse a German-style number (supports both , and . as decimal separator) */
/* FIX-1: Use global /,/g to replace ALL commas */
const parseNum = (s: string) => parseFloat(s.replace(/,/g, "."));

/** Normalize text: remove thousand-separator dots, keep decimal dots */
function normalizeText(input: string): string {
  return input.toLowerCase().replace(/\./g, (m, offset, str) => {
    const before = str[offset - 1];
    const after = str[offset + 1];
    if (before && /\d/.test(before) && after && /\d/.test(after)) {
      const afterDigits = str.slice(offset + 1).match(/^\d+/);
      if (afterDigits && afterDigits[0].length === 3) return "";
    }
    return m;
  });
}

/** Try to match a pattern pair (number-first and keyword-first) */
function matchPattern(
  text: string,
  patterns: RegExp[],
  existing: number | undefined,
): number | null {
  if (existing !== undefined) return null;
  for (const pat of patterns) {
    const m = text.match(pat);
    if (m) {
      const isReverse = /^[a-zäöü]/i.test(m[1]);
      return parseNum(isReverse ? m[2] : m[1]);
    }
  }
  return null;
}

/**
 * Parse natural language input into simulation parameters.
 * Returns explicit + market defaults merged (explicit takes priority).
 * This means using the AI field creates a fresh scenario with defaults for unmentioned params.
 */
export function parseAiPrompt(rawInput: string): AiParseResult {
  const text = normalizeText(rawInput);
  const explicitUpdates: Partial<SimParams> = {};

  /* ── Capital ── */
  const capitalPatterns = [
    /(\d+[.,]?\d*)\s*(k|tsd|tausend)?\s*(euro|€|eur|startkapital|eigenkapital|budget|kapital)/i,
    /(startkapital|eigenkapital|budget|kapital)[:\s]*(\d+[.,]?\d*)\s*(k|tsd|tausend)?\s*(euro|€|eur)?/i,
  ];
  for (const pat of capitalPatterns) {
    const m = text.match(pat);
    if (m && !explicitUpdates.startCapital) {
      const isReverse = /^[a-zäöü]/i.test(m[1]);
      const numStr = isReverse ? m[2] : m[1];
      const multiplier = isReverse ? m[3] : m[2];
      let val = parseNum(numStr);
      if (multiplier && /^(k|tsd|tausend)$/i.test(multiplier)) val *= 1000;
      explicitUpdates.startCapital = val;
    }
  }

  /* ── Monthly Investment ── */
  const monthlyPatterns = [
    /(\d+[.,]?\d*)\s*(euro|€|eur)?\s*(monat|mtl|pro monat|monthly|sparrate|investition\/m)/i,
    /(monat|mtl|sparrate|monatlich)[:\s]*(\d+[.,]?\d*)\s*(euro|€|eur)?/i,
  ];
  const monthly = matchPattern(text, monthlyPatterns, explicitUpdates.monthlyInvestment);
  if (monthly !== null) explicitUpdates.monthlyInvestment = monthly;

  /* ── Years ── */
  const yearPatterns = [
    /(\d+)\s*(jahre?|j\.|year|laufzeit)/i,
    /(laufzeit|zeitraum|dauer)[:\s]*(\d+)/i,
  ];
  for (const pat of yearPatterns) {
    const m = text.match(pat);
    if (m && !explicitUpdates.years) {
      const isReverse = /^[a-zäöü]/i.test(m[1]);
      explicitUpdates.years = parseInt(isReverse ? m[2] : m[1]);
    }
  }

  /* ── Rent Yield ── */
  const renditePatterns = [
    /(\d+[.,]?\d*)\s*%?\s*(rendite|mietrendite|yield|brutto)/i,
    /(rendite|mietrendite|yield)[:\s]*(\d+[.,]?\d*)\s*%?/i,
  ];
  const rendite = matchPattern(text, renditePatterns, explicitUpdates.rentYield);
  if (rendite !== null) explicitUpdates.rentYield = rendite;

  /* ── Interest Rate ── */
  const zinsPatterns = [
    /(\d+[.,]?\d*)\s*%?\s*(zins|zinssatz|interest|darlehenszins)/i,
    /(zins|zinssatz|darlehenszins)[:\s]*(\d+[.,]?\d*)\s*%?/i,
  ];
  const zins = matchPattern(text, zinsPatterns, explicitUpdates.annualReturn);
  if (zins !== null) explicitUpdates.annualReturn = zins;

  /* ── Leverage ── */
  const hebelPatterns = [
    /(\d+[.,]?\d*)\s*%?\s*(hebel|fremdkapital|leverage|fk-quote|fk)/i,
    /(hebel|fremdkapital|leverage|fk-quote|fk)[:\s]*(\d+[.,]?\d*)\s*%?/i,
  ];
  const hebel = matchPattern(text, hebelPatterns, explicitUpdates.leverageRatio);
  if (hebel !== null) explicitUpdates.leverageRatio = hebel;

  /* ── Appreciation ── */
  const wertPatterns = [
    /(\d+[.,]?\d*)\s*%?\s*(wertsteigerung|appreciation|wachstum)/i,
    /(wertsteigerung|appreciation|wachstum)[:\s]*(\d+[.,]?\d*)\s*%?/i,
  ];
  const wert = matchPattern(text, wertPatterns, explicitUpdates.annualAppreciation);
  if (wert !== null) explicitUpdates.annualAppreciation = wert;

  /* ── Keyword-based scenario defaults ── */
  const applyScenarioDefaults = (scenarioParams: Partial<SimParams>) => {
    for (const [k, v] of Object.entries(scenarioParams)) {
      if (!(k in explicitUpdates)) (explicitUpdates as Record<string, unknown>)[k] = v;
    }
  };
  if (text.includes("konservativ") || text.includes("sicher") || text.includes("vorsichtig")) {
    applyScenarioDefaults(SCENARIOS[0].params);
  } else if (text.includes("aggressiv") || text.includes("riskant") || text.includes("maximal")) {
    applyScenarioDefaults(SCENARIOS[2].params);
  } else if (/\bcashflow\b/.test(text) || /\bmiete\b/.test(text)) {
    applyScenarioDefaults(SCENARIOS[3].params);
  } else if (text.includes("einsteiger") || text.includes("anfang") || text.includes("klein")) {
    applyScenarioDefaults(SCENARIOS[5].params);
  }

  /* ── Merge: explicitly parsed values take priority, then fill gaps with market defaults ── */
  const updates: Partial<SimParams> = { ...MARKET_DEFAULTS, ...explicitUpdates };

  /* ── Build description — use key membership, not value comparison ── */
  const parsed: string[] = [];
  const assumed: string[] = [];

  if (explicitUpdates.startCapital !== undefined)
    parsed.push(`Startkapital: ${explicitUpdates.startCapital.toLocaleString("de-DE")} €`);
  if (explicitUpdates.monthlyInvestment !== undefined)
    parsed.push(`Monatliche Investition: ${explicitUpdates.monthlyInvestment.toLocaleString("de-DE")} €`);
  if (explicitUpdates.years !== undefined)
    parsed.push(`Laufzeit: ${explicitUpdates.years} Jahre`);
  if (explicitUpdates.rentYield !== undefined)
    parsed.push(`Mietrendite: ${explicitUpdates.rentYield}%`);
  if (explicitUpdates.annualReturn !== undefined)
    parsed.push(`Zinssatz: ${explicitUpdates.annualReturn}%`);
  if (explicitUpdates.leverageRatio !== undefined)
    parsed.push(`FK-Quote: ${explicitUpdates.leverageRatio}%`);
  if (explicitUpdates.annualAppreciation !== undefined)
    parsed.push(`Wertsteigerung: ${explicitUpdates.annualAppreciation}% p.a.`);

  if (!parsed.some(p => p.startsWith("Startkapital")))
    assumed.push(`Startkapital: ${(MARKET_DEFAULTS.startCapital ?? 0).toLocaleString("de-DE")} € (marktüblich)`);
  if (!parsed.some(p => p.startsWith("Monatliche")))
    assumed.push(`Monatl. Investition: ${(MARKET_DEFAULTS.monthlyInvestment ?? 0).toLocaleString("de-DE")} € (marktüblich)`);
  if (!parsed.some(p => p.startsWith("Laufzeit")))
    assumed.push(`Laufzeit: ${MARKET_DEFAULTS.years} Jahre (marktüblich)`);
  if (!parsed.some(p => p.startsWith("Mietrendite")))
    assumed.push(`Mietrendite: ${MARKET_DEFAULTS.rentYield}% (marktüblich)`);
  if (!parsed.some(p => p.startsWith("FK-Quote")))
    assumed.push(`FK-Quote: ${MARKET_DEFAULTS.leverageRatio}% (marktüblich)`);
  if (!parsed.some(p => p.startsWith("Wertsteigerung")))
    assumed.push(`Wertsteigerung: ${MARKET_DEFAULTS.annualAppreciation}% p.a. (marktüblich)`);

  const description = `Szenario: "${rawInput.trim()}"\n\n${
    parsed.length > 0 ? "Erkannte Parameter:\n" + parsed.map(a => `• ${a}`).join("\n") + "\n\n" : ""
  }Marktübliche Annahmen:\n${assumed.map(a => `• ${a}`).join("\n")}`;

  return { updates, parsed, assumed, description };
}
