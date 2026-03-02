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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Switch } from "@/components/ui/switch";
import { FileText, Plus, AlertTriangle, CheckCircle, Clock, Trash2 } from "lucide-react";
import { formatCurrency } from "@/lib/formatters";
import { toast } from "sonner";
import { useProperties } from "@/context/PropertyContext";

interface ContractRow {
  id: string;
  property_id: string;
  contract_type: string;
  start_date: string;
  end_date: string | null;
  is_indefinite: boolean;
  notice_period_months: number;
  base_rent: number;
  cold_rent: number;
  warm_rent: number;
  deposit_amount: number;
  rent_increase_index: string;
  notes: string | null;
  status: string;
  created_at: string;
}

interface ContractManagementProps {
  propertyId?: string;
}

const ContractManagement = ({ propertyId }: ContractManagementProps) => {
  const { user } = useAuth();
  const qc = useQueryClient();
  const { properties } = useProperties();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    property_id: propertyId || "",
    contract_type: "mietvertrag",
    start_date: new Date().toISOString().split("T")[0],
    end_date: "",
    is_indefinite: true,
    notice_period_months: 3,
    base_rent: 0,
    cold_rent: 0,
    warm_rent: 0,
    deposit_amount: 0,
    rent_increase_index: "mietspiegel",
    notes: "",
  });

  const { data: contracts = [], isLoading } = useQuery({
    queryKey: ["contracts", propertyId],
    queryFn: async () => {
      let q = supabase.from("contracts").select("*").order("created_at", { ascending: false });
      if (propertyId) q = q.eq("property_id", propertyId);
      const { data, error } = await q;
      if (error) throw error;
      return data || [];
    },
    enabled: !!user,
  });

  const addMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("contracts").insert({
        user_id: user!.id,
        property_id: form.property_id,
        contract_type: form.contract_type,
        start_date: form.start_date,
        end_date: form.is_indefinite ? null : form.end_date || null,
        is_indefinite: form.is_indefinite,
        notice_period_months: form.notice_period_months,
        base_rent: form.base_rent,
        cold_rent: form.cold_rent,
        warm_rent: form.warm_rent,
        deposit_amount: form.deposit_amount,
        rent_increase_index: form.rent_increase_index,
        notes: form.notes || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["contracts"] });
      setOpen(false);
      toast.success("Vertrag angelegt");
    },
    onError: () => toast.error("Fehler beim Anlegen"),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("contracts").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["contracts"] });
      toast.success("Vertrag gelöscht");
    },
  });

  const getStatusBadge = (contract: ContractRow) => {
    if (contract.status === "terminated") return <Badge variant="destructive">Gekündigt</Badge>;
    if (!contract.is_indefinite && contract.end_date) {
      const daysLeft = Math.ceil((new Date(contract.end_date).getTime() - Date.now()) / 86400000);
      if (daysLeft < 0) return <Badge variant="destructive">Abgelaufen</Badge>;
      if (daysLeft < 90) return <Badge className="bg-gold/15 text-gold border-gold/30"><AlertTriangle className="h-3 w-3 mr-1" />Läuft aus ({daysLeft}T)</Badge>;
    }
    return <Badge className="bg-profit/15 text-profit border-profit/30"><CheckCircle className="h-3 w-3 mr-1" />Aktiv</Badge>;
  };

  const getPropertyName = (pid: string) => properties.find(p => p.id === pid)?.name || "–";

  return (
    <Card className="p-5">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-semibold flex items-center gap-2">
          <FileText className="h-4 w-4 text-muted-foreground" /> Vertragsmanagement
        </h2>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm" variant="outline"><Plus className="h-3.5 w-3.5 mr-1" /> Vertrag</Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader><DialogTitle>Neuer Mietvertrag</DialogTitle></DialogHeader>
            <div className="grid gap-3 mt-2">
              {!propertyId && (
                <div>
                  <Label>Objekt</Label>
                  <Select value={form.property_id} onValueChange={v => setForm(f => ({ ...f, property_id: v }))}>
                    <SelectTrigger><SelectValue placeholder="Objekt wählen" /></SelectTrigger>
                    <SelectContent>
                      {properties.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              )}
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Vertragsbeginn</Label><Input type="date" value={form.start_date} onChange={e => setForm(f => ({ ...f, start_date: e.target.value }))} /></div>
                <div className="flex items-center gap-2 pt-5">
                  <Switch checked={form.is_indefinite} onCheckedChange={v => setForm(f => ({ ...f, is_indefinite: v }))} />
                  <Label className="text-xs">Unbefristet</Label>
                </div>
              </div>
              {!form.is_indefinite && (
                <div><Label>Vertragsende</Label><Input type="date" value={form.end_date} onChange={e => setForm(f => ({ ...f, end_date: e.target.value }))} /></div>
              )}
              <div className="grid grid-cols-3 gap-3">
                <div><Label>Kaltmiete (€)</Label><Input type="number" value={form.cold_rent} onChange={e => setForm(f => ({ ...f, cold_rent: +e.target.value }))} /></div>
                <div><Label>Warmmiete (€)</Label><Input type="number" value={form.warm_rent} onChange={e => setForm(f => ({ ...f, warm_rent: +e.target.value }))} /></div>
                <div><Label>Kaution (€)</Label><Input type="number" value={form.deposit_amount} onChange={e => setForm(f => ({ ...f, deposit_amount: +e.target.value }))} /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Kündigungsfrist (Monate)</Label><Input type="number" value={form.notice_period_months} onChange={e => setForm(f => ({ ...f, notice_period_months: +e.target.value }))} /></div>
                <div>
                  <Label>Mietanpassung</Label>
                  <Select value={form.rent_increase_index} onValueChange={v => setForm(f => ({ ...f, rent_increase_index: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="mietspiegel">Mietspiegel</SelectItem>
                      <SelectItem value="index">Indexmiete (VPI)</SelectItem>
                      <SelectItem value="staffel">Staffelmiete</SelectItem>
                      <SelectItem value="keine">Keine</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <Button onClick={() => addMutation.mutate()} disabled={!form.property_id || addMutation.isPending}>Speichern</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <div className="text-sm text-muted-foreground animate-pulse">Laden...</div>
      ) : contracts.length === 0 ? (
        <p className="text-sm text-muted-foreground">Noch keine Verträge angelegt.</p>
      ) : (
        <div className="overflow-auto">
          <Table>
            <TableHeader>
              <TableRow>
                {!propertyId && <TableHead>Objekt</TableHead>}
                <TableHead>Beginn</TableHead>
                <TableHead>Ende</TableHead>
                <TableHead>Kaltmiete</TableHead>
                <TableHead>Warmmiete</TableHead>
                <TableHead>Anpassung</TableHead>
                <TableHead>Status</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {contracts.map((c: ContractRow) => (
                <TableRow key={c.id}>
                  {!propertyId && <TableCell className="text-xs">{getPropertyName(c.property_id)}</TableCell>}
                  <TableCell className="text-xs">{new Date(c.start_date).toLocaleDateString("de-DE")}</TableCell>
                  <TableCell className="text-xs">{c.is_indefinite ? <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> Unbefristet</span> : c.end_date ? new Date(c.end_date).toLocaleDateString("de-DE") : "–"}</TableCell>
                  <TableCell className="text-xs font-medium">{formatCurrency(c.cold_rent)}</TableCell>
                  <TableCell className="text-xs font-medium">{formatCurrency(c.warm_rent)}</TableCell>
                  <TableCell className="text-xs capitalize">{c.rent_increase_index}</TableCell>
                  <TableCell>{getStatusBadge(c)}</TableCell>
                  <TableCell>
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => deleteMutation.mutate(c.id)}>
                      <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </Card>
  );
};

export default ContractManagement;
