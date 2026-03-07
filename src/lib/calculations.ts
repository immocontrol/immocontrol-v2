/**
 * Zentrale Kennzahlen-Berechnungen für Immobilien (Rendite, Mietmultiplikator, etc.).
 * Vermeidet doppelte Formeln in PropertyDetail, PropertyCard, ObjekteList, Dashboard, etc.
 */

/** Brutto-Rendite in % (Jahresmiete / Kaufpreis). */
export function calcBruttoRendite(purchasePrice: number, monthlyRent: number): number {
  if (!purchasePrice || !Number.isFinite(monthlyRent)) return 0;
  return (monthlyRent * 12 / purchasePrice) * 100;
}

/** Netto-Rendite in % ((Jahresmiete - Jahresausgaben) / Kaufpreis). */
export function calcNettoRendite(
  purchasePrice: number,
  monthlyRent: number,
  monthlyExpenses: number
): number {
  if (!purchasePrice || !Number.isFinite(monthlyRent)) return 0;
  return ((monthlyRent - (monthlyExpenses || 0)) * 12 / purchasePrice) * 100;
}

/** Mietmultiplikator (Kaufpreis / Jahresmiete). */
export function calcMietmultiplikator(purchasePrice: number, monthlyRent: number): number {
  if (!monthlyRent || monthlyRent <= 0 || !Number.isFinite(purchasePrice)) return 0;
  return purchasePrice / (monthlyRent * 12);
}

/** Monatlicher Cashflow (Miete - Kosten - Rate). */
export function calcMonthlyCashflow(
  monthlyRent: number,
  monthlyExpenses: number,
  monthlyCreditRate: number
): number {
  const r = Number(monthlyRent) || 0;
  const e = Number(monthlyExpenses) || 0;
  const c = Number(monthlyCreditRate) || 0;
  return r - e - c;
}

/** DSCR = Debt Service Coverage Ratio (Netto-Miete / Kapitaldienst). Ab 1,2 tragfähig. */
export function calcDSCR(
  monthlyRent: number,
  monthlyExpenses: number,
  monthlyCreditRate: number
): number {
  const rate = Number(monthlyCreditRate) || 0;
  if (rate <= 0) return 0;
  const noi = (Number(monthlyRent) || 0) - (Number(monthlyExpenses) || 0);
  return noi / rate;
}
