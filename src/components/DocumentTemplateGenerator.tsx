import { useState } from "react";
import { FileText, Download, Copy, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useProperties } from "@/context/PropertyContext";
import { toast } from "sonner";

const TEMPLATES = [
  { id: "kuendigung", label: "Kündigungsbestätigung", icon: "📄" },
  { id: "mietbescheinigung", label: "Mietbescheinigung", icon: "🏠" },
  { id: "nebenkosteninfo", label: "NK-Abrechnungsschreiben", icon: "📊" },
  { id: "mietanpassung", label: "Mietanpassung", icon: "📈" },
  { id: "schluesseluebergabe", label: "Schlüsselübergabe", icon: "🔑" },
];

const DocumentTemplateGenerator = () => {
  const [template, setTemplate] = useState("");
  const [propertyId, setPropertyId] = useState("");
  const [copied, setCopied] = useState(false);
  const { properties } = useProperties();

  const generateTemplate = () => {
    const prop = properties.find(p => p.id === propertyId);
    if (!prop) { toast.error("Bitte Objekt wählen"); return; }

    const date = new Date().toLocaleDateString("de-DE");
    const templates: Record<string, string> = {
      kuendigung: `Kündigungsbestätigung\n\nDatum: ${date}\nObjekt: ${prop.name}\nAdresse: ${prop.address}\n\nSehr geehrte/r Mieter/in,\n\nhiermit bestätigen wir den Eingang Ihrer Kündigung.\n\nDas Mietverhältnis endet am [DATUM].\n\nBitte vereinbaren Sie einen Termin zur Wohnungsabnahme.\n\nMit freundlichen Grüßen\n[Vermieter]`,
      mietbescheinigung: `Mietbescheinigung\n\nDatum: ${date}\n\nHiermit wird bescheinigt, dass\n[MIETER NAME]\nwohnhaft in ${prop.address}\nseit [EINZUGSDATUM] Mieter der o.g. Wohnung ist.\n\nDie monatliche Miete beträgt ${prop.monthlyRent.toFixed(2)} €.\n\nDiese Bescheinigung wird auf Wunsch des Mieters ausgestellt.\n\n[Vermieter]`,
      nebenkosteninfo: `Nebenkostenabrechnungsschreiben\n\nDatum: ${date}\nObjekt: ${prop.name}\nAdresse: ${prop.address}\n\nSehr geehrte/r Mieter/in,\n\nanbei erhalten Sie die Nebenkostenabrechnung für den Zeitraum [ZEITRAUM].\n\nGesamtkosten: [BETRAG]\nIhre Vorauszahlungen: [VORAUSZAHLUNG]\nGuthaben/Nachzahlung: [DIFFERENZ]\n\nBitte überweisen Sie den Betrag bis zum [DATUM].\n\nMit freundlichen Grüßen\n[Vermieter]`,
      mietanpassung: `Mietanpassungsschreiben\n\nDatum: ${date}\nObjekt: ${prop.name}\nAdresse: ${prop.address}\n\nSehr geehrte/r Mieter/in,\n\nhiermit kündige ich eine Mietanpassung an.\n\nAktuelle Kaltmiete: ${prop.monthlyRent.toFixed(2)} €\nNeue Kaltmiete: [NEUE MIETE] €\n\nDie Anpassung gilt ab dem [DATUM] und beruht auf [BEGRÜNDUNG].\n\nMit freundlichen Grüßen\n[Vermieter]`,
      schluesseluebergabe: `Schlüsselübergabeprotokoll\n\nDatum: ${date}\nObjekt: ${prop.name}\nAdresse: ${prop.address}\n\nÜbergeben an: [MIETER]\n\nÜbergebene Schlüssel:\n□ Haustür: ___ Stück\n□ Wohnungstür: ___ Stück\n□ Keller: ___ Stück\n□ Briefkasten: ___ Stück\n□ Garage: ___ Stück\n\nGesamtanzahl: ___ Schlüssel\n\n_______________ _______________\nVermieter          Mieter`,
    };

    const text = templates[template] || "";
    navigator.clipboard.writeText(text).then(
      () => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
        toast.success("Vorlage in die Zwischenablage kopiert!");
      },
      () => toast.error("Kopieren fehlgeschlagen — kein Clipboard-Zugriff")
    );
  };

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5">
          <FileText className="h-3.5 w-3.5" /> Vorlagen
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
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

          <div className="grid grid-cols-1 gap-2">
            {TEMPLATES.map(t => (
              <button
                key={t.id}
                onClick={() => setTemplate(t.id)}
                className={`flex items-center gap-2 p-3 rounded-lg border text-left transition-colors text-sm ${
                  template === t.id ? "border-primary bg-primary/5" : "border-border hover:border-muted-foreground/30"
                }`}
              >
                <span>{t.icon}</span>
                <span className="font-medium">{t.label}</span>
              </button>
            ))}
          </div>

          <Button onClick={generateTemplate} disabled={!template || !propertyId} className="w-full gap-1.5">
            {copied ? <CheckCircle className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
            {copied ? "Kopiert!" : "Vorlage generieren & kopieren"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default DocumentTemplateGenerator;
