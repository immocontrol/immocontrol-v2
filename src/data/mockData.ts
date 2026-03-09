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
  yearBuilt: number;
  ownership: "privat" | "egbr";
  /** Verbleibende Nutzungsdauer in Jahren für lineare AfA (nur Gebäudeanteil). */
  restnutzungsdauer?: number | null;
  /** Gebäudeanteil in % des Kaufpreises (Rest = Grund und Boden); Standard 80. */
  buildingSharePercent?: number | null;
}
