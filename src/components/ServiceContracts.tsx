import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SettingsToggleRow } from "@/components/ui/settings-toggle-row";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Wrench, Plus, AlertTriangle, CheckCircle, RotateCw, Trash2 } from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/formatters";
import { toast } from "sonner";
import { useProperties } from "@/context/PropertyContext";
import { EmptyState } from "@/components/EmptyState";
import { createMutationErrorHandler } from "@/lib/mutationErrorHandler";

const SERVICE_TYPES = [
  { value: "wartung", label: "Wartung" },
  { value: "reinigung", label: "Reinigung" },
  { value: "garten", label: "Gartenpflege" },
  { value: "hausverwaltung", label: "Hausverwaltung" },
  { value: "aufzug", label: "Aufzug" },
  { value: "heizung", label: "Heizung" },
  { value: "schornstein", label: "Schornsteinfeger" },
  { value: "sicherheit", label: "Sicherheit" },
  { value: "sonstiges", label: "Sonstiges" },
];

interface ServiceContractRow {
  id: string;
  property_id: string;
  service_type: string;
  provider_name: string;
  contract_number: string | null;
  start_date: string;
  end_date: string | null;
  is_auto_renew: boolean;
  notice_period_months: number;
  annual_cost: number;
  payment_interval: string;
  notes: string | null;
  created_at: string;
}

interface ServiceContractsProps {
  propertyId?: string;
}

const ServiceContracts = ({ propertyId }: ServiceContractsProps) => {
  const { user } = useAuth();
  const qc = useQueryClient();
  const { properties } = useProperties();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    property_id: propertyId || "",
    service_type: "wartung",
    provider_name: "",
    contract_number: "",
    start_date: new Date().toISOString().split("T")[0],
    end_date: "",
    is_auto_renew: true,
    notice_period_months: 3,
    annual_cost: 0,
    payment_interval: "monatlich",
    notes: "",
  });

  const { data: contracts = [], isLoading } = useQuery({
    queryKey: ["service_contracts", propertyId],
    queryFn: async () => {
      let q = supabase.from("service_contracts").select("*").order("created_at", { ascending: false });
      if (propertyId) q = q.eq("property_id", propertyId);
      const { data, error } = await q;
      if (error) throw error;
      return data || [];
    },
    enabled: !!user,
  });

  const addMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("service_contracts").insert({
        user_id: user!.id,
        property_id: form.property_id,
        service_type: form.service_type,
        provider_name: form.provider_name,
        contract_number: form.contract_number || null,
        start_date: form.start_date,
        end_date: form.end_date || null,
        is_auto_renew: form.is_auto_renew,
        notice_period_months: form.notice_period_months,
        annual_cost: form.annual_cost,
        payment_interval: form.payment_interval,
        notes: form.notes || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["service_contracts"] });
      setOpen(false);
      toast.success("Dienstleistervertrag angelegt");
    },
    onError: createMutationErrorHandler("Dienstleistervertrag anlegen", "Fehler beim Anlegen"),
  });

  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("service_contracts").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["service_contracts"] });
      toast.success("Gelöscht");
      setDeleteTargetId(null);
    },
    onError: createMutationErrorHandler("Dienstleistervertrag löschen", "Fehler beim Löschen"),
  });

  const totalAnnualCost = contracts.reduce((s: number, c: ServiceContractRow) => s + Number(c.annual_cost), 0);
  const getPropertyName = (pid: string) => properties.find(p => p.id === pid)?.name || "–";

  return (
    <Card className="p-5">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-semibold flex items-center gap-2">
          <Wrench className="h-4 w-4 text-muted-foreground" /> Dienstleisterverträge
          {contracts.length > 0 && <span className="text-xs text-muted-foreground font-normal">({formatCurrency(totalAnnualCost)}/Jahr)</span>}
        </h2>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm" variant="outline"><Plus className="h-3.5 w-3.5 mr-1" /> Vertrag</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Neuer Dienstleistervertrag</DialogTitle></DialogHeader>
            <div className="grid gap-3 mt-2">
              {!propertyId && (
                <div>
                  <Label>Objekt</Label>
                  <Select value={form.property_id} onValueChange={v => setForm(f => ({ ...f, property_id: v }))}>
                    <SelectTrigger><SelectValue placeholder="Objekt wählen" /></SelectTrigger>
                    <SelectContent>{properties.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              )}
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Dienstleister</Label><Input value={form.provider_name} onChange={e => setForm(f => ({ ...f, provider_name: e.target.value }))} placeholder="z.B. Kaminkehrer Müller" /></div>
                <div>
                  <Label>Leistungsart</Label>
                  <Select value={form.service_type} onValueChange={v => setForm(f => ({ ...f, service_type: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{SERVICE_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Vertragsbeginn</Label><Input type="date" value={form.start_date} onChange={e => setForm(f => ({ ...f, start_date: e.target.value }))} /></div>
                <div><Label>Vertragsende (optional)</Label><Input type="date" value={form.end_date} onChange={e => setForm(f => ({ ...f, end_date: e.target.value }))} /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Jahreskosten (€)</Label><Input type="number" value={form.annual_cost} onChange={e => setForm(f => ({ ...f, annual_cost: +e.target.value }))} /></div>
                <div>
                  <Label>Zahlungsintervall</Label>
                  <Select value={form.payment_interval} onValueChange={v => setForm(f => ({ ...f, payment_interval: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="monatlich">Monatlich</SelectItem>
                      <SelectItem value="quartalsweise">Quartalsweise</SelectItem>
                      <SelectItem value="halbjährlich">Halbjährlich</SelectItem>
                      <SelectItem value="jährlich">Jährlich</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <SettingsToggleRow
                label="Automatische Verlängerung"
                checked={form.is_auto_renew}
                onCheckedChange={v => setForm(f => ({ ...f, is_auto_renew: v }))}
                ariaLabel="Automatische Verlängerung ein oder aus"
              />
              <div className="flex items-center gap-4">
                <div className="flex-1">
                  <Label className="text-xs">Kündigungsfrist (Monate)</Label>
                  <Input type="number" className="h-8" value={form.notice_period_months} onChange={e => setForm(f => ({ ...f, notice_period_months: +e.target.value }))} />
                </div>
              </div>
              <Button onClick={() => addMutation.mutate()} disabled={!form.provider_name || !form.property_id}>Speichern</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <div className="text-sm text-muted-foreground animate-pulse" role="status" aria-live="polite">Laden...</div>
      ) : contracts.length === 0 ? (
        <EmptyState icon={Wrench} title="Keine Dienstleisterverträge" description="Verträge für Wartung, Reinigung oder Hausverwaltung anlegen" />
      ) : (
        <div className="overflow-auto">
          <Table>
            <TableHeader>
              <TableRow>
                {!propertyId && <TableHead>Objekt</TableHead>}
                <TableHead>Dienstleister</TableHead>
                <TableHead>Leistung</TableHead>
                <TableHead>Kosten/Jahr</TableHead>
                <TableHead>Laufzeit</TableHead>
                <TableHead>Status</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {contracts.map((c: ServiceContractRow) => {
                const endDate = c.end_date ? new Date(c.end_date) : null;
                const daysLeft = endDate ? Math.ceil((endDate.getTime() - Date.now()) / 86400000) : null;
                return (
                  <TableRow key={c.id}>
                    {!propertyId && <TableCell className="text-xs">{getPropertyName(c.property_id)}</TableCell>}
                    <TableCell className="text-xs font-medium">{c.provider_name}</TableCell>
                    <TableCell className="text-xs capitalize">{SERVICE_TYPES.find(t => t.value === c.service_type)?.label || c.service_type}</TableCell>
                    <TableCell className="text-xs font-medium">{formatCurrency(c.annual_cost)}</TableCell>
                    <TableCell className="text-xs">
                      {endDate ? (
                        <span>bis {formatDate(c.end_date!)}</span>
                      ) : c.is_auto_renew ? (
                        <span className="flex items-center gap-1"><RotateCw className="h-3 w-3" /> Automatisch</span>
                      ) : "Unbefristet"}
                    </TableCell>
                    <TableCell>
                      {daysLeft !== null && daysLeft < 0 ? (
                        <Badge variant="destructive">Abgelaufen</Badge>
                      ) : daysLeft !== null && daysLeft < 90 ? (
                        <Badge className="bg-gold/15 text-gold border-gold/30"><AlertTriangle className="h-3 w-3 mr-1" />{daysLeft}T</Badge>
                      ) : (
                        <Badge className="bg-profit/15 text-profit border-profit/30"><CheckCircle className="h-3 w-3 mr-1" />Aktiv</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setDeleteTargetId(c.id)} aria-label="Vertrag löschen">
                        <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      <AlertDialog open={!!deleteTargetId} onOpenChange={(open) => { if (!open) setDeleteTargetId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Dienstleistervertrag löschen?</AlertDialogTitle>
            <AlertDialogDescription>Der Vertrag wird unwiderruflich entfernt.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => { if (deleteTargetId) deleteMutation.mutate(deleteTargetId); }}
            >
              Löschen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
};

export default ServiceContracts;
