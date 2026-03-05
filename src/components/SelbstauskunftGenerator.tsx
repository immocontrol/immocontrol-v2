import { useState, useEffect, useCallback, useRef } from "react";
import { FileText, Download, Loader2, ChevronLeft, ChevronRight, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useAuth } from "@/hooks/useAuth";
import { useProperties } from "@/context/PropertyContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

/* IMPROVE-14: Remove unused jsPDF import (smaller bundle, fewer dependencies) */
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import AddressAutocomplete from "@/components/AddressAutocomplete";

interface SelbstauskunftData {
  anrede: string; titel: string; name: string; vorname: string; geburtsname: string;
  staatsangehoerigkeit: string; geburtsdatum: string; geburtsort: string;
  strasse: string; plz: string; ort: string; voranschrift: string;
  telefon: string; email: string; familienstand: string; kinderAnzahl: string; kinderImHaushalt: string;
  arbeitgeber: string; branche: string; berufsbezeichnung: string; beschaeftigtSeit: string;
  befristet: string; probezeit: string;
  giroKonten: string; wertpapiere: string; bausparGuthaben: string; lebensversicherungen: string;
  rentenversicherungen: string; immobilienEigengenutzt: string; immobilienFremdgenutzt: string; sonstigesVermoegen: string;
  gehaltNetto: string; renten: string; selbststaendig: string; mieteinnahmen: string;
  kindergeld: string; unterhaltEinnahmen: string;
  lebenshaltung: string; warmmiete: string; krankenversicherung: string; unterhaltAusgaben: string;
  kitaBeitrag: string; kreditraten: string; sparraten: string; sonstigeAusgaben: string;
  bemerkungen: string;
}

const defaultData: SelbstauskunftData = {
  anrede: "", titel: "", name: "", vorname: "", geburtsname: "",
  staatsangehoerigkeit: "deutsch", geburtsdatum: "", geburtsort: "",
  strasse: "", plz: "", ort: "", voranschrift: "",
  telefon: "", email: "", familienstand: "", kinderAnzahl: "0", kinderImHaushalt: "0",
  arbeitgeber: "", branche: "", berufsbezeichnung: "", beschaeftigtSeit: "",
  befristet: "nein", probezeit: "nein",
  giroKonten: "", wertpapiere: "", bausparGuthaben: "", lebensversicherungen: "",
  rentenversicherungen: "", immobilienEigengenutzt: "", immobilienFremdgenutzt: "", sonstigesVermoegen: "",
  gehaltNetto: "", renten: "", selbststaendig: "", mieteinnahmen: "",
  kindergeld: "", unterhaltEinnahmen: "",
  lebenshaltung: "", warmmiete: "", krankenversicherung: "", unterhaltAusgaben: "",
  kitaBeitrag: "", kreditraten: "", sparraten: "", sonstigeAusgaben: "",
  bemerkungen: "",
};

const fmtCur = (v: string) => {
  const n = parseFloat(v);
  return isNaN(n) ? "" : n.toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " \u20ac";
};

/* BUG-1: Sanitize text for WinAnsi encoding — replace non-WinAnsi chars with ASCII equivalents */
/* BUG-2: Fixes "WinAnsi cannot encode \"−\" (0x2212)" error by mapping all problematic Unicode chars to ASCII */
const sanitizeForWinAnsi = (text: string): string => {
  return text
    .replace(/\u2212/g, "-")   // minus sign -> hyphen
    .replace(/\u2013/g, "-")   // en-dash -> hyphen
    .replace(/\u2014/g, "--")  // em-dash -> double hyphen
    .replace(/\u2018/g, "'")   // left single quote
    .replace(/\u2019/g, "'")   // right single quote
    .replace(/\u201c/g, '"')   // left double quote
    .replace(/\u201d/g, '"')   // right double quote
    .replace(/\u2026/g, "...") // ellipsis
    .replace(/\u00b7/g, ".")   // middle dot
    .replace(/\u2022/g, "*");  // bullet
};

const NAME_FIELDS: (keyof SelbstauskunftData)[] = ["name", "vorname", "geburtsname", "geburtsort"];

/* FUNC-47: Selbstauskunft field validation */
const CURRENCY_FIELDS: string[] = ["gehaltNetto", "renten", "selbststaendig", "mieteinnahmen", "kindergeld", "unterhaltEinnahmen", "lebenshaltung", "warmmiete", "krankenversicherung", "unterhaltAusgaben", "kitaBeitrag", "kreditraten", "sparraten", "sonstigeAusgaben"];
const validateSelbstauskunftField = (field: string, value: string): string | null => {
  if (!value.trim()) return null;
  if (field === "email" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return "Ungültige E-Mail";
  if (field === "telefon" && !/^[+\d\s()-]{6,}$/.test(value)) return "Ungültige Telefonnummer";
  /* FIX-1: Use global /,/g to replace ALL commas */
  if (CURRENCY_FIELDS.includes(field) && isNaN(Number(value.replace(/\./g, "").replace(/,/g, ".")))) return "Ungültige Zahl";
  return null;
};

/* FUNC-48: PDF field IDs for Selbstauskunft */
const SELBSTAUSKUNFT_FIELD_IDS = [
  "name", "vorname", "geburtsname", "geburtsdatum", "geburtsort",
  "strasse", "plz", "ort", "telefon", "email",
  "beruf", "arbeitgeber", "einkommen", "familienstand",
  "anzahl_personen", "haustiere", "schufa", "insolvenz",
] as const;

/* OPT-35: Form step count */
const SELBSTAUSKUNFT_TOTAL_STEPS = 7;

const STEPS = [
  { id: "personal", title: "Persönliche Daten" },
  { id: "contact", title: "Kontakt & Familie" },
  { id: "employment", title: "Berufstätigkeit" },
  { id: "assets", title: "Vermögenswerte" },
  { id: "income", title: "Einnahmen" },
  { id: "expenses", title: "Ausgaben" },
  { id: "summary", title: "Zusammenfassung & Download" },
];

export const SelbstauskunftGenerator = () => {
  const { user } = useAuth();
  const { properties } = useProperties();
  const [data, setData] = useState<SelbstauskunftData>(defaultData);
  const [generating, setGenerating] = useState(false);
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!user || !open) return;
    const prefill = async () => {
      const { data: profile } = await supabase.from("profiles").select("display_name").eq("user_id", user.id).maybeSingle();
      const { data: loans } = await supabase.from("loans").select("remaining_balance, monthly_payment").eq("user_id", user.id);
      const totalRent = properties.reduce((s, p) => s + (p.monthlyRent || 0), 0);
      const totalRate = loans?.reduce((s, l) => s + Number(l.monthly_payment || 0), 0) || 0;
      const totalPropertyValue = properties.reduce((s, p) => s + (p.currentValue || 0), 0);
      const nameParts = (profile?.display_name || "").split(" ");
      setData(prev => ({
        ...prev, email: user.email || "", vorname: nameParts[0] || "", name: nameParts.slice(1).join(" ") || "",
        mieteinnahmen: totalRent > 0 ? totalRent.toFixed(2) : "",
        kreditraten: totalRate > 0 ? totalRate.toFixed(2) : "",
        immobilienFremdgenutzt: totalPropertyValue > 0 ? totalPropertyValue.toFixed(2) : "",
      }));
    };
    prefill();
  }, [user, open, properties]);

  useEffect(() => { if (open) setStep(0); }, [open]);

  const update = useCallback((key: keyof SelbstauskunftData, value: string) => {
    if (NAME_FIELDS.includes(key)) value = value.replace(/[0-9]/g, "");
    setData(prev => ({ ...prev, [key]: value }));
  }, []);

  const nextStep = () => {
    if (step < STEPS.length - 1) {
      setStep(s => s + 1);
      contentRef.current?.scrollTo({ top: 0, behavior: "smooth" });
    }
  };
  const prevStep = () => {
    if (step > 0) {
      setStep(s => s - 1);
      contentRef.current?.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  const generatePDF = useCallback(async () => {
    setGenerating(true);
    try {
      /* ── Build fillable AcroForm PDF with pdf-lib (proper Unicode + editable fields) ── */
      const pdfDoc = await PDFDocument.create();
      const helvetica = await pdfDoc.embedFont(StandardFonts.Helvetica);
      const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
      const pageW = 595.28; // A4 in points
      const pageH = 841.89;
      const margin = 42.52; // ~15mm
      const contentW = pageW - 2 * margin;
      const form = pdfDoc.getForm();
      let fieldCounter = 0;

      let page = pdfDoc.addPage([pageW, pageH]);
      let y = pageH - margin;

      /* BUG-1: Sanitize all text for WinAnsi before drawing to prevent encoding errors */
      const drawText = (text: string, x: number, yPos: number, opts: { size?: number; bold?: boolean; color?: [number, number, number] } = {}) => {
        const font = opts.bold ? helveticaBold : helvetica;
        const c = opts.color || [30, 30, 30];
        page.drawText(sanitizeForWinAnsi(text), { x, y: yPos, size: opts.size || 10, font, color: rgb(c[0] / 255, c[1] / 255, c[2] / 255) });
      };

      const checkPage = (needed: number) => {
        if (y - needed < margin) {
          page = pdfDoc.addPage([pageW, pageH]);
          y = pageH - margin;
        }
      };

      const drawSection = (title: string) => {
        checkPage(25);
        y -= 6;
        page.drawRectangle({ x: margin, y: y - 6, width: contentW, height: 20, color: rgb(42 / 255, 157 / 255, 110 / 255) });
        drawText(title, margin + 6, y, { size: 11, bold: true, color: [255, 255, 255] });
        y -= 26;
      };

      /** Draw a fillable text field (AcroForm) */
      const drawEditableField = (label: string, value: string, x: number, yPos: number, w: number) => {
        fieldCounter++;
        const fieldName = "field_" + fieldCounter + "_" + label.replace(/[^a-zA-Z0-9]/g, "_").substring(0, 30);
        drawText(label, x, yPos + 10, { size: 7, color: [120, 120, 120] });
        // Draw background rect
        page.drawRectangle({ x, y: yPos - 2, width: w, height: 16, color: rgb(0.98, 0.98, 0.98), borderColor: rgb(0.78, 0.78, 0.78), borderWidth: 0.5 });
        // Create fillable form field
        const textField = form.createTextField(fieldName);
        textField.setText(sanitizeForWinAnsi(value || ""));
        textField.addToPage(page, { x: x + 2, y: yPos, width: w - 4, height: 12, borderWidth: 0 });
        try { textField.setFontSize(9); } catch { /* some viewers handle font size differently */ }
      };

      const drawFieldRow = (l1: string, v1: string, l2: string, v2: string) => {
        checkPage(30);
        const hw = contentW / 2 - 4;
        drawEditableField(l1, v1, margin, y, hw);
        drawEditableField(l2, v2, margin + contentW / 2 + 4, y, hw);
        y -= 30;
      };

      const drawSingleField = (label: string, value: string) => {
        checkPage(30);
        drawEditableField(label, value, margin, y, contentW / 2 - 4);
        y -= 30;
      };

      // ── Header ──
      drawText("Selbstauskunft", margin, y, { size: 18, bold: true, color: [42, 157, 110] });
      y -= 14;
      drawText("Erstellt am " + new Date().toLocaleDateString("de-DE") + " \u00b7 ImmoControl", margin, y, { size: 8, color: [150, 150, 150] });
      y -= 16;

      // ── Pers\u00f6nliche Daten ──
      drawSection("Pers\u00f6nliche Daten");
      drawFieldRow("Anrede", data.anrede, "Titel", data.titel);
      drawFieldRow("Name", data.name, "Vorname", data.vorname);
      drawFieldRow("Geburtsname", data.geburtsname, "Staatsangeh\u00f6rigkeit", data.staatsangehoerigkeit);
      drawFieldRow("Geburtsdatum", data.geburtsdatum, "Geburtsort", data.geburtsort);
      drawFieldRow("Stra\u00dfe, Hausnummer", data.strasse, "PLZ, Ort", data.plz + " " + data.ort);
      drawSingleField("Voranschrift (bei Umzug in letzten 3 Jahren)", data.voranschrift);

      // ── Kontaktdaten ──
      drawSection("Kontaktdaten");
      drawFieldRow("Telefon", data.telefon, "E-Mail", data.email);

      // ── Familienstand ──
      drawSection("Familienstand");
      drawFieldRow("Familienstand", data.familienstand, "Kinder (Anzahl)", data.kinderAnzahl);
      drawSingleField("davon im Haushalt lebend", data.kinderImHaushalt);

      // ── Berufst\u00e4tigkeit ──
      drawSection("Angaben zur Berufst\u00e4tigkeit");
      drawFieldRow("Arbeitgeber", data.arbeitgeber, "Branche", data.branche);
      drawFieldRow("Berufsbezeichnung", data.berufsbezeichnung, "Besch\u00e4ftigt seit", data.beschaeftigtSeit);
      drawFieldRow("Befristung", data.befristet, "Probezeit", data.probezeit);

      // ── Verm\u00f6genswerte (new page) ──
      page = pdfDoc.addPage([pageW, pageH]); y = pageH - margin;
      drawSection("Verm\u00f6genswerte");
      drawFieldRow("Giro-/Tagesgeld-/Sparkonten", fmtCur(data.giroKonten), "Wertpapierverm\u00f6gen", fmtCur(data.wertpapiere));
      drawFieldRow("Bausparguthaben", fmtCur(data.bausparGuthaben), "Lebensversicherungen", fmtCur(data.lebensversicherungen));
      drawFieldRow("Rentenversicherungen", fmtCur(data.rentenversicherungen), "Immobilien (eigengenutzt)", fmtCur(data.immobilienEigengenutzt));
      drawFieldRow("Immobilien (fremdgenutzt)", fmtCur(data.immobilienFremdgenutzt), "Sonstiges", fmtCur(data.sonstigesVermoegen));

      // ── Bestehende Verbindlichkeiten ──
      const { data: loans } = await supabase.from("loans").select("bank_name, remaining_balance, monthly_payment, fixed_interest_until, loan_type").eq("user_id", user!.id);
      if (loans && loans.length > 0) {
        drawSection("Bestehende Verbindlichkeiten");
        const cols = [margin, margin + 113, margin + 227, margin + 340];
        drawText("Darlehensart", cols[0], y, { size: 8, bold: true, color: [80, 80, 80] });
        drawText("Restschuld", cols[1], y, { size: 8, bold: true, color: [80, 80, 80] });
        drawText("Monatsrate", cols[2], y, { size: 8, bold: true, color: [80, 80, 80] });
        drawText("Zinsbindung bis", cols[3], y, { size: 8, bold: true, color: [80, 80, 80] });
        y -= 4;
        page.drawLine({ start: { x: margin, y }, end: { x: margin + contentW, y }, thickness: 0.5, color: rgb(0.78, 0.78, 0.78) });
        y -= 14;
        for (const loan of loans) {
          checkPage(18);
          drawText(loan.bank_name || loan.loan_type || "", cols[0], y, { size: 9 });
          drawText(fmtCur(String(loan.remaining_balance || 0)), cols[1], y, { size: 9 });
          drawText(fmtCur(String(loan.monthly_payment || 0)), cols[2], y, { size: 9 });
          drawText(loan.fixed_interest_until || "\u2013", cols[3], y, { size: 9 });
          y -= 17;
        }
      }

      // ── Einnahmen pro Monat ──
      drawSection("Einnahmen pro Monat");
      drawFieldRow("Gehalt netto", fmtCur(data.gehaltNetto), "Renten/Pensionen", fmtCur(data.renten));
      drawFieldRow("Selbstst\u00e4ndige T\u00e4tigkeit", fmtCur(data.selbststaendig), "Mieteinnahmen (kalt)", fmtCur(data.mieteinnahmen));
      drawFieldRow("Kindergeld", fmtCur(data.kindergeld), "Unterhalt", fmtCur(data.unterhaltEinnahmen));
      const sumE = [data.gehaltNetto, data.renten, data.selbststaendig, data.mieteinnahmen, data.kindergeld, data.unterhaltEinnahmen].reduce((s, v) => s + (parseFloat(v) || 0), 0);
      drawSingleField("Summe Gesamteinnahmen", fmtCur(sumE.toFixed(2)));

      // ── Ausgaben pro Monat ──
      drawSection("Ausgaben pro Monat");
      drawFieldRow("Lebenshaltungskosten", fmtCur(data.lebenshaltung), "Warmmiete", fmtCur(data.warmmiete));
      drawFieldRow("Private Krankenversicherung", fmtCur(data.krankenversicherung), "Unterhaltszahlungen", fmtCur(data.unterhaltAusgaben));
      drawFieldRow("Kita/Kinderbetreuung", fmtCur(data.kitaBeitrag), "Kreditraten/Leasing", fmtCur(data.kreditraten));
      drawFieldRow("Sparraten", fmtCur(data.sparraten), "Sonstige Ausgaben", fmtCur(data.sonstigeAusgaben));
      const sumA = [data.lebenshaltung, data.warmmiete, data.krankenversicherung, data.unterhaltAusgaben, data.kitaBeitrag, data.kreditraten, data.sparraten, data.sonstigeAusgaben].reduce((s, v) => s + (parseFloat(v) || 0), 0);
      drawSingleField("Summe Gesamtausgaben", fmtCur(sumA.toFixed(2)));

      // ── \u00dcberschuss ──
      const ue = sumE - sumA;
      checkPage(30);
      const ueBg = ue >= 0 ? rgb(230 / 255, 250 / 255, 240 / 255) : rgb(255 / 255, 235 / 255, 235 / 255);
      page.drawRectangle({ x: margin, y: y - 8, width: contentW, height: 28, color: ueBg, borderColor: rgb(0.78, 0.78, 0.78), borderWidth: 0.5 });
      drawText("\u00dcberschuss (Einnahmen \u2212 Ausgaben)", margin + 8, y + 4, { size: 10, bold: true });
      const ueColor: [number, number, number] = ue >= 0 ? [42, 157, 110] : [200, 50, 50];
      drawText(fmtCur(ue.toFixed(2)), margin + contentW - 120, y + 4, { size: 12, bold: true, color: ueColor });
      y -= 36;

      // ── Immobilien\u00fcbersicht ──
      if (properties.length > 0) {
        page = pdfDoc.addPage([pageW, pageH]); y = pageH - margin;
        drawSection("Immobilien\u00fcbersicht");
        const pCols = [margin, margin + 128, margin + 227, margin + 312, margin + 397];
        ["Objekt", "Wert", "Miete/M", "Restschuld", "Cashflow/M"].forEach((h, i) => drawText(h, pCols[i], y, { size: 8, bold: true, color: [80, 80, 80] }));
        y -= 4;
        page.drawLine({ start: { x: margin, y }, end: { x: margin + contentW, y }, thickness: 0.5, color: rgb(0.78, 0.78, 0.78) });
        y -= 14;
        for (const p of properties) {
          checkPage(18);
          drawText(p.name.substring(0, 25), pCols[0], y, { size: 9 });
          drawText(fmtCur(String(p.currentValue)), pCols[1], y, { size: 9 });
          drawText(fmtCur(String(p.monthlyRent)), pCols[2], y, { size: 9 });
          drawText(fmtCur(String(p.remainingDebt)), pCols[3], y, { size: 9 });
          const cfColor: [number, number, number] = p.monthlyCashflow >= 0 ? [42, 157, 110] : [200, 50, 50];
          drawText(fmtCur(String(p.monthlyCashflow)), pCols[4], y, { size: 9, color: cfColor });
          y -= 17;
        }
      }

      // ── Bemerkungen ──
      if (data.bemerkungen) {
        checkPage(40);
        drawSection("Bemerkungen");
        drawText(data.bemerkungen.substring(0, 500), margin + 6, y, { size: 9 });
        y -= 20;
      }

      // ── Vollst\u00e4ndigkeitserkl\u00e4rung ──
      page = pdfDoc.addPage([pageW, pageH]); y = pageH - margin;
      drawSection("Vollst\u00e4ndigkeitserkl\u00e4rung");
      drawText("Hiermit best\u00e4tige ich die Richtigkeit und Vollst\u00e4ndigkeit der gemachten Angaben.", margin, y, { size: 9 });
      y -= 40;
      drawFieldRow("Ort, Datum", "", "Unterschrift", "");
      y -= 20;
      page.drawLine({ start: { x: margin, y }, end: { x: margin + 198, y }, thickness: 0.5, color: rgb(0.7, 0.7, 0.7) });
      page.drawLine({ start: { x: margin + contentW / 2 + 6, y }, end: { x: margin + contentW, y }, thickness: 0.5, color: rgb(0.7, 0.7, 0.7) });

      // ── Footer on every page ──
      const pages = pdfDoc.getPages();
      const tp = pages.length;
      for (let i = 0; i < tp; i++) {
        const pg = pages[i];
        /* BUG-2: Apply sanitizeForWinAnsi to footer text to prevent encoding crash */
        pg.drawText(sanitizeForWinAnsi("Selbstauskunft \u00b7 " + data.vorname + " " + data.name + " \u00b7 Seite " + (i + 1) + "/" + tp), {
          x: margin, y: 20, size: 7, font: helvetica, color: rgb(0.7, 0.7, 0.7),
        });
        pg.drawText(sanitizeForWinAnsi("Erstellt mit ImmoControl"), {
          x: pageW - margin - 100, y: 20, size: 7, font: helvetica, color: rgb(0.7, 0.7, 0.7),
        });
      }

      // ── Save ──
      const pdfBytes = await pdfDoc.save();
      const blob = new Blob([pdfBytes], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "Selbstauskunft_" + (data.name || "Entwurf") + "_" + new Date().toISOString().split("T")[0] + ".pdf";
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Selbstauskunft als PDF heruntergeladen! (Felder sind editierbar)");
    } catch (err: unknown) {
      toast.error("Fehler beim Erstellen: " + (err instanceof Error ? err.message : "Unbekannt"));
    } finally {
      setGenerating(false);
    }
  }, [data, user, properties]);

  // Render helpers as plain functions (not components) to fix focus bug
  const inp = (label: string, field: keyof SelbstauskunftData, type = "text", placeholder = "") => {
    /* FUNC-47: Wire up field validation */
    const validationError = validateSelbstauskunftField(field, data[field]);
    return (
      <div className="space-y-1" key={field}>
        <Label className="text-xs text-muted-foreground">{label}</Label>
        <Input
          type={type}
          value={data[field]}
          onChange={(e) => update(field, e.target.value)}
          placeholder={placeholder}
          className={`h-9 text-sm ${validationError ? "border-loss" : ""}`}
          inputMode={type === "number" ? "decimal" : undefined}
        />
        {validationError && <p className="text-[10px] text-loss">{validationError}</p>}
      </div>
    );
  };

  const sel = (label: string, field: keyof SelbstauskunftData, options: { value: string; label: string }[]) => (
    <div className="space-y-1" key={field}>
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <Select value={data[field]} onValueChange={(v) => update(field, v)}>
        <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="W\u00e4hlen..." /></SelectTrigger>
        <SelectContent>{options.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
      </Select>
    </div>
  );

  const sumE = [data.gehaltNetto, data.renten, data.selbststaendig, data.mieteinnahmen, data.kindergeld, data.unterhaltEinnahmen].reduce((s, v) => s + (parseFloat(v) || 0), 0);
  const sumA = [data.lebenshaltung, data.warmmiete, data.krankenversicherung, data.unterhaltAusgaben, data.kitaBeitrag, data.kreditraten, data.sparraten, data.sonstigeAusgaben].reduce((s, v) => s + (parseFloat(v) || 0), 0);
  const surplus = sumE - sumA;

  const renderStep = () => {
    switch (step) {
      case 0:
        return (
          <div className="space-y-3 page-enter">
            <div className="grid grid-cols-2 gap-3">
              {sel("Anrede", "anrede", [{ value: "Herr", label: "Herr" }, { value: "Frau", label: "Frau" }, { value: "Divers", label: "Divers" }])}
              {inp("Titel", "titel", "text", "z.B. Dr.")}
              {inp("Nachname", "name")}
              {inp("Vorname", "vorname")}
              {inp("Geburtsname", "geburtsname")}
              {inp("Staatsangeh\u00f6rigkeit", "staatsangehoerigkeit")}
              {inp("Geburtsdatum", "geburtsdatum", "date")}
              {inp("Geburtsort", "geburtsort")}
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Stra\u00dfe, Hausnummer</Label>
              <AddressAutocomplete
                value={data.strasse}
                onChange={(val) => update("strasse", val)}
                placeholder="Stra\u00dfe und Hausnummer"
              />
            </div>
            <div className="grid grid-cols-3 gap-3">
              {inp("PLZ", "plz")}
              <div className="col-span-2">{inp("Ort", "ort")}</div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Voranschrift (bei Umzug in letzten 3 Jahren)</Label>
              <AddressAutocomplete
                value={data.voranschrift}
                onChange={(val) => update("voranschrift", val)}
                placeholder="Vorherige Adresse"
              />
            </div>
          </div>
        );
      case 1:
        return (
          <div className="space-y-3 page-enter">
            <h3 className="text-sm font-semibold text-primary">Kontaktdaten</h3>
            <div className="grid grid-cols-2 gap-3">
              {inp("Telefon", "telefon", "tel")}
              {inp("E-Mail", "email", "email")}
            </div>
            <h3 className="text-sm font-semibold text-primary mt-4">Familienstand</h3>
            <div className="grid grid-cols-3 gap-3">
              {sel("Familienstand", "familienstand", [{ value: "ledig", label: "Ledig" }, { value: "verheiratet", label: "Verheiratet" }, { value: "geschieden", label: "Geschieden" }, { value: "verwitwet", label: "Verwitwet" }, { value: "getrennt", label: "Getrennt lebend" }])}
              {inp("Kinder (Anzahl)", "kinderAnzahl", "number")}
              {inp("davon im Haushalt", "kinderImHaushalt", "number")}
            </div>
          </div>
        );
      case 2:
        return (
          <div className="space-y-3 page-enter">
            <div className="grid grid-cols-2 gap-3">
              {inp("Arbeitgeber", "arbeitgeber")}
              {inp("Branche", "branche")}
              {inp("Berufsbezeichnung", "berufsbezeichnung")}
              {inp("Besch\u00e4ftigt seit", "beschaeftigtSeit", "date")}
              {sel("Befristung", "befristet", [{ value: "nein", label: "Nein" }, { value: "ja", label: "Ja" }])}
              {sel("Probezeit", "probezeit", [{ value: "nein", label: "Nein" }, { value: "ja", label: "Ja" }])}
            </div>
          </div>
        );
      case 3:
        return (
          <div className="space-y-3 page-enter">
            <div className="grid grid-cols-2 gap-3">
              {inp("Giro-/Tagesgeld (\u20ac)", "giroKonten", "number")}
              {inp("Wertpapiere (\u20ac)", "wertpapiere", "number")}
              {inp("Bausparguthaben (\u20ac)", "bausparGuthaben", "number")}
              {inp("Lebensversicherungen (\u20ac)", "lebensversicherungen", "number")}
              {inp("Rentenversicherungen (\u20ac)", "rentenversicherungen", "number")}
              {inp("Immobilien eigengenutzt (\u20ac)", "immobilienEigengenutzt", "number")}
              {inp("Immobilien fremdgenutzt (\u20ac)", "immobilienFremdgenutzt", "number")}
              {inp("Sonstiges (\u20ac)", "sonstigesVermoegen", "number")}
            </div>
          </div>
        );
      case 4:
        return (
          <div className="space-y-3 page-enter">
            <div className="grid grid-cols-2 gap-3">
              {inp("Gehalt netto (\u20ac)", "gehaltNetto", "number")}
              {inp("Renten/Pensionen (\u20ac)", "renten", "number")}
              {inp("Selbstst\u00e4ndig (\u20ac)", "selbststaendig", "number")}
              {inp("Mieteinnahmen kalt (\u20ac)", "mieteinnahmen", "number")}
              {inp("Kindergeld (\u20ac)", "kindergeld", "number")}
              {inp("Unterhalt (\u20ac)", "unterhaltEinnahmen", "number")}
            </div>
            <div className="rounded-lg bg-profit/5 border border-profit/20 p-3 text-sm">
              <span className="text-muted-foreground">Summe: </span>
              <span className="font-bold text-profit">{fmtCur(sumE.toFixed(2))}</span>
            </div>
          </div>
        );
      case 5:
        return (
          <div className="space-y-3 page-enter">
            <div className="grid grid-cols-2 gap-3">
              {inp("Lebenshaltung (\u20ac)", "lebenshaltung", "number")}
              {inp("Warmmiete (\u20ac)", "warmmiete", "number")}
              {inp("PKV (\u20ac)", "krankenversicherung", "number")}
              {inp("Unterhalt (\u20ac)", "unterhaltAusgaben", "number")}
              {inp("Kita (\u20ac)", "kitaBeitrag", "number")}
              {inp("Kreditraten (\u20ac)", "kreditraten", "number")}
              {inp("Sparraten (\u20ac)", "sparraten", "number")}
              {inp("Sonstige (\u20ac)", "sonstigeAusgaben", "number")}
            </div>
            <div className="rounded-lg bg-loss/5 border border-loss/20 p-3 text-sm">
              <span className="text-muted-foreground">Summe: </span>
              <span className="font-bold text-loss">{fmtCur(sumA.toFixed(2))}</span>
            </div>
            <div className={"rounded-lg p-3 text-sm border " + (surplus >= 0 ? "bg-profit/5 border-profit/20" : "bg-loss/5 border-loss/20")}>
              <span className="text-muted-foreground">Überschuss: </span>
              <span className={"font-bold " + (surplus >= 0 ? "text-profit" : "text-loss")}>{fmtCur(surplus.toFixed(2))}</span>
            </div>
          </div>
        );
      case 6:
        return (
          <div className="space-y-4 page-enter">
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Bemerkungen</Label>
              <textarea
                value={data.bemerkungen}
                onChange={(e) => update("bemerkungen", e.target.value)}
                placeholder="Weitere Angaben..."
                className="w-full h-20 bg-secondary text-foreground text-sm rounded-lg px-3 py-2 outline-none resize-none border border-input focus:border-primary transition-colors"
              />
            </div>
            <div className="rounded-lg border border-border p-4 space-y-2 bg-secondary/30">
              {/* IMPROVE-15: Use literal umlauts/dashes in UI strings (avoid confusing \\uXXXX renderings) */}
              <h4 className="text-sm font-semibold">Zusammenfassung</h4>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div><span className="text-muted-foreground">Name:</span> {data.vorname} {data.name}</div>
                <div><span className="text-muted-foreground">Arbeitgeber:</span> {data.arbeitgeber || "–"}</div>
                <div><span className="text-muted-foreground">Einnahmen:</span> {fmtCur(sumE.toFixed(2))}</div>
                <div><span className="text-muted-foreground">Ausgaben:</span> {fmtCur(sumA.toFixed(2))}</div>
                <div className="col-span-2">
                  <span className="text-muted-foreground">Überschuss:</span>{" "}
                  <span className={surplus >= 0 ? "text-profit font-medium" : "text-loss font-medium"}>{fmtCur(surplus.toFixed(2))}</span>
                </div>
              </div>
            </div>
            <Button onClick={generatePDF} disabled={generating} className="w-full gap-2" size="lg">
              {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
              {generating ? "Wird erstellt..." : "PDF herunterladen"}
            </Button>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5">
          <FileText className="h-3.5 w-3.5" /> Selbstauskunft
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] p-0 overflow-hidden">
        <DialogHeader className="p-5 pb-0">
          <DialogTitle className="flex items-center gap-2 text-base">
            <FileText className="h-5 w-5 text-primary" /> Selbstauskunft
          </DialogTitle>
          <p className="text-xs text-muted-foreground">
            Schritt {step + 1} von {STEPS.length}: {STEPS[step].title}
          </p>
        </DialogHeader>

        {/* Progress bar */}
        <div className="px-5 pt-3">
          <div className="h-1.5 bg-secondary rounded-full overflow-hidden">
            <div
              className="h-full bg-primary rounded-full transition-all duration-500 ease-out"
              style={{ width: ((step + 1) / STEPS.length * 100) + "%" }}
            />
          </div>
          <div className="flex justify-between mt-2">
            {STEPS.map((s, i) => (
              <button
                key={s.id}
                onClick={() => setStep(i)}
                className={"flex items-center justify-center w-7 h-7 rounded-full text-xs font-medium transition-all " +
                  (i === step ? "bg-primary text-primary-foreground scale-110" :
                   i < step ? "bg-primary/20 text-primary" :
                   "bg-secondary text-muted-foreground")}
                title={s.title}
              >
                {i < step ? <Check className="h-3 w-3" /> : String(i + 1)}
              </button>
            ))}
          </div>
        </div>

        {/* Step content */}
        <div ref={contentRef} className="overflow-y-auto max-h-[calc(90vh-220px)] px-5 pb-5 pt-3">
          {renderStep()}
        </div>

        {/* Navigation */}
        <div className="flex items-center justify-between border-t border-border px-5 py-3 bg-background">
          <Button variant="outline" size="sm" onClick={prevStep} disabled={step === 0} className="gap-1">
            <ChevronLeft className="h-3.5 w-3.5" /> Zurück
          </Button>
          {step < STEPS.length - 1 ? (
            <Button size="sm" onClick={nextStep} className="gap-1">
              Weiter <ChevronRight className="h-3.5 w-3.5" />
            </Button>
          ) : (
            <span className="text-xs text-muted-foreground">PDF oben herunterladen</span>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
