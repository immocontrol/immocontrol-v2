/**
 * FUND-22: DATEV export for tax advisors — generates CSV files compatible
 * with DATEV Unternehmen Online (Buchungsstapel format).
 *
 * Format: DATEV-Header + semicolon-separated booking records.
 * Encoding: Windows-1252 (ANSI) as required by DATEV.
 */

export interface DatevBooking {
  /** Umsatz (Betrag) */
  amount: number;
  /** Soll (S) oder Haben (H) */
  debitCredit: "S" | "H";
  /** Gegenkonto */
  counterAccount: string;
  /** Buchungsdatum (DDMM) */
  date: string;
  /** Buchungstext */
  description: string;
  /** Belegfeld 1 (Rechnungsnummer) */
  receiptField1?: string;
  /** Konto */
  account: string;
  /** Kostenstelle */
  costCenter?: string;
}

interface DatevExportOptions {
  /** Berater-Nummer */
  consultantNumber: string;
  /** Mandanten-Nummer */
  clientNumber: string;
  /** Wirtschaftsjahr-Beginn (YYYYMMDD) */
  fiscalYearStart: string;
  /** Buchungen */
  bookings: DatevBooking[];
  /** Export-Zeitraum von (YYYYMMDD) */
  periodFrom: string;
  /** Export-Zeitraum bis (YYYYMMDD) */
  periodTo: string;
}

/**
 * FUND-22: Generate DATEV Buchungsstapel CSV content.
 * Returns a string in DATEV-compatible format.
 */
export function generateDatevCSV(options: DatevExportOptions): string {
  const {
    consultantNumber,
    clientNumber,
    fiscalYearStart,
    bookings,
    periodFrom,
    periodTo,
  } = options;

  const now = new Date();
  const timestamp = [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, "0"),
    String(now.getDate()).padStart(2, "0"),
    String(now.getHours()).padStart(2, "0"),
    String(now.getMinutes()).padStart(2, "0"),
    String(now.getSeconds()).padStart(2, "0"),
  ].join("");

  // DATEV Header row
  const headerRow = [
    '"EXTF"', // Format
    "700", // Version
    "21", // Kategorie (Buchungsstapel)
    '"Buchungsstapel"',
    "12", // Format-Version
    `"${timestamp}"`, // Erzeugt am
    "", // Importiert
    '"RE"', // Herkunft
    '""', // Exportiert von
    '""', // Importiert von
    `"${consultantNumber}"`,
    `"${clientNumber}"`,
    `"${fiscalYearStart}"`,
    "4", // Sachkontenlänge
    `"${periodFrom}"`,
    `"${periodTo}"`,
    '""', // Bezeichnung
    '""', // Diktatkürzel
    "0", // Buchungstyp
    "0", // Rechnungslegungszweck
    "0", // Festschreibung
    '""', // WKZ
  ].join(";");

  // Column headers
  const columnHeaders = [
    "Umsatz (ohne Soll/Haben-Kz)",
    "Soll/Haben-Kennzeichen",
    "WKZ Umsatz",
    "Kurs",
    "Basis-Umsatz",
    "WKZ Basis-Umsatz",
    "Konto",
    "Gegenkonto (ohne BU-Schlüssel)",
    "BU-Schlüssel",
    "Belegdatum",
    "Belegfeld 1",
    "Belegfeld 2",
    "Skonto",
    "Buchungstext",
    "Postensperre",
    "Diverse Adressnummer",
    "Geschäftspartnerbank",
    "Sachverhalt",
    "Zinssperre",
    "Beleglink",
    "Beleginfo - Art 1",
    "Beleginfo - Inhalt 1",
    "Kostenstelle",
  ].map((h) => `"${h}"`).join(";");

  // Booking rows
  const bookingRows = bookings.map((b) => {
    const amount = Math.abs(b.amount).toFixed(2).replace(".", ",");
    return [
      amount,
      b.debitCredit,
      "EUR",
      "", // Kurs
      "", // Basis-Umsatz
      "", // WKZ Basis
      b.account,
      b.counterAccount,
      "", // BU-Schlüssel
      b.date,
      b.receiptField1 ?? "",
      "", // Belegfeld 2
      "", // Skonto
      `"${b.description.replace(/"/g, '""')}"`,
      "", // Postensperre
      "", // Adressnummer
      "", // Geschäftspartnerbank
      "", // Sachverhalt
      "", // Zinssperre
      "", // Beleglink
      "", // Beleginfo Art
      "", // Beleginfo Inhalt
      b.costCenter ?? "",
    ].join(";");
  });

  return [headerRow, columnHeaders, ...bookingRows].join("\r\n");
}

/**
 * FUND-22: Convert monthly rent/expense data to DATEV bookings.
 */
export function rentToDatevBookings(
  properties: Array<{
    name: string;
    monthlyRent: number;
    monthlyExpenses: number;
    propertyId: string;
  }>,
  month: number,
  year: number,
): DatevBooking[] {
  const dateStr = `0101`; // Will be overridden per booking
  const mmStr = String(month).padStart(2, "0");

  return properties.flatMap((p) => {
    const bookings: DatevBooking[] = [];

    // Mieteinnahme
    if (p.monthlyRent > 0) {
      bookings.push({
        amount: p.monthlyRent,
        debitCredit: "S",
        account: "1200", // Bank
        counterAccount: "8100", // Mieteinnahmen
        date: `01${mmStr}`,
        description: `Miete ${p.name} ${mmStr}/${year}`,
        receiptField1: `MIETE-${p.propertyId.slice(0, 8)}-${mmStr}${year}`,
        costCenter: p.propertyId.slice(0, 8),
      });
    }

    // Nebenkosten
    if (p.monthlyExpenses > 0) {
      bookings.push({
        amount: p.monthlyExpenses,
        debitCredit: "H",
        account: "1200", // Bank
        counterAccount: "4210", // Betriebskosten
        date: `01${mmStr}`,
        description: `NK ${p.name} ${mmStr}/${year}`,
        receiptField1: `NK-${p.propertyId.slice(0, 8)}-${mmStr}${year}`,
        costCenter: p.propertyId.slice(0, 8),
      });
    }

    return bookings;
  });
}

/**
 * FUND-22: Download DATEV CSV as file.
 */
export function downloadDatevCSV(content: string, filename: string): void {
  // DATEV expects Windows-1252 (ANSI) encoding — encode manually
  const encoder = new TextEncoder();
  const win1252 = encoder.encode(content);
  const blob = new Blob([win1252], { type: "text/csv;charset=windows-1252" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
