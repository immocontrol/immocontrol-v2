import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Zap, Plus, AlertTriangle, CheckCircle, Trash2 } from "lucide-react";
import { toast } from "sonner";

const ENERGY_CLASSES = ["A+", "A", "B", "C", "D", "E", "F", "G", "H"];

const getClassColor = (cls: string | null) => {
  if (!cls) return "bg-secondary text-foreground";
  const idx = ENERGY_CLASSES.indexOf(cls);
  if (idx <= 1) return "bg-profit/15 text-profit border-profit/30";
  if (idx <= 3) return "bg-gold/15 text-gold border-gold/30";
  return "bg-loss/15 text-loss border-loss/30";
};

interface EnergyCertificateRow {
  id: string;
  property_id: string;
  certificate_type: string;
  energy_class: string | null;
  energy_value: number;
  issue_date: string;
  expiry_date: string;
  issuer: string | null;
  created_at: string;
}

interface EnergyCertificateTrackerProps {
  propertyId: string;
}

const EnergyCertificateTracker = ({ propertyId }: EnergyCertificateTrackerProps) => {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    certificate_type: "verbrauch",
    energy_class: "",
    energy_value: 0,
    issue_date: new Date().toISOString().split("T")[0],
    expiry_date: "",
    issuer: "",
  });

  const { data: certs = [], isLoading } = useQuery({
    queryKey: ["energy_certificates", propertyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("energy_certificates")
        .select("*")
        .eq("property_id", propertyId)
        .order("expiry_date", { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!user,
  });

  const addMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("energy_certificates").insert({
        user_id: user!.id,
        property_id: propertyId,
        certificate_type: form.certificate_type,
        energy_class: form.energy_class || null,
        energy_value: form.energy_value,
        issue_date: form.issue_date,
        expiry_date: form.expiry_date,
        issuer: form.issuer || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["energy_certificates"] });
      setOpen(false);
      toast.success("Energieausweis hinzugefügt");
    },
    onError: () => toast.error("Fehler"),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("energy_certificates").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["energy_certificates"] });
      toast.success("Gelöscht");
    },
  });

  return (
    <Card className="p-5">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-semibold flex items-center gap-2">
          <Zap className="h-4 w-4 text-muted-foreground" /> Energieausweis
        </h2>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm" variant="outline"><Plus className="h-3.5 w-3.5 mr-1" /> Ausweis</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Energieausweis erfassen</DialogTitle></DialogHeader>
            <div className="grid gap-3 mt-2">
              <div>
                <Label>Typ</Label>
                <Select value={form.certificate_type} onValueChange={v => setForm(f => ({ ...f, certificate_type: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="verbrauch">Verbrauchsausweis</SelectItem>
                    <SelectItem value="bedarf">Bedarfsausweis</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Energieeffizienzklasse</Label>
                  <Select value={form.energy_class} onValueChange={v => setForm(f => ({ ...f, energy_class: v }))}>
                    <SelectTrigger><SelectValue placeholder="Klasse" /></SelectTrigger>
                    <SelectContent>{ENERGY_CLASSES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div><Label>Kennwert (kWh/m²a)</Label><Input type="number" value={form.energy_value} onChange={e => setForm(f => ({ ...f, energy_value: +e.target.value }))} /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Ausstellungsdatum</Label><Input type="date" value={form.issue_date} onChange={e => setForm(f => ({ ...f, issue_date: e.target.value }))} /></div>
                <div><Label>Gültig bis</Label><Input type="date" value={form.expiry_date} onChange={e => setForm(f => ({ ...f, expiry_date: e.target.value }))} /></div>
              </div>
              <div><Label>Aussteller</Label><Input value={form.issuer} onChange={e => setForm(f => ({ ...f, issuer: e.target.value }))} placeholder="Name des Ausstellers" /></div>
              <Button onClick={() => addMutation.mutate()} disabled={!form.expiry_date || addMutation.isPending}>Speichern</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <div className="text-sm text-muted-foreground animate-pulse">Laden...</div>
      ) : certs.length === 0 ? (
        <p className="text-sm text-muted-foreground">Kein Energieausweis hinterlegt.</p>
      ) : (
        <div className="space-y-3">
          {certs.map((cert: EnergyCertificateRow) => {
            const daysLeft = Math.ceil((new Date(cert.expiry_date).getTime() - Date.now()) / 86400000);
            const isExpired = daysLeft < 0;
            const isExpiring = daysLeft >= 0 && daysLeft < 180;
            return (
              <div key={cert.id} className="flex items-center justify-between rounded-lg bg-secondary/50 p-4">
                <div className="flex items-center gap-4">
                  <div className={`w-12 h-12 rounded-lg flex items-center justify-center text-lg font-bold ${getClassColor(cert.energy_class)}`}>
                    {cert.energy_class || "–"}
                  </div>
                  <div>
                    <div className="text-sm font-medium capitalize">{cert.certificate_type === "verbrauch" ? "Verbrauchsausweis" : "Bedarfsausweis"}</div>
                    <div className="text-xs text-muted-foreground">
                      {cert.energy_value} kWh/m²a · {cert.issuer || "–"}
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      Gültig bis: {new Date(cert.expiry_date).toLocaleDateString("de-DE")}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {isExpired ? (
                    <Badge variant="destructive"><AlertTriangle className="h-3 w-3 mr-1" /> Abgelaufen</Badge>
                  ) : isExpiring ? (
                    <Badge className="bg-gold/15 text-gold border-gold/30"><AlertTriangle className="h-3 w-3 mr-1" /> {daysLeft}T</Badge>
                  ) : (
                    <Badge className="bg-profit/15 text-profit border-profit/30"><CheckCircle className="h-3 w-3 mr-1" /> Gültig</Badge>
                  )}
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => deleteMutation.mutate(cert.id)}>
                    <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
};

export default EnergyCertificateTracker;
