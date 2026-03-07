/**
 * Zentrale Konstanten für Mietrecht (§558 BGB Mieterhöhung, §559 BGB Modernisierung).
 * Einzige Quelle für Kappungsgrenze, Wartefrist, angespannte Märkte und Modernisierungsumlage.
 * Genutzt von: Entwicklungsplan, RentIncreaseWizard, Mietvertragsverwaltung, MietpreisCheck.
 */

/** §558 BGB: Kappungsgrenze — Miete darf in 3 Jahren max. 20 % steigen (15 % in angespannten Märkten). */
export const KAPPUNGSGRENZE_NORMAL = 20;

/** §558 BGB: Kappungsgrenze in angespannten Wohnungsmärkten (Mietpreisbremse). */
export const KAPPUNGSGRENZE_ANGESPANNT = 15;

/** §558 BGB: Wartefrist — Erhöhung frühestens 15 Monate nach letzter Erhöhung. */
export const WARTEFRIST_MONATE = 15;

/** §559 BGB: Modernisierungsumlage — max. 8 % der Modernisierungskosten pro Jahr auf Mieter umlegbar. */
export const MODERNISIERUNG_UMLAGE_PROZENT = 8;

/** Städte mit angespanntem Wohnungsmarkt (Kappungsgrenze 15 %). */
export const ANGESPANNTE_MÄRKTE = [
  "Berlin", "München", "Hamburg", "Frankfurt", "Köln", "Düsseldorf",
  "Stuttgart", "Freiburg", "Heidelberg", "Regensburg", "Augsburg",
  "Münster", "Bonn", "Darmstadt", "Mainz", "Konstanz", "Tübingen",
  "Potsdam", "Rostock", "Leipzig", "Dresden",
] as const;

/**
 * Prüft, ob ein Standort (Adresse/Ort) in einem angespannten Wohnungsmarkt liegt.
 */
export function isAngespanntMarkt(location: string): boolean {
  const loc = (location || "").toLowerCase();
  return ANGESPANNTE_MÄRKTE.some((m) => loc.includes(m.toLowerCase()));
}

/**
 * Kappungsgrenze in % (15 oder 20) für einen Standort.
 */
export function getKappungsgrenzePercent(angespanntMarkt: boolean): number {
  return angespanntMarkt ? KAPPUNGSGRENZE_ANGESPANNT : KAPPUNGSGRENZE_NORMAL;
}
