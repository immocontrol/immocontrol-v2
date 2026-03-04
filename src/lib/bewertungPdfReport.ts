/**
 * Bewertungs-PDF Report Generator
 * Generates a professional property valuation report using jsPDF.
 */
import { jsPDF } from "jspdf";
import { formatCurrency } from "@/lib/formatters";
import type { ParsedExposeData } from "@/lib/exposeParser";

export interface ValuationResults {
  ertragswert: number;
  sachwert: number;
  vergleichswert: number;
  durchschnitt: number;
  bodenrichtwert: number;
  bodenwert: number;
  jahresRohertrag: number;
  jahresReinertrag: number;
  restnutzungsdauer: number;
  vervielfaeltiger: number;
  herstellungskosten: number;
  altersminderung: number;
  brwToPrice: number;
}

/** Generate a professional PDF valuation report */
export function generateBewertungsPdf(
  data: ParsedExposeData,
  valuation: ValuationResults,
  sparkasseResult?: { requested: boolean; email?: string },
): void {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 20;
  const contentWidth = pageWidth - 2 * margin;
  const footerSpace = 25;
  let y = margin;
  let pageNum = 1;

  /** Check if adding neededHeight would overflow — if so, add a new page */
  const checkPageBreak = (neededHeight: number) => {
    if (y + neededHeight > pageHeight - footerSpace) {
      addFooter();
      doc.addPage();
      pageNum++;
      y = margin;
    }
  };

  const addText = (text: string, x: number, yPos: number, opts?: { fontSize?: number; fontStyle?: string; color?: [number, number, number]; maxWidth?: number }) => {
    doc.setFontSize(opts?.fontSize || 10);
    doc.setFont("helvetica", opts?.fontStyle || "normal");
    if (opts?.color) doc.setTextColor(...opts.color);
    else doc.setTextColor(30, 30, 30);
    doc.text(text, x, yPos, { maxWidth: opts?.maxWidth || contentWidth });
  };

  const addLine = (yPos: number) => {
    doc.setDrawColor(200, 200, 200);
    doc.setLineWidth(0.3);
    doc.line(margin, yPos, pageWidth - margin, yPos);
  };

  const addFooter = () => {
    const footerY = pageHeight - 10;
    addLine(footerY - 3);
    addText("ImmoControl - Immobilien-Schnellbewertung", margin, footerY, { fontSize: 7, color: [180, 180, 180] });
    addText(`Seite ${pageNum} | ${new Date().toLocaleDateString("de-DE")}`, pageWidth - margin - 40, footerY, { fontSize: 7, color: [180, 180, 180] });
  };

  const addSectionHeader = (title: string): number => {
    checkPageBreak(15);
    doc.setFillColor(37, 99, 235);
    doc.rect(margin, y - 1, contentWidth, 8, "F");
    addText(title, margin + 3, y + 4.5, { fontSize: 11, fontStyle: "bold", color: [255, 255, 255] });
    y += 12;
    return y;
  };

  const addKeyValue = (key: string, value: string, highlight = false): number => {
    checkPageBreak(10);
    if (highlight) {
      doc.setFillColor(245, 247, 250);
      doc.rect(margin, y - 3, contentWidth, 7, "F");
    }
    addText(key, margin + 2, y, { fontSize: 9, color: [100, 100, 100] });
    addText(value, margin + contentWidth / 2, y, { fontSize: 9, fontStyle: "bold" });
    y += 7;
    return y;
  };

  // === HEADER ===
  doc.setFillColor(37, 99, 235);
  doc.rect(0, 0, pageWidth, 35, "F");
  addText("ImmoControl", margin, 12, { fontSize: 20, fontStyle: "bold", color: [255, 255, 255] });
  addText("Immobilien-Schnellbewertung", margin, 20, { fontSize: 12, color: [200, 220, 255] });
  addText(`Erstellt am ${new Date().toLocaleDateString("de-DE", { day: "2-digit", month: "long", year: "numeric" })}`, margin, 28, { fontSize: 9, color: [180, 200, 255] });
  y = 45;

  // === OBJECT DATA ===
  addSectionHeader("Objektdaten");

  if (data.address) addKeyValue("Adresse", data.address);
  if (data.immobilientyp !== "Sonstige") addKeyValue("Immobilientyp", data.immobilientyp, true);
  if (data.wohnflaeche > 0) addKeyValue("Wohnflache", `${data.wohnflaeche.toLocaleString("de-DE")} m\u00B2`);
  if (data.grundstueckFlaeche > 0) addKeyValue("Grundstucksflache", `${data.grundstueckFlaeche.toLocaleString("de-DE")} m\u00B2`, true);
  if (data.baujahr > 0) addKeyValue("Baujahr", String(data.baujahr));
  if (data.zimmer > 0) addKeyValue("Zimmer", String(data.zimmer), true);
  if (data.kaufpreis > 0) addKeyValue("Kaufpreis", formatCurrency(data.kaufpreis));
  if (data.kaltmiete > 0) addKeyValue("Kaltmiete / Monat", formatCurrency(data.kaltmiete), true);
  if (data.jahresmiete > 0) addKeyValue("Jahresmiete", formatCurrency(data.jahresmiete));
  if (data.zustand !== "Unbekannt") addKeyValue("Zustand", data.zustand);
  if (data.ausstattung !== "Unbekannt") addKeyValue("Ausstattung", data.ausstattung, true);

  // Features
  const features: string[] = [];
  if (data.balkon) features.push("Balkon/Terrasse");
  if (data.garten) features.push("Garten");
  if (data.aufzug) features.push("Aufzug");
  if (data.keller) features.push("Keller");
  if (data.stellplaetze > 0) features.push(`${data.stellplaetze} Stellplatz/e`);
  if (features.length > 0) addKeyValue("Merkmale", features.join(", "));

  if (data.energiekennwert > 0) addKeyValue("Energiekennwert", `${data.energiekennwert} kWh/(m\u00B2*a)`, true);

  y += 5;

  // === VALUATION PARAMETERS ===
  addSectionHeader("Bewertungsparameter");
  addKeyValue("Bodenrichtwert", `${valuation.bodenrichtwert} EUR/m\u00B2`);
  addKeyValue("Bodenwert", formatCurrency(valuation.bodenwert), true);
  addKeyValue("Jahresrohertrag", formatCurrency(valuation.jahresRohertrag));
  addKeyValue("Jahresreinertrag", formatCurrency(valuation.jahresReinertrag), true);
  addKeyValue("Restnutzungsdauer", `${valuation.restnutzungsdauer} Jahre`);
  addKeyValue("Vervielfaltiger", valuation.vervielfaeltiger.toFixed(2), true);
  addKeyValue("Herstellungskosten", formatCurrency(valuation.herstellungskosten));
  addKeyValue("Altersminderung", `${(valuation.altersminderung * 100).toFixed(1)}%`, true);
  y += 5;

  // === RESULTS ===
  addSectionHeader("Bewertungsergebnisse");

  // Ertragswert
  checkPageBreak(20);
  doc.setFillColor(240, 249, 255);
  doc.rect(margin, y - 2, contentWidth, 14, "F");
  addText("Ertragswertverfahren", margin + 3, y + 3, { fontSize: 9, color: [100, 100, 100] });
  addText(formatCurrency(valuation.ertragswert), margin + 3, y + 9, { fontSize: 13, fontStyle: "bold", color: [37, 99, 235] });
  addText("Basierend auf Mieteinnahmen", margin + contentWidth / 2, y + 6, { fontSize: 8, color: [140, 140, 140] });
  y += 18;

  // Sachwert
  checkPageBreak(20);
  doc.setFillColor(240, 253, 244);
  doc.rect(margin, y - 2, contentWidth, 14, "F");
  addText("Sachwertverfahren", margin + 3, y + 3, { fontSize: 9, color: [100, 100, 100] });
  addText(formatCurrency(valuation.sachwert), margin + 3, y + 9, { fontSize: 13, fontStyle: "bold", color: [22, 163, 74] });
  addText("Basierend auf Herstellungskosten", margin + contentWidth / 2, y + 6, { fontSize: 8, color: [140, 140, 140] });
  y += 18;

  // Vergleichswert
  checkPageBreak(20);
  doc.setFillColor(254, 249, 195);
  doc.rect(margin, y - 2, contentWidth, 14, "F");
  addText("Vergleichswertverfahren", margin + 3, y + 3, { fontSize: 9, color: [100, 100, 100] });
  addText(formatCurrency(valuation.vergleichswert), margin + 3, y + 9, { fontSize: 13, fontStyle: "bold", color: [161, 98, 7] });
  addText("Basierend auf Marktvergleich", margin + contentWidth / 2, y + 6, { fontSize: 8, color: [140, 140, 140] });
  y += 20;

  // === COMBINED RESULT ===
  checkPageBreak(30);
  doc.setFillColor(37, 99, 235);
  doc.rect(margin, y - 2, contentWidth, 22, "F");
  addText("Geschatzter Marktwert (Durchschnitt)", margin + 3, y + 4, { fontSize: 10, color: [200, 220, 255] });
  addText(formatCurrency(valuation.durchschnitt), margin + 3, y + 14, { fontSize: 18, fontStyle: "bold", color: [255, 255, 255] });

  if (data.kaufpreis > 0) {
    const diff = ((valuation.durchschnitt - data.kaufpreis) / data.kaufpreis) * 100;
    const diffText = `${diff >= 0 ? "+" : ""}${diff.toFixed(1)}% vs. Kaufpreis`;
    addText(diffText, margin + contentWidth / 2, y + 14, { fontSize: 12, fontStyle: "bold", color: [255, 255, 255] });
  }
  y += 28;

  // Sparkasse comparison note
  if (sparkasseResult?.requested) {
    checkPageBreak(20);
    y += 3;
    addLine(y);
    y += 5;
    addText("Sparkasse S-ImmoPreisfinder", margin, y, { fontSize: 9, fontStyle: "bold", color: [200, 50, 50] });
    y += 5;
    addText(
      sparkasseResult.email
        ? `Bewertung angefordert an: ${sparkasseResult.email}. Der PDF-Bericht wird per E-Mail zugestellt.`
        : "Sparkasse-Bewertung wurde angefordert. Der Bericht wird per E-Mail zugestellt.",
      margin,
      y,
      { fontSize: 8, color: [100, 100, 100], maxWidth: contentWidth },
    );
    y += 8;
  }

  // === DISCLAIMER ===
  checkPageBreak(25);
  y += 3;
  addLine(y);
  y += 4;
  addText("Hinweis", margin, y, { fontSize: 8, fontStyle: "bold", color: [150, 150, 150] });
  y += 4;
  addText(
    "Diese Bewertung basiert auf vereinfachten Normverfahren und dient ausschliesslich als Orientierung. " +
    "Fur eine rechtsverbindliche Bewertung beauftragen Sie bitte einen zertifizierten Sachverstandigen. " +
    "Die Angaben erfolgen ohne Gewahr.",
    margin,
    y,
    { fontSize: 7, color: [150, 150, 150], maxWidth: contentWidth },
  );

  // Footer on last page
  addFooter();

  // Save
  const fileName = data.address
    ? `Bewertung_${data.address.replace(/[^a-zA-Z0-9äöüÄÖÜß]/g, "_").slice(0, 40)}.pdf`
    : `Immobilien_Bewertung_${new Date().toISOString().split("T")[0]}.pdf`;
  doc.save(fileName);
}
