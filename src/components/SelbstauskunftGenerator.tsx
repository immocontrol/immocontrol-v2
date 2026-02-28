import { useState, useEffect, useCallback } from "react";
import { FileText, Download, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useAuth } from "@/hooks/useAuth";
import { useProperties } from "@/context/PropertyContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { jsPDF } from "jspdf";

interface SelbstauskunftData {
  // Persönliche Daten
  anrede: string;
  titel: string;
  name: string;
  vorname: string;
  geburtsname: string;
  staatsangehoerigkeit: string;
  geburtsdatum: string;
  geburtsort: string;
  strasse: string;
  plz: string;
  ort: string;
  voranschrift: string;
  telefon: string;
  email: string;
  familienstand: string;
  kinderAnzahl: string;
  kinderImHaushalt: string;
  // Berufstätigkeit
  arbeitgeber: string;
  branche: string;
  berufsbezeichnung: string;
  beschaeftigtSeit: string;
  befristet: string;
  probezeit: string;
  // Vermögen
  giroKonten: string;
  wertpapiere: string;
  bausparGuthaben: string;
  lebensversicherungen: string;
  rentenversicherungen: string;
  immobilienEigengenutzt: string;
  immobilienFremdgenutzt: string;
  sonstigesVermoegen: string;
  // Einnahmen
  gehaltNetto: string;
  renten: string;
  selbststaendig: string;
  mieteinnahmen: string;
  kindergeld: string;
  unterhaltEinnahmen: string;
  // Ausgaben
  lebenshaltung: string;
  warmmiete: string;
  krankenversicherung: string;
  unterhaltAusgaben: string;
  kitaBeitrag: string;
  kreditraten: string;
  sparraten: string;
  sonstigeAusgaben: string;
  // Bemerkungen
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
  rentenversicherungen: "", immobilienEigengenutzt: "", immobilienFremdgenutzt: "",
  sonstigesVermoegen: "",
  gehaltNetto: "", renten: "", selbststaendig: "", mieteinnahmen: "",
  kindergeld: "", unterhaltEinnahmen: "",
  lebenshaltung: "", warmmiete: "", krankenversicherung: "", unterhaltAusgaben: "",
  kitaBeitrag: "", kreditraten: "", sparraten: "", sonstigeAusgaben: "",
  bemerkungen: "",
};

const formatCurrency = (v: string) => {
  const n = parseFloat(v);
  return isNaN(n) ? "" : n.toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " €";
};

export const SelbstauskunftGenerator = () => {
  const { user } = useAuth();
  const { properties } = useProperties();
  const [data, setData] = useState<SelbstauskunftData>(defaultData);
  const [generating, setGenerating] = useState(false);
  const [open, setOpen] = useState(false);

  // Pre-fill from profile and properties
  useEffect(() => {
    if (!user || !open) return;
    const prefill = async () => {
      const { data: profile } = await supabase
        .from("profiles")
        .select("display_name")
        .eq("user_id", user.id)
        .maybeSingle();

      const { data: loans } = await supabase
        .from("loans")
        .select("remaining_balance, monthly_payment")
        .eq("user_id", user.id);

      const totalRent = properties.reduce((s, p) => s + (p.monthlyRent || 0), 0);
      const totalDebt = loans?.reduce((s, l) => s + Number(l.remaining_balance || 0), 0) || 0;
      const totalRate = loans?.reduce((s, l) => s + Number(l.monthly_payment || 0), 0) || 0;
      const totalPropertyValue = properties.reduce((s, p) => s + (p.currentValue || 0), 0);

      const nameParts = (profile?.display_name || "").split(" ");
      setData(prev => ({
        ...prev,
        email: user.email || "",
        vorname: nameParts[0] || "",
        name: nameParts.slice(1).join(" ") || "",
        mieteinnahmen: totalRent > 0 ? totalRent.toFixed(2) : "",
        kreditraten: totalRate > 0 ? totalRate.toFixed(2) : "",
        immobilienFremdgenutzt: totalPropertyValue > 0 ? totalPropertyValue.toFixed(2) : "",
      }));
    };
    prefill();
  }, [user, open, properties]);

  const update = useCallback((key: keyof SelbstauskunftData, value: string) => {
    setData(prev => ({ ...prev, [key]: value }));
  }, []);

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
        if (opts.color) doc.setTextColor(...opts.color);
        else doc.setTextColor(30, 30, 30);
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

      const addField = (label: string, value: string, col: 0 | 1 = 0) => {
        if (y > 275) { doc.addPage(); y = 15; }
        const x = col === 0 ? margin : margin + contentW / 2 + 2;
        const w = contentW / 2 - 2;
        addText(label, x, y, { size: 7, color: [120, 120, 120] });
        y += 4;
        // Draw input field box
        doc.setDrawColor(200, 200, 200);
        doc.setFillColor(250, 250, 250);
        doc.roundedRect(x, y - 3, w, 6, 1, 1, "FD");
        addText(value || "", x + 2, y + 1, { size: 9 });
        y += 8;
      };

      const addFieldRow = (label1: string, value1: string, label2: string, value2: string) => {
        if (y > 275) { doc.addPage(); y = 15; }
        const x1 = margin;
        const x2 = margin + contentW / 2 + 2;
        const w = contentW / 2 - 2;
        addText(label1, x1, y, { size: 7, color: [120, 120, 120] });
        addText(label2, x2, y, { size: 7, color: [120, 120, 120] });
        y += 4;
        doc.setDrawColor(200, 200, 200);
        doc.setFillColor(250, 250, 250);
        doc.roundedRect(x1, y - 3, w, 6, 1, 1, "FD");
        doc.roundedRect(x2, y - 3, w, 6, 1, 1, "FD");
        addText(value1 || "", x1 + 2, y + 1, { size: 9 });
        addText(value2 || "", x2 + 2, y + 1, { size: 9 });
        y += 8;
      };

      // Header
      addText("Selbstauskunft", margin, y, { size: 18, bold: true, color: [42, 157, 110] });
      y += 5;
      addText(`Erstellt am ${new Date().toLocaleDateString("de-DE")} · ImmoControl`, margin, y, { size: 8, color: [150, 150, 150] });
      y += 8;

      // Persönliche Daten
      addSection("Persönliche Daten");
      addFieldRow("Anrede", data.anrede, "Titel", data.titel);
      addFieldRow("Name", data.name, "Vorname", data.vorname);
      addFieldRow("Geburtsname", data.geburtsname, "Staatsangehörigkeit", data.staatsangehoerigkeit);
      addFieldRow("Geburtsdatum", data.geburtsdatum, "Geburtsort", data.geburtsort);
      addFieldRow("Straße, Hausnummer", data.strasse, "PLZ, Ort", `${data.plz} ${data.ort}`);
      addField("Voranschrift (bei Umzug in letzten 3 Jahren)", data.voranschrift);

      // Kontakt
      addSection("Kontaktdaten");
      addFieldRow("Telefon", data.telefon, "E-Mail", data.email);

      // Familienstand
      addSection("Familienstand");
      addFieldRow("Familienstand", data.familienstand, "Kinder (Anzahl)", data.kinderAnzahl);
      addField("davon im Haushalt lebend", data.kinderImHaushalt);

      // Berufstätigkeit
      addSection("Angaben zur Berufstätigkeit");
      addFieldRow("Arbeitgeber", data.arbeitgeber, "Branche", data.branche);
      addFieldRow("Berufsbezeichnung", data.berufsbezeichnung, "Beschäftigt seit", data.beschaeftigtSeit);
      addFieldRow("Befristung", data.befristet, "Probezeit", data.probezeit);

      // Vermögenswerte
      doc.addPage(); y = 15;
      addSection("Vermögenswerte");
      addFieldRow("Giro-/Tagesgeld-/Sparkonten", formatCurrency(data.giroKonten), "Wertpapiervermögen", formatCurrency(data.wertpapiere));
      addFieldRow("Bausparguthaben", formatCurrency(data.bausparGuthaben), "Lebensversicherungen", formatCurrency(data.lebensversicherungen));
      addFieldRow("Rentenversicherungen", formatCurrency(data.rentenversicherungen), "Immobilien (eigengenutzt)", formatCurrency(data.immobilienEigengenutzt));
      addFieldRow("Immobilien (fremdgenutzt)", formatCurrency(data.immobilienFremdgenutzt), "Sonstiges", formatCurrency(data.sonstigesVermoegen));

      // Bestehende Verbindlichkeiten from loans
      const { data: loans } = await supabase
        .from("loans")
        .select("bank_name, remaining_balance, monthly_payment, fixed_interest_until, loan_type")
        .eq("user_id", user!.id);

      if (loans && loans.length > 0) {
        addSection("Bestehende Verbindlichkeiten");
        // Table header
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
          addText(`${loan.bank_name || loan.loan_type}`, cols[0], y, { size: 9 });
          addText(formatCurrency(String(loan.remaining_balance || 0)), cols[1], y, { size: 9 });
          addText(formatCurrency(String(loan.monthly_payment || 0)), cols[2], y, { size: 9 });
          addText(loan.fixed_interest_until || "–", cols[3], y, { size: 9 });
          y += 6;
        }
        y += 2;
      }

      // Einnahmen
      addSection("Einnahmen pro Monat");
      addFieldRow("Gehalt netto", formatCurrency(data.gehaltNetto), "Renten/Pensionen", formatCurrency(data.renten));
      addFieldRow("Selbstständige Tätigkeit", formatCurrency(data.selbststaendig), "Mieteinnahmen (kalt)", formatCurrency(data.mieteinnahmen));
      addFieldRow("Kindergeld", formatCurrency(data.kindergeld), "Unterhalt", formatCurrency(data.unterhaltEinnahmen));
      const sumEinnahmen = [data.gehaltNetto, data.renten, data.selbststaendig, data.mieteinnahmen, data.kindergeld, data.unterhaltEinnahmen]
        .reduce((s, v) => s + (parseFloat(v) || 0), 0);
      addField("Summe Gesamteinnahmen", formatCurrency(sumEinnahmen.toFixed(2)));

      // Ausgaben
      addSection("Ausgaben pro Monat");
      addFieldRow("Lebenshaltungskosten", formatCurrency(data.lebenshaltung), "Warmmiete", formatCurrency(data.warmmiete));
      addFieldRow("Private Krankenversicherung", formatCurrency(data.krankenversicherung), "Unterhaltszahlungen", formatCurrency(data.unterhaltAusgaben));
      addFieldRow("Kita/Kinderbetreuung", formatCurrency(data.kitaBeitrag), "Kreditraten/Leasing", formatCurrency(data.kreditraten));
      addFieldRow("Sparraten", formatCurrency(data.sparraten), "Sonstige Ausgaben", formatCurrency(data.sonstigeAusgaben));
      const sumAusgaben = [data.lebenshaltung, data.warmmiete, data.krankenversicherung, data.unterhaltAusgaben, data.kitaBeitrag, data.kreditraten, data.sparraten, data.sonstigeAusgaben]
        .reduce((s, v) => s + (parseFloat(v) || 0), 0);
      addField("Summe Gesamtausgaben", formatCurrency(sumAusgaben.toFixed(2)));

      // Überschuss
      const ueberschuss = sumEinnahmen - sumAusgaben;
      y += 2;
      doc.setFillColor(ueberschuss >= 0 ? 230 : 255, ueberschuss >= 0 ? 250 : 235, ueberschuss >= 0 ? 240 : 235);
      doc.roundedRect(margin, y - 4, contentW, 10, 2, 2, "F");
      addText("Überschuss (Einnahmen − Ausgaben)", margin + 3, y + 2, { size: 10, bold: true });
      addText(formatCurrency(ueberschuss.toFixed(2)), margin + contentW - 40, y + 2, { size: 12, bold: true, color: ueberschuss >= 0 ? [42, 157, 110] : [200, 50, 50] });

      // Immobilienübersicht
      if (properties.length > 0) {
        doc.addPage(); y = 15;
        addSection("Immobilienübersicht");
        const pCols = [margin, margin + 45, margin + 80, margin + 110, margin + 140];
        addText("Objekt", pCols[0], y, { size: 8, bold: true, color: [80, 80, 80] });
        addText("Wert", pCols[1], y, { size: 8, bold: true, color: [80, 80, 80] });
        addText("Miete/M", pCols[2], y, { size: 8, bold: true, color: [80, 80, 80] });
        addText("Restschuld", pCols[3], y, { size: 8, bold: true, color: [80, 80, 80] });
        addText("Cashflow/M", pCols[4], y, { size: 8, bold: true, color: [80, 80, 80] });
        y += 2;
        doc.line(margin, y, margin + contentW, y);
        y += 5;
        for (const p of properties) {
          if (y > 275) { doc.addPage(); y = 15; }
          addText(p.name.substring(0, 25), pCols[0], y, { size: 9 });
          addText(formatCurrency(String(p.currentValue)), pCols[1], y, { size: 9 });
          addText(formatCurrency(String(p.monthlyRent)), pCols[2], y, { size: 9 });
          addText(formatCurrency(String(p.remainingDebt)), pCols[3], y, { size: 9 });
          const cf = p.monthlyCashflow;
          addText(formatCurrency(String(cf)), pCols[4], y, { size: 9, color: cf >= 0 ? [42, 157, 110] : [200, 50, 50] });
          y += 6;
        }
      }

      // Bemerkungen
      if (data.bemerkungen) {
        y += 4;
        addSection("Bemerkungen");
        const lines = doc.splitTextToSize(data.bemerkungen, contentW - 4);
        addText(lines.join("\n"), margin + 2, y, { size: 9 });
      }

      // Vollständigkeitserklärung
      doc.addPage(); y = 15;
      addSection("Vollständigkeitserklärung");
      addText("Hiermit bestätige ich die Richtigkeit und Vollständigkeit der gemachten Angaben.", margin, y, { size: 9 });
      y += 15;
      addFieldRow("Ort, Datum", "", "Unterschrift", "");
      y += 10;
      doc.setDrawColor(180, 180, 180);
      doc.line(margin, y, margin + 70, y);
      doc.line(margin + contentW / 2 + 2, y, margin + contentW, y);

      // Footer on each page
      const totalPages = doc.getNumberOfPages();
      for (let i = 1; i <= totalPages; i++) {
        doc.setPage(i);
        doc.setFontSize(7);
        doc.setTextColor(180, 180, 180);
        doc.text(`Selbstauskunft · ${data.vorname} ${data.name} · Seite ${i}/${totalPages}`, margin, 290);
        doc.text("Erstellt mit ImmoControl", pageW - margin - 35, 290);
      }

      doc.save(`Selbstauskunft_${data.name || "Entwurf"}_${new Date().toISOString().split("T")[0]}.pdf`);
      toast.success("Selbstauskunft als PDF heruntergeladen!");
    } catch (err: unknown) {
      toast.error("Fehler beim Erstellen: " + (err instanceof Error ? err.message : "Unbekannt"));
    } finally {
      setGenerating(false);
    }
  }, [data, user, properties]);

  const InputField = ({ label, field, type = "text", placeholder = "" }: { label: string; field: keyof SelbstauskunftData; type?: string; placeholder?: string }) => (
    <div className="space-y-1">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <Input
        type={type}
        value={data[field]}
        onChange={(e) => update(field, e.target.value)}
        placeholder={placeholder}
        className="h-8 text-sm"
      />
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5">
          <FileText className="h-3.5 w-3.5" /> Selbstauskunft
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] p-0">
        <DialogHeader className="p-6 pb-0">
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" />
            Selbstauskunft für Bankfinanzierung
          </DialogTitle>
          <p className="text-xs text-muted-foreground">
            Daten aus deinem Portfolio werden automatisch übernommen. Ergänze die fehlenden Angaben und lade die PDF herunter.
          </p>
        </DialogHeader>
        <ScrollArea className="max-h-[calc(90vh-140px)] px-6 pb-6">
          <div className="space-y-6 pt-4">
            {/* Persönliche Daten */}
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-primary">Persönliche Daten</h3>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Anrede</Label>
                  <Select value={data.anrede} onValueChange={(v) => update("anrede", v)}>
                    <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="Wählen..." /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Herr">Herr</SelectItem>
                      <SelectItem value="Frau">Frau</SelectItem>
                      <SelectItem value="Divers">Divers</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <InputField label="Titel" field="titel" placeholder="z.B. Dr." />
                <InputField label="Nachname" field="name" />
                <InputField label="Vorname" field="vorname" />
                <InputField label="Geburtsname" field="geburtsname" />
                <InputField label="Staatsangehörigkeit" field="staatsangehoerigkeit" />
                <InputField label="Geburtsdatum" field="geburtsdatum" type="date" />
                <InputField label="Geburtsort" field="geburtsort" />
              </div>
              <InputField label="Straße, Hausnummer" field="strasse" />
              <div className="grid grid-cols-3 gap-3">
                <InputField label="PLZ" field="plz" />
                <div className="col-span-2">
                  <InputField label="Ort" field="ort" />
                </div>
              </div>
              <InputField label="Voranschrift (bei Umzug in letzten 3 Jahren)" field="voranschrift" />
            </div>

            {/* Kontakt */}
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-primary">Kontaktdaten</h3>
              <div className="grid grid-cols-2 gap-3">
                <InputField label="Telefon" field="telefon" type="tel" />
                <InputField label="E-Mail" field="email" type="email" />
              </div>
            </div>

            {/* Familienstand */}
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-primary">Familienstand</h3>
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Familienstand</Label>
                  <Select value={data.familienstand} onValueChange={(v) => update("familienstand", v)}>
                    <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="Wählen..." /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ledig">Ledig</SelectItem>
                      <SelectItem value="verheiratet">Verheiratet</SelectItem>
                      <SelectItem value="geschieden">Geschieden</SelectItem>
                      <SelectItem value="verwitwet">Verwitwet</SelectItem>
                      <SelectItem value="getrennt">Getrennt lebend</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <InputField label="Kinder (Anzahl)" field="kinderAnzahl" type="number" />
                <InputField label="davon im Haushalt" field="kinderImHaushalt" type="number" />
              </div>
            </div>

            {/* Berufstätigkeit */}
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-primary">Berufstätigkeit</h3>
              <div className="grid grid-cols-2 gap-3">
                <InputField label="Arbeitgeber" field="arbeitgeber" />
                <InputField label="Branche" field="branche" />
                <InputField label="Berufsbezeichnung" field="berufsbezeichnung" />
                <InputField label="Beschäftigt seit" field="beschaeftigtSeit" type="date" />
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Befristung</Label>
                  <Select value={data.befristet} onValueChange={(v) => update("befristet", v)}>
                    <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="nein">Nein</SelectItem>
                      <SelectItem value="ja">Ja</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Probezeit</Label>
                  <Select value={data.probezeit} onValueChange={(v) => update("probezeit", v)}>
                    <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="nein">Nein</SelectItem>
                      <SelectItem value="ja">Ja</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            {/* Vermögenswerte */}
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-primary">Vermögenswerte</h3>
              <div className="grid grid-cols-2 gap-3">
                <InputField label="Giro-/Tagesgeld-/Sparkonten (€)" field="giroKonten" type="number" />
                <InputField label="Wertpapiervermögen (€)" field="wertpapiere" type="number" />
                <InputField label="Bausparguthaben (€)" field="bausparGuthaben" type="number" />
                <InputField label="Lebensversicherungen (€)" field="lebensversicherungen" type="number" />
                <InputField label="Rentenversicherungen (€)" field="rentenversicherungen" type="number" />
                <InputField label="Immobilien eigengenutzt (€)" field="immobilienEigengenutzt" type="number" />
                <InputField label="Immobilien fremdgenutzt (€)" field="immobilienFremdgenutzt" type="number" />
                <InputField label="Sonstiges (€)" field="sonstigesVermoegen" type="number" />
              </div>
            </div>

            {/* Einnahmen */}
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-primary">Einnahmen pro Monat</h3>
              <div className="grid grid-cols-2 gap-3">
                <InputField label="Gehalt netto (€)" field="gehaltNetto" type="number" />
                <InputField label="Renten/Pensionen (€)" field="renten" type="number" />
                <InputField label="Selbstständige Tätigkeit (€)" field="selbststaendig" type="number" />
                <InputField label="Mieteinnahmen kalt (€)" field="mieteinnahmen" type="number" />
                <InputField label="Kindergeld (€)" field="kindergeld" type="number" />
                <InputField label="Unterhalt (€)" field="unterhaltEinnahmen" type="number" />
              </div>
            </div>

            {/* Ausgaben */}
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-primary">Ausgaben pro Monat</h3>
              <div className="grid grid-cols-2 gap-3">
                <InputField label="Lebenshaltungskosten (€)" field="lebenshaltung" type="number" />
                <InputField label="Warmmiete (€)" field="warmmiete" type="number" />
                <InputField label="Private Krankenversicherung (€)" field="krankenversicherung" type="number" />
                <InputField label="Unterhaltszahlungen (€)" field="unterhaltAusgaben" type="number" />
                <InputField label="Kita/Kinderbetreuung (€)" field="kitaBeitrag" type="number" />
                <InputField label="Kreditraten/Leasing (€)" field="kreditraten" type="number" />
                <InputField label="Sparraten (€)" field="sparraten" type="number" />
                <InputField label="Sonstige Ausgaben (€)" field="sonstigeAusgaben" type="number" />
              </div>
            </div>

            {/* Bemerkungen */}
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Bemerkungen</Label>
              <textarea
                value={data.bemerkungen}
                onChange={(e) => update("bemerkungen", e.target.value)}
                placeholder="Weitere Angaben, Anmerkungen..."
                className="w-full h-20 bg-secondary text-foreground text-sm rounded-lg px-3 py-2 outline-none resize-none border border-input"
              />
            </div>

            {/* Generate */}
            <Button onClick={generatePDF} disabled={generating} className="w-full gap-2">
              {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
              {generating ? "Wird erstellt..." : "Selbstauskunft als PDF herunterladen"}
            </Button>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
};
