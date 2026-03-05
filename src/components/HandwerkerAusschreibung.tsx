/**
 * INHALT-20: Handwerker-Ausschreibung — Angebots-Vergleich & Verwaltung
 * Handwerkerangebote erfassen, vergleichen, beauftragen.
 * Pro Gewerk: mehrere Angebote einholen und strukturiert vergleichen.
 */
import { memo, useState, useCallback, useMemo } from "react";
import { HardHat, Plus, ChevronDown, ChevronUp, Star, Trash2, CheckCircle2, Download } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { formatCurrency } from "@/lib/formatters";
import { toast } from "sonner";

interface HandwerkerAngebot {
  id: string;
  firmenname: string;
  gewerk: string;
  beschreibung: string;
  preis: number;
  lieferzeit: string;
  bewertung: number; // 1-5
  status: "angefragt" | "erhalten" | "beauftragt" | "abgelehnt";
  notizen: string;
  createdAt: string;
}

interface Ausschreibung {
  id: string;
  titel: string;
  gewerk: string;
  objectName: string;
  angebote: HandwerkerAngebot[];
  createdAt: string;
}

const GEWERKE = [
  "Sanitär", "Elektro", "Heizung", "Maler", "Bodenleger", "Dachdecker",
  "Tischler", "Schlosser", "Maurer", "Gartenbau", "Reinigung", "Sonstiges",
];

const STORAGE_KEY = "immo_ausschreibungen";

const HandwerkerAusschreibung = memo(() => {
  const [expanded, setExpanded] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showNewAngebot, setShowNewAngebot] = useState<string | null>(null);
  const [selectedAusschreibung, setSelectedAusschreibung] = useState<string | null>(null);

  const [ausschreibungen, setAusschreibungen] = useState<Ausschreibung[]>(() => {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]"); }
    catch { return []; }
  });

  const [newAusschreibung, setNewAusschreibung] = useState({
    titel: "",
    gewerk: "Sanitär",
    objectName: "",
  });

  const [newAngebot, setNewAngebot] = useState<Partial<HandwerkerAngebot>>({
    status: "erhalten",
    bewertung: 3,
  });

  const save = useCallback((updated: Ausschreibung[]) => {
    setAusschreibungen(updated);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  }, []);

  const createAusschreibung = useCallback(() => {
    if (!newAusschreibung.titel) {
      toast.error("Bitte Titel angeben");
      return;
    }
    const ausschreibung: Ausschreibung = {
      id: crypto.randomUUID(),
      titel: newAusschreibung.titel,
      gewerk: newAusschreibung.gewerk,
      objectName: newAusschreibung.objectName,
      angebote: [],
      createdAt: new Date().toISOString(),
    };
    save([ausschreibung, ...ausschreibungen]);
    setSelectedAusschreibung(ausschreibung.id);
    setNewAusschreibung({ titel: "", gewerk: "Sanitär", objectName: "" });
    setShowNew(false);
    toast.success("Ausschreibung erstellt");
  }, [newAusschreibung, ausschreibungen, save]);

  const addAngebot = useCallback((ausschreibungId: string) => {
    if (!newAngebot.firmenname || !newAngebot.preis) {
      toast.error("Bitte Firma und Preis angeben");
      return;
    }
    const angebot: HandwerkerAngebot = {
      id: crypto.randomUUID(),
      firmenname: newAngebot.firmenname || "",
      gewerk: ausschreibungen.find((a) => a.id === ausschreibungId)?.gewerk || "",
      beschreibung: newAngebot.beschreibung || "",
      preis: newAngebot.preis || 0,
      lieferzeit: newAngebot.lieferzeit || "",
      bewertung: newAngebot.bewertung || 3,
      status: newAngebot.status as HandwerkerAngebot["status"] || "erhalten",
      notizen: newAngebot.notizen || "",
      createdAt: new Date().toISOString(),
    };
    const updated = ausschreibungen.map((a) =>
      a.id === ausschreibungId ? { ...a, angebote: [...a.angebote, angebot] } : a
    );
    save(updated);
    setNewAngebot({ status: "erhalten", bewertung: 3 });
    setShowNewAngebot(null);
    toast.success("Angebot hinzugefügt");
  }, [newAngebot, ausschreibungen, save]);

  const updateAngebotStatus = useCallback((ausschreibungId: string, angebotId: string, status: HandwerkerAngebot["status"]) => {
    const updated = ausschreibungen.map((a) => {
      if (a.id !== ausschreibungId) return a;
      return {
        ...a,
        angebote: a.angebote.map((ang) =>
          ang.id === angebotId ? { ...ang, status } : ang
        ),
      };
    });
    save(updated);
    toast.success(`Status auf "${status}" geändert`);
  }, [ausschreibungen, save]);

  const deleteAusschreibung = useCallback((id: string) => {
    save(ausschreibungen.filter((a) => a.id !== id));
    if (selectedAusschreibung === id) setSelectedAusschreibung(null);
    toast.success("Ausschreibung gelöscht");
  }, [ausschreibungen, selectedAusschreibung, save]);

  const current = ausschreibungen.find((a) => a.id === selectedAusschreibung);

  const exportComparison = useCallback(() => {
    if (!current) return;
    const lines = [
      `Angebotsvergleich: ${current.titel}`,
      `Gewerk: ${current.gewerk}`,
      `Objekt: ${current.objectName}`,
      "",
      "Firma;Preis;Lieferzeit;Bewertung;Status",
      ...current.angebote.map((a) =>
        `${a.firmenname};${a.preis.toFixed(2)};${a.lieferzeit};${a.bewertung}/5;${a.status}`
      ),
    ];
    const blob = new Blob(["\uFEFF" + lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `angebotsvergleich-${current.titel.replace(/\s+/g, "-")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Vergleich exportiert");
  }, [current]);

  return (
    <div className="gradient-card rounded-xl border border-border p-4 animate-fade-in">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <HardHat className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-semibold">Handwerker-Ausschreibung</h3>
          <Badge variant="outline" className="text-[10px] h-5">{ausschreibungen.length}</Badge>
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

      {/* New Ausschreibung */}
      {showNew && (
        <div className="border border-border rounded-lg p-2 mb-3 space-y-2">
          <Input className="h-7 text-[10px]" placeholder="Titel (z.B. Badezimmer-Sanierung)" value={newAusschreibung.titel} onChange={(e) => setNewAusschreibung((p) => ({ ...p, titel: e.target.value }))} />
          <div className="grid grid-cols-2 gap-2">
            <Select value={newAusschreibung.gewerk} onValueChange={(v) => setNewAusschreibung((p) => ({ ...p, gewerk: v }))}>
              <SelectTrigger className="h-7 text-[10px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                {GEWERKE.map((g) => <SelectItem key={g} value={g} className="text-xs">{g}</SelectItem>)}
              </SelectContent>
            </Select>
            <Input className="h-7 text-[10px]" placeholder="Objekt" value={newAusschreibung.objectName} onChange={(e) => setNewAusschreibung((p) => ({ ...p, objectName: e.target.value }))} />
          </div>
          <Button size="sm" className="w-full text-[10px] h-7" onClick={createAusschreibung}>Ausschreibung erstellen</Button>
        </div>
      )}

      {/* Ausschreibung list */}
      {!current && (
        <div className="space-y-1.5">
          {ausschreibungen.slice(0, expanded ? undefined : 3).map((a) => {
            const cheapest = a.angebote.length > 0 ? Math.min(...a.angebote.map((ang) => ang.preis)) : 0;
            const beauftragt = a.angebote.find((ang) => ang.status === "beauftragt");
            return (
              <button key={a.id} className="w-full p-2 rounded-lg bg-background/50 border border-border/50 text-[10px] text-left hover:bg-accent/50 transition-colors" onClick={() => setSelectedAusschreibung(a.id)}>
                <div className="flex justify-between items-center">
                  <div>
                    <span className="font-medium">{a.titel}</span>
                    <Badge variant="outline" className="text-[8px] h-4 ml-1">{a.gewerk}</Badge>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="text-muted-foreground">{a.angebote.length} Angebote</span>
                    {cheapest > 0 && <span className="font-medium text-profit">ab {formatCurrency(cheapest)}</span>}
                    {beauftragt && <CheckCircle2 className="h-3 w-3 text-profit" />}
                    <Button variant="ghost" size="icon" className="h-5 w-5" onClick={(e) => { e.stopPropagation(); deleteAusschreibung(a.id); }}>
                      <Trash2 className="h-3 w-3 text-muted-foreground" />
                    </Button>
                  </div>
                </div>
              </button>
            );
          })}
          {ausschreibungen.length === 0 && (
            <p className="text-[10px] text-muted-foreground text-center py-3">Noch keine Ausschreibungen — klicke + um zu starten</p>
          )}
        </div>
      )}

      {/* Active Ausschreibung detail */}
      {current && (
        <>
          <div className="flex items-center justify-between mb-2">
            <div>
              <span className="text-xs font-medium">{current.titel}</span>
              <Badge variant="outline" className="text-[8px] h-4 ml-1">{current.gewerk}</Badge>
            </div>
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="sm" className="text-[10px] h-5" onClick={() => setShowNewAngebot(current.id)}>
                <Plus className="h-3 w-3 mr-0.5" />Angebot
              </Button>
              <Button variant="ghost" size="sm" className="text-[10px] h-5" onClick={() => setSelectedAusschreibung(null)}>Zurück</Button>
            </div>
          </div>

          {/* New Angebot form */}
          {showNewAngebot === current.id && (
            <div className="border border-border rounded-lg p-2 mb-2 space-y-1.5">
              <div className="grid grid-cols-2 gap-2">
                <Input className="h-7 text-[10px]" placeholder="Firmenname" value={newAngebot.firmenname || ""} onChange={(e) => setNewAngebot((p) => ({ ...p, firmenname: e.target.value }))} />
                <Input className="h-7 text-[10px]" type="number" placeholder="Preis €" value={newAngebot.preis || ""} onChange={(e) => setNewAngebot((p) => ({ ...p, preis: parseFloat(e.target.value) || 0 }))} />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Input className="h-7 text-[10px]" placeholder="Lieferzeit" value={newAngebot.lieferzeit || ""} onChange={(e) => setNewAngebot((p) => ({ ...p, lieferzeit: e.target.value }))} />
                <Select value={String(newAngebot.bewertung || 3)} onValueChange={(v) => setNewAngebot((p) => ({ ...p, bewertung: parseInt(v) }))}>
                  <SelectTrigger className="h-7 text-[10px]"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {[1,2,3,4,5].map((n) => <SelectItem key={n} value={String(n)} className="text-xs">{"★".repeat(n)}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <Button size="sm" className="w-full text-[10px] h-7" onClick={() => addAngebot(current.id)}>Angebot speichern</Button>
            </div>
          )}

          {/* Angebote list (sorted by price) */}
          <div className="space-y-1 max-h-48 overflow-y-auto">
            {current.angebote
              .sort((a, b) => a.preis - b.preis)
              .map((ang, idx) => (
                <div key={ang.id} className={`p-1.5 rounded-lg border text-[10px] ${
                  ang.status === "beauftragt" ? "bg-profit/5 border-profit/20" :
                  ang.status === "abgelehnt" ? "bg-muted/50 border-border opacity-60" :
                  idx === 0 ? "bg-primary/5 border-primary/20" :
                  "bg-background/50 border-border/50"
                }`}>
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-1">
                      <span className="font-medium">{ang.firmenname}</span>
                      <span className="text-muted-foreground">{"★".repeat(ang.bewertung)}</span>
                    </div>
                    <span className="font-bold">{formatCurrency(ang.preis)}</span>
                  </div>
                  <div className="flex justify-between items-center mt-0.5">
                    <span className="text-muted-foreground">{ang.lieferzeit || "k.A."}</span>
                    <div className="flex gap-0.5">
                      {ang.status !== "beauftragt" && (
                        <Button variant="ghost" size="sm" className="text-[8px] h-4 px-1 text-profit" onClick={() => updateAngebotStatus(current.id, ang.id, "beauftragt")}>
                          Beauftragen
                        </Button>
                      )}
                      {ang.status !== "abgelehnt" && ang.status !== "beauftragt" && (
                        <Button variant="ghost" size="sm" className="text-[8px] h-4 px-1 text-loss" onClick={() => updateAngebotStatus(current.id, ang.id, "abgelehnt")}>
                          Ablehnen
                        </Button>
                      )}
                      {ang.status === "beauftragt" && <Badge className="text-[8px] h-4 bg-profit text-white">Beauftragt</Badge>}
                    </div>
                  </div>
                </div>
              ))}
          </div>

          {current.angebote.length >= 2 && (
            <Button size="sm" variant="outline" className="w-full text-[10px] h-7 mt-2" onClick={exportComparison}>
              <Download className="h-3 w-3 mr-1" />
              Vergleich exportieren
            </Button>
          )}
        </>
      )}
    </div>
  );
});
HandwerkerAusschreibung.displayName = "HandwerkerAusschreibung";

export { HandwerkerAusschreibung };
