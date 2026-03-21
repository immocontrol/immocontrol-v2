/**
 * INHALT-7: Mieter-Kommunikationshistorie — Kompletter Nachrichtenverlauf
 * Alle E-Mails, Briefe, Anrufe, Notizen pro Mieter chronologisch.
 * Automatische Vorlagen für Mieterhöhung, Kündigung, Betriebskostenabrechnung.
 */
import { memo, useState, useCallback, useMemo } from "react";
import { MessageSquare, Plus, FileText, Phone, Mail, StickyNote, ChevronDown, ChevronUp, Download, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/hooks/useAuth";
import { formatDate, relativeTime } from "@/lib/formatters";
import { toast } from "sonner";

interface CommunicationEntry {
  id: string;
  tenantName: string;
  type: "email" | "brief" | "anruf" | "notiz";
  subject: string;
  content: string;
  date: string;
  direction: "eingehend" | "ausgehend";
}

interface Template {
  name: string;
  subject: string;
  content: string;
}

const TEMPLATES: Template[] = [
  {
    name: "Mieterhöhung §558 BGB",
    subject: "Mieterhöhung gemäß §558 BGB",
    content: `Sehr geehrte/r [Mieter],

gemäß §558 BGB erhöhen wir die Nettokaltmiete für Ihre Wohnung [Adresse] ab dem [Datum] von [Alte Miete] € auf [Neue Miete] € monatlich.

Die Erhöhung beträgt [Prozent]% und liegt damit innerhalb der Kappungsgrenze von 20% in drei Jahren. Die neue Miete entspricht dem örtlichen Mietspiegel.

Bitte teilen Sie uns Ihre Zustimmung innerhalb von zwei Monaten mit.

Mit freundlichen Grüßen
[Vermieter]`,
  },
  {
    name: "Kündigung wegen Eigenbedarf",
    subject: "Kündigung wegen Eigenbedarf",
    content: `Sehr geehrte/r [Mieter],

hiermit kündigen wir das Mietverhältnis für die Wohnung [Adresse] wegen Eigenbedarfs gemäß §573 Abs. 2 Nr. 2 BGB zum [Datum].

Begründung: [Begründung des Eigenbedarfs]

Die Kündigungsfrist beträgt [Frist] Monate gemäß §573c BGB.

Mit freundlichen Grüßen
[Vermieter]`,
  },
  {
    name: "Betriebskostenabrechnung",
    subject: "Betriebskostenabrechnung [Jahr]",
    content: `Sehr geehrte/r [Mieter],

in der Anlage erhalten Sie die Betriebskostenabrechnung für das Jahr [Jahr] für Ihre Wohnung [Adresse].

Gesamtkosten: [Gesamtkosten] €
Ihr Anteil: [Anteil] €
Vorauszahlungen: [Vorauszahlungen] €
[Nachzahlung/Gutschrift]: [Betrag] €

Bitte überweisen Sie den Nachzahlungsbetrag bis zum [Fälligkeitsdatum].

Mit freundlichen Grüßen
[Vermieter]`,
  },
  {
    name: "Mängelbeseitigung",
    subject: "Bestätigung Mängelanzeige",
    content: `Sehr geehrte/r [Mieter],

Ihre Mängelanzeige vom [Datum] haben wir erhalten. Wir werden den gemeldeten Mangel ([Beschreibung]) schnellstmöglich beheben lassen.

Ein Handwerker wird sich in den nächsten [Zeitraum] bei Ihnen melden.

Mit freundlichen Grüßen
[Vermieter]`,
  },
];

const TYPE_ICONS = {
  email: Mail,
  brief: FileText,
  anruf: Phone,
  notiz: StickyNote,
};

const MieterKommunikation = memo(() => {
  const { user } = useAuth();
  const [expanded, setExpanded] = useState(false);
  const [entries, setEntries] = useState<CommunicationEntry[]>(() => {
    try {
      return JSON.parse(localStorage.getItem("immo_comm_history") || "[]");
    } catch { return []; }
  });
  const [showNew, setShowNew] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [newEntry, setNewEntry] = useState<Partial<CommunicationEntry>>({
    type: "email",
    direction: "ausgehend",
    date: new Date().toISOString().slice(0, 10),
  });

  const filteredEntries = useMemo(() => {
    if (!searchTerm) return entries;
    const term = searchTerm.toLowerCase();
    return entries.filter((e) =>
      e.tenantName.toLowerCase().includes(term) ||
      e.subject.toLowerCase().includes(term) ||
      e.content.toLowerCase().includes(term)
    );
  }, [entries, searchTerm]);

  const addEntry = useCallback(() => {
    if (!newEntry.tenantName || !newEntry.subject) {
      toast.error("Bitte Mieter und Betreff angeben");
      return;
    }
    const entry: CommunicationEntry = {
      id: crypto.randomUUID(),
      tenantName: newEntry.tenantName || "",
      type: newEntry.type as CommunicationEntry["type"] || "notiz",
      subject: newEntry.subject || "",
      content: newEntry.content || "",
      date: newEntry.date || new Date().toISOString(),
      direction: newEntry.direction as CommunicationEntry["direction"] || "ausgehend",
    };
    const updated = [entry, ...entries];
    setEntries(updated);
    localStorage.setItem("immo_comm_history", JSON.stringify(updated));
    setNewEntry({ type: "email", direction: "ausgehend", date: new Date().toISOString().slice(0, 10) });
    setShowNew(false);
    toast.success("Eintrag gespeichert");
  }, [newEntry, entries]);

  const applyTemplate = useCallback((template: Template) => {
    setNewEntry((prev) => ({
      ...prev,
      subject: template.subject,
      content: template.content,
    }));
    setShowNew(true);
    toast.success(`Vorlage "${template.name}" geladen`);
  }, []);

  return (
    <div className="gradient-card rounded-xl border border-border p-4 animate-fade-in">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <MessageSquare className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-semibold">Kommunikation</h3>
          <Badge variant="outline" className="text-[10px] h-5">{entries.length} Einträge</Badge>
        </div>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setShowNew(!showNew)}>
            <Plus className="h-3 w-3" />
          </Button>
          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setExpanded(!expanded)}>
            {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
          </Button>
        </div>
      </div>

      {/* Templates */}
      {expanded && (
        <div className="mb-3">
          <p className="text-[10px] text-muted-foreground mb-1">Vorlagen</p>
          <div className="flex flex-wrap gap-1">
            {TEMPLATES.map((t) => (
              <Button key={t.name} size="sm" variant="outline" className="text-[10px] h-6 px-2" onClick={() => applyTemplate(t)}>
                <FileText className="h-3 w-3 mr-1" />
                {t.name}
              </Button>
            ))}
          </div>
        </div>
      )}

      {/* New entry form */}
      {showNew && (
        <div className="surface-section p-2 mb-3 space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <Input className="h-7 text-[10px]" placeholder="Mietername" value={newEntry.tenantName || ""} onChange={(e) => setNewEntry((p) => ({ ...p, tenantName: e.target.value }))} />
            <Select value={newEntry.type} onValueChange={(v) => setNewEntry((p) => ({ ...p, type: v }))}>
              <SelectTrigger className="h-7 text-[10px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="email" className="text-xs">E-Mail</SelectItem>
                <SelectItem value="brief" className="text-xs">Brief</SelectItem>
                <SelectItem value="anruf" className="text-xs">Anruf</SelectItem>
                <SelectItem value="notiz" className="text-xs">Notiz</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Input className="h-7 text-[10px]" placeholder="Betreff" value={newEntry.subject || ""} onChange={(e) => setNewEntry((p) => ({ ...p, subject: e.target.value }))} />
          <Textarea className="text-[10px] min-h-[60px]" placeholder="Inhalt..." value={newEntry.content || ""} onChange={(e) => setNewEntry((p) => ({ ...p, content: e.target.value }))} />
          <Button size="sm" className="w-full text-[10px] h-7" onClick={addEntry}>Speichern</Button>
        </div>
      )}

      {/* Search */}
      {entries.length > 0 && (
        <div className="relative mb-2">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
          <Input className="h-7 text-[10px] pl-7" placeholder="Suchen..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
        </div>
      )}

      {/* Communication timeline */}
      <div className="space-y-1.5 max-h-48 overflow-y-auto">
        {filteredEntries.slice(0, expanded ? 20 : 5).map((entry) => {
          const Icon = TYPE_ICONS[entry.type];
          return (
            <div key={entry.id} className="flex items-start gap-2 p-1.5 rounded-lg bg-background/50 text-[10px]">
              <Icon className="h-3 w-3 text-primary shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <div className="flex justify-between items-start">
                  <span className="font-medium truncate">{entry.tenantName}</span>
                  <span className="text-muted-foreground shrink-0 ml-1">{relativeTime(entry.date)}</span>
                </div>
                <p className="text-muted-foreground truncate">{entry.subject}</p>
              </div>
              <Badge variant="outline" className="text-[8px] h-4 shrink-0">{entry.direction}</Badge>
            </div>
          );
        })}
        {filteredEntries.length === 0 && (
          <p className="text-[10px] text-muted-foreground text-center py-3">Noch keine Einträge</p>
        )}
      </div>
    </div>
  );
});
MieterKommunikation.displayName = "MieterKommunikation";

export { MieterKommunikation };
