/**
 * AfA (Absetzung für Abnutzung) und 15%-Sanierungsregel für Immobilien.
 * Nur der Gebäudeanteil ist abschreibbar; Grund und Boden nicht.
 */

export interface PropertyAfaInput {
  purchasePrice: number;
  yearBuilt?: number;
  /** Gebäudeanteil in % (Rest = Grund und Boden). Default 80. */
  buildingSharePercent?: number | null;
  /** Restnutzungsdauer in Jahren für lineare AfA. Wenn gesetzt, wird diese statt AfA-Satz genutzt. */
  restnutzungsdauer?: number | null;
}

/** Gebäudeanteil in Euro (nur dieser ist abschreibbar). */
export function getGebaeudeAnteil(p: PropertyAfaInput): number {
  const share = (p.buildingSharePercent ?? 80) / 100;
  return p.purchasePrice * share;
}

/** Grund und Boden in Euro (nicht abschreibbar). */
export function getGrundUndBoden(p: PropertyAfaInput): number {
  return p.purchasePrice - getGebaeudeAnteil(p);
}

/** Jährlicher AfA-Satz in % (2%, 2,5% oder 3% je nach Baujahr, oder 100/Restnutzungsdauer). */
export function getAfaRatePercent(p: PropertyAfaInput): number {
  if (p.restnutzungsdauer != null && p.restnutzungsdauer > 0) {
    return 100 / p.restnutzungsdauer;
  }
  const year = p.yearBuilt ?? 1970;
  if (year >= 2023) return 3;
  if (year < 1925) return 2.5;
  return 2;
}

/** Jährliche AfA in Euro (nur Gebäudeanteil, linear). */
export function getAnnualAfa(p: PropertyAfaInput): number {
  const gebaeude = getGebaeudeAnteil(p);
  const ratePercent = getAfaRatePercent(p);
  return gebaeude * (ratePercent / 100);
}

/**
 * 15%-Sanierungsregel: Maximaler abzugsfähiger Betrag (Netto) in den ersten 3 Jahren = 15 % des Gebäudeanteils.
 * Bruttobetrag inkl. 19 % MwSt. = Netto * 1,19 (wie viel du brutto ausgeben darfst, damit 15 % Gebäudeanteil nicht überschritten wird).
 */
export function getSanierung15PercentBrutto(p: PropertyAfaInput): number {
  const gebaeude = getGebaeudeAnteil(p);
  const nettoMax = gebaeude * 0.15;
  return nettoMax * 1.19;
}

/** Max. abzugsfähige Sanierungskosten (Netto) in den ersten 3 Jahren = 15 % des Gebäudeanteils. */
export function getSanierung15PercentNetto(p: PropertyAfaInput): number {
  return getGebaeudeAnteil(p) * 0.15;
}
