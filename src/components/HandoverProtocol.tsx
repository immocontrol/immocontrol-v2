import { useState, useCallback } from "react";
import { ClipboardList, Download, Plus, Trash2, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";
import { formatCurrency } from "@/lib/formatters";

interface Room {
  name: string;
  condition: number; // 1-5
  notes: string;
  items: { name: string; ok: boolean; note: string }[];
}

const DEFAULT_ROOMS: Room[] = [
  { name: "Flur/Eingang", condition: 3, notes: "", items: [
    { name: "Wände & Decke", ok: true, note: "" },
    { name: "Boden", ok: true, note: "" },
    { name: "Tür & Schloss", ok: true, note: "" },
    { name: "Lichtschalter", ok: true, note: "" },
  ]},
  { name: "Wohnzimmer", condition: 3, notes: "", items: [
    { name: "Wände & Decke", ok: true, note: "" },
    { name: "Boden", ok: true, note: "" },
    { name: "Fenster & Rollläden", ok: true, note: "" },
    { name: "Steckdosen", ok: true, note: "" },
    { name: "Heizkörper", ok: true, note: "" },
  ]},
  { name: "Küche", condition: 3, notes: "", items: [
    { name: "Herd/Ofen", ok: true, note: "" },
    { name: "Spüle & Armatur", ok: true, note: "" },
    { name: "Schränke", ok: true, note: "" },
    { name: "Boden", ok: true, note: "" },
    { name: "Dunstabzug", ok: true, note: "" },
  ]},
  { name: "Badezimmer", condition: 3, notes: "", items: [
    { name: "Waschbecken & Armatur", ok: true, note: "" },
    { name: "Toilette", ok: true, note: "" },
    { name: "Dusche/Badewanne", ok: true, note: "" },
    { name: "Fliesen & Fugen", ok: true, note: "" },
    { name: "Lüftung", ok: true, note: "" },
  ]},
  { name: "Schlafzimmer", condition: 3, notes: "", items: [
    { name: "Wände & Decke", ok: true, note: "" },
    { name: "Boden", ok: true, note: "" },
    { name: "Fenster", ok: true, note: "" },
    { name: "Heizkörper", ok: true, note: "" },
  ]},
];

const CONDITION_LABELS = ["", "Mangelhaft", "Ausreichend", "Befriedigend", "Gut", "Sehr gut"];

export function HandoverProtocol() {
  const [type, setType] = useState<"einzug" | "auszug">("einzug");
  const [tenant, setTenant] = useState("");
  const [address, setAddress] = useState("");
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [rooms, setRooms] = useState<Room[]>(DEFAULT_ROOMS);
  const [meterStand, setMeterStand] = useState({ strom: "", gas: "", wasser: "", heizung: "" });
  const [keysCount, setKeysCount] = useState("2");
  const [generalNotes, setGeneralNotes] = useState("");

  const updateRoom = (idx: number, updates: Partial<Room>) => {
    setRooms(prev => prev.map((r, i) => i === idx ? { ...r, ...updates } : r));
  };

  const updateItem = (roomIdx: number, itemIdx: number, updates: Partial<Room["items"][0]>) => {
    setRooms(prev => prev.map((r, ri) => ri === roomIdx ? {
      ...r,
      items: r.items.map((item, ii) => ii === itemIdx ? { ...item, ...updates } : item),
    } : r));
  };

  const exportPDF = useCallback(() => {
    const html = `<!DOCTYPE html><html lang="de"><head><meta charset="UTF-8">
<title>Übergabeprotokoll – ${tenant || "Mieter"}</title>
<style>
body{font-family:system-ui,sans-serif;padding:30px;color:#222;max-width:800px;margin:0 auto;font-size:13px}
h1{font-size:20px;border-bottom:2px solid #2a9d6e;padding-bottom:8px}
h2{font-size:15px;margin-top:20px;color:#555}
table{width:100%;border-collapse:collapse;margin:8px 0}
th,td{padding:6px 8px;border:1px solid #ddd;text-align:left}
th{background:#f5f5f5;font-weight:600}
.stars{color:#f5a623}
.ok{color:#2a9d6e;font-weight:600}.nok{color:#d94040;font-weight:600}
.sig{display:flex;justify-content:space-between;margin-top:60px;gap:40px}
.sig-box{flex:1;border-top:1px solid #999;padding-top:8px;text-align:center;font-size:11px;color:#888}
.footer{margin-top:40px;font-size:10px;color:#aaa;text-align:center}
</style></head><body>
<h1>📋 Wohnungsübergabeprotokoll – ${type === "einzug" ? "Einzug" : "Auszug"}</h1>
<table>
<tr><td><strong>Mieter:</strong> ${tenant || "–"}</td><td><strong>Datum:</strong> ${new Date(date).toLocaleDateString("de-DE")}</td></tr>
<tr><td><strong>Objekt:</strong> ${address || "–"}</td><td><strong>Schlüssel:</strong> ${keysCount} Stück</td></tr>
</table>

<h2>Zählerstände</h2>
<table>
<tr><th>Zähler</th><th>Stand</th></tr>
${Object.entries(meterStand).map(([k, v]) => `<tr><td>${k.charAt(0).toUpperCase() + k.slice(1)}</td><td>${v || "–"}</td></tr>`).join("")}
</table>

${rooms.map(room => `
<h2>${room.name} – ${"⭐".repeat(room.condition)} (${CONDITION_LABELS[room.condition]})</h2>
<table>
<tr><th>Gegenstand</th><th>Zustand</th><th>Anmerkung</th></tr>
${room.items.map(item => `<tr><td>${item.name}</td><td class="${item.ok ? "ok" : "nok"}">${item.ok ? "✓ OK" : "✗ Mangel"}</td><td>${item.note || "–"}</td></tr>`).join("")}
</table>
${room.notes ? `<p><em>Anmerkung: ${room.notes}</em></p>` : ""}
`).join("")}

${generalNotes ? `<h2>Allgemeine Anmerkungen</h2><p>${generalNotes}</p>` : ""}

<div class="sig">
<div class="sig-box">Vermieter<br><br><br>Datum, Unterschrift</div>
<div class="sig-box">Mieter<br><br><br>Datum, Unterschrift</div>
</div>

<div class="footer">Erstellt mit ImmoControl · ${new Date().toLocaleDateString("de-DE")}</div>
</body></html>`;

    const w = window.open("", "_blank");
    if (w) { w.document.write(html); w.document.close(); w.print(); }
    toast.success("Übergabeprotokoll erstellt!");
  }, [type, tenant, address, date, rooms, meterStand, keysCount, generalNotes]);

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5">
          <ClipboardList className="h-3.5 w-3.5" /> Übergabeprotokoll
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ClipboardList className="h-5 w-5 text-primary" /> Wohnungsübergabeprotokoll
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Header Info */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Art</Label>
              <Select value={type} onValueChange={v => setType(v as "einzug" | "auszug")}>
                <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="einzug">Einzug</SelectItem>
                  <SelectItem value="auszug">Auszug</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Datum</Label>
              <Input type="date" value={date} onChange={e => setDate(e.target.value)} className="h-9 text-sm" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Mieter</Label>
              <Input value={tenant} onChange={e => setTenant(e.target.value)} placeholder="Name des Mieters" className="h-9 text-sm" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Adresse/Objekt</Label>
              <Input value={address} onChange={e => setAddress(e.target.value)} placeholder="Straße, PLZ Ort" className="h-9 text-sm" />
            </div>
          </div>

          {/* Meter readings */}
          <div>
            <h3 className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wider">Zählerstände</h3>
            <div className="grid grid-cols-4 gap-2">
              {Object.entries(meterStand).map(([key, val]) => (
                <div key={key} className="space-y-1">
                  <Label className="text-[10px] capitalize">{key}</Label>
                  <Input value={val} onChange={e => setMeterStand({...meterStand, [key]: e.target.value})} className="h-8 text-xs" placeholder="Stand" />
                </div>
              ))}
            </div>
          </div>

          {/* Keys */}
          <div className="flex items-center gap-3">
            <Label className="text-xs whitespace-nowrap">Schlüssel übergeben:</Label>
            <Input value={keysCount} onChange={e => setKeysCount(e.target.value)} className="h-8 text-xs w-20" type="number" />
            <span className="text-xs text-muted-foreground">Stück</span>
          </div>

          {/* Rooms */}
          {rooms.map((room, ri) => (
            <div key={ri} className="border border-border rounded-lg p-3 space-y-2">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold">{room.name}</h3>
                <div className="flex items-center gap-1">
                  {[1, 2, 3, 4, 5].map(star => (
                    <button
                      key={star}
                      onClick={() => updateRoom(ri, { condition: star })}
                      className={`text-sm ${star <= room.condition ? "text-accent" : "text-muted-foreground/30"}`}
                    >
                      ★
                    </button>
                  ))}
                  <span className="text-[10px] text-muted-foreground ml-1">{CONDITION_LABELS[room.condition]}</span>
                </div>
              </div>
              <div className="space-y-1">
                {room.items.map((item, ii) => (
                  <div key={ii} className="flex items-center gap-2 text-xs">
                    <button
                      onClick={() => updateItem(ri, ii, { ok: !item.ok })}
                      className={`w-5 h-5 rounded border-2 flex items-center justify-center text-[10px] font-bold transition-colors ${
                        item.ok ? "border-profit bg-profit/10 text-profit" : "border-loss bg-loss/10 text-loss"
                      }`}
                    >
                      {item.ok ? "✓" : "✗"}
                    </button>
                    <span className="flex-1">{item.name}</span>
                    <Input
                      value={item.note}
                      onChange={e => updateItem(ri, ii, { note: e.target.value })}
                      placeholder="Anmerkung..."
                      className="h-7 text-[11px] w-40"
                    />
                  </div>
                ))}
              </div>
              <Textarea
                value={room.notes}
                onChange={e => updateRoom(ri, { notes: e.target.value })}
                placeholder={`Anmerkungen zu ${room.name}...`}
                className="text-xs min-h-[40px]"
              />
            </div>
          ))}

          {/* General notes */}
          <div className="space-y-1">
            <Label className="text-xs">Allgemeine Anmerkungen</Label>
            <Textarea value={generalNotes} onChange={e => setGeneralNotes(e.target.value)} className="text-xs min-h-[60px]" placeholder="Sonstige Bemerkungen..." />
          </div>

          <Button onClick={exportPDF} className="w-full gap-1.5">
            <Download className="h-4 w-4" /> Protokoll als PDF drucken
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
