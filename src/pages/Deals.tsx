import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Building2, MapPin, Phone, Mail, ArrowRight, GripVertical, Edit2, Trash2, Clock, TrendingUp, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";

const STAGES = [
  { key: "recherche", label: "Recherche", color: "bg-slate-500" },
  { key: "kontaktiert", label: "Kontaktiert", color: "bg-blue-500" },
  { key: "besichtigung", label: "Besichtigung", color: "bg-yellow-500" },
  { key: "angebot", label: "Angebot", color: "bg-orange-500" },
  { key: "verhandlung", label: "Verhandlung", color: "bg-purple-500" },
  { key: "abgeschlossen", label: "Abgeschlossen", color: "bg-green-500" },
  { key: "abgelehnt", label: "Abgelehnt", color: "bg-red-500" },
] as const;

const stageMap = Object.fromEntries(STAGES.map(s => [s.key, s]));

const emptyForm = {
  title: "", address: "", description: "", stage: "recherche", purchase_price: 0,
  expected_rent: 0, sqm: 0, units: 1, property_type: "ETW", contact_name: "",
  contact_phone: "", contact_email: "", source: "", notes: "", lost_reason: "",
};

const Deals = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [addOpen, setAddOpen] = useState(false);
  const [editDeal, setEditDeal] = useState<any>(null);
  const [form, setForm] = useState({ ...emptyForm });
  const [viewMode, setViewMode] = useState<"kanban" | "list">("kanban");

  const { data: deals = [], isLoading } = useQuery({
    queryKey: ["deals", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase.from("deals").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const saveDeal = useMutation({
    mutationFn: async () => {
      const payload = {
        ...form,
        user_id: user!.id,
        expected_yield: form.expected_rent && form.purchase_price ? ((form.expected_rent * 12) / form.purchase_price) * 100 : 0,
      };
      if (editDeal) {
        const { error } = await supabase.from("deals").update(payload).eq("id", editDeal.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("deals").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["deals"] });
      toast.success(editDeal ? "Deal aktualisiert" : "Deal angelegt");
      setAddOpen(false);
      setEditDeal(null);
      setForm({ ...emptyForm });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteDeal = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("deals").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["deals"] });
      toast.success("Deal gelöscht");
    },
  });

  const moveDeal = useMutation({
    mutationFn: async ({ id, stage }: { id: string; stage: string }) => {
      const { error } = await supabase.from("deals").update({ stage }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["deals"] }),
  });

  const openEdit = (deal: any) => {
    setEditDeal(deal);
    setForm({
      title: deal.title, address: deal.address || "", description: deal.description || "",
      stage: deal.stage, purchase_price: deal.purchase_price || 0, expected_rent: deal.expected_rent || 0,
      sqm: deal.sqm || 0, units: deal.units || 1, property_type: deal.property_type || "ETW",
      contact_name: deal.contact_name || "", contact_phone: deal.contact_phone || "",
      contact_email: deal.contact_email || "", source: deal.source || "", notes: deal.notes || "",
      lost_reason: deal.lost_reason || "",
    });
    setAddOpen(true);
  };

  const fmt = (n: number) => new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(n);

  // Stats
  const activeDeals = deals.filter((d: { stage: string }) => d.stage !== "abgelehnt" && d.stage !== "abgeschlossen");
  const totalVolume = activeDeals.reduce((s: number, d: { purchase_price?: number }) => s + (d.purchase_price || 0), 0);
  const wonDeals = deals.filter((d: { stage: string }) => d.stage === "abgeschlossen");
  const avgDealAge = activeDeals.length > 0
    ? Math.round(activeDeals.reduce((s: number, d: { created_at: string }) => s + Math.floor((Date.now() - new Date(d.created_at).getTime()) / 86400000), 0) / activeDeals.length)
    : 0;

  /* FUNC-15: Deal conversion rate per stage */
  const stageConversionRates = useMemo(() => {
    const rates: Record<string, number> = {};
    STAGES.forEach((stage, idx) => {
      const inStage = deals.filter((d: { stage: string }) => d.stage === stage.key).length;
      const later = STAGES.slice(idx + 1).map(s => s.key);
      const progressed = deals.filter((d: { stage: string }) => later.includes(d.stage)).length;
      rates[stage.key] = inStage > 0 ? Math.round((progressed / (inStage + progressed)) * 100) : 0;
    });
    return rates;
  }, [deals]);

  /* FUNC-16: Deal source analytics */
  const sourceAnalytics = useMemo(() => {
    const sources: Record<string, number> = {};
    deals.forEach((d: any) => {
      const src = d.source || "Unbekannt";
      sources[src] = (sources[src] || 0) + 1;
    });
    return sources;
  }, [deals]);

  /* FUNC-17: Average deal value */
  const avgDealValue = useMemo(() => {
    const dealsWithPrice = deals.filter((d: { purchase_price?: number }) => d.purchase_price && d.purchase_price > 0);
    if (dealsWithPrice.length === 0) return 0;
    return dealsWithPrice.reduce((s: number, d: { purchase_price?: number }) => s + (d.purchase_price || 0), 0) / dealsWithPrice.length;
  }, [deals]);

  /* FUNC-18: Pipeline velocity - avg days in current stage */
  const pipelineVelocity = useMemo(() => {
    const active = deals.filter((d: any) => d.stage !== "closed" && d.stage !== "lost");
    if (active.length === 0) return 0;
    const totalDays = active.reduce((s: number, d: any) => {
      const created = new Date(d.created_at || Date.now()).getTime();
      return s + (Date.now() - created) / (1000 * 60 * 60 * 24);
    }, 0);
    return Math.round(totalDays / active.length);
  }, [deals]);

  /* OPT-15: Memoized deal property type distribution */
  const dealTypeDistribution = useMemo(() => {
    const types: Record<string, number> = {};
    deals.forEach((d: any) => {
      const t = d.property_type || "Sonstige";
      types[t] = (types[t] || 0) + 1;
    });
    return types;
  }, [deals]);


  // Improvement 1: Pipeline value per stage
  const stageValues = STAGES.reduce((acc, s) => {
    acc[s.key] = deals
      .filter((d: { stage: string; purchase_price?: number }) => d.stage === s.key)
      .reduce((sum: number, d: { purchase_price?: number }) => sum + (d.purchase_price || 0), 0);
    return acc;
  }, {} as Record<string, number>);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight">Deal Pipeline</h1>
          <p className="text-muted-foreground text-sm">Investmentchancen verfolgen & bewerten</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 bg-secondary rounded-lg p-0.5">
            <Button variant={viewMode === "kanban" ? "default" : "ghost"} size="sm" className="text-xs h-7" onClick={() => setViewMode("kanban")}>Kanban</Button>
            <Button variant={viewMode === "list" ? "default" : "ghost"} size="sm" className="text-xs h-7" onClick={() => setViewMode("list")}>Liste</Button>
          </div>
          <Button size="sm" onClick={() => { setForm({ ...emptyForm }); setEditDeal(null); setAddOpen(true); }}>
            <Plus className="h-4 w-4 mr-1" /> Deal anlegen
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card><CardContent className="p-3"><p className="text-xs text-muted-foreground">Aktive Deals</p><p className="text-xl font-bold">{activeDeals.length}</p></CardContent></Card>
        <Card><CardContent className="p-3"><p className="text-xs text-muted-foreground">Pipeline-Volumen</p><p className="text-xl font-bold">{fmt(totalVolume)}</p></CardContent></Card>
        <Card><CardContent className="p-3"><p className="text-xs text-muted-foreground">Gewonnen</p><p className="text-xl font-bold text-green-600">{wonDeals.length}</p></CardContent></Card>
        <Card><CardContent className="p-3"><p className="text-xs text-muted-foreground">Conversion</p><p className="text-xl font-bold">{deals.length ? Math.round((wonDeals.length / deals.length) * 100) : 0}%</p></CardContent></Card>
        <Card><CardContent className="p-3"><p className="text-xs text-muted-foreground">Ø Alter (Tage)</p><p className="text-xl font-bold flex items-center gap-1">{avgDealAge}{avgDealAge > 30 && <AlertTriangle className="h-4 w-4 text-gold" />}</p></CardContent></Card>
        {/* FUNC-17: Average deal value */}
        {avgDealValue > 0 && <Card><CardContent className="p-3"><p className="text-xs text-muted-foreground">Ø Dealwert</p><p className="text-xl font-bold">{fmt(avgDealValue)}</p></CardContent></Card>}
        {/* FUNC-18: Pipeline velocity */}
        {pipelineVelocity > 0 && <Card><CardContent className="p-3"><p className="text-xs text-muted-foreground">Ø Tage im Stage</p><p className="text-xl font-bold">{pipelineVelocity}d</p></CardContent></Card>}
      </div>

      {/* FUNC-15/16: Stage conversion rates & source analytics */}
      {deals.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Card>
            <CardContent className="p-3">
              <p className="text-xs text-muted-foreground font-semibold uppercase tracking-wider mb-2">Conversion pro Stage</p>
              <div className="space-y-1.5">
                {STAGES.filter(s => s.key !== "abgelehnt" && s.key !== "abgeschlossen").map(s => (
                  <div key={s.key} className="flex items-center gap-2">
                    <div className={cn("w-2 h-2 rounded-full shrink-0", s.color)} />
                    <span className="text-xs flex-1">{s.label}</span>
                    <div className="w-16 h-1.5 bg-secondary rounded-full overflow-hidden">
                      <div className="h-full bg-primary rounded-full" style={{ width: `${stageConversionRates[s.key] || 0}%` }} />
                    </div>
                    <span className="text-xs font-medium w-8 text-right">{stageConversionRates[s.key] || 0}%</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
          {Object.keys(sourceAnalytics).length > 0 && (
            <Card>
              <CardContent className="p-3">
                <p className="text-xs text-muted-foreground font-semibold uppercase tracking-wider mb-2">Quellen</p>
                <div className="space-y-1.5">
                  {Object.entries(sourceAnalytics).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([source, count]) => (
                    <div key={source} className="flex items-center justify-between">
                      <span className="text-xs truncate">{source}</span>
                      <span className="text-xs font-medium bg-secondary px-1.5 py-0.5 rounded">{count}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Kanban View */}
      {viewMode === "kanban" ? (
        <div className="flex gap-3 overflow-x-auto pb-4 snap-x -mx-4 px-4 sm:mx-0 sm:px-0">
          {STAGES.map(stage => {
            const stageDeals = deals.filter((d: { stage: string }) => d.stage === stage.key);
            return (
              <div key={stage.key} className="min-w-[240px] sm:min-w-[260px] w-[240px] sm:w-[260px] shrink-0 snap-start">
                <div className="flex items-center gap-2 mb-2">
                  <div className={cn("w-2.5 h-2.5 rounded-full", stage.color)} />
                  <span className="text-sm font-semibold">{stage.label}</span>
                  <Badge variant="outline" className="text-[10px] ml-auto">{stageDeals.length}</Badge>
                  {stageValues[stage.key] > 0 && (
                    <span className="text-[9px] text-muted-foreground">{fmt(stageValues[stage.key])}</span>
                  )}
                </div>
                <div className="space-y-2">
                  {stageDeals.map((deal: any) => {
                    const dealAge = Math.floor((Date.now() - new Date(deal.created_at).getTime()) / 86400000);
                    const isStale = dealAge > 30 && deal.stage !== "abgeschlossen" && deal.stage !== "abgelehnt";
                    return (
                    <Card key={deal.id} className={cn("cursor-pointer hover:shadow-md transition-shadow", isStale && "border-gold/40")} onClick={() => openEdit(deal)}>
                      <CardContent className="p-3 space-y-1.5">
                        <div className="flex items-center justify-between">
                          <p className="font-medium text-sm truncate flex-1">{deal.title}</p>
                          {isStale && <AlertTriangle className="h-3 w-3 text-gold shrink-0 ml-1" />}
                        </div>
                        {deal.address && (
                          <p className="text-xs text-muted-foreground flex items-center gap-1 truncate">
                            <MapPin className="h-3 w-3 shrink-0" /> {deal.address}
                          </p>
                        )}
                        <div className="flex items-center justify-between">
                          {deal.purchase_price > 0 && <span className="text-xs font-medium">{fmt(deal.purchase_price)}</span>}
                          {deal.expected_yield > 0 && <Badge variant="outline" className="text-[10px]">{deal.expected_yield.toFixed(1)}% Rendite</Badge>}
                        </div>
                        {deal.contact_name && (
                          <p className="text-[10px] text-muted-foreground">{deal.contact_name}</p>
                        )}
                        <p className="text-[10px] text-muted-foreground flex items-center gap-1"><Clock className="h-2.5 w-2.5" /> {dealAge}d</p>
                      </CardContent>
                    </Card>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* List View */
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-xs text-muted-foreground">
                    <th className="text-left p-3 font-medium">Deal</th>
                    <th className="text-left p-3 font-medium">Stage</th>
                    <th className="text-left p-3 font-medium">Preis</th>
                    <th className="text-left p-3 font-medium">Rendite</th>
                    <th className="text-left p-3 font-medium">Kontakt</th>
                    <th className="text-left p-3 font-medium">Erstellt</th>
                    <th className="p-3"></th>
                  </tr>
                </thead>
                <tbody>
                  {deals.map((deal: { id: string; title: string; address?: string; stage: string; purchase_price?: number; expected_yield?: number; contact_name?: string; created_at: string }) => {
                    const s = stageMap[deal.stage];
                    return (
                      <tr key={deal.id} className="border-b border-border/50 hover:bg-secondary/30 cursor-pointer" onClick={() => openEdit(deal)}>
                        <td className="p-3">
                          <p className="font-medium">{deal.title}</p>
                          {deal.address && <p className="text-xs text-muted-foreground">{deal.address}</p>}
                        </td>
                        <td className="p-3">
                          <div className="flex items-center gap-1.5">
                            <div className={cn("w-2 h-2 rounded-full", s?.color)} />
                            <span className="text-xs">{s?.label || deal.stage}</span>
                          </div>
                        </td>
                        <td className="p-3">{deal.purchase_price > 0 ? fmt(deal.purchase_price) : "–"}</td>
                        <td className="p-3">{deal.expected_yield > 0 ? `${deal.expected_yield.toFixed(1)}%` : "–"}</td>
                        <td className="p-3 text-xs text-muted-foreground">{deal.contact_name || "–"}</td>
                        <td className="p-3 text-xs text-muted-foreground">{new Date(deal.created_at).toLocaleDateString("de-DE")}</td>
                        <td className="p-3">
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={e => { e.stopPropagation(); deleteDeal.mutate(deal.id); }}>
                            <Trash2 className="h-3.5 w-3.5 text-destructive" />
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {deals.length === 0 && (
                <div className="py-12 text-center text-sm text-muted-foreground">
                  <Building2 className="h-8 w-8 mx-auto mb-3 opacity-30" />
                  Noch keine Deals angelegt
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Add/Edit Dialog */}
      <Dialog open={addOpen} onOpenChange={o => { setAddOpen(o); if (!o) setEditDeal(null); }}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editDeal ? "Deal bearbeiten" : "Neuen Deal anlegen"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Input placeholder="Titel / Objektname *" value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} />
            <Input placeholder="Adresse" value={form.address} onChange={e => setForm(p => ({ ...p, address: e.target.value }))} />
            <div className="grid grid-cols-2 gap-3">
              <Select value={form.stage} onValueChange={v => setForm(p => ({ ...p, stage: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {STAGES.map(s => <SelectItem key={s.key} value={s.key}>{s.label}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={form.property_type} onValueChange={v => setForm(p => ({ ...p, property_type: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ETW">ETW</SelectItem>
                  <SelectItem value="MFH">MFH</SelectItem>
                  <SelectItem value="EFH">EFH</SelectItem>
                  <SelectItem value="Gewerbe">Gewerbe</SelectItem>
                  <SelectItem value="Grundstück">Grundstück</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <Input type="number" placeholder="Kaufpreis €" value={form.purchase_price || ""} onChange={e => setForm(p => ({ ...p, purchase_price: parseFloat(e.target.value) || 0 }))} />
              <Input type="number" placeholder="Miete €/Monat" value={form.expected_rent || ""} onChange={e => setForm(p => ({ ...p, expected_rent: parseFloat(e.target.value) || 0 }))} />
              <Input type="number" placeholder="qm" value={form.sqm || ""} onChange={e => setForm(p => ({ ...p, sqm: parseFloat(e.target.value) || 0 }))} />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <Input placeholder="Kontakt Name" value={form.contact_name} onChange={e => setForm(p => ({ ...p, contact_name: e.target.value }))} />
              <Input placeholder="Kontakt Tel." value={form.contact_phone} onChange={e => setForm(p => ({ ...p, contact_phone: e.target.value }))} />
              <Input placeholder="Kontakt E-Mail" value={form.contact_email} onChange={e => setForm(p => ({ ...p, contact_email: e.target.value }))} />
            </div>
            <Input placeholder="Quelle (z.B. ImmoScout, Makler, Kaltakquise)" value={form.source} onChange={e => setForm(p => ({ ...p, source: e.target.value }))} />
            <Textarea placeholder="Notizen" value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} rows={3} />
            {(form.stage === "abgelehnt") && (
              <Input placeholder="Grund für Absage" value={form.lost_reason} onChange={e => setForm(p => ({ ...p, lost_reason: e.target.value }))} />
            )}
            <div className="flex gap-2">
              {editDeal && (
                <Button variant="destructive" className="flex-1" onClick={() => { deleteDeal.mutate(editDeal.id); setAddOpen(false); setEditDeal(null); }}>
                  <Trash2 className="h-4 w-4 mr-1" /> Löschen
                </Button>
              )}
              <Button onClick={() => saveDeal.mutate()} disabled={!form.title.trim()} className="flex-1">
                {editDeal ? "Speichern" : "Deal anlegen"}
              </Button>
            </div>
            {editDeal && form.stage !== "abgeschlossen" && form.stage !== "abgelehnt" && (
              <div className="flex gap-1 flex-wrap">
                <span className="text-xs text-muted-foreground mr-1 mt-1">Verschieben:</span>
                {STAGES.filter(s => s.key !== form.stage).map(s => (
                  <Button key={s.key} variant="outline" size="sm" className="text-xs h-7" onClick={() => {
                    moveDeal.mutate({ id: editDeal.id, stage: s.key });
                    setForm(p => ({ ...p, stage: s.key }));
                  }}>
                    <div className={cn("w-2 h-2 rounded-full mr-1", s.color)} /> {s.label}
                  </Button>
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Deals;
