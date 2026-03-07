import { useState, useEffect, useMemo, useCallback } from "react";
import { Link } from "react-router-dom";
import { ROUTES } from "@/lib/routes";
import { FileText, Plus, Trash2, Download, CheckCircle, Clock, AlertCircle, FolderOpen, Save, Loader2, Building2, BarChart3 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useProperties } from "@/context/PropertyContext";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";
import { formatCurrency } from "@/lib/formatters";
import { queryKeys } from "@/lib/queryKeys";
import { AutoNebenkosten } from "@/components/AutoNebenkosten";
import { EmptyState } from "@/components/EmptyState";
import jsPDF from "jspdf";

const NK_CATEGORIES = [
  "Grundsteuer", "Wasserversorgung", "Entwässerung", "Heizkosten", "Warmwasser",
  "Aufzug", "Straßenreinigung", "Müllabfuhr", "Gebäudereinigung", "Gartenpflege",
  "Beleuchtung", "Schornsteinreinigung", "Versicherungen", "Hausmeister", "Kabelanschluss", "Sonstiges"
];

const Nebenkosten = () => {
  const { user } = useAuth();
  const { properties } = useProperties();
  const qc = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [selectedBilling, setSelectedBilling] = useState<string | null>(null);
  const [form, setForm] = useState({
    property_id: "",
    tenant_id: "",
    billing_period_start: `${new Date().getFullYear() - 1}-01-01`,
    billing_period_end: `${new Date().getFullYear() - 1}-12-31`,
    prepayments: "0",
  });
  const [itemForm, setItemForm] = useState({ category: "Grundsteuer", description: "", total_amount: "", distribution_key: "Fläche", tenant_amount: "" });

  const { data: billings = [] } = useQuery({
    queryKey: ["utility_billings"],
    queryFn: async () => {
      const { data } = await supabase.from("utility_billings").select("*").order("created_at", { ascending: false });
      return data || [];
    },
    enabled: !!user,
  });

  /* IMP-41-12: Dynamic document title with billing count */
  useEffect(() => { document.title = `Nebenkosten (${billings.length}) – ImmoControl`; }, [billings.length]);

  const { data: tenants = [] } = useQuery({
    queryKey: ["all_tenants_nk"],
    queryFn: async () => {
      const { data } = await supabase.from("tenants").select("id, first_name, last_name, property_id, is_active");
      return data || [];
    },
    enabled: !!user,
  });

  const { data: billingItems = [] } = useQuery({
    queryKey: ["utility_billing_items", selectedBilling],
    queryFn: async () => {
      if (!selectedBilling) return [];
      const { data } = await supabase.from("utility_billing_items").select("*").eq("billing_id", selectedBilling).order("created_at");
      return data || [];
    },
    enabled: !!selectedBilling,
  });

  const createBilling = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Nicht angemeldet");
      if (!form.property_id) throw new Error("Bitte Objekt wählen");
      const { error } = await supabase.from("utility_billings").insert({
        property_id: form.property_id,
        user_id: user.id,
        tenant_id: form.tenant_id || null,
        billing_period_start: form.billing_period_start,
        billing_period_end: form.billing_period_end,
        prepayments: parseFloat(form.prepayments) || 0,
        status: "draft",
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Nebenkostenabrechnung erstellt");
      setCreateOpen(false);
      qc.invalidateQueries({ queryKey: ["utility_billings"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const addItem = useMutation({
    mutationFn: async () => {
      if (!user || !selectedBilling) throw new Error("Fehler");
      const { error } = await supabase.from("utility_billing_items").insert({
        billing_id: selectedBilling,
        user_id: user.id,
        category: itemForm.category,
        description: itemForm.description,
        total_amount: parseFloat(itemForm.total_amount) || 0,
        distribution_key: itemForm.distribution_key,
        tenant_amount: parseFloat(itemForm.tenant_amount) || 0,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Position hinzugefügt");
      setItemForm({ category: "Grundsteuer", description: "", total_amount: "", distribution_key: "Fläche", tenant_amount: "" });
      qc.invalidateQueries({ queryKey: ["utility_billing_items", selectedBilling] });
      updateBillingTotals();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteItem = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("utility_billing_items").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["utility_billing_items", selectedBilling] });
      updateBillingTotals();
    },
    onError: () => toast.error("Fehler beim Löschen"),
  });

  const deleteBilling = useMutation({
    mutationFn: async (id: string) => {
      const { error: itemsErr } = await supabase.from("utility_billing_items").delete().eq("billing_id", id);
      if (itemsErr) throw itemsErr;
      const { error: billingErr } = await supabase.from("utility_billings").delete().eq("id", id);
      if (billingErr) throw billingErr;
    },
    onSuccess: () => {
      toast.success("Abrechnung gelöscht");
      setSelectedBilling(null);
      qc.invalidateQueries({ queryKey: ["utility_billings"] });
    },
    onError: () => toast.error("Fehler beim Löschen der Abrechnung"),
  });

  const updateBillingTotals = async () => {
    if (!selectedBilling) return;
    const { data: items } = await supabase.from("utility_billing_items").select("total_amount, tenant_amount").eq("billing_id", selectedBilling);
    const totalCosts = (items || []).reduce((s, i) => s + Number(i.total_amount), 0);
    const tenantShare = (items || []).reduce((s, i) => s + Number(i.tenant_amount), 0);
    const billing = billings.find(b => b.id === selectedBilling);
    const prepayments = Number(billing?.prepayments || 0);
    await supabase.from("utility_billings").update({
      total_costs: totalCosts,
      tenant_share: tenantShare,
      balance: tenantShare - prepayments,
    }).eq("id", selectedBilling);
    qc.invalidateQueries({ queryKey: ["utility_billings"] });
  };

  /* IMP-17: Wrap finalizeBilling in useCallback for stable reference */
  const finalizeBilling = useCallback(async (id: string) => {
    const { error } = await supabase.from("utility_billings").update({ status: "final" }).eq("id", id);
    if (error) { toast.error("Fehler beim Finalisieren"); return; }
    toast.success("Abrechnung finalisiert");
    qc.invalidateQueries({ queryKey: ["utility_billings"] });
  }, [qc]);

  /* IMP-16: Replace `any` with proper billing record type */
  const exportBillingPDF = (billing: { id: string; property_id: string; tenant_id: string | null; billing_period_start: string; billing_period_end: string; prepayments: number; total_costs: number; tenant_share: number; balance: number; status: string }) => {
    const property = properties.find(p => p.id === billing.property_id);
    const tenant = tenants.find(t => t.id === billing.tenant_id);
    const items = billingItems.filter(i => i.billing_id === billing.id);
    
    const html = `<!DOCTYPE html><html lang="de"><head><meta charset="UTF-8"><title>Nebenkostenabrechnung</title>
<style>body{font-family:system-ui,sans-serif;padding:40px;color:#222;max-width:800px;margin:0 auto}
h1{font-size:22px;border-bottom:2px solid #2a9d6e;padding-bottom:8px}
table{width:100%;border-collapse:collapse;margin:16px 0;font-size:13px}
th,td{padding:8px 10px;text-align:left;border-bottom:1px solid #eee}
th{background:#f5f5f5;font-weight:600}
.total{font-weight:700;border-top:2px solid #333}
.positive{color:#2a9d6e}.negative{color:#d94040}
.footer{margin-top:40px;font-size:11px;color:#aaa;text-align:center}</style></head><body>
<h1>📋 Nebenkostenabrechnung</h1>
<p><strong>Objekt:</strong> ${property?.name || "–"} · ${property?.address || ""}</p>
${tenant ? `<p><strong>Mieter:</strong> ${tenant.first_name} ${tenant.last_name}</p>` : ""}
<p><strong>Zeitraum:</strong> ${new Date(billing.billing_period_start).toLocaleDateString("de-DE")} – ${new Date(billing.billing_period_end).toLocaleDateString("de-DE")}</p>
<table>
<tr><th>Kostenart</th><th>Beschreibung</th><th>Umlageschlüssel</th><th>Gesamtkosten</th><th>Mieteranteil</th></tr>
${items.map(i => `<tr><td>${i.category}</td><td>${i.description}</td><td>${i.distribution_key}</td><td>${formatCurrency(Number(i.total_amount))}</td><td>${formatCurrency(Number(i.tenant_amount))}</td></tr>`).join("")}
</table>
<table>
<tr class="total"><td colspan="4">Summe Mieteranteil</td><td>${formatCurrency(Number(billing.tenant_share))}</td></tr>
<tr><td colspan="4">Vorauszahlungen</td><td>-${formatCurrency(Number(billing.prepayments))}</td></tr>
<tr class="total"><td colspan="4">${Number(billing.balance) >= 0 ? "Nachzahlung" : "Guthaben"}</td><td class="${Number(billing.balance) >= 0 ? "negative" : "positive"}">${formatCurrency(Math.abs(Number(billing.balance)))}</td></tr>
</table>
<div class="footer">ImmoControl · Nebenkostenabrechnung · Erstellt am ${new Date().toLocaleDateString("de-DE")}</div>
</body></html>`;
    const w = window.open("", "_blank");
    if (w) { w.document.write(html); w.document.close(); w.print(); }
  };

  /** SYNERGY: Nebenkostenabrechnung als Dokument speichern (PDF → property_documents) */
  const generateBillingPdfBlob = useCallback((
    billing: { property_id: string; tenant_id: string | null; billing_period_start: string; billing_period_end: string; prepayments: number; total_costs: number; tenant_share: number; balance: number },
    property: { name: string; address?: string } | undefined,
    tenant: { first_name: string; last_name: string } | undefined,
    items: Array<{ category: string; description: string; distribution_key: string; total_amount: number; tenant_amount: number }>
  ): Blob => {
    const doc = new jsPDF({ format: "a4" });
    const m = 20;
    let y = m;
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text("Nebenkostenabrechnung", m, y); y += 10;
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text(`Objekt: ${property?.name || "–"} ${property?.address || ""}`, m, y); y += 6;
    if (tenant) { doc.text(`Mieter: ${tenant.first_name} ${tenant.last_name}`, m, y); y += 6; }
    doc.text(`Zeitraum: ${new Date(billing.billing_period_start).toLocaleDateString("de-DE")} – ${new Date(billing.billing_period_end).toLocaleDateString("de-DE")}`, m, y); y += 12;
    doc.setFont("helvetica", "bold");
    doc.text("Kostenart", m, y);
    doc.text("Beschreibung", m + 40, y);
    doc.text("Mieteranteil", m + 120, y); y += 6;
    doc.setFont("helvetica", "normal");
    items.forEach(i => {
      doc.text(i.category, m, y);
      doc.text((i.description || "").slice(0, 25), m + 40, y);
      doc.text(formatCurrency(Number(i.tenant_amount)), m + 120, y); y += 6;
    });
    y += 6;
    doc.setFont("helvetica", "bold");
    doc.text("Summe Mieteranteil", m, y);
    doc.text(formatCurrency(Number(billing.tenant_share)), m + 120, y); y += 6;
    doc.setFont("helvetica", "normal");
    doc.text("Vorauszahlungen", m, y);
    doc.text(`-${formatCurrency(Number(billing.prepayments))}`, m + 120, y); y += 8;
    doc.setFont("helvetica", "bold");
    doc.text(Number(billing.balance) >= 0 ? "Nachzahlung" : "Guthaben", m, y);
    doc.text(formatCurrency(Math.abs(Number(billing.balance))), m + 120, y);
    doc.setFontSize(8);
    doc.text(`ImmoControl · Erstellt am ${new Date().toLocaleDateString("de-DE")}`, m, 285);
    return doc.output("blob");
  }, []);

  const [savingAsDoc, setSavingAsDoc] = useState(false);
  const saveBillingAsDocument = useCallback(async () => {
    if (!user || !selectedBillingData) return;
    setSavingAsDoc(true);
    try {
      const property = properties.find(p => p.id === selectedBillingData.property_id);
      const tenant = selectedBillingData.tenant_id ? tenants.find(t => t.id === selectedBillingData.tenant_id) : undefined;
      const items = billingItems.map(i => ({
        category: i.category,
        description: i.description || "",
        distribution_key: i.distribution_key,
        total_amount: Number(i.total_amount || 0),
        tenant_amount: Number(i.tenant_amount || 0),
      }));
      const blob = generateBillingPdfBlob(selectedBillingData, property, tenant, items);
      const fileName = `Nebenkostenabrechnung_${property?.name || "Objekt"}_${new Date(selectedBillingData.billing_period_end).getFullYear()}.pdf`.replace(/[^a-zA-Z0-9äöüÄÖÜß_\-\.]/g, "_");
      const filePath = `${user.id}/${selectedBillingData.property_id}/${Date.now()}_${fileName}`;
      const { error: uploadError } = await supabase.storage.from("property-documents").upload(filePath, blob, { contentType: "application/pdf" });
      if (uploadError) throw uploadError;
      const { error: insertError } = await supabase.from("property_documents").insert({
        property_id: selectedBillingData.property_id,
        user_id: user.id,
        file_name: fileName,
        file_path: filePath,
        file_size: blob.size,
        file_type: "application/pdf",
        category: "Nebenkostenabrechnung",
      });
      if (insertError) throw insertError;
      qc.invalidateQueries({ queryKey: queryKeys.documents.byProperty(selectedBillingData.property_id) });
      qc.invalidateQueries({ queryKey: ["all_documents"] });
      qc.invalidateQueries({ queryKey: queryKeys.timeline.byProperty(selectedBillingData.property_id) });
      toast.success("Nebenkostenabrechnung als Dokument gespeichert");
    } catch (e: unknown) {
      toast.error((e as Error).message || "Speichern fehlgeschlagen");
    } finally {
      setSavingAsDoc(false);
    }
  }, [user, selectedBillingData, properties, tenants, billingItems, generateBillingPdfBlob, qc]);

  /* FUNC-34: NK per sqm calculation */
  /* STRONG-17: NaN/Infinity guard on NK per sqm — prevents broken display if sqm data is missing */
  const nkPerSqm = useMemo(() => {
    const totalCosts = billings.reduce((s, b) => s + Number(b.total_costs || 0), 0);
    const totalSqm = properties.reduce((s, p) => s + (p.sqm || 0), 0);
    const raw = totalSqm > 0 ? (totalCosts / totalSqm) : 0;
    return Number.isFinite(raw) ? raw : 0;
  }, [billings, properties]);

  /* FUNC-35: Billing status summary */
  const billingStatusSummary = useMemo(() => ({
    draft: billings.filter(b => b.status === "draft").length,
    final: billings.filter(b => b.status === "final").length,
    totalBalance: billings.reduce((s, b) => s + Math.abs(Number(b.balance || 0)), 0),
  }), [billings]);

  /* OPT-20: Memoized category totals for the selected billing */
  const categoryTotals = useMemo(() => {
    const totals: Record<string, number> = {};
    billingItems.forEach(item => {
      totals[item.category] = (totals[item.category] || 0) + Number(item.tenant_amount || 0);
    });
    return totals;
  }, [billingItems]);

  /* STRONG-3: Memoize selectedBillingData — previously recalculated via .find() on every render */
  const selectedBillingData = useMemo(() => billings.find(b => b.id === selectedBilling), [billings, selectedBilling]);
  /* STRONG-4: Memoize filteredTenants — prevents re-filtering on unrelated state changes */
  const filteredTenants = useMemo(() => form.property_id ? tenants.filter(t => t.property_id === form.property_id) : [], [tenants, form.property_id]);

  /* IMP-41-13: NK per sqm display in subtitle for quick reference */
  const nkPerSqmFormatted = useMemo(() => {
    if (nkPerSqm <= 0) return null;
    return `${nkPerSqm.toFixed(2)} €/m²`;
  }, [nkPerSqm]);

  const statusIcon = (status: string) => {
    if (status === "final") return <CheckCircle className="h-3.5 w-3.5 text-profit" />;
    return <Clock className="h-3.5 w-3.5 text-gold" />;
  };

  return (
    <div className="space-y-6" role="main" aria-label="Nebenkostenabrechnung">
      {/* Improvement 12: Mobile responsive header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight">Nebenkostenabrechnung</h1>
          <p className="text-sm text-muted-foreground mt-1 flex items-center gap-3 flex-wrap">
            {billings.length} Abrechnungen
            {billings.length > 0 && (
              <span className="ml-1">
                · {formatCurrency(billings.reduce((s, b) => s + Number(b.total_costs), 0))} Gesamtkosten
                · {billingStatusSummary.draft} Entwurf, {billingStatusSummary.final} final
                {/* IMP-41-13: Show NK per sqm in subtitle */}
                {nkPerSqmFormatted && <span> · {nkPerSqmFormatted}</span>}
              </span>
            )}
            <Link to={ROUTES.DOKUMENTE} className="text-primary hover:underline flex items-center gap-1 text-xs">
              <FolderOpen className="h-3.5 w-3.5" /> Dokumente
            </Link>
          </p>
        </div>
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="gap-1.5 touch-target min-h-[44px]"><Plus className="h-3.5 w-3.5" /> Neue Abrechnung</Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader><DialogTitle>Neue Nebenkostenabrechnung</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div className="space-y-1">
                <Label className="text-xs">Objekt *</Label>
                <Select value={form.property_id} onValueChange={v => setForm({ ...form, property_id: v, tenant_id: "" })}>
                  <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Objekt wählen" /></SelectTrigger>
                  <SelectContent>{properties.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              {filteredTenants.length > 0 && (
                <div className="space-y-1">
                  <Label className="text-xs">Mieter</Label>
                  <Select value={form.tenant_id} onValueChange={v => setForm({ ...form, tenant_id: v })}>
                    <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Mieter wählen" /></SelectTrigger>
                    <SelectContent>{filteredTenants.map(t => <SelectItem key={t.id} value={t.id}>{t.first_name} {t.last_name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              )}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Von</Label>
                  <Input type="date" value={form.billing_period_start} onChange={e => setForm({ ...form, billing_period_start: e.target.value })} className="h-9 text-sm" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Bis</Label>
                  <Input type="date" value={form.billing_period_end} onChange={e => setForm({ ...form, billing_period_end: e.target.value })} className="h-9 text-sm" />
                </div>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Vorauszahlungen (gesamt)</Label>
                <Input type="number" value={form.prepayments} onChange={e => setForm({ ...form, prepayments: e.target.value })} className="h-9 text-sm" />
              </div>
              <Button onClick={() => createBilling.mutate()} className="w-full touch-target min-h-[44px]" disabled={createBilling.isPending}>Abrechnung erstellen</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* UPD-21: Stagger animation for billing summary cards */}
      {selectedBilling && selectedBillingData ? (
        <div className="space-y-4">
          <Button variant="ghost" size="sm" onClick={() => setSelectedBilling(null)} className="text-xs touch-target min-h-[44px]">← Zurück zur Übersicht</Button>
          
          <div className="gradient-card rounded-xl border border-border p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="text-sm font-semibold">
                    {properties.find(p => p.id === selectedBillingData.property_id)?.name || "Objekt"}
                  </h2>
                  <Link
                    to={`/objekt/${selectedBillingData.property_id}`}
                    className="text-xs text-primary hover:underline flex items-center gap-1 touch-target min-h-[44px]"
                  >
                    <Building2 className="h-3 w-3" /> Zum Objekt
                  </Link>
                </div>
                <p className="text-xs text-muted-foreground">
                  {new Date(selectedBillingData.billing_period_start).toLocaleDateString("de-DE")} – {new Date(selectedBillingData.billing_period_end).toLocaleDateString("de-DE")}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {selectedBillingData.status === "draft" && (
                  <Button variant="outline" size="sm" className="touch-target min-h-[44px] text-xs" onClick={() => finalizeBilling(selectedBillingData.id)}>
                    <CheckCircle className="h-3 w-3 mr-1" /> Finalisieren
                  </Button>
                )}
                <Button variant="outline" size="sm" className="touch-target min-h-[44px] text-xs" onClick={() => exportBillingPDF(selectedBillingData)}>
                  <Download className="h-3 w-3 mr-1" /> PDF
                </Button>
                <Button variant="outline" size="sm" className="touch-target min-h-[44px] text-xs" disabled={savingAsDoc} onClick={saveBillingAsDocument}>
                  {savingAsDoc ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <Save className="h-3 w-3 mr-1" />} Als Dokument
                </Button>
              </div>
            </div>

            {/* Summary */}
            {/* UPD-22: Add stagger animation to billing summary */}
            {/* IMP-44-15: Add aria-label to billing summary grid for screen readers */}
            <div className="grid grid-cols-3 gap-3 card-stagger-enter" aria-label="Abrechnungszusammenfassung">
              <div className="bg-secondary/30 rounded-lg p-3 text-center">
                <div className="text-[10px] text-muted-foreground">Gesamtkosten</div>
                <div className="text-sm font-bold">{formatCurrency(Number(selectedBillingData.total_costs))}</div>
              </div>
              <div className="bg-secondary/30 rounded-lg p-3 text-center">
                <div className="text-[10px] text-muted-foreground">Vorauszahlungen</div>
                <div className="text-sm font-bold">{formatCurrency(Number(selectedBillingData.prepayments))}</div>
              </div>
              <div className={`rounded-lg p-3 text-center ${Number(selectedBillingData.balance) >= 0 ? "bg-loss/10" : "bg-profit/10"}`}>
                <div className="text-[10px] text-muted-foreground">{Number(selectedBillingData.balance) >= 0 ? "Nachzahlung" : "Guthaben"}</div>
                <div className={`text-sm font-bold ${Number(selectedBillingData.balance) >= 0 ? "text-loss" : "text-profit"}`}>
                  {formatCurrency(Math.abs(Number(selectedBillingData.balance)))}
                </div>
              </div>
            </div>

            {/* Items */}
            <div className="space-y-2">
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Kostenpositionen</h3>
              {billingItems.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-3">Noch keine Positionen</p>
              ) : (
                billingItems.map(item => (
                  <div key={item.id} className="flex items-center justify-between p-2 rounded-lg bg-secondary/20 text-sm">
                    <div>
                      <span className="font-medium">{item.category}</span>
                      {item.description && <span className="text-muted-foreground ml-2 text-xs">{item.description}</span>}
                      <span className="text-[10px] bg-secondary px-1.5 py-0.5 rounded ml-2">{item.distribution_key}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-muted-foreground">{formatCurrency(Number(item.total_amount))}</span>
                      <span className="font-medium">{formatCurrency(Number(item.tenant_amount))}</span>
                      {selectedBillingData.status === "draft" && (
                        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => deleteItem.mutate(item.id)} aria-label="Position löschen">
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Add item */}
            {selectedBillingData.status === "draft" && (
              <div className="border-t border-border pt-4 space-y-3">
                <h3 className="text-xs font-semibold">Position hinzufügen</h3>
                <div className="grid grid-cols-2 gap-3">
                  <Select value={itemForm.category} onValueChange={v => setItemForm({ ...itemForm, category: v })}>
                    <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                    <SelectContent>{NK_CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                  </Select>
                  <Input value={itemForm.description} onChange={e => setItemForm({ ...itemForm, description: e.target.value })} className="h-9 text-sm" placeholder="Beschreibung" />
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">Gesamtkosten</Label>
                    <Input type="number" value={itemForm.total_amount} onChange={e => setItemForm({ ...itemForm, total_amount: e.target.value })} className="h-9 text-sm" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Umlageschlüssel</Label>
                    <Select value={itemForm.distribution_key} onValueChange={v => setItemForm({ ...itemForm, distribution_key: v })}>
                      <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Fläche">Fläche</SelectItem>
                        <SelectItem value="Personen">Personen</SelectItem>
                        <SelectItem value="Einheiten">Einheiten</SelectItem>
                        <SelectItem value="Verbrauch">Verbrauch</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Mieteranteil</Label>
                    <Input type="number" value={itemForm.tenant_amount} onChange={e => setItemForm({ ...itemForm, tenant_amount: e.target.value })} className="h-9 text-sm" />
                  </div>
                </div>
                <Button variant="outline" size="sm" onClick={() => addItem.mutate()} disabled={!itemForm.total_amount || addItem.isPending}>
                  <Plus className="h-3 w-3 mr-1" /> Position hinzufügen
                </Button>
              </div>
            )}
          </div>
        </div>
      ) : (
        /* Billing list */
        billings.length === 0 ? (
          <EmptyState
            icon={FileText}
            title="Keine Abrechnungen"
            description="Erstelle deine erste Nebenkostenabrechnung. Du brauchst Objekte und ggf. Mieter – verknüpft mit Mietübersicht."
            action={
              <div className="flex flex-wrap items-center justify-center gap-2">
                <Link to={ROUTES.RENT} className="inline-flex">
                  <Button variant="outline" size="sm" className="gap-1.5 touch-target min-h-[44px]">
                    <BarChart3 className="h-3.5 w-3.5" /> Mietübersicht
                  </Button>
                </Link>
                <Link to={ROUTES.OBJEKTE} className="inline-flex">
                  <Button variant="outline" size="sm" className="gap-1.5 touch-target min-h-[44px]">
                    <Building2 className="h-3.5 w-3.5" /> Objekte
                  </Button>
                </Link>
              </div>
            }
          />
        ) : (
          <div className="space-y-2 list-stagger">
            {billings.map(b => {
              const property = properties.find(p => p.id === b.property_id);
              const tenant = tenants.find(t => t.id === b.tenant_id);
              return (
                <button
                  key={b.id}
                  onClick={() => setSelectedBilling(b.id)}
                  className="w-full gradient-card rounded-xl border border-border p-4 text-left hover:border-primary/20 transition-all group card-hover-glow"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      {statusIcon(b.status)}
                      <div>
                        <div className="text-sm font-semibold">{property?.name || "–"}</div>
                        <div className="text-xs text-muted-foreground">
                          {new Date(b.billing_period_start).toLocaleDateString("de-DE")} – {new Date(b.billing_period_end).toLocaleDateString("de-DE")}
                          {tenant && <span> · {tenant.first_name} {tenant.last_name}</span>}
                        </div>
                      </div>
                    </div>
                    <div className="text-right flex items-center gap-3">
                      <div>
                        <div className={`text-sm font-bold ${Number(b.balance) >= 0 ? "text-loss" : "text-profit"}`}>
                          {Number(b.balance) >= 0 ? "Nachzahlung" : "Guthaben"}: {formatCurrency(Math.abs(Number(b.balance)))}
                        </div>
                        <div className="text-[10px] text-muted-foreground">
                          Gesamt: {formatCurrency(Number(b.total_costs))}
                        </div>
                      </div>
                      <Button variant="ghost" size="icon" className="h-7 w-7 opacity-0 group-hover:opacity-100" onClick={(e) => { e.stopPropagation(); deleteBilling.mutate(b.id); }} aria-label="Abrechnung löschen">
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )
      )}
      {/* Automatische Nebenkostenabrechnung — moved from Dashboard */}
      <AutoNebenkosten />
    </div>
  );
};

export default Nebenkosten;
