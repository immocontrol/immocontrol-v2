/**
 * Entwicklungsplan für unterentwickelte Objekte.
 * Hilft, das Objekt gegenüber der Bank positiv darzustellen: Zeitstrahl mit Mietanpassungen
 * (§558 BGB: 15% oder 20% alle 3 Jahre je nach Mietpreisbremse), Modernisierungen (PV, Dämmung, Sanierung).
 */

/** Angespannte Wohnungsmärkte: hier gilt Kappungsgrenze 15% in 3 Jahren (sonst 20%). */
export const ANGESPANNTE_MÄRKTE = [
  "Berlin", "München", "Hamburg", "Frankfurt", "Köln", "Düsseldorf",
  "Stuttgart", "Freiburg", "Heidelberg", "Regensburg", "Augsburg",
  "Münster", "Bonn", "Darmstadt", "Mainz", "Konstanz", "Tübingen",
  "Potsdam", "Rostock", "Leipzig", "Dresden",
];

const WARTEFRIST_MONATE = 15; // §558 BGB: frühestens 15 Monate nach letzter Erhöhung
const JAHRE_ZWISCHEN_ERHOEHUNG = 3;

export interface PropertyForPlan {
  id: string;
  name: string;
  address?: string;
  location?: string;
  monthlyRent: number;
  sqm: number;
  units: number;
  purchasePrice?: number;
  purchaseDate?: string;
  monthlyExpenses?: number;
  monthlyCreditRate?: number;
}

export interface EntwicklungsplanOptions {
  /** Letzte Mieterhöhung (Datum); wenn nicht gesetzt, wird Kaufdatum genutzt. */
  lastRentAdjustmentDate?: string | null;
  /** Planungszeitraum in Jahren (Default 10). */
  horizonYears?: number;
}

export interface MietanpassungStep {
  yearFromNow: number;
  monthFromNow: number;
  rentBefore: number;
  rentAfter: number;
  increasePercent: number;
  label: string;
}

export interface EntwicklungsplanMassnahme {
  id: string;
  typ: "mietanpassung" | "pv_mieterstrom" | "daemmung" | "wohnungssanierung";
  title: string;
  description: string;
  /** Jahr (ab jetzt) in dem die Maßnahme sinnvoll ist. */
  yearSuggested: number;
  /** Einmalige Kosten (€), falls z.B. Sanierung. */
  costOneTime?: number;
  /** Zusätzliche jährliche Einnahmen (€) nach Umsetzung. */
  revenueAnnual?: number;
  /** Umlegbar auf Mieter (z.B. 8% bei Dämmung §559 BGB). */
  umlegbarPercent?: number;
  /** Geschätzter Mietzuwachs pro Monat (€) bei Sanierung/Wohnung. */
  rentIncreaseMonthly?: number;
}

export interface EntwicklungsplanResult {
  /** Aktuelle Ist-Miete/Monat. */
  istMieteMonat: number;
  /** Kappungsgrenze in % (15 oder 20). */
  kappungsgrenzePercent: number;
  /** Ob angespannter Wohnungsmarkt (Mietpreisbremse). */
  angespanntMarkt: boolean;
  /** Nächste mögliche Anpassung (Monate ab heute). */
  naechsteAnpassungInMonaten: number;
  /** Zeitstrahl: Miete pro Jahr (Jahr 0 = jetzt). */
  mieteProJahr: { year: number; mieteMonat: number; mieteJahr: number; label?: string }[];
  /** Geplante Mietanpassungsschritte. */
  mietanpassungSteps: MietanpassungStep[];
  /** Alle empfohlenen Maßnahmen. */
  massnahmen: EntwicklungsplanMassnahme[];
  /** Geschätzte Miete nach allen Maßnahmen (inkl. Modernisierung) am Ende des Horizonts. */
  zielMieteMonat: number;
}

function isAngespanntMarkt(location: string): boolean {
  const loc = (location || "").toLowerCase();
  return ANGESPANNTE_MÄRKTE.some(m => loc.includes(m.toLowerCase()));
}

/**
 * Berechnet den Entwicklungsplan für ein Objekt: Mietanpassungen (15% oder 20% alle 3 Jahre)
 * und empfohlene wertsteigernde Maßnahmen (PV, Dämmung, Wohnungssanierung).
 */
export function computeEntwicklungsplan(
  property: PropertyForPlan,
  options: EntwicklungsplanOptions = {}
): EntwicklungsplanResult {
  const location = [property.address, property.location].filter(Boolean).join(" ") || "";
  const angespannt = isAngespanntMarkt(location);
  const kappungsgrenzePercent = angespannt ? 15 : 20;
  const horizonYears = options.horizonYears ?? 10;
  const lastAdjustment = options.lastRentAdjustmentDate || property.purchaseDate || "";
  const now = new Date();
  const lastDate = lastAdjustment ? new Date(lastAdjustment) : now;
  const monthsSinceLast = (now.getFullYear() - lastDate.getFullYear()) * 12 + (now.getMonth() - lastDate.getMonth());
  const naechsteAnpassungInMonaten = Math.max(0, WARTEFRIST_MONATE - monthsSinceLast);

  let rentCurrent = property.monthlyRent || 0;
  const mieteProJahr: EntwicklungsplanResult["mieteProJahr"] = [];
  const mietanpassungSteps: MietanpassungStep[] = [];

  // Schritte: erste Erhöhung bei naechsteAnpassungInMonaten, dann alle 36 Monate
  let nextIncreaseMonth = naechsteAnpassungInMonaten;
  let rentAfterSteps = rentCurrent;
  const multiplier = 1 + kappungsgrenzePercent / 100;

  for (let step = 0; step <= Math.ceil(horizonYears / JAHRE_ZWISCHEN_ERHOEHUNG) + 1; step++) {
    const monthAtStep = step === 0 ? 0 : nextIncreaseMonth + (step - 1) * JAHRE_ZWISCHEN_ERHOEHUNG * 12;
    if (monthAtStep > horizonYears * 12) break;
    if (step > 0) {
      const rentBefore = rentAfterSteps;
      rentAfterSteps = rentAfterSteps * multiplier;
      mietanpassungSteps.push({
        yearFromNow: Math.floor(monthAtStep / 12),
        monthFromNow: monthAtStep,
        rentBefore,
        rentAfter: rentAfterSteps,
        increasePercent: kappungsgrenzePercent,
        label: `Mietanpassung §558: +${kappungsgrenzePercent}%`,
      });
    }
  }

  // Miete pro Jahr: am Ende des Jahres gültiger Wert (nach allen bis dahin fälligen Erhöhungen)
  for (let y = 0; y <= horizonYears; y++) {
    const monthEndOfYear = (y + 1) * 12 - 1;
    let mieteThisYear = rentCurrent;
    let label: string | undefined;
    for (const s of mietanpassungSteps) {
      if (s.monthFromNow <= monthEndOfYear) {
        mieteThisYear = s.rentAfter;
        if (s.yearFromNow === y) label = `+${kappungsgrenzePercent}%`;
      }
    }
    mieteProJahr.push({
      year: y,
      mieteMonat: mieteThisYear,
      mieteJahr: mieteThisYear * 12,
      label,
    });
  }

  // Maßnahmen-Katalog (wertsteigernd)
  const massnahmen: EntwicklungsplanMassnahme[] = [];

  const zielMieteMonat = mieteProJahr.length > 0 ? mieteProJahr[mieteProJahr.length - 1].mieteMonat : property.monthlyRent;

  // 1. Mietanpassungen (bereits im Zeitstrahl)
  if (mietanpassungSteps.length > 0) {
    massnahmen.push({
      id: "mietanpassung",
      typ: "mietanpassung",
      title: "Mietanpassung §558 BGB",
      description: `Kappungsgrenze ${kappungsgrenzePercent}% in 3 Jahren${angespannt ? " (angespannter Markt)" : ""}. Nächste Anpassung in ${naechsteAnpassungInMonaten} Monaten.`,
      yearSuggested: Math.ceil(naechsteAnpassungInMonaten / 12),
      revenueAnnual: (zielMieteMonat - property.monthlyRent) * 12,
    });
  }

  // 2. PV + Speicher Mieterstrom
  if (property.sqm > 0) {
    const geschaetzteKwp = Math.min(30, Math.max(5, Math.floor(property.sqm / 20)));
    massnahmen.push({
      id: "pv_mieterstrom",
      typ: "pv_mieterstrom",
      title: "PV-Anlage mit Speicher (Mieterstrom)",
      description: `Geschätzt ${geschaetzteKwp} kWp: zusätzliche Einnahmen durch Mieterstrom, bessere Energiebilanz.`,
      yearSuggested: 1,
      costOneTime: geschaetzteKwp * 1500,
      revenueAnnual: geschaetzteKwp * 200,
    });
  }

  // 3. Dämmung (§559 BGB: 8% der Kosten umlegbar)
  massnahmen.push({
    id: "daemmung",
    typ: "daemmung",
    title: "Dämmungsmaßnahmen",
    description: "Fassade/Dach: bis zu 8% der Modernisierungskosten pro Jahr auf Mieter umlegbar (§559 BGB).",
    yearSuggested: 2,
    costOneTime: property.sqm ? property.sqm * 150 : undefined,
    umlegbarPercent: 8,
  });

  // 4. Wohnungssanierung bei Auszug
  const rentIncreaseSanierung = property.monthlyRent > 0 && property.units > 0
    ? (property.monthlyRent / property.units) * 0.15
    : 200;
  massnahmen.push({
    id: "wohnungssanierung",
    typ: "wohnungssanierung",
    title: "Wohnungssanierung bei Auszug",
    description: "Bei Leerstand: Sanierung und teurere Neuvermietung (ortsüblich).",
    yearSuggested: 3,
    costOneTime: property.sqm && property.units ? (property.sqm / property.units) * 8000 : 15000,
    rentIncreaseMonthly: rentIncreaseSanierung * property.units,
    revenueAnnual: rentIncreaseSanierung * property.units * 12,
  });

  return {
    istMieteMonat: property.monthlyRent,
    kappungsgrenzePercent,
    angespanntMarkt: angespannt,
    naechsteAnpassungInMonaten,
    mieteProJahr,
    mietanpassungSteps,
    massnahmen,
    zielMieteMonat,
  };
}
