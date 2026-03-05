/**
 * INHALT-17: Due-Diligence-Checkliste — Strukturierte Ankaufsprüfung
 * Alle relevanten Dokumente und Prüfpunkte vor dem Kauf einer Immobilie.
 * Checkliste mit Fortschrittsanzeige und Ampelsystem.
 */
import { memo, useState, useCallback, useMemo } from "react";
import { Search, CheckCircle2, Circle, AlertTriangle, ChevronDown, ChevronUp, Plus, Download, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatDate } from "@/lib/formatters";
import { toast } from "sonner";
import { ManusDueDiligence } from "@/components/manus/ManusDueDiligence";

interface DDItem {
  id: string;
  label: string;
  category: string;
  status: "offen" | "ok" | "warnung" | "fehlt";
  notes: string;
}

interface DDChecklist {
  id: string;
  objectName: string;
  items: DDItem[];
  createdAt: string;
}

const DEFAULT_DD_ITEMS: Omit<DDItem, "id" | "status" | "notes">[] = [
  // Grundbuch & Rechtliches
  { label: "Grundbuchauszug (max. 3 Monate alt)", category: "Grundbuch & Recht" },
  { label: "Teilungserklärung (bei WEG)", category: "Grundbuch & Recht" },
  { label: "Altlasten-Auskunft", category: "Grundbuch & Recht" },
  { label: "Baulastenverzeichnis", category: "Grundbuch & Recht" },
  { label: "Bebauungsplan / §34 BauGB", category: "Grundbuch & Recht" },
  // Finanzen
  { label: "Mieterliste mit Miethöhen", category: "Finanzen" },
  { label: "Mietverträge aller Einheiten", category: "Finanzen" },
  { label: "NK-Abrechnungen letzte 3 Jahre", category: "Finanzen" },
  { label: "Wirtschaftsplan (WEG)", category: "Finanzen" },
  { label: "Instandhaltungsrücklage (WEG)", category: "Finanzen" },
  { label: "Hausgeld-Abrechnungen", category: "Finanzen" },
  // Technisch
  { label: "Energieausweis", category: "Technik" },
  { label: "Grundrisse / Baupläne", category: "Technik" },
  { label: "Sanierungshistorie", category: "Technik" },
  { label: "Zustand Dach, Fassade, Fenster", category: "Technik" },
  { label: "Heizungsanlage (Alter, Typ)", category: "Technik" },
  { label: "Leitungen (Wasser, Elektro, Gas)", category: "Technik" },
  // Mieter
  { label: "Mieterbonität geprüft", category: "Mieter" },
  { label: "Mietrückstände vorhanden?", category: "Mieter" },
  { label: "Leerstand / Kündigungen?", category: "Mieter" },
  // Sonstiges
  { label: "Objektbesichtigung durchgeführt", category: "Besichtigung" },
  { label: "Nachbarschaft / Umfeld geprüft", category: "Besichtigung" },
  { label: "Marktmiete recherchiert", category: "Besichtigung" },
  { label: "Rendite-Berechnung erstellt", category: "Kalkulation" },
  { label: "Finanzierungszusage eingeholt", category: "Kalkulation" },
];

const STORAGE_KEY = "immo_dd_checklists";

const DueDiligenceCheckliste = memo(() => {
  const [expanded, setExpanded] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [newName, setNewName] = useState("");
  const [selectedChecklist, setSelectedChecklist] = useState<string | null>(null);

  const [checklists, setChecklists] = useState<DDChecklist[]>(() => {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]"); }
    catch { return []; }
  });

  const currentChecklist = checklists.find((c) => c.id === selectedChecklist);

  const progress = useMemo(() => {
    if (!currentChecklist) return { total: 0, done: 0, warnings: 0, percent: 0 };
    const total = currentChecklist.items.length;
    const done = currentChecklist.items.filter((i) => i.status === "ok").length;
    const warnings = currentChecklist.items.filter((i) => i.status === "warnung").length;
    return { total, done, warnings, percent: total > 0 ? (done / total) * 100 : 0 };
  }, [currentChecklist]);

  const createChecklist = useCallback(() => {
    if (!newName) {
      toast.error("Bitte Objektname angeben");
      return;
    }
    const checklist: DDChecklist = {
      id: crypto.randomUUID(),
      objectName: newName,
      items: DEFAULT_DD_ITEMS.map((item) => ({
        ...item,
        id: crypto.randomUUID(),
        status: "offen",
        notes: "",
      })),
      createdAt: new Date().toISOString(),
    };
    const updated = [checklist, ...checklists];
    setChecklists(updated);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    setSelectedChecklist(checklist.id);
    setNewName("");
    setShowNew(false);
    toast.success(`Due Diligence für "${newName}" erstellt`);
  }, [newName, checklists]);

  const updateItemStatus = useCallback((itemId: string, status: DDItem["status"]) => {
    if (!selectedChecklist) return;
    const updated = checklists.map((cl) => {
      if (cl.id !== selectedChecklist) return cl;
      return {
        ...cl,
        items: cl.items.map((item) =>
          item.id === itemId ? { ...item, status } : item
        ),
      };
    });
    setChecklists(updated);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  }, [checklists, selectedChecklist]);

  const deleteChecklist = useCallback((id: string) => {
    const updated = checklists.filter((c) => c.id !== id);
    setChecklists(updated);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    if (selectedChecklist === id) setSelectedChecklist(null);
    toast.success("Checkliste gelöscht");
  }, [checklists, selectedChecklist]);

  const categories = currentChecklist
    ? [...new Set(currentChecklist.items.map((i) => i.category))]
    : [];

  return (
    <div className="gradient-card rounded-xl border border-border p-4 animate-fade-in">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Search className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-semibold">Due Diligence</h3>
          <Badge variant="outline" className="text-[10px] h-5">{checklists.length} Prüfungen</Badge>
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

      {/* New checklist */}
      {showNew && (
        <div className="flex gap-2 mb-3">
          <Input className="h-7 text-[10px] flex-1" placeholder="Objektname für DD" value={newName} onChange={(e) => setNewName(e.target.value)} />
          <Button size="sm" className="text-[10px] h-7" onClick={createChecklist}>Erstellen</Button>
        </div>
      )}

      {/* Checklist selector */}
      {checklists.length > 0 && !currentChecklist && (
        <div className="space-y-1.5">
          {checklists.slice(0, expanded ? undefined : 3).map((cl) => {
            const done = cl.items.filter((i) => i.status === "ok").length;
            const pct = cl.items.length > 0 ? (done / cl.items.length) * 100 : 0;
            return (
              <button key={cl.id} className="w-full p-2 rounded-lg bg-background/50 border border-border/50 text-[10px] text-left hover:bg-accent/50 transition-colors flex justify-between items-center"
                onClick={() => setSelectedChecklist(cl.id)}>
                <div>
                  <span className="font-medium">{cl.objectName}</span>
                  <span className="text-muted-foreground ml-1">{done}/{cl.items.length}</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-16 h-1.5 rounded-full bg-muted overflow-hidden">
                    <div className={`h-full rounded-full ${pct === 100 ? "bg-profit" : "bg-primary"}`} style={{ width: `${pct}%` }} />
                  </div>
                  <Button variant="ghost" size="icon" className="h-5 w-5" onClick={(e) => { e.stopPropagation(); deleteChecklist(cl.id); }}>
                    <Trash2 className="h-3 w-3 text-muted-foreground" />
                  </Button>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* Active checklist */}
      {currentChecklist && (
        <>
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium">{currentChecklist.objectName}</span>
            <Button variant="ghost" size="sm" className="text-[10px] h-5" onClick={() => setSelectedChecklist(null)}>Zurück</Button>
          </div>

          {/* Progress */}
          <div className="mb-2">
            <div className="flex justify-between text-[10px] mb-1">
              <span className="text-muted-foreground">{progress.done}/{progress.total} geprüft</span>
              {progress.warnings > 0 && <span className="text-gold">{progress.warnings} Warnungen</span>}
              <span className="font-bold">{progress.percent.toFixed(0)}%</span>
            </div>
            <div className="h-2 rounded-full bg-muted overflow-hidden">
              <div className={`h-full rounded-full transition-all ${progress.percent === 100 ? "bg-profit" : "bg-primary"}`}
                style={{ width: `${progress.percent}%` }} />
            </div>
          </div>

          {/* Manus AI: Report */}
          <div className="mb-3">
            <ManusDueDiligence defaultAddress={currentChecklist.objectName} />
          </div>

          {/* Items by category */}
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {categories.map((cat) => (
              <div key={cat}>
                <p className="text-[10px] font-semibold text-muted-foreground mb-1">{cat}</p>
                {currentChecklist.items.filter((i) => i.category === cat).map((item) => (
                  <div key={item.id} className="flex items-center gap-1 text-[10px] py-0.5">
                    <button
                      className="shrink-0"
                      onClick={() => {
                        const nextStatus: Record<DDItem["status"], DDItem["status"]> = {
                          offen: "ok", ok: "warnung", warnung: "fehlt", fehlt: "offen",
                        };
                        updateItemStatus(item.id, nextStatus[item.status]);
                      }}
                    >
                      {item.status === "ok" ? <CheckCircle2 className="h-3.5 w-3.5 text-profit" /> :
                       item.status === "warnung" ? <AlertTriangle className="h-3.5 w-3.5 text-gold" /> :
                       item.status === "fehlt" ? <AlertTriangle className="h-3.5 w-3.5 text-loss" /> :
                       <Circle className="h-3.5 w-3.5 text-muted-foreground" />}
                    </button>
                    <span className={item.status === "ok" ? "line-through text-muted-foreground" : ""}>{item.label}</span>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </>
      )}

      {checklists.length === 0 && !showNew && (
        <p className="text-[10px] text-muted-foreground text-center py-3">Neue Due Diligence starten — klicke +</p>
      )}
    </div>
  );
});
DueDiligenceCheckliste.displayName = "DueDiligenceCheckliste";

export { DueDiligenceCheckliste };
