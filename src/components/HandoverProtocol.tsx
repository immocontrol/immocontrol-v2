import { useState, useCallback } from "react";
import { ClipboardList, Download, Copy, Check, Save, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { useProperties } from "@/context/PropertyContext";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ROUTES } from "@/lib/routes";
import { queryKeys } from "@/lib/queryKeys";
import { loadJsPDF } from "@/lib/lazyImports";
import { formatDate } from "@/lib/formatters";

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

const METER_LABELS: Record<string, string> = {
  strom: "Strom (kWh)",
  gas: "Gas (m³)",
  wasser: "Wasser (m³)",
  heizung: "Heizung",
};
const METER_KEYS = ["strom", "gas", "wasser", "heizung"] as const;

export function HandoverProtocol() {
  const { user } = useAuth();
  const { properties } = useProperties();
  const queryClient = useQueryClient();
  const [type, setType] = useState<"einzug" | "auszug">("einzug");
  const [propertyId, setPropertyId] = useState("");
  const [tenantId, setTenantId] = useState("");
  const [tenant, setTenant] = useState("");
  const [address, setAddress] = useState("");
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [rooms, setRooms] = useState<Room[]>(DEFAULT_ROOMS);
  const [meterStand, setMeterStand] = useState({ strom: "", gas: "", wasser: "", heizung: "" });
  const [keysCount, setKeysCount] = useState("2");
  const [generalNotes, setGeneralNotes] = useState("");
  const [lastConfirmLink, setLastConfirmLink] = useState<string | null>(null);
  const [linkCopied, setLinkCopied] = useState(false);
  const [pdfSaving, setPdfSaving] = useState(false);
  const [copiedProtocolId, setCopiedProtocolId] = useState<string | null>(null);

  const { data: tenants = [] } = useQuery({
    queryKey: ["tenants", propertyId],
    queryFn: async () => {
      const { data } = await supabase.from("tenants").select("id, first_name, last_name, property_id").eq("property_id", propertyId).eq("is_active", true);
      return (data || []) as Array<{ id: string; first_name: string; last_name: string; property_id: string }>;
    },
    enabled: !!propertyId,
  });

  const selectedProperty = properties.find((p) => p.id === propertyId);
  const selectedTenant = tenants.find((t) => t.id === tenantId);

  const { data: savedProtocols = [] } = useQuery({
    queryKey: [...queryKeys.handoverProtocols.byProperty(propertyId)],
    queryFn: async () => {
      const { data } = await supabase
        .from("handover_protocols")
        .select("id, type, protocol_data, tenant_confirmed_at, created_at, confirm_token")
        .eq("property_id", propertyId)
        .order("created_at", { ascending: false })
        .limit(20);
      return (data || []) as Array<{
        id: string;
        type: string;
        protocol_data: { date?: string; address?: string; tenant?: string };
        tenant_confirmed_at: string | null;
        created_at: string;
        confirm_token: string | null;
      }>;
    },
    enabled: !!propertyId,
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!user?.id || !propertyId || !tenantId) throw new Error("Objekt und Mieter auswählen.");
      const protocolData = {
        tenant: tenant || (selectedTenant ? `${selectedTenant.first_name} ${selectedTenant.last_name}`.trim() : ""),
        address: address || selectedProperty?.address || "",
        date,
        keysCount,
        meterStand,
        rooms,
        generalNotes,
      };
      const { data, error } = await supabase
        .from("handover_protocols")
        .insert({
          property_id: propertyId,
          tenant_id: tenantId,
          created_by: user.id,
          type,
          protocol_data: protocolData,
        })
        .select("id, confirm_token")
        .single();
      if (error) throw error;
      return data as { id: string; confirm_token: string };
    },
    onSuccess: (data) => {
      const base = typeof window !== "undefined" ? window.location.origin : "";
      const link = `${base}${ROUTES.HANDOVER_CONFIRM}/${data.confirm_token}`;
      setLastConfirmLink(link);
      queryClient.invalidateQueries({ queryKey: queryKeys.handoverProtocols.all });
      toast.success("Protokoll gespeichert. Link zum Bestätigen kopieren und an den Mieter senden.");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Speichern fehlgeschlagen."),
  });

  const updateRoom = (idx: number, updates: Partial<Room>) => {
    setRooms(prev => prev.map((r, i) => i === idx ? { ...r, ...updates } : r));
  };

  const updateItem = (roomIdx: number, itemIdx: number, updates: Partial<Room["items"][0]>) => {
    setRooms(prev => prev.map((r, ri) => ri === roomIdx ? {
      ...r,
      items: r.items.map((item, ii) => ii === itemIdx ? { ...item, ...updates } : item),
    } : r));
  };

  const buildPdfBlob = useCallback(async (): Promise<{ blob: Blob; fileName: string } | null> => {
    try {
      const JsPDF = await loadJsPDF();
      const doc = new JsPDF({ format: "a4" });
      const margin = 20;
      const pageW = doc.internal.pageSize.getWidth();
      const pageH = doc.internal.pageSize.getHeight();
      let y = margin;
      const lineH = 6;
      const checkY = () => { if (y > pageH - 40) { doc.addPage(); y = margin; } };

      doc.setFontSize(16);
      doc.setFont("helvetica", "bold");
      doc.text(`Wohnungsübergabeprotokoll – ${type === "einzug" ? "Einzug" : "Auszug"}`, margin, y); y += lineH + 4;
      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      doc.text(`Mieter: ${tenant || "–"}`, margin, y); doc.text(`Datum: ${new Date(date).toLocaleDateString("de-DE")}`, pageW - margin - 45, y); y += lineH;
      doc.text(`Objekt: ${address || "–"}`, margin, y); doc.text(`Schlüssel: ${keysCount} Stück`, pageW - margin - 45, y); y += lineH + 6;

      doc.setFont("helvetica", "bold");
      doc.text("Zählerstände", margin, y); y += lineH;
      doc.setFont("helvetica", "normal");
      METER_KEYS.forEach((k) => {
        const label = METER_LABELS[k] || k;
        const val = meterStand[k] || "–";
        doc.text(`${label}: ${val}`, margin + 5, y); y += lineH;
      });
      y += 4;

      rooms.forEach((room) => {
        checkY();
        doc.setFont("helvetica", "bold");
        doc.text(`${room.name} – ${CONDITION_LABELS[room.condition] || ""}`, margin, y); y += lineH;
        doc.setFont("helvetica", "normal");
        room.items.forEach((item) => {
          checkY();
          doc.text(`${item.ok ? "✓" : "✗"} ${item.name}${item.note ? " – " + item.note : ""}`, margin + 5, y); y += lineH;
        });
        if (room.notes) { checkY(); doc.setFont("helvetica", "italic"); doc.text(room.notes.substring(0, 80), margin + 5, y); y += lineH; doc.setFont("helvetica", "normal"); }
        y += 2;
      });

      if (generalNotes) {
        checkY();
        doc.setFont("helvetica", "bold");
        doc.text("Allgemeine Anmerkungen", margin, y); y += lineH;
        doc.setFont("helvetica", "normal");
        const lines = doc.splitTextToSize(generalNotes, pageW - 2 * margin - 10);
        lines.forEach((line: string) => { checkY(); doc.text(line, margin + 5, y); y += lineH; });
        y += 4;
      }

      y = Math.max(y, pageH - 50);
      doc.setDrawColor(180);
      doc.line(margin, y, margin + 75, y); doc.line(pageW - margin - 75, y, pageW - margin, y); y += lineH;
      doc.setFontSize(9);
      doc.setTextColor(120);
      doc.text("Vermieter, Unterschrift", margin, y); doc.text("Mieter, Unterschrift", pageW - margin - 75, y);
      doc.setFontSize(8);
      doc.text(`Erstellt mit ImmoControl · ${new Date().toLocaleDateString("de-DE")}`, margin, pageH - 10);
      doc.setTextColor(0);

      const out = doc.output("blob");
      const blob = out instanceof Promise ? await out : out;
      const safeName = (tenant || "Mieter").replace(/\s+/g, "_").replace(/[^a-zA-ZäöüÄÖÜß0-9_-]/g, "");
      const fileName = `Uebergabeprotokoll_${type}_${safeName}_${date}.pdf`;
      return { blob, fileName };
    } catch (e) {
      toast.error("PDF konnte nicht erstellt werden.");
      console.error(e);
      return null;
    }
  }, [type, tenant, address, date, rooms, meterStand, keysCount, generalNotes]);

  const handlePdfDownload = useCallback(async () => {
    const result = await buildPdfBlob();
    if (!result) return;
    const url = URL.createObjectURL(result.blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = result.fileName;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("PDF heruntergeladen.");
  }, [buildPdfBlob]);

  const handlePdfSaveToDocuments = useCallback(async () => {
    if (!user?.id || !propertyId) {
      toast.error("Bitte Objekt auswählen.");
      return;
    }
    setPdfSaving(true);
    try {
      const result = await buildPdfBlob();
      if (!result) return;
      const filePath = `${user.id}/${propertyId}/${Date.now()}_${result.fileName}`;
      const { error: uploadError } = await supabase.storage
        .from("property-documents")
        .upload(filePath, result.blob, { contentType: "application/pdf" });
      if (uploadError) throw uploadError;
      const { error: dbError } = await supabase.from("property_documents").insert({
        user_id: user.id,
        property_id: propertyId,
        file_name: result.fileName,
        file_path: filePath,
        file_size: result.blob.size,
        file_type: "application/pdf",
        category: "Übergabeprotokoll",
      } as never);
      if (dbError) throw dbError;
      queryClient.invalidateQueries({ queryKey: queryKeys.documents.byProperty(propertyId) });
      toast.success("Protokoll in Dokumente gespeichert.");
    } catch (e) {
      toast.error("Speichern fehlgeschlagen.");
      console.error(e);
    } finally {
      setPdfSaving(false);
    }
  }, [user, propertyId, buildPdfBlob, queryClient]);

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5">
          <ClipboardList className="h-3.5 w-3.5" /> Übergabeprotokoll
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto overflow-x-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ClipboardList className="h-5 w-5 text-primary" /> Wohnungsübergabeprotokoll
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Bereits gespeicherte Protokolle (Objekt ausgewählt) */}
          {propertyId && savedProtocols.length > 0 && (
            <div className="rounded-lg border border-border bg-muted/30 p-3 space-y-2">
              <p className="text-xs font-medium text-muted-foreground">Gespeicherte Protokolle (dieses Objekt)</p>
              <ul className="space-y-1.5 max-h-32 overflow-y-auto">
                {savedProtocols.map((hp) => {
                  const link = hp.confirm_token ? `${typeof window !== "undefined" ? window.location.origin : ""}${ROUTES.HANDOVER_CONFIRM}/${hp.confirm_token}` : null;
                  return (
                    <li key={hp.id} className="flex flex-wrap items-center justify-between gap-2 text-xs">
                      <span>
                        {hp.type === "auszug" ? "Auszug" : "Einzug"} – {hp.protocol_data?.date ? formatDate(hp.protocol_data.date) : formatDate(hp.created_at)}
                        {hp.tenant_confirmed_at && (
                          <span className="ml-1.5 text-profit">✓ bestätigt</span>
                        )}
                      </span>
                      {link && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-7 px-1.5 gap-0.5"
                          onClick={() => {
                            navigator.clipboard.writeText(link);
                            setCopiedProtocolId(hp.id);
                            toast.success("Link kopiert.");
                            setTimeout(() => setCopiedProtocolId(null), 2000);
                          }}
                        >
                          {copiedProtocolId === hp.id ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                          Link
                        </Button>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          )}

          {/* Link zum Bestätigen (nach Speichern) */}
          {lastConfirmLink && (
            <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 space-y-2">
              <p className="text-xs font-medium text-foreground">Link an Mieter senden (zum Bestätigen):</p>
              <div className="flex gap-2">
                <Input readOnly value={lastConfirmLink} className="text-xs font-mono flex-1 min-w-0" />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="shrink-0 gap-1"
                  onClick={() => {
                    navigator.clipboard.writeText(lastConfirmLink);
                    setLinkCopied(true);
                    toast.success("Link kopiert.");
                    setTimeout(() => setLinkCopied(false), 2000);
                  }}
                >
                  {linkCopied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                  {linkCopied ? "Kopiert" : "Kopieren"}
                </Button>
              </div>
            </div>
          )}

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
            <div className="space-y-1 col-span-2">
              <Label className="text-xs">Objekt</Label>
              <Select value={propertyId} onValueChange={(v) => { setPropertyId(v); setTenantId(""); const prop = properties.find((p) => p.id === v); setAddress(prop?.address || ""); }}>
                <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Objekt wählen" /></SelectTrigger>
                <SelectContent>
                  {properties.map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.name || p.address || p.id}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1 col-span-2">
              <Label className="text-xs">Mieter</Label>
              <Select value={tenantId} onValueChange={(v) => { setTenantId(v); const t = tenants.find(x => x.id === v); setTenant(t ? `${t.first_name} ${t.last_name}`.trim() : ""); setAddress(selectedProperty?.address || address); }}>
                <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Mieter wählen" /></SelectTrigger>
                <SelectContent>
                  {tenants.map((t) => (
                    <SelectItem key={t.id} value={t.id}>{t.first_name} {t.last_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Mieter (Anzeige)</Label>
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
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {METER_KEYS.map((key) => (
                <div key={key} className="space-y-1">
                  <Label className="text-[10px]">{METER_LABELS[key]}</Label>
                  <Input value={meterStand[key]} onChange={e => setMeterStand({ ...meterStand, [key]: e.target.value })} className="h-8 text-xs" placeholder="Stand" />
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
              <div className="flex flex-wrap items-center justify-between gap-1">
                <h3 className="text-sm font-semibold min-w-0 truncate">{room.name}</h3>
                <div className="flex items-center gap-0.5 shrink-0">
                  {[1, 2, 3, 4, 5].map(star => (
                    <button
                      key={star}
                      onClick={() => updateRoom(ri, { condition: star })}
                      className={`text-xs leading-none p-0.5 ${star <= room.condition ? "text-accent" : "text-muted-foreground/30"}`}
                    >
                      ★
                    </button>
                  ))}
                  <span className="text-[9px] text-muted-foreground ml-0.5 hidden xs:inline">{CONDITION_LABELS[room.condition]}</span>
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
                      className="h-7 text-[11px] w-24 sm:w-40 min-w-0"
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

          <div className="flex flex-col gap-2">
            <Button
              onClick={() => saveMutation.mutate()}
              disabled={saveMutation.isPending || !propertyId || !tenantId}
              className="w-full gap-1.5"
            >
              {saveMutation.isPending ? "Speichern…" : "Speichern & Link erstellen"}
            </Button>
            <p className="text-[10px] text-muted-foreground text-wrap-safe">
              Nach dem Speichern: Link kopieren und an den Mieter senden. Der Mieter kann den Inhalt über den Link bestätigen.
            </p>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" onClick={handlePdfDownload} className="gap-1.5">
                <Download className="h-3.5 w-3.5" /> PDF herunterladen
              </Button>
              {propertyId && (
                <Button variant="outline" size="sm" onClick={handlePdfSaveToDocuments} disabled={pdfSaving} className="gap-1.5">
                  {pdfSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                  In Dokumente speichern
                </Button>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
