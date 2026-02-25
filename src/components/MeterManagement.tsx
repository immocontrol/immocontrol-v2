import { useState } from "react";
import { Gauge, Plus, Trash2, TrendingUp } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";

const METER_TYPES = ["Strom", "Gas", "Wasser", "Heizung", "Warmwasser"];

interface Props {
  propertyId: string;
}

const MeterManagement = ({ propertyId }: Props) => {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [addOpen, setAddOpen] = useState(false);
  const [readingOpen, setReadingOpen] = useState<string | null>(null);
  const [form, setForm] = useState({ meter_type: "Strom", meter_number: "", unit_label: "", location_note: "" });
  const [readingForm, setReadingForm] = useState({ value: "", reading_date: new Date().toISOString().split("T")[0], note: "" });

  const { data: meters = [] } = useQuery({
    queryKey: ["meters", propertyId],
    queryFn: async () => {
      const { data } = await supabase.from("meters").select("*").eq("property_id", propertyId).order("meter_type");
      return data || [];
    },
    enabled: !!user,
  });

  const { data: readings = [] } = useQuery({
    queryKey: ["meter_readings", propertyId],
    queryFn: async () => {
      const meterIds = meters.map(m => m.id);
      if (meterIds.length === 0) return [];
      const { data } = await supabase.from("meter_readings").select("*").in("meter_id", meterIds).order("reading_date", { ascending: false });
      return data || [];
    },
    enabled: meters.length > 0,
  });

  const addMeter = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Nicht angemeldet");
      const { error } = await supabase.from("meters").insert({
        property_id: propertyId,
        user_id: user.id,
        meter_type: form.meter_type,
        meter_number: form.meter_number,
        unit_label: form.unit_label,
        location_note: form.location_note || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Zähler angelegt");
      setAddOpen(false);
      setForm({ meter_type: "Strom", meter_number: "", unit_label: "", location_note: "" });
      qc.invalidateQueries({ queryKey: ["meters", propertyId] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const addReading = useMutation({
    mutationFn: async (meterId: string) => {
      if (!user) throw new Error("Nicht angemeldet");
      const { error } = await supabase.from("meter_readings").insert({
        meter_id: meterId,
        user_id: user.id,
        value: parseFloat(readingForm.value),
        reading_date: readingForm.reading_date,
        note: readingForm.note || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Zählerstand erfasst");
      setReadingOpen(null);
      setReadingForm({ value: "", reading_date: new Date().toISOString().split("T")[0], note: "" });
      qc.invalidateQueries({ queryKey: ["meter_readings", propertyId] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteMeter = useMutation({
    mutationFn: async (id: string) => {
      await supabase.from("meters").delete().eq("id", id);
    },
    onSuccess: () => {
      toast.success("Zähler entfernt");
      qc.invalidateQueries({ queryKey: ["meters", propertyId] });
    },
  });

  const getLatestReading = (meterId: string) => {
    return readings.find(r => r.meter_id === meterId);
  };

  const getConsumption = (meterId: string) => {
    const meterReadings = readings.filter(r => r.meter_id === meterId).sort((a, b) => new Date(b.reading_date).getTime() - new Date(a.reading_date).getTime());
    if (meterReadings.length < 2) return null;
    return Number(meterReadings[0].value) - Number(meterReadings[1].value);
  };

  const typeIcon = (type: string) => {
    switch (type) {
      case "Strom": return "⚡";
      case "Gas": return "🔥";
      case "Wasser": return "💧";
      case "Heizung": return "🌡️";
      case "Warmwasser": return "♨️";
      default: return "📊";
    }
  };

  return (
    <div className="gradient-card rounded-xl border border-border p-5 space-y-4 animate-fade-in">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold flex items-center gap-2">
          <Gauge className="h-4 w-4 text-muted-foreground" /> Zählermanagement
        </h2>
        <Dialog open={addOpen} onOpenChange={setAddOpen}>
          <DialogTrigger asChild>
            <Button variant="outline" size="sm" className="gap-1.5 h-7 text-xs">
              <Plus className="h-3 w-3" /> Zähler
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle>Neuen Zähler anlegen</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <div className="space-y-1">
                <Label className="text-xs">Zählerart</Label>
                <Select value={form.meter_type} onValueChange={v => setForm({ ...form, meter_type: v })}>
                  <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {METER_TYPES.map(t => <SelectItem key={t} value={t}>{typeIcon(t)} {t}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Zählernummer</Label>
                <Input value={form.meter_number} onChange={e => setForm({ ...form, meter_number: e.target.value })} className="h-9 text-sm" placeholder="z.B. 12345678" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Einheit / Wohnung</Label>
                <Input value={form.unit_label} onChange={e => setForm({ ...form, unit_label: e.target.value })} className="h-9 text-sm" placeholder="z.B. EG links" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Standort-Hinweis</Label>
                <Input value={form.location_note} onChange={e => setForm({ ...form, location_note: e.target.value })} className="h-9 text-sm" placeholder="z.B. Keller" />
              </div>
              <Button onClick={() => addMeter.mutate()} className="w-full" disabled={!form.meter_number || addMeter.isPending}>
                Zähler anlegen
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {meters.length === 0 ? (
        <p className="text-xs text-muted-foreground text-center py-4">Noch keine Zähler angelegt</p>
      ) : (
        <div className="space-y-2">
          {meters.map(meter => {
            const latest = getLatestReading(meter.id);
            const consumption = getConsumption(meter.id);
            return (
              <div key={meter.id} className="flex items-center gap-3 p-3 rounded-lg bg-secondary/30 hover:bg-secondary/50 transition-colors">
                <span className="text-lg">{typeIcon(meter.meter_type)}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">{meter.meter_type}</span>
                    <span className="text-[10px] text-muted-foreground">#{meter.meter_number}</span>
                    {meter.unit_label && <span className="text-[10px] bg-secondary px-1.5 py-0.5 rounded">{meter.unit_label}</span>}
                  </div>
                  <div className="flex items-center gap-3 text-[11px] text-muted-foreground mt-0.5">
                    {latest ? (
                      <>
                        <span>Letzter Stand: <strong className="text-foreground">{Number(latest.value).toLocaleString("de-DE")}</strong></span>
                        <span>{new Date(latest.reading_date).toLocaleDateString("de-DE")}</span>
                      </>
                    ) : (
                      <span>Noch kein Zählerstand</span>
                    )}
                    {consumption !== null && (
                      <span className="flex items-center gap-0.5">
                        <TrendingUp className="h-3 w-3" /> Verbrauch: {consumption.toLocaleString("de-DE")}
                      </span>
                    )}
                  </div>
                </div>
                <Dialog open={readingOpen === meter.id} onOpenChange={v => { setReadingOpen(v ? meter.id : null); if (!v) setReadingForm({ value: "", reading_date: new Date().toISOString().split("T")[0], note: "" }); }}>
                  <DialogTrigger asChild>
                    <Button variant="ghost" size="sm" className="h-7 text-xs gap-1">
                      <Plus className="h-3 w-3" /> Ablesen
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-sm">
                    <DialogHeader>
                      <DialogTitle>{typeIcon(meter.meter_type)} {meter.meter_type} – Zählerstand erfassen</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-3">
                      <div className="space-y-1">
                        <Label className="text-xs">Zählerstand</Label>
                        <Input type="number" value={readingForm.value} onChange={e => setReadingForm({ ...readingForm, value: e.target.value })} className="h-9 text-sm" placeholder="12345" />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Ablesedatum</Label>
                        <Input type="date" value={readingForm.reading_date} onChange={e => setReadingForm({ ...readingForm, reading_date: e.target.value })} className="h-9 text-sm" />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Notiz</Label>
                        <Input value={readingForm.note} onChange={e => setReadingForm({ ...readingForm, note: e.target.value })} className="h-9 text-sm" placeholder="Optional" />
                      </div>
                      <Button onClick={() => addReading.mutate(meter.id)} className="w-full" disabled={!readingForm.value || addReading.isPending}>
                        Stand erfassen
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
                <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive" onClick={() => deleteMeter.mutate(meter.id)}>
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default MeterManagement;
