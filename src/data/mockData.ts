export interface Property {
  id: string;
  name: string;
  location: string;
  address: string;
  type: string;
  units: number;
  purchasePrice: number;
  purchaseDate: string;
  currentValue: number;
  monthlyRent: number;
  /** Warmmiete (Gesamtmiete) EUR/Monat. Nebenkosten = warmRent - monthlyRent. */
  warmRent?: number | null;
  monthlyExpenses: number;
  monthlyCreditRate: number;
  monthlyCashflow: number;
  remainingDebt: number;
  interestRate: number;
  sqm: number;
  /** Gewerbefläche in m² (vermietet). Vermietete Fläche = sqm + commercialSqm für Kaltmiete/qm. */
  commercialSqm?: number | null;
  yearBuilt: number;
  ownership: "privat" | "egbr";
  /** Parkplätze / Stellplätze (separat vermietbar). */
  parkingUnderground?: number | null;
  parkingStellplatz?: number | null;
  parkingGarage?: number | null;
  /** Gartenfläche (m²) oder Anzahl Gärten. */
  gardenSqm?: number | null;
  /** Sonstiges separat vermietbar (z.B. Keller, Dachterrasse). */
  otherRentableNotes?: string | null;
  /** Verbleibende Nutzungsdauer in Jahren für lineare AfA (nur Gebäudeanteil). */
  restnutzungsdauer?: number | null;
  /** Gebäudeanteil in % des Kaufpreises (Rest = Grund und Boden); Standard 80. */
  buildingSharePercent?: number | null;
}
