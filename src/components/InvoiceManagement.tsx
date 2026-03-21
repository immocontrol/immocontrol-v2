import { useState, useEffect } from "react";
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
import { Receipt, Plus, Check, Clock, AlertTriangle, Trash2 } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { formatCurrency, formatDate } from "@/lib/formatters";
import { toastSuccess } from "@/lib/toastMessages";
import { useProperties } from "@/context/PropertyContext";
import { EmptyState } from "@/components/EmptyState";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { createMutationErrorHandler } from "@/lib/mutationErrorHandler";

interface InvoiceRow {
  id: string;
  property_id: string | null;
  vendor_name: string;
  invoice_number: string | null;
  invoice_date: string;
  due_date: string | null;
  amount: number;
  tax_amount: number;
  category: string;
  status: string;
  payment_date: string | null;
  notes: string | null;
  created_at: string;
}

const CATEGORIES = [
  { value: "wartung", label: "Wartung & Reparatur" },
  { value: "versicherung", label: "Versicherung" },
  { value: "steuer", label: "Steuern & Abgaben" },
  { value: "verwaltung", label: "Verwaltung" },
  { value: "energie", label: "Energie & Versorger" },
  { value: "handwerker", label: "Handwerker" },
  { value: "sonstiges", label: "Sonstiges" },
];

interface InvoiceManagementProps {
  initialOpen?: boolean;
  initialPropertyId?: string;
  onAddOpened?: () => void;
}

const InvoiceManagement = ({ initialOpen, initialPropertyId, onAddOpened }: InvoiceManagementProps = {}) => {
  const { user } = useAuth();
  const qc = useQueryClient();
  const { properties } = useProperties();
  const [open, setOpen] = useState(!!initialOpen);
  const [quickOpen, setQuickOpen] = useState(false);
  const [filter, setFilter] = useState("alle");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
  const today = new Date().toISOString().split("T")[0];
  const [form, setForm] = useState({
    property_id: initialPropertyId || "",
    vendor_name: "",
    invoice_number: "",
    invoice_date: today,
    due_date: "",
    amount: 0,
    tax_amount: 0,
    category: "sonstiges",
    notes: "",
  });
  const [quickForm, setQuickForm] = useState({ vendor_name: "", amount: 0, category: "sonstiges" });

  useEffect(() => {
    if (initialOpen) {
      setOpen(true);
      if (initialPropertyId) setForm(f => ({ ...f, property_id: initialPropertyId }));
      onAddOpened?.();
    }
  }, [initialOpen, initialPropertyId, onAddOpened]);

  const { data: invoices = [], isLoading } = useQuery({
    queryKey: ["invoices", filter],
    queryFn: async () => {
      let q = supabase.from("invoices").select("*").order("invoice_date", { ascending: false });
      if (filter !== "alle") q = q.eq("status", filter);
      const { data, error } = await q;
      if (error) throw error;
      return data || [];
    },
    enabled: !!user,
  });

  const buildInsertPayload = (data: { vendor_name: string; amount: number; tax_amount?: number; category: string; property_id?: string; invoice_number?: string; invoice_date?: string; due_date?: string; notes?: string }) => ({
    user_id: user!.id,
    property_id: data.property_id || null,
    vendor_name: data.vendor_name,
    invoice_number: data.invoice_number || null,
    invoice_date: data.invoice_date || today,
    due_date: data.due_date || null,
    amount: data.amount,
    tax_amount: data.tax_amount ?? 0,
    category: data.category,
    notes: data.notes || null,
  });

  const addMutation = useMutation({
    mutationFn: async (payload?: { vendor_name: string; amount: number; category: string }) => {
      const data = payload
        ? { ...form, vendor_name: payload.vendor_name, amount: payload.amount, category: payload.category }
        : form;
      const { error } = await supabase.from("invoices").insert(buildInsertPayload(data));
      if (error) throw error;
    },
    onSuccess: (_, payload) => {
      qc.invalidateQueries({ queryKey: ["invoices"] });
      setOpen(false);
      setQuickOpen(false);
      if (payload) setQuickForm({ vendor_name: "", amount: 0, category: "sonstiges" });
      toast.success("Rechnung erfasst");
    },
    onError: createMutationErrorHandler("Rechnung erfassen", "Fehler beim Erfassen"),
  });

  const updateStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const updates: Record<string, string> = { status };
      if (status === "bezahlt") updates.payment_date = new Date().toISOString().split("T")[0];
      const { error } = await supabase.from("invoices").update(updates).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["invoices"] });
      toastSuccess("Status aktualisiert");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("invoices").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["invoices"] });
      setDeleteTargetId(null);
      toastSuccess("Gelöscht");
    },
    onError: createMutationErrorHandler("Rechnung löschen", "Fehler beim Löschen"),
  });

  const bulkUpdateStatusMutation = useMutation({
    mutationFn: async ({ ids, status }: { ids: string[]; status: string }) => {
      const updates: Record<string, string> = { status };
      if (status === "bezahlt") updates.payment_date = new Date().toISOString().split("T")[0];
      const { error } = await supabase.from("invoices").update(updates).in("id", ids);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["invoices"] });
      setSelectedIds(new Set());
      toastSuccess("Status aktualisiert");
    },
    onError: createMutationErrorHandler("Rechnungen aktualisieren", "Fehler"),
  });

  const bulkDeleteMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      const { error } = await supabase.from("invoices").delete().in("id", ids);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["invoices"] });
      setSelectedIds(new Set());
      toastSuccess("Gelöscht");
    },
    onError: createMutationErrorHandler("Rechnungen löschen", "Fehler"),
  });

  const getStatusBadge = (status: string, dueDate: string | null) => {
    if (status === "bezahlt") return <Badge className="bg-profit/15 text-profit border-profit/30"><Check className="h-3 w-3 mr-1" />Bezahlt</Badge>;
    if (status === "storniert") return <Badge variant="secondary">Storniert</Badge>;
    if (dueDate && new Date(dueDate) < new Date()) return <Badge variant="destructive"><AlertTriangle className="h-3 w-3 mr-1" />Überfällig</Badge>;
    return <Badge className="bg-gold/15 text-gold border-gold/30"><Clock className="h-3 w-3 mr-1" />Offen</Badge>;
  };

  const totals = invoices.reduce((acc: { total: number; open: number; paid: number }, inv: InvoiceRow) => {
    acc.total += Number(inv.amount);
    if (inv.status === "offen") acc.open += Number(inv.amount);
    if (inv.status === "bezahlt") acc.paid += Number(inv.amount);
    return acc;
  }, { total: 0, open: 0, paid: 0 });

  const getPropertyName = (pid: string | null) => pid ? properties.find(p => p.id === pid)?.name || "–" : "Allgemein";

  return (
    <Card className="p-5">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-semibold flex items-center gap-2">
          <Receipt className="h-4 w-4 text-muted-foreground" /> Rechnungseingang
        </h2>
        <div className="flex items-center gap-2">
          <Select value={filter} onValueChange={setFilter}>
            <SelectTrigger className="h-8 w-28 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="alle">Alle</SelectItem>
              <SelectItem value="offen">Offen</SelectItem>
              <SelectItem value="bezahlt">Bezahlt</SelectItem>
              <SelectItem value="storniert">Storniert</SelectItem>
            </SelectContent>
          </Select>
          <Dialog open={quickOpen} onOpenChange={setQuickOpen}>
            <DialogTrigger asChild>
              <Button size="sm" variant="ghost" className="text-xs"><Plus className="h-3 w-3 mr-1" /> Schnell</Button>
            </DialogTrigger>
            <DialogContent className="max-w-xs">
              <DialogHeader><DialogTitle>Schnell erfassen</DialogTitle></DialogHeader>
              <div className="grid gap-3 mt-2">
                <div><Label>Lieferant</Label><Input value={quickForm.vendor_name} onChange={e => setQuickForm(f => ({ ...f, vendor_name: e.target.value }))} placeholder="z.B. Stadtwerke" /></div>
                <div><Label>Betrag (€)</Label><Input type="number" value={quickForm.amount || ""} onChange={e => setQuickForm(f => ({ ...f, amount: +e.target.value || 0 }))} placeholder="0" /></div>
                <div>
                  <Label>Kategorie</Label>
                  <Select value={quickForm.category} onValueChange={v => setQuickForm(f => ({ ...f, category: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{CATEGORIES.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <Button onClick={() => addMutation.mutate(quickForm)} disabled={!quickForm.vendor_name || addMutation.isPending}>Erfassen</Button>
              </div>
            </DialogContent>
          </Dialog>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm" variant="outline"><Plus className="h-3.5 w-3.5 mr-1" /> Rechnung</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Rechnung erfassen</DialogTitle></DialogHeader>
              <div className="grid gap-3 mt-2">
                <div><Label>Lieferant / Dienstleister</Label><Input value={form.vendor_name} onChange={e => setForm(f => ({ ...f, vendor_name: e.target.value }))} placeholder="z.B. Stadtwerke" /></div>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>Rechnungsnummer</Label><Input value={form.invoice_number} onChange={e => setForm(f => ({ ...f, invoice_number: e.target.value }))} /></div>
                  <div>
                    <Label>Kategorie</Label>
                    <Select value={form.category} onValueChange={v => setForm(f => ({ ...f, category: v }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>{CATEGORIES.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>Rechnungsdatum</Label><Input type="date" value={form.invoice_date} onChange={e => setForm(f => ({ ...f, invoice_date: e.target.value }))} /></div>
                  <div><Label>Fällig am</Label><Input type="date" value={form.due_date} onChange={e => setForm(f => ({ ...f, due_date: e.target.value }))} /></div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>Betrag netto (€)</Label><Input type="number" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: +e.target.value }))} /></div>
                  <div><Label>MwSt. (€)</Label><Input type="number" value={form.tax_amount} onChange={e => setForm(f => ({ ...f, tax_amount: +e.target.value }))} /></div>
                </div>
                <div>
                  <Label>Objekt (optional)</Label>
                  <Select value={form.property_id} onValueChange={v => setForm(f => ({ ...f, property_id: v }))}>
                    <SelectTrigger><SelectValue placeholder="Kein Objekt" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">Allgemein</SelectItem>
                      {properties.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <Button onClick={() => addMutation.mutate()} disabled={!form.vendor_name || addMutation.isPending}>Erfassen</Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Bulk actions */}
      {selectedIds.size > 0 && invoices.length > 0 && (
        <div className="flex items-center justify-between gap-2 p-3 rounded-xl border border-primary/20 bg-primary/5 mb-4">
          <span className="text-sm font-medium">{selectedIds.size} ausgewählt</span>
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={() => setSelectedIds(new Set())}>
              Auswahl aufheben
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="gap-1.5"
              onClick={() => bulkUpdateStatusMutation.mutate({ ids: Array.from(selectedIds), status: "bezahlt" })}
              disabled={bulkUpdateStatusMutation.isPending}
            >
              <Check className="h-3.5 w-3.5" /> Als bezahlt
            </Button>
            <Button
              size="sm"
              variant="destructive"
              className="gap-1.5"
              onClick={() => bulkDeleteMutation.mutate(Array.from(selectedIds))}
              disabled={bulkDeleteMutation.isPending}
            >
              <Trash2 className="h-3.5 w-3.5" /> Löschen
            </Button>
          </div>
        </div>
      )}

      {/* Summary */}
      <div className="grid grid-cols-3 gap-3 mb-4">
        <div className="rounded-lg bg-secondary/50 p-3 text-center">
          <div className="text-xs text-muted-foreground">Gesamt</div>
          <div className="text-sm font-bold">{formatCurrency(totals.total)}</div>
        </div>
        <div className="rounded-lg bg-gold/10 p-3 text-center">
          <div className="text-xs text-muted-foreground">Offen</div>
          <div className="text-sm font-bold text-gold">{formatCurrency(totals.open)}</div>
        </div>
        <div className="rounded-lg bg-profit/10 p-3 text-center">
          <div className="text-xs text-muted-foreground">Bezahlt</div>
          <div className="text-sm font-bold text-profit">{formatCurrency(totals.paid)}</div>
        </div>
      </div>

      {isLoading ? (
        <div className="text-sm text-muted-foreground animate-pulse" role="status" aria-live="polite">Laden...</div>
      ) : invoices.length === 0 ? (
        <EmptyState
          icon={Receipt}
          title="Keine Rechnungen"
          description="Rechnungen erfassen für bessere Übersicht"
          action={
            <Button size="sm" className="gap-1.5 touch-target min-h-[44px]" onClick={() => setOpen(true)}>
              <Plus className="h-3.5 w-3.5" /> Erste Rechnung erfassen
            </Button>
          }
        />
      ) : (
        <div className="overflow-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">
                  <Checkbox
                    checked={invoices.length > 0 && invoices.every((inv) => selectedIds.has(inv.id))}
                    onCheckedChange={(c) =>
                      setSelectedIds(c ? new Set(invoices.map((i) => i.id)) : new Set())
                    }
                    aria-label="Alle auswählen"
                  />
                </TableHead>
                <TableHead>Datum</TableHead>
                <TableHead>Lieferant</TableHead>
                <TableHead>Objekt</TableHead>
                <TableHead>Kategorie</TableHead>
                <TableHead>Betrag</TableHead>
                <TableHead>Fällig</TableHead>
                <TableHead>Status</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {invoices.map((inv: InvoiceRow) => (
                <TableRow key={inv.id}>
                  <TableCell>
                    <Checkbox
                      checked={selectedIds.has(inv.id)}
                      onCheckedChange={() =>
                        setSelectedIds((prev) => {
                          const next = new Set(prev);
                          if (next.has(inv.id)) next.delete(inv.id);
                          else next.add(inv.id);
                          return next;
                        })
                      }
                      aria-label={`${inv.vendor_name} auswählen`}
                    />
                  </TableCell>
                  <TableCell className="text-xs">{formatDate(inv.invoice_date)}</TableCell>
                  <TableCell className="text-xs font-medium">{inv.vendor_name}</TableCell>
                  <TableCell className="text-xs">{getPropertyName(inv.property_id)}</TableCell>
                  <TableCell className="text-xs capitalize">{CATEGORIES.find(c => c.value === inv.category)?.label || inv.category}</TableCell>
                  <TableCell className="text-xs font-medium">{formatCurrency(inv.amount)}</TableCell>
                  <TableCell className="text-xs">{inv.due_date ? formatDate(inv.due_date) : "–"}</TableCell>
                  <TableCell>{getStatusBadge(inv.status, inv.due_date)}</TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      {inv.status === "offen" && (
                        <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => updateStatus.mutate({ id: inv.id, status: "bezahlt" })}>
                          <Check className="h-3 w-3 mr-1" /> Bezahlt
                        </Button>
                      )}
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setDeleteTargetId(inv.id)} aria-label="Rechnung löschen">
                        <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <AlertDialog open={!!deleteTargetId} onOpenChange={(open) => { if (!open) setDeleteTargetId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Rechnung löschen?</AlertDialogTitle>
            <AlertDialogDescription>
              Die Rechnung wird unwiderruflich gelöscht.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => { if (deleteTargetId) { deleteMutation.mutate(deleteTargetId); setDeleteTargetId(null); } }}
            >
              Löschen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
};

export default InvoiceManagement;
