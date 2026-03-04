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
}

/** Generate a professional PDF valuation report */
export function generateBewertungsPdf(
  data: ParsedExposeData,
  valuation: ValuationResults,
  sparkasseResult?: { requested: boolean; email?: string },
): void {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 20;
  const contentWidth = pageWidth - 2 * margin;
  let y = margin;

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

  const addSectionHeader = (title: string, yPos: number): number => {
    doc.setFillColor(37, 99, 235);
    doc.rect(margin, yPos - 1, contentWidth, 8, "F");
    addText(title, margin + 3, yPos + 4.5, { fontSize: 11, fontStyle: "bold", color: [255, 255, 255] });
    return yPos + 12;
  };

  const addKeyValue = (key: string, value: string, yPos: number, highlight = false): number => {
    if (highlight) {
      doc.setFillColor(245, 247, 250);
      doc.rect(margin, yPos - 3, contentWidth, 7, "F");
    }
    addText(key, margin + 2, yPos, { fontSize: 9, color: [100, 100, 100] });
    addText(value, margin + contentWidth / 2, yPos, { fontSize: 9, fontStyle: "bold" });
    return yPos + 7;
  };

  // === HEADER ===
  doc.setFillColor(37, 99, 235);
  doc.rect(0, 0, pageWidth, 35, "F");
  addText("ImmoControl", margin, 12, { fontSize: 20, fontStyle: "bold", color: [255, 255, 255] });
  addText("Immobilien-Schnellbewertung", margin, 20, { fontSize: 12, color: [200, 220, 255] });
  addText(`Erstellt am ${new Date().toLocaleDateString("de-DE", { day: "2-digit", month: "long", year: "numeric" })}`, margin, 28, { fontSize: 9, color: [180, 200, 255] });
  y = 45;

  // === OBJECT DATA ===
  y = addSectionHeader("Objektdaten", y);

  if (data.address) y = addKeyValue("Adresse", data.address, y);
  if (data.immobilientyp !== "Sonstige") y = addKeyValue("Immobilientyp", data.immobilientyp, y, true);
  if (data.wohnflaeche > 0) y = addKeyValue("Wohnflache", `${data.wohnflaeche.toLocaleString("de-DE")} m\u00B2`, y);
  if (data.grundstueckFlaeche > 0) y = addKeyValue("Grundstucksflache", `${data.grundstueckFlaeche.toLocaleString("de-DE")} m\u00B2`, y, true);
  if (data.baujahr > 0) y = addKeyValue("Baujahr", String(data.baujahr), y);
  if (data.zimmer > 0) y = addKeyValue("Zimmer", String(data.zimmer), y, true);
  if (data.kaufpreis > 0) y = addKeyValue("Kaufpreis", formatCurrency(data.kaufpreis), y);
  if (data.kaltmiete > 0) y = addKeyValue("Kaltmiete / Monat", formatCurrency(data.kaltmiete), y, true);
  if (data.zustand !== "Unbekannt") y = addKeyValue("Zustand", data.zustand, y);
  if (data.ausstattung !== "Unbekannt") y = addKeyValue("Ausstattung", data.ausstattung, y, true);

  // Features
  const features: string[] = [];
  if (data.balkon) features.push("Balkon/Terrasse");
  if (data.garten) features.push("Garten");
  if (data.aufzug) features.push("Aufzug");
  if (data.keller) features.push("Keller");
  if (data.stellplaetze > 0) features.push(`${data.stellplaetze} Stellplatz/e`);
  if (features.length > 0) y = addKeyValue("Ausstattung", features.join(", "), y);

  if (data.energiekennwert > 0) y = addKeyValue("Energiekennwert", `${data.energiekennwert} kWh/(m\u00B2*a)`, y, true);

  y += 5;

  // === VALUATION PARAMETERS ===
  y = addSectionHeader("Bewertungsparameter", y);
  y = addKeyValue("Bodenrichtwert", `${valuation.bodenrichtwert} EUR/m\u00B2`, y);
  y = addKeyValue("Bodenwert", formatCurrency(valuation.bodenwert), y, true);
  y = addKeyValue("Jahresrohertrag", formatCurrency(valuation.jahresRohertrag), y);
  y = addKeyValue("Jahresreinertrag", formatCurrency(valuation.jahresReinertrag), y, true);
  y = addKeyValue("Restnutzungsdauer", `${valuation.restnutzungsdauer} Jahre`, y);
  y = addKeyValue("Vervielfaltiger", valuation.vervielfaeltiger.toFixed(2), y, true);
  y = addKeyValue("Herstellungskosten", formatCurrency(valuation.herstellungskosten), y);
  y = addKeyValue("Altersminderung", `${(valuation.altersminderung * 100).toFixed(1)}%`, y, true);
  y += 5;

  // === RESULTS ===
  y = addSectionHeader("Bewertungsergebnisse", y);

  // Ertragswert
  doc.setFillColor(240, 249, 255);
  doc.rect(margin, y - 2, contentWidth, 14, "F");
  addText("Ertragswertverfahren", margin + 3, y + 3, { fontSize: 9, color: [100, 100, 100] });
  addText(formatCurrency(valuation.ertragswert), margin + 3, y + 9, { fontSize: 13, fontStyle: "bold", color: [37, 99, 235] });
  addText("Basierend auf Mieteinnahmen", margin + contentWidth / 2, y + 6, { fontSize: 8, color: [140, 140, 140] });
  y += 18;

  // Sachwert
  doc.setFillColor(240, 253, 244);
  doc.rect(margin, y - 2, contentWidth, 14, "F");
  addText("Sachwertverfahren", margin + 3, y + 3, { fontSize: 9, color: [100, 100, 100] });
  addText(formatCurrency(valuation.sachwert), margin + 3, y + 9, { fontSize: 13, fontStyle: "bold", color: [22, 163, 74] });
  addText("Basierend auf Herstellungskosten", margin + contentWidth / 2, y + 6, { fontSize: 8, color: [140, 140, 140] });
  y += 18;

  // Vergleichswert
  doc.setFillColor(254, 249, 195);
  doc.rect(margin, y - 2, contentWidth, 14, "F");
  addText("Vergleichswertverfahren", margin + 3, y + 3, { fontSize: 9, color: [100, 100, 100] });
  addText(formatCurrency(valuation.vergleichswert), margin + 3, y + 9, { fontSize: 13, fontStyle: "bold", color: [161, 98, 7] });
  addText("Basierend auf Marktvergleich", margin + contentWidth / 2, y + 6, { fontSize: 8, color: [140, 140, 140] });
  y += 20;

  // === COMBINED RESULT ===
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
  y = Math.max(y + 5, 250);
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

  // Footer
  const footerY = doc.internal.pageSize.getHeight() - 10;
  addLine(footerY - 3);
  addText("ImmoControl - Immobilien-Schnellbewertung", margin, footerY, { fontSize: 7, color: [180, 180, 180] });
  addText(`Seite 1 von 1 | ${new Date().toLocaleDateString("de-DE")}`, pageWidth - margin - 50, footerY, { fontSize: 7, color: [180, 180, 180] });

  // Save
  const fileName = data.address
    ? `Bewertung_${data.address.replace(/[^a-zA-Z0-9äöüÄÖÜß]/g, "_").slice(0, 40)}.pdf`
    : `Immobilien_Bewertung_${new Date().toISOString().split("T")[0]}.pdf`;
  doc.save(fileName);
}
