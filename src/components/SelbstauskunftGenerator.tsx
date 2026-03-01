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
import { jsPDF } from "jspdf";

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

const NAME_FIELDS: (keyof SelbstauskunftData)[] = ["name", "vorname", "geburtsname", "geburtsort"];

const STEPS = [
  { id: "personal", title: "Pers\u00f6nliche Daten" },
  { id: "contact", title: "Kontakt & Familie" },
  { id: "employment", title: "Berufst\u00e4tigkeit" },
  { id: "assets", title: "Verm\u00f6genswerte" },
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
      const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
      const pageW = 210;
      const margin = 15;
      const contentW = pageW - 2 * margin;
      let y = 15;

      const addText = (text: string, x: number, yPos: number, opts: { size?: number; bold?: boolean; color?: [number, number, number] } = {}) => {
        doc.setFontSize(opts.size || 10);
        doc.setFont("helvetica", opts.bold ? "bold" : "normal");
        if (opts.color) doc.setTextColor(...opts.color); else doc.setTextColor(30, 30, 30);
        doc.text(text, x, yPos);
      };

      const addSection = (title: string) => {
        if (y > 260) { doc.addPage(); y = 15; }
        y += 4;
        doc.setFillColor(42, 157, 110);
        doc.rect(margin, y - 4, contentW, 7, "F");
        addText(title, margin + 2, y + 1, { size: 11, bold: true, color: [255, 255, 255] });
        y += 10;
      };

      const addFieldRow = (l1: string, v1: string, l2: string, v2: string) => {
        if (y > 275) { doc.addPage(); y = 15; }
        const x1 = margin;
        const x2 = margin + contentW / 2 + 2;
        const w = contentW / 2 - 2;
        addText(l1, x1, y, { size: 7, color: [120, 120, 120] });
        addText(l2, x2, y, { size: 7, color: [120, 120, 120] });
        y += 4;
        doc.setDrawColor(200, 200, 200);
        doc.setFillColor(250, 250, 250);
        doc.roundedRect(x1, y - 3, w, 6, 1, 1, "FD");
        doc.roundedRect(x2, y - 3, w, 6, 1, 1, "FD");
        addText(v1 || "", x1 + 2, y + 1, { size: 9 });
        addText(v2 || "", x2 + 2, y + 1, { size: 9 });
        y += 8;
      };

      const addField = (label: string, value: string) => {
        if (y > 275) { doc.addPage(); y = 15; }
        addText(label, margin, y, { size: 7, color: [120, 120, 120] });
        y += 4;
        doc.setDrawColor(200, 200, 200);
        doc.setFillColor(250, 250, 250);
        doc.roundedRect(margin, y - 3, contentW / 2 - 2, 6, 1, 1, "FD");
        addText(value || "", margin + 2, y + 1, { size: 9 });
        y += 8;
      };

      // Header
      addText("Selbstauskunft", margin, y, { size: 18, bold: true, color: [42, 157, 110] });
      y += 5;
      addText("Erstellt am " + new Date().toLocaleDateString("de-DE") + " \u00b7 ImmoControl", margin, y, { size: 8, color: [150, 150, 150] });
      y += 8;

      addSection("Pers\u00f6nliche Daten");
      addFieldRow("Anrede", data.anrede, "Titel", data.titel);
      addFieldRow("Name", data.name, "Vorname", data.vorname);
      addFieldRow("Geburtsname", data.geburtsname, "Staatsangeh\u00f6rigkeit", data.staatsangehoerigkeit);
      addFieldRow("Geburtsdatum", data.geburtsdatum, "Geburtsort", data.geburtsort);
      addFieldRow("Stra\u00dfe, Hausnummer", data.strasse, "PLZ, Ort", data.plz + " " + data.ort);
      addField("Voranschrift (bei Umzug in letzten 3 Jahren)", data.voranschrift);

      addSection("Kontaktdaten");
      addFieldRow("Telefon", data.telefon, "E-Mail", data.email);

      addSection("Familienstand");
      addFieldRow("Familienstand", data.familienstand, "Kinder (Anzahl)", data.kinderAnzahl);
      addField("davon im Haushalt lebend", data.kinderImHaushalt);

      addSection("Angaben zur Berufst\u00e4tigkeit");
      addFieldRow("Arbeitgeber", data.arbeitgeber, "Branche", data.branche);
      addFieldRow("Berufsbezeichnung", data.berufsbezeichnung, "Besch\u00e4ftigt seit", data.beschaeftigtSeit);
      addFieldRow("Befristung", data.befristet, "Probezeit", data.probezeit);

      doc.addPage(); y = 15;
      addSection("Verm\u00f6genswerte");
      addFieldRow("Giro-/Tagesgeld-/Sparkonten", fmtCur(data.giroKonten), "Wertpapierverm\u00f6gen", fmtCur(data.wertpapiere));
      addFieldRow("Bausparguthaben", fmtCur(data.bausparGuthaben), "Lebensversicherungen", fmtCur(data.lebensversicherungen));
      addFieldRow("Rentenversicherungen", fmtCur(data.rentenversicherungen), "Immobilien (eigengenutzt)", fmtCur(data.immobilienEigengenutzt));
      addFieldRow("Immobilien (fremdgenutzt)", fmtCur(data.immobilienFremdgenutzt), "Sonstiges", fmtCur(data.sonstigesVermoegen));

      const { data: loans } = await supabase.from("loans").select("bank_name, remaining_balance, monthly_payment, fixed_interest_until, loan_type").eq("user_id", user!.id);
      if (loans && loans.length > 0) {
        addSection("Bestehende Verbindlichkeiten");
        const cols = [margin, margin + 40, margin + 80, margin + 120];
        addText("Darlehensart", cols[0], y, { size: 8, bold: true, color: [80, 80, 80] });
        addText("Restschuld", cols[1], y, { size: 8, bold: true, color: [80, 80, 80] });
        addText("Monatsrate", cols[2], y, { size: 8, bold: true, color: [80, 80, 80] });
        addText("Zinsbindung bis", cols[3], y, { size: 8, bold: true, color: [80, 80, 80] });
        y += 2;
        doc.setDrawColor(200, 200, 200);
        doc.line(margin, y, margin + contentW, y);
        y += 5;
        for (const loan of loans) {
          if (y > 275) { doc.addPage(); y = 15; }
          addText(loan.bank_name || loan.loan_type, cols[0], y, { size: 9 });
          addText(fmtCur(String(loan.remaining_balance || 0)), cols[1], y, { size: 9 });
          addText(fmtCur(String(loan.monthly_payment || 0)), cols[2], y, { size: 9 });
          addText(loan.fixed_interest_until || "\u2013", cols[3], y, { size: 9 });
          y += 6;
        }
        y += 2;
      }

      addSection("Einnahmen pro Monat");
      addFieldRow("Gehalt netto", fmtCur(data.gehaltNetto), "Renten/Pensionen", fmtCur(data.renten));
      addFieldRow("Selbstst\u00e4ndige T\u00e4tigkeit", fmtCur(data.selbststaendig), "Mieteinnahmen (kalt)", fmtCur(data.mieteinnahmen));
      addFieldRow("Kindergeld", fmtCur(data.kindergeld), "Unterhalt", fmtCur(data.unterhaltEinnahmen));
      const sumE = [data.gehaltNetto, data.renten, data.selbststaendig, data.mieteinnahmen, data.kindergeld, data.unterhaltEinnahmen].reduce((s, v) => s + (parseFloat(v) || 0), 0);
      addField("Summe Gesamteinnahmen", fmtCur(sumE.toFixed(2)));

      addSection("Ausgaben pro Monat");
      addFieldRow("Lebenshaltungskosten", fmtCur(data.lebenshaltung), "Warmmiete", fmtCur(data.warmmiete));
      addFieldRow("Private Krankenversicherung", fmtCur(data.krankenversicherung), "Unterhaltszahlungen", fmtCur(data.unterhaltAusgaben));
      addFieldRow("Kita/Kinderbetreuung", fmtCur(data.kitaBeitrag), "Kreditraten/Leasing", fmtCur(data.kreditraten));
      addFieldRow("Sparraten", fmtCur(data.sparraten), "Sonstige Ausgaben", fmtCur(data.sonstigeAusgaben));
      const sumA = [data.lebenshaltung, data.warmmiete, data.krankenversicherung, data.unterhaltAusgaben, data.kitaBeitrag, data.kreditraten, data.sparraten, data.sonstigeAusgaben].reduce((s, v) => s + (parseFloat(v) || 0), 0);
      addField("Summe Gesamtausgaben", fmtCur(sumA.toFixed(2)));

      const ue = sumE - sumA;
      y += 2;
      doc.setFillColor(ue >= 0 ? 230 : 255, ue >= 0 ? 250 : 235, ue >= 0 ? 240 : 235);
      doc.roundedRect(margin, y - 4, contentW, 10, 2, 2, "F");
      addText("\u00dcberschuss (Einnahmen \u2212 Ausgaben)", margin + 3, y + 2, { size: 10, bold: true });
      addText(fmtCur(ue.toFixed(2)), margin + contentW - 40, y + 2, { size: 12, bold: true, color: ue >= 0 ? [42, 157, 110] : [200, 50, 50] });

      if (properties.length > 0) {
        doc.addPage(); y = 15;
        addSection("Immobilien\u00fcbersicht");
        const pCols = [margin, margin + 45, margin + 80, margin + 110, margin + 140];
        ["Objekt", "Wert", "Miete/M", "Restschuld", "Cashflow/M"].forEach((h, i) => addText(h, pCols[i], y, { size: 8, bold: true, color: [80, 80, 80] }));
        y += 2;
        doc.line(margin, y, margin + contentW, y);
        y += 5;
        for (const p of properties) {
          if (y > 275) { doc.addPage(); y = 15; }
          addText(p.name.substring(0, 25), pCols[0], y, { size: 9 });
          addText(fmtCur(String(p.currentValue)), pCols[1], y, { size: 9 });
          addText(fmtCur(String(p.monthlyRent)), pCols[2], y, { size: 9 });
          addText(fmtCur(String(p.remainingDebt)), pCols[3], y, { size: 9 });
          addText(fmtCur(String(p.monthlyCashflow)), pCols[4], y, { size: 9, color: p.monthlyCashflow >= 0 ? [42, 157, 110] : [200, 50, 50] });
          y += 6;
        }
      }

      if (data.bemerkungen) {
        y += 4;
        addSection("Bemerkungen");
        const lines = doc.splitTextToSize(data.bemerkungen, contentW - 4);
        addText(lines.join("\n"), margin + 2, y, { size: 9 });
      }

      doc.addPage(); y = 15;
      addSection("Vollst\u00e4ndigkeitserkl\u00e4rung");
      addText("Hiermit best\u00e4tige ich die Richtigkeit und Vollst\u00e4ndigkeit der gemachten Angaben.", margin, y, { size: 9 });
      y += 15;
      addFieldRow("Ort, Datum", "", "Unterschrift", "");
      y += 10;
      doc.setDrawColor(180, 180, 180);
      doc.line(margin, y, margin + 70, y);
      doc.line(margin + contentW / 2 + 2, y, margin + contentW, y);

      const tp = doc.getNumberOfPages();
      for (let i = 1; i <= tp; i++) {
        doc.setPage(i);
        doc.setFontSize(7);
        doc.setTextColor(180, 180, 180);
        doc.text("Selbstauskunft \u00b7 " + data.vorname + " " + data.name + " \u00b7 Seite " + i + "/" + tp, margin, 290);
        doc.text("Erstellt mit ImmoControl", pageW - margin - 35, 290);
      }

      doc.save("Selbstauskunft_" + (data.name || "Entwurf") + "_" + new Date().toISOString().split("T")[0] + ".pdf");
      toast.success("Selbstauskunft als PDF heruntergeladen!");
    } catch (err: unknown) {
      toast.error("Fehler beim Erstellen: " + (err instanceof Error ? err.message : "Unbekannt"));
    } finally {
      setGenerating(false);
    }
  }, [data, user, properties]);

  // Render helpers as plain functions (not components) to fix focus bug
  const inp = (label: string, field: keyof SelbstauskunftData, type = "text", placeholder = "") => (
    <div className="space-y-1" key={field}>
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <Input
        type={type}
        value={data[field]}
        onChange={(e) => update(field, e.target.value)}
        placeholder={placeholder}
        className="h-9 text-sm"
        inputMode={type === "number" ? "decimal" : undefined}
      />
    </div>
  );

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
            {inp("Stra\u00dfe, Hausnummer", "strasse")}
            <div className="grid grid-cols-3 gap-3">
              {inp("PLZ", "plz")}
              <div className="col-span-2">{inp("Ort", "ort")}</div>
            </div>
            {inp("Voranschrift (bei Umzug in letzten 3 Jahren)", "voranschrift")}
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
              <span className="text-muted-foreground">\u00dcberschuss: </span>
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
              <h4 className="text-sm font-semibold">Zusammenfassung</h4>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div><span className="text-muted-foreground">Name:</span> {data.vorname} {data.name}</div>
                <div><span className="text-muted-foreground">Arbeitgeber:</span> {data.arbeitgeber || "\u2013"}</div>
                <div><span className="text-muted-foreground">Einnahmen:</span> {fmtCur(sumE.toFixed(2))}</div>
                <div><span className="text-muted-foreground">Ausgaben:</span> {fmtCur(sumA.toFixed(2))}</div>
                <div className="col-span-2">
                  <span className="text-muted-foreground">\u00dcberschuss:</span>{" "}
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
            <ChevronLeft className="h-3.5 w-3.5" /> Zur\u00fcck
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
