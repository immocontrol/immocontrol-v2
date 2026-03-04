/**
 * Expose PDF Parser — extracts structured property data from German real estate Expose PDFs.
 * Uses regex patterns for common German Expose formats (ImmoScout24, Immowelt, Makler-PDFs).
 */

export interface ParsedExposeData {
  /** Full address string */
  address: string;
  /** Street name + number */
  strasse: string;
  /** Postal code */
  plz: string;
  /** City name */
  ort: string;
  /** Living area in m² */
  wohnflaeche: number;
  /** Plot area in m² */
  grundstueckFlaeche: number;
  /** Year of construction */
  baujahr: number;
  /** Number of rooms */
  zimmer: number;
  /** Purchase price in EUR */
  kaufpreis: number;
  /** Monthly cold rent in EUR */
  kaltmiete: number;
  /** Property type */
  immobilientyp: "EFH" | "DHH" | "RMH" | "REH" | "MFH" | "ETW" | "Bungalow" | "Villa" | "Sonstige";
  /** Condition */
  zustand: "Erstbezug" | "Neuwertig" | "Modernisiert" | "Gepflegt" | "Renovierungsbeduerftig" | "Unbekannt";
  /** Equipment quality */
  ausstattung: "Einfach" | "Normal" | "Gehoben" | "Stark gehoben" | "Unbekannt";
  /** Number of floors */
  etagen: number;
  /** Floor level (for apartments) */
  etage: number;
  /** Parking spaces */
  stellplaetze: number;
  /** Has balcony/terrace */
  balkon: boolean;
  /** Has garden */
  garten: boolean;
  /** Has elevator */
  aufzug: boolean;
  /** Has cellar */
  keller: boolean;
  /** Energy certificate value kWh/(m²*a) */
  energiekennwert: number;
  /** Raw extracted text for reference */
  rawText: string;
  /** Confidence score 0-100 */
  confidence: number;
  /** Fields that were successfully extracted */
  extractedFields: string[];
}

/** Helper to extract a numeric value from text using a regex */
function extractNumber(text: string, patterns: RegExp[]): number {
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      // Handle German number format: 1.234,56 → 1234.56
      const raw = match[1].replace(/\./g, "").replace(",", ".");
      const num = parseFloat(raw);
      if (!isNaN(num) && isFinite(num)) return num;
    }
  }
  return 0;
}

/** Helper to check if text contains any of the keywords (case-insensitive) */
function containsAny(text: string, keywords: string[]): boolean {
  const lower = text.toLowerCase();
  return keywords.some(k => lower.includes(k.toLowerCase()));
}

/** Extract address components from text */
function extractAddress(text: string): { strasse: string; plz: string; ort: string } {
  let strasse = "";
  let plz = "";
  let ort = "";

  // Pattern: "Straße Nr, PLZ Ort" or "Straße Nr\nPLZ Ort"
  const fullAddr = text.match(
    /([A-ZÄÖÜ][a-zäöüß]+(?:[-\s][A-ZÄÖÜa-zäöüß]+)*(?:str(?:aße|\.)?|weg|allee|platz|ring|damm|gasse|ufer|chaussee)\s*\d+\s*[a-z]?)\s*[,\n]\s*(\d{5})\s+([A-ZÄÖÜ][a-zäöüß]+(?:\s[A-ZÄÖÜa-zäöüß]+)*)/i
  );
  if (fullAddr) {
    strasse = fullAddr[1].trim();
    plz = fullAddr[2];
    ort = fullAddr[3].trim();
    return { strasse, plz, ort };
  }

  // Try just PLZ + Ort
  const plzOrt = text.match(/(\d{5})\s+([A-ZÄÖÜ][a-zäöüß]+(?:[\s-][A-ZÄÖÜa-zäöüß]+)*)/);
  if (plzOrt) {
    plz = plzOrt[1];
    ort = plzOrt[2].trim();
  }

  // Try street separately
  const street = text.match(
    /([A-ZÄÖÜ][a-zäöüß]+(?:[-\s][A-ZÄÖÜa-zäöüß]+)*(?:str(?:aße|\.)?|weg|allee|platz|ring|damm|gasse|ufer|chaussee)\s*\d+\s*[a-z]?)/i
  );
  if (street) {
    strasse = street[1].trim();
  }

  // Try "Lage:" or "Standort:" or "Adresse:" sections
  const lageMatch = text.match(/(?:Lage|Standort|Adresse|Objekt(?:adresse)?)\s*[:]\s*([^\n]{5,80})/i);
  if (lageMatch && !strasse && !ort) {
    const lageText = lageMatch[1].trim();
    const innerPlz = lageText.match(/(\d{5})\s+([A-ZÄÖÜ][a-zäöüß]+)/);
    if (innerPlz) {
      plz = plz || innerPlz[1];
      ort = ort || innerPlz[2].trim();
    }
  }

  return { strasse, plz, ort };
}

/** Detect property type from text */
function detectImmobilientyp(text: string): ParsedExposeData["immobilientyp"] {
  const lower = text.toLowerCase();
  if (lower.includes("einfamilienhaus") || lower.includes("efh")) return "EFH";
  if (lower.includes("doppelhaushälfte") || lower.includes("dhh")) return "DHH";
  if (lower.includes("reihenmittelhaus") || lower.includes("rmh")) return "RMH";
  if (lower.includes("reihenendhaus") || lower.includes("reh")) return "REH";
  if (lower.includes("mehrfamilienhaus") || lower.includes("mfh") || lower.includes("zinshaus") || lower.includes("renditeobj")) return "MFH";
  if (lower.includes("eigentumswohnung") || lower.includes("etw") || lower.includes("wohnung")) return "ETW";
  if (lower.includes("bungalow")) return "Bungalow";
  if (lower.includes("villa")) return "Villa";
  return "Sonstige";
}

/** Detect property condition from text */
function detectZustand(text: string): ParsedExposeData["zustand"] {
  const lower = text.toLowerCase();
  if (lower.includes("erstbezug")) return "Erstbezug";
  if (lower.includes("neuwertig")) return "Neuwertig";
  if (lower.includes("modernisiert") || lower.includes("kernsaniert") || lower.includes("saniert")) return "Modernisiert";
  if (lower.includes("gepflegt") || lower.includes("gut erhalten")) return "Gepflegt";
  if (lower.includes("renovierungsbedürftig") || lower.includes("sanierungsbedürftig") || lower.includes("renovierungsbed")) return "Renovierungsbeduerftig";
  return "Unbekannt";
}

/** Detect equipment quality from text */
function detectAusstattung(text: string): ParsedExposeData["ausstattung"] {
  const lower = text.toLowerCase();
  if (lower.includes("stark gehoben") || lower.includes("luxus") || lower.includes("exklusiv")) return "Stark gehoben";
  if (lower.includes("gehoben") || lower.includes("hochwertig")) return "Gehoben";
  if (lower.includes("einfach") || lower.includes("standard")) return "Einfach";
  if (lower.includes("normal") || lower.includes("mittel") || lower.includes("zeitgemäß")) return "Normal";
  return "Unbekannt";
}

/** Main parser: extract structured data from raw Expose text */
export function parseExposeText(rawText: string): ParsedExposeData {
  const text = rawText.replace(/\s+/g, " ").trim();
  const extractedFields: string[] = [];

  // Address
  const addr = extractAddress(rawText);
  if (addr.strasse) extractedFields.push("strasse");
  if (addr.plz) extractedFields.push("plz");
  if (addr.ort) extractedFields.push("ort");

  // Wohnflaeche
  const wohnflaeche = extractNumber(text, [
    /Wohnfläche\s*[:.]?\s*([\d.,]+)\s*m/i,
    /Wfl\.?\s*[:.]?\s*([\d.,]+)\s*m/i,
    /ca\.?\s*([\d.,]+)\s*m²?\s*Wohn/i,
    /Wohnraum\s*[:.]?\s*([\d.,]+)\s*m/i,
    /Gesamtfläche\s*[:.]?\s*([\d.,]+)\s*m/i,
  ]);
  if (wohnflaeche > 0) extractedFields.push("wohnflaeche");

  // Grundstueckflaeche
  const grundstueckFlaeche = extractNumber(text, [
    /Grundstücksfläche\s*[:.]?\s*([\d.,]+)\s*m/i,
    /Grundstück\s*[:.]?\s*([\d.,]+)\s*m/i,
    /GrdSt\.?\s*[:.]?\s*([\d.,]+)\s*m/i,
    /Grundfl\.?\s*[:.]?\s*([\d.,]+)\s*m/i,
  ]);
  if (grundstueckFlaeche > 0) extractedFields.push("grundstueckFlaeche");

  // Baujahr
  const baujahr = extractNumber(text, [
    /Baujahr\s*[:.]?\s*(\d{4})/i,
    /Bj\.?\s*[:.]?\s*(\d{4})/i,
    /(?:erbaut|errichtet)\s*(?:im\s*Jahr\s*)?[:.]?\s*(\d{4})/i,
    /Fertigstellung\s*[:.]?\s*(\d{4})/i,
  ]);
  if (baujahr > 1800 && baujahr <= new Date().getFullYear() + 5) extractedFields.push("baujahr");

  // Zimmer
  const zimmer = extractNumber(text, [
    /Zimmer\s*[:.]?\s*([\d.,]+)/i,
    /([\d.,]+)\s*Zi(?:mmer)?\.?/i,
    /Räume\s*[:.]?\s*([\d.,]+)/i,
    /Anzahl\s*Zimmer\s*[:.]?\s*([\d.,]+)/i,
  ]);
  if (zimmer > 0) extractedFields.push("zimmer");

  // Kaufpreis
  const kaufpreis = extractNumber(text, [
    /Kaufpreis\s*[:.]?\s*([\d.,]+)\s*(?:€|EUR)/i,
    /Preis\s*[:.]?\s*([\d.,]+)\s*(?:€|EUR)/i,
    /Angebotspreis\s*[:.]?\s*([\d.,]+)\s*(?:€|EUR)/i,
    /([\d.,]+)\s*(?:€|EUR)\s*(?:Kaufpreis|VHB|Festpreis)/i,
    /Kaufpreis\s*[:.]?\s*(?:€|EUR)\s*([\d.,]+)/i,
  ]);
  if (kaufpreis > 0) extractedFields.push("kaufpreis");

  // Kaltmiete
  const kaltmiete = extractNumber(text, [
    /Kaltmiete\s*[:.]?\s*([\d.,]+)\s*(?:€|EUR)/i,
    /Nettokaltmiete\s*[:.]?\s*([\d.,]+)\s*(?:€|EUR)/i,
    /Miete\s*(?:kalt)?\s*[:.]?\s*([\d.,]+)\s*(?:€|EUR)/i,
    /Mieteinnahmen\s*[:.]?\s*([\d.,]+)\s*(?:€|EUR)/i,
    /Ist-Miete\s*[:.]?\s*([\d.,]+)\s*(?:€|EUR)/i,
    /Jahresnettokaltmiete\s*[:.]?\s*([\d.,]+)\s*(?:€|EUR)/i,
  ]);
  if (kaltmiete > 0) extractedFields.push("kaltmiete");

  // Property type
  const immobilientyp = detectImmobilientyp(text);
  if (immobilientyp !== "Sonstige") extractedFields.push("immobilientyp");

  // Condition
  const zustand = detectZustand(text);
  if (zustand !== "Unbekannt") extractedFields.push("zustand");

  // Equipment quality
  const ausstattung = detectAusstattung(text);
  if (ausstattung !== "Unbekannt") extractedFields.push("ausstattung");

  // Etagen
  const etagen = extractNumber(text, [
    /(?:Anzahl\s*)?(?:Etagen|Geschosse)\s*[:.]?\s*(\d+)/i,
    /(\d+)\s*(?:Etagen|Geschosse|stöckig)/i,
  ]);
  if (etagen > 0) extractedFields.push("etagen");

  // Etage (for apartments)
  const etage = extractNumber(text, [
    /Etage\s*[:.]?\s*(\d+)/i,
    /(\d+)\.\s*(?:OG|Obergeschoss|Etage)/i,
    /(?:Lage\s*im\s*)?(\d+)\.\s*Stock/i,
  ]);
  if (etage > 0) extractedFields.push("etage");

  // Stellplaetze
  const stellplaetze = extractNumber(text, [
    /Stellplätze?\s*[:.]?\s*(\d+)/i,
    /(\d+)\s*Stellpl/i,
    /Garage\s*[:.]?\s*(\d+)/i,
    /Parkplätze?\s*[:.]?\s*(\d+)/i,
    /(\d+)\s*(?:Garage|Carport|Tiefgarage)/i,
  ]);
  if (stellplaetze > 0) extractedFields.push("stellplaetze");

  // Boolean features
  const balkon = containsAny(text, ["Balkon", "Terrasse", "Loggia", "Dachterrasse"]);
  const garten = containsAny(text, ["Garten", "Gartenanteil", "Grünfläche"]);
  const aufzug = containsAny(text, ["Aufzug", "Fahrstuhl", "Lift", "Personenaufzug"]);
  const keller = containsAny(text, ["Keller", "Kellerraum", "Unterkellerung", "Souterrain"]);
  if (balkon) extractedFields.push("balkon");
  if (garten) extractedFields.push("garten");
  if (aufzug) extractedFields.push("aufzug");
  if (keller) extractedFields.push("keller");

  // Energiekennwert
  const energiekennwert = extractNumber(text, [
    /Energiekennwert\s*[:.]?\s*([\d.,]+)\s*kWh/i,
    /Endenergiebedarf\s*[:.]?\s*([\d.,]+)\s*kWh/i,
    /([\d.,]+)\s*kWh\s*\/\s*\(?\s*m²/i,
    /Energieverbrauch\s*[:.]?\s*([\d.,]+)/i,
  ]);
  if (energiekennwert > 0) extractedFields.push("energiekennwert");

  // Build full address
  const addressParts = [addr.strasse, addr.plz && addr.ort ? `${addr.plz} ${addr.ort}` : addr.ort].filter(Boolean);
  const address = addressParts.join(", ");
  if (address) extractedFields.push("address");

  // Confidence score based on how many fields we extracted
  const maxFields = 15;
  const confidence = Math.min(100, Math.round((extractedFields.length / maxFields) * 100));

  return {
    address,
    strasse: addr.strasse,
    plz: addr.plz,
    ort: addr.ort,
    wohnflaeche,
    grundstueckFlaeche,
    baujahr: baujahr > 1800 ? baujahr : 0,
    zimmer,
    kaufpreis,
    kaltmiete,
    immobilientyp,
    zustand,
    ausstattung,
    etagen,
    etage,
    stellplaetze,
    balkon,
    garten,
    aufzug,
    keller,
    energiekennwert,
    rawText,
    confidence,
    extractedFields,
  };
}

/** Extract text from a PDF file using pdfjs-dist */
export async function extractPdfText(file: File): Promise<string> {
  const pdfjsLib = await import("pdfjs-dist");
  pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;

  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

  const pages: string[] = [];
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    const text = content.items
      .map((item: { str?: string }) => item.str || "")
      .join(" ");
    pages.push(text.trim());
  }

  return pages.filter(Boolean).join("\n\n");
}
