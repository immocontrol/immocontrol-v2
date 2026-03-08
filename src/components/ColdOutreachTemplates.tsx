/**
 * E-Mail- und Anschreiben-Vorlagen für Kaltakquise nach Scout-Treffern.
 */
import { useState } from "react";
import { Copy, Mail, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const TEMPLATES = [
  { id: "scout_wgh", label: "WGH-Eigentümer (Kaltanschreiben)", category: "Kaltakquise" },
  { id: "scout_gewerbe", label: "Gewerbeimmobilie (Kaltanschreiben)", category: "Kaltakquise" },
  { id: "expose_anfrage", label: "Exposé-Anfrage (Online-Portal)", category: "Anfrage" },
  { id: "rueckfrage_termin", label: "Rückfrage nach Besichtigung", category: "Nachfassen" },
  { id: "makler_kontakt", label: "Makler-Kontakt (Objektinteresse)", category: "Makler" },
];

const TEMPLATE_BODIES: Record<string, string> = {
  scout_wgh: `Sehr geehrte Damen und Herren,

bei meiner Recherche zu Immobilieninvestments in [ORT/LAGE] bin ich auf Ihre Immobilie an der [ADRESSE] aufmerksam geworden.

Ich bin privater Immobilieninvestor und interessiere mich für den Erwerb von Mehrfamilienhäusern und Eigentumswohnungen. Sollten Sie an einem Verkauf interessiert sein oder Planungen in diese Richtung haben, würde ich mich über eine Rückmeldung freuen.

Bitte nehmen Sie unverbindlich Kontakt mit mir auf.

Mit freundlichen Grüßen
[NAME]
[TELEFON]`,

  scout_gewerbe: `Sehr geehrte Damen und Herren,

bei meiner Suche nach Gewerbeimmobilien in [ORT] bin ich auf Ihr Objekt [ADRESSE] gestoßen.

Ich investiere in Gewerbeimmobilien und wäre an einem Erwerb oder einer Besichtigung interessiert. Falls Sie verkaufen möchten oder Ihr Mietverhältnis planen, freue ich mich über eine Nachricht.

Mit freundlichen Grüßen
[NAME]`,

  expose_anfrage: `Guten Tag,

ich habe Ihr Exposé zu [ADRESSE/OBJEKT] gesehen und hätte Interesse an weiteren Informationen.

Könnten Sie mir bitte die vollständigen Unterlagen (Exposé, Grundriss, Mietverträge) zukommen lassen? Gerne vereinbaren wir auch einen Besichtigungstermin.

Mit freundlichen Grüßen
[NAME]`,

  rueckfrage_termin: `Guten Tag,

vielen Dank für die Besichtigung am [DATUM]. Ich habe das Objekt mit Interesse angesehen.

[Bewertung/Kurze Rückmeldung]

Ich möchte gerne die nächsten Schritte besprechen. Wann hätten Sie Zeit für ein Gespräch?

Mit freundlichen Grüßen
[NAME]`,

  makler_kontakt: `Sehr geehrte Damen und Herren,

ich habe Ihr Angebot zu [OBJEKT/ADRESSE] gesehen und bin daran interessiert.

Bitte senden Sie mir die vollständigen Unterlagen. Ich stehe für eine Besichtigung kurzfristig zur Verfügung.

Mit freundlichen Grüßen
[NAME]
[TELEFON]`,
};

interface ColdOutreachTemplatesProps {
  onSelect?: (templateId: string, body: string) => void;
  className?: string;
}

export function ColdOutreachTemplates({ onSelect, className }: ColdOutreachTemplatesProps) {
  const [selected, setSelected] = useState<string>("");
  const [copied, setCopied] = useState(false);
  const body = selected ? TEMPLATE_BODIES[selected] ?? "" : "";

  const handleCopy = () => {
    if (!body) return;
    navigator.clipboard.writeText(body);
    setCopied(true);
    toast.success("Vorlage kopiert");
    setTimeout(() => setCopied(false), 2000);
  };

  const handleUse = () => {
    if (selected && body) {
      onSelect?.(selected, body);
      toast.success("Vorlage übernommen");
    }
  };

  return (
    <div className={cn("rounded-xl border border-border bg-card p-4", className)}>
      <h3 className="flex items-center gap-2 text-sm font-semibold mb-3">
        <Mail className="h-4 w-4 text-primary" />
        Anschreiben-Vorlagen (Kaltakquise)
      </h3>
      <p className="text-[10px] text-muted-foreground mb-3">
        Vorlagen für Kontaktaufnahme nach Scout-Treffern oder Exposé-Suche. Platzhalter [NAME], [ORT], [ADRESSE] vor dem Versand ersetzen.
      </p>
      <Select value={selected} onValueChange={setSelected}>
        <SelectTrigger className="h-9 text-xs mb-3">
          <SelectValue placeholder="Vorlage wählen …" />
        </SelectTrigger>
        <SelectContent>
          {TEMPLATES.map((t) => (
            <SelectItem key={t.id} value={t.id} className="text-xs">
              {t.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {body && (
        <>
          <Textarea
            value={body}
            readOnly
            className="text-xs min-h-[160px] resize-none font-mono"
          />
          <div className="flex gap-2 mt-2">
            <Button variant="outline" size="sm" className="h-8 text-xs" onClick={handleCopy}>
              {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
              {copied ? " Kopiert" : " Kopieren"}
            </Button>
            {onSelect && (
              <Button variant="default" size="sm" className="h-8 text-xs" onClick={handleUse}>
                Übernehmen
              </Button>
            )}
          </div>
        </>
      )}
    </div>
  );
}
