/**
 * FEATURE-7: Enhanced Document Template Generator
 *
 * - 10 templates (5 original + 5 new: Mietvertrag, Mahnung, Betriebskosten, Renovierung, Einzugsprotokoll)
 * - PDF generation via print window
 * - Auto-fill from property data
 * - Copy to clipboard
 * - Templates grouped by category
 */

import { useState, useCallback } from "react";
import { FileText, Copy, CheckCircle, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useProperties } from "@/context/PropertyContext";
import { escapeHtml } from "@/lib/sanitize";
import { toast } from "sonner";

const TEMPLATES = [
  { id: "kuendigung", label: "Kündigungsbestätigung", icon: "📄", category: "Vertrag" },
  { id: "mietbescheinigung", label: "Mietbescheinigung", icon: "🏠", category: "Bescheinigung" },
  { id: "nebenkosteninfo", label: "NK-Abrechnungsschreiben", icon: "📊", category: "Abrechnung" },
  { id: "mietanpassung", label: "Mietanpassung", icon: "📈", category: "Vertrag" },
  { id: "schluesseluebergabe", label: "Schlüsselübergabe", icon: "🔑", category: "Protokoll" },
  { id: "mietvertrag", label: "Mietvertrag (Entwurf)", icon: "📝", category: "Vertrag" },
  { id: "mahnung", label: "Zahlungsmahnung", icon: "⚠️", category: "Mahnung" },
  { id: "betriebskosten", label: "Betriebskostenabrechnung", icon: "💰", category: "Abrechnung" },
  { id: "renovierung", label: "Renovierungsvereinbarung", icon: "🔧", category: "Protokoll" },
  { id: "einzugsprotokoll", label: "Einzugsprotokoll", icon: "📋", category: "Protokoll" },
];

const DocumentTemplateGenerator = () => {
  const [template, setTemplate] = useState("");
  const [propertyId, setPropertyId] = useState("");
  const [copied, setCopied] = useState(false);
  const { properties } = useProperties();

  const getTemplateText = useCallback((templateId: string, pid: string): string => {
    const prop = properties.find(p => p.id === pid);
    if (!prop) return "";

    const date = new Date().toLocaleDateString("de-DE");
    const rent = prop.monthlyRent.toFixed(2);

    const templates: Record<string, string> = {
      kuendigung: `Kündigungsbestätigung\n\nDatum: ${date}\nObjekt: ${prop.name}\nAdresse: ${prop.address}\n\nSehr geehrte/r Mieter/in,\n\nhiermit bestätigen wir den Eingang Ihrer Kündigung.\n\nDas Mietverhältnis endet am [DATUM].\n\nBitte vereinbaren Sie einen Termin zur Wohnungsabnahme.\n\nMit freundlichen Grüßen\n[Vermieter]`,
      mietbescheinigung: `Mietbescheinigung\n\nDatum: ${date}\n\nHiermit wird bescheinigt, dass\n[MIETER NAME]\nwohnhaft in ${prop.address}\nseit [EINZUGSDATUM] Mieter der o.g. Wohnung ist.\n\nDie monatliche Miete beträgt ${rent} €.\n\nDiese Bescheinigung wird auf Wunsch des Mieters ausgestellt.\n\n[Vermieter]`,
      nebenkosteninfo: `Nebenkostenabrechnungsschreiben\n\nDatum: ${date}\nObjekt: ${prop.name}\nAdresse: ${prop.address}\n\nSehr geehrte/r Mieter/in,\n\nanbei erhalten Sie die Nebenkostenabrechnung für den Zeitraum [ZEITRAUM].\n\nGesamtkosten: [BETRAG]\nIhre Vorauszahlungen: [VORAUSZAHLUNG]\nGuthaben/Nachzahlung: [DIFFERENZ]\n\nBitte überweisen Sie den Betrag bis zum [DATUM].\n\nMit freundlichen Grüßen\n[Vermieter]`,
      mietanpassung: `Mietanpassungsschreiben\n\nDatum: ${date}\nObjekt: ${prop.name}\nAdresse: ${prop.address}\n\nSehr geehrte/r Mieter/in,\n\nhiermit kündige ich eine Mietanpassung an.\n\nAktuelle Kaltmiete: ${rent} €\nNeue Kaltmiete: [NEUE MIETE] €\n\nDie Anpassung gilt ab dem [DATUM] und beruht auf [BEGRÜNDUNG].\n\nMit freundlichen Grüßen\n[Vermieter]`,
      schluesseluebergabe: `Schlüsselübergabeprotokoll\n\nDatum: ${date}\nObjekt: ${prop.name}\nAdresse: ${prop.address}\n\nÜbergeben an: [MIETER]\n\nÜbergebene Schlüssel:\n□ Haustür: ___ Stück\n□ Wohnungstür: ___ Stück\n□ Keller: ___ Stück\n□ Briefkasten: ___ Stück\n□ Garage: ___ Stück\n\nGesamtanzahl: ___ Schlüssel\n\n_______________ _______________\nVermieter          Mieter`,
      mietvertrag: `Mietvertrag (Entwurf)\n\nDatum: ${date}\n\n§ 1 Mietgegenstand\nDer Vermieter vermietet dem Mieter die Wohnung in:\n${prop.name}\n${prop.address}\nWohnfläche: ca. ${prop.sqm} m²\n\n§ 2 Mietzeit\nDas Mietverhältnis beginnt am [EINZUGSDATUM].\nEs wird auf unbestimmte Zeit geschlossen.\n\n§ 3 Miete\nDie monatliche Kaltmiete beträgt: ${rent} €\nNebenkosten-Vorauszahlung: ${prop.monthlyExpenses.toFixed(2)} €\nGesamtmiete: ${(prop.monthlyRent + prop.monthlyExpenses).toFixed(2)} €\n\n§ 4 Kaution\nDer Mieter zahlt eine Kaution in Höhe von [KAUTION] €.\n\n§ 5 Schönheitsreparaturen\n[VEREINBARUNG]\n\n§ 6 Kündigung\nDie gesetzliche Kündigungsfrist beträgt 3 Monate zum Monatsende.\n\n_______________ _______________\nVermieter          Mieter`,
      mahnung: `Zahlungsmahnung\n\nDatum: ${date}\nObjekt: ${prop.name}\nAdresse: ${prop.address}\n\nSehr geehrte/r [MIETER NAME],\n\nleider mussten wir feststellen, dass die Mietzahlung für [MONAT/JAHR] in Höhe von ${rent} € noch nicht eingegangen ist.\n\nWir bitten Sie höflich, den offenen Betrag bis zum [FRIST DATUM] auf folgendes Konto zu überweisen:\n\n[KONTOINHABER]\n[IBAN]\n[BIC]\nVerwendungszweck: Miete ${prop.name} [MONAT/JAHR]\n\nSollte die Zahlung bereits veranlasst sein, betrachten Sie dieses Schreiben als gegenstandslos.\n\nMit freundlichen Grüßen\n[Vermieter]`,
      betriebskosten: `Betriebskostenabrechnung\n\nDatum: ${date}\nObjekt: ${prop.name}\nAdresse: ${prop.address}\nAbrechnungszeitraum: [01.01.YYYY] – [31.12.YYYY]\nMieter: [MIETER NAME]\nWohnfläche: ${prop.sqm} m²\n\nPosition                        Gesamtkosten    Ihr Anteil\n────────────────────────────────────────────────\nGrundsteuer                     [BETRAG] €      [ANTEIL] €\nWasser / Abwasser               [BETRAG] €      [ANTEIL] €\nMüllabfuhr                      [BETRAG] €      [ANTEIL] €\nHausreinigung                   [BETRAG] €      [ANTEIL] €\nGartenpflege                    [BETRAG] €      [ANTEIL] €\nAllgemeinstrom                  [BETRAG] €      [ANTEIL] €\nVersicherungen                  [BETRAG] €      [ANTEIL] €\nSchornsteinfeger                [BETRAG] €      [ANTEIL] €\n────────────────────────────────────────────────\nSumme                                           [GESAMT] €\nIhre Vorauszahlungen                             [VZ] €\n────────────────────────────────────────────────\nGuthaben / Nachzahlung                           [DIFF] €\n\n[Vermieter]`,
      renovierung: `Renovierungsvereinbarung\n\nDatum: ${date}\nObjekt: ${prop.name}\nAdresse: ${prop.address}\n\nZwischen\n[VERMIETER] (Vermieter)\nund\n[MIETER] (Mieter)\n\nwird folgende Vereinbarung über Renovierungsarbeiten getroffen:\n\n1. Beschreibung der Arbeiten:\n   [BESCHREIBUNG DER ARBEITEN]\n\n2. Zeitraum:\n   Beginn: [STARTDATUM]\n   Voraussichtliches Ende: [ENDDATUM]\n\n3. Kostenübernahme:\n   □ Vermieter trägt alle Kosten\n   □ Mieter trägt alle Kosten\n   □ Kostenteilung: Vermieter [X]% / Mieter [Y]%\n\n4. Mietminderung während der Arbeiten:\n   □ Keine Mietminderung\n   □ Mietminderung von [X]% für [ZEITRAUM]\n\n_______________ _______________\nVermieter          Mieter`,
      einzugsprotokoll: `Wohnungsübergabeprotokoll (Einzug)\n\nDatum: ${date}\nObjekt: ${prop.name}\nAdresse: ${prop.address}\nMieter: [MIETER NAME]\n\nZählerstände:\nStrom:    _______________ kWh  (Zähler-Nr.: ___________)\nGas:      _______________ m³   (Zähler-Nr.: ___________)\nWasser:   _______________ m³   (Zähler-Nr.: ___________)\nHeizung:  _______________      (Zähler-Nr.: ___________)\n\nRaumzustand:\nFlur:          □ gut  □ Mängel: _______________________\nWohnzimmer:    □ gut  □ Mängel: _______________________\nSchlafzimmer:  □ gut  □ Mängel: _______________________\nKüche:         □ gut  □ Mängel: _______________________\nBad:           □ gut  □ Mängel: _______________________\nBalkon/Terr.:  □ gut  □ Mängel: _______________________\nKeller:        □ gut  □ Mängel: _______________________\n\nSchlüssel: ___ Stück übergeben (Haupt: ___ Keller: ___ Briefk.: ___)\n\nBemerkungen:\n____________________________________________________________\n\n_______________ _______________\nVermieter          Mieter`,
    };

    return templates[templateId] || "";
  }, [properties]);

  const generateTemplate = () => {
    const prop = properties.find(p => p.id === propertyId);
    if (!prop) { toast.error("Bitte Objekt wählen"); return; }

    const text = getTemplateText(template, propertyId);
    navigator.clipboard.writeText(text).then(
      () => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
        toast.success("Vorlage in die Zwischenablage kopiert!");
      },
      () => toast.error("Kopieren fehlgeschlagen — kein Clipboard-Zugriff")
    );
  };

  /** FEATURE-7: Generate PDF via print window */
  const generatePDF = () => {
    const prop = properties.find(p => p.id === propertyId);
    if (!prop) { toast.error("Bitte Objekt wählen"); return; }

    const text = getTemplateText(template, propertyId);
    const templateLabel = TEMPLATES.find(t => t.id === template)?.label || "Dokument";

    const html = `<!DOCTYPE html>
<html lang="de"><head><meta charset="UTF-8"><title>${templateLabel}</title>
<style>
  body { font-family: 'Segoe UI', system-ui, sans-serif; padding: 50px; color: #222; max-width: 700px; margin: 0 auto; line-height: 1.6; font-size: 14px; }
  h1 { font-size: 20px; border-bottom: 2px solid #2a9d6e; padding-bottom: 8px; margin-bottom: 20px; }
  pre { white-space: pre-wrap; font-family: inherit; }
  .footer { margin-top: 60px; font-size: 10px; color: #aaa; text-align: center; border-top: 1px solid #eee; padding-top: 10px; }
  .placeholder { background: #fff3cd; padding: 1px 4px; border-radius: 3px; font-weight: 600; }
  @media print { body { padding: 30px; } .no-print { display: none; } }
</style></head><body>
<h1>${templateLabel}</h1>
<pre>${escapeHtml(text).replace(/\[([^\]]+)\]/g, '<span class="placeholder">[$1]</span>')}</pre>
<div class="footer">ImmoControl · ${templateLabel} · ${new Date().toLocaleDateString("de-DE")}</div>
<div class="no-print" style="margin-top:30px;text-align:center">
  <button onclick="window.print()" style="padding:8px 24px;background:#2a9d6e;color:white;border:none;border-radius:6px;cursor:pointer;font-size:14px">Drucken / Als PDF speichern</button>
</div>
</body></html>`;

    const printWindow = window.open("", "_blank");
    if (printWindow) {
      printWindow.document.write(html);
      printWindow.document.close();
    }
    toast.success(`${templateLabel} als PDF geöffnet`);
  };

  // Group templates by category
  const categories = [...new Set(TEMPLATES.map(t => t.category))];

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5">
          <FileText className="h-3.5 w-3.5" /> Vorlagen
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Dokumentvorlagen</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <Select value={propertyId} onValueChange={setPropertyId}>
            <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Objekt wählen" /></SelectTrigger>
            <SelectContent>
              {properties.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
            </SelectContent>
          </Select>

          {categories.map(cat => (
            <div key={cat}>
              <div className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium mb-1.5">{cat}</div>
              <div className="space-y-1.5">
                {TEMPLATES.filter(t => t.category === cat).map(t => (
                  <button
                    key={t.id}
                    onClick={() => setTemplate(t.id)}
                    className={`flex items-center gap-2 p-2.5 rounded-lg border text-left transition-colors text-sm w-full ${
                      template === t.id ? "border-primary bg-primary/5" : "border-border hover:border-muted-foreground/30"
                    }`}
                  >
                    <span>{t.icon}</span>
                    <span className="font-medium">{t.label}</span>
                  </button>
                ))}
              </div>
            </div>
          ))}

          <div className="grid grid-cols-2 gap-2">
            <Button onClick={generateTemplate} disabled={!template || !propertyId} className="gap-1.5">
              {copied ? <CheckCircle className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
              {copied ? "Kopiert!" : "Kopieren"}
            </Button>
            <Button variant="outline" onClick={generatePDF} disabled={!template || !propertyId} className="gap-1.5">
              <Printer className="h-3.5 w-3.5" /> Als PDF
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default DocumentTemplateGenerator;
