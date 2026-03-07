import { useState, useMemo, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useProperties } from "@/context/PropertyContext";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { FileText, Plus, AlertTriangle, Clock, Calendar, Bell, Trash2, TrendingUp, CheckCircle, Info } from "lucide-react";
import { toast } from "sonner";
import { formatCurrency, formatDate, formatDaysUntil } from "@/lib/formatters";
import { handleError } from "@/lib/handleError";
import { toastErrorWithRetry } from "@/lib/toastMessages";
import { KAPPUNGSGRENZE_NORMAL, KAPPUNGSGRENZE_ANGESPANNT, WARTEFRIST_MONATE } from "@/lib/mietrechtConstants";

/**
 * MIETVERTRAG-1: Mietvertragsverwaltung mit Fristen-Erinnerungen
 *
 * Manages rental contracts (Mietverträge) with:
 * - Contract lifecycle tracking (active, expiring, expired, terminated)
 * - §558 BGB rent increase deadlines and reminders
 * - Automatic deadline calculations for notice periods
 * - Kappungsgrenze tracking (20% / 15% limit over 3 years)
 */

interface MietvertragRow {
  id: string;
  property_id: string;
  tenant_id: string | null;
  tenant_name: string;
  unit_number: string;
  contract_start: string;
  contract_end: string | null;
  is_indefinite: boolean;
  notice_period_months: number;
  base_rent: number;
  cold_rent: number;
  warm_rent: number;
  deposit_amount: number;
  deposit_paid: boolean;
  rent_increase_type: string;
  last_rent_increase: string | null;
  index_base_year: string | null;
  staffel_percent: number | null;
  staffel_interval_months: number | null;
  notes: string | null;
  status: string;
  created_at: string;
}

interface MietvertragsverwaltungProps {
  propertyId?: string;
}

/** MIETVERTRAG-2: Calculate §558 BGB deadlines and limits */
function calcRentIncreaseInfo(contract: MietvertragRow, isAngespannterMarkt: boolean) {
  const kappungsgrenze = isAngespannterMarkt ? KAPPUNGSGRENZE_ANGESPANNT : KAPPUNGSGRENZE_NORMAL;

  /* Next possible rent increase date */
  let nextIncreaseDate: Date | null = null;
  if (contract.last_rent_increase) {
    const last = new Date(contract.last_rent_increase);
    nextIncreaseDate = new Date(last);
    nextIncreaseDate.setMonth(nextIncreaseDate.getMonth() + WARTEFRIST_MONATE);
  } else {
    /* If no previous increase, can increase after 12 months from contract start */
    const start = new Date(contract.contract_start);
    nextIncreaseDate = new Date(start);
    nextIncreaseDate.setMonth(nextIncreaseDate.getMonth() + 12);
  }

  const canIncreaseNow = nextIncreaseDate <= new Date();
  const daysUntilIncrease = Math.ceil((nextIncreaseDate.getTime() - Date.now()) / 86400000);

  return {
    kappungsgrenze,
    nextIncreaseDate,
    canIncreaseNow,
    daysUntilIncrease,
    cooldownMonths: WARTEFRIST_MONATE,
  };
}

/** MIETVERTRAG-3: Calculate contract status and notice deadline */
function calcContractStatus(contract: MietvertragRow) {
  const now = new Date();

  if (contract.status === "terminated") {
    return { label: "Gekündigt", variant: "destructive" as const, icon: AlertTriangle };
  }

  if (!contract.is_indefinite && contract.contract_end) {
    const endDate = new Date(contract.contract_end);
    const daysLeft = Math.ceil((endDate.getTime() - now.getTime()) / 86400000);

    /* Notice deadline: end date minus notice period */
    const noticeDeadline = new Date(endDate);
    noticeDeadline.setMonth(noticeDeadline.getMonth() - contract.notice_period_months);
    const daysUntilNotice = Math.ceil((noticeDeadline.getTime() - now.getTime()) / 86400000);

    if (daysLeft < 0) {
      return { label: "Abgelaufen", variant: "destructive" as const, icon: AlertTriangle };
    }
    if (daysUntilNotice <= 30) {
      return { label: `Kündigungsfrist in ${daysUntilNotice}T`, variant: "destructive" as const, icon: Bell };
    }
    if (daysLeft <= 90) {
      return { label: `Läuft in ${daysLeft}T ab`, variant: "secondary" as const, icon: Clock };
    }
    return { label: "Aktiv", variant: "default" as const, icon: CheckCircle };
  }

  return { label: "Unbefristet", variant: "default" as const, icon: CheckCircle };
}

export const Mietvertragsverwaltung = ({ propertyId }: MietvertragsverwaltungProps) => {
  const { user } = useAuth();
  const qc = useQueryClient();
  const { properties } = useProperties();
  const [open, setOpen] = useState(false);
  const [isAngespannt, setIsAngespannt] = useState(false);
  const [form, setForm] = useState({
    property_id: propertyId || "",
    tenant_name: "",
    unit_number: "",
    contract_start: new Date().toISOString().split("T")[0],
    contract_end: "",
    is_indefinite: true,
    notice_period_months: 3,
    base_rent: 0,
    cold_rent: 0,
    warm_rent: 0,
    deposit_amount: 0,
    deposit_paid: false,
    rent_increase_type: "mietspiegel",
    notes: "",
  });
  const lastDeletedIdRef = useRef<string | null>(null);

  /* MIETVERTRAG-4: Fetch all contracts */
  const { data: contracts = [], isLoading } = useQuery({
    queryKey: ["mietvertraege", propertyId],
    queryFn: async () => {
      let query = supabase
        .from("mietvertraege")
        .select("*")
        .order("contract_start", { ascending: false });
      if (propertyId) query = query.eq("property_id", propertyId);
      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as unknown as MietvertragRow[];
    },
    enabled: !!user,
  });

  /* MIETVERTRAG-5: Add new contract */
  const addMutation = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Nicht angemeldet");
      const { error } = await supabase.from("mietvertraege").insert({
        user_id: user.id,
        ...form,
        contract_end: form.is_indefinite ? null : form.contract_end || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["mietvertraege"] });
      setOpen(false);
      toast.success("Mietvertrag angelegt");
    },
    onError: (e: unknown) => {
      handleError(e, { context: "supabase", details: "mietvertraege.insert", showToast: false });
      toastErrorWithRetry(e instanceof Error ? e.message : "Fehler beim Anlegen", () => addMutation.mutate());
    },
  });

  /* MIETVERTRAG-6: Delete contract */
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("mietvertraege").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["mietvertraege"] });
      toast.success("Vertrag gelöscht");
    },
    onError: (e: unknown) => {
      handleError(e, { context: "supabase", details: "mietvertraege.delete", showToast: false });
      toastErrorWithRetry("Fehler beim Löschen", () => { if (lastDeletedIdRef.current) deleteMutation.mutate(lastDeletedIdRef.current); });
    },
  });

  /* MIETVERTRAG-7: Summary statistics */
  const summary = useMemo(() => {
    const active = contracts.filter(c => c.status !== "terminated");
    const expiring = contracts.filter(c => {
      if (c.is_indefinite || !c.contract_end) return false;
      const days = Math.ceil((new Date(c.contract_end).getTime() - Date.now()) / 86400000);
      return days > 0 && days <= 90;
    });
    const needsIncrease = contracts.filter(c => {
      const info = calcRentIncreaseInfo(c, isAngespannt);
      return info.canIncreaseNow;
    });
    const totalRent = active.reduce((s, c) => s + Number(c.warm_rent), 0);

    return { active: active.length, expiring: expiring.length, needsIncrease: needsIncrease.length, totalRent };
  }, [contracts, isAngespannt]);

  const getPropertyName = (pid: string) => properties.find(p => p.id === pid)?.name || "–";

  return (
    <Card className="p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <FileText className="h-5 w-5 text-primary" />
          <h3 className="font-semibold">Mietvertragsverwaltung</h3>
          <Badge variant="secondary" className="text-xs">{contracts.length}</Badge>
        </div>
        <div className="flex items-center gap-2">
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="flex items-center gap-1.5">
                <Switch
                  checked={isAngespannt}
                  onCheckedChange={setIsAngespannt}
                  className="scale-75"
                />
                <span className="text-xs text-muted-foreground">Angespannter Markt</span>
                <Info className="h-3 w-3 text-muted-foreground" />
              </div>
            </TooltipTrigger>
            <TooltipContent>
              <p className="text-xs max-w-[250px]">
                Angespannter Wohnungsmarkt (§558 Abs. 3 BGB): Kappungsgrenze 15% statt 20% in 3 Jahren.
                Gilt z.B. in Berlin, München, Hamburg, Frankfurt.
              </p>
            </TooltipContent>
          </Tooltip>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="gap-1"><Plus className="h-3.5 w-3.5" /> Vertrag</Button>
            </DialogTrigger>
            <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Neuer Mietvertrag</DialogTitle>
              </DialogHeader>
              <div className="grid gap-3">
                {!propertyId && (
                  <div>
                    <Label className="text-xs">Objekt</Label>
                    <Select value={form.property_id} onValueChange={v => setForm(f => ({ ...f, property_id: v }))}>
                      <SelectTrigger><SelectValue placeholder="Objekt wählen" /></SelectTrigger>
                      <SelectContent>
                        {properties.map(p => (
                          <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label className="text-xs">Mieter</Label>
                    <Input value={form.tenant_name} onChange={e => setForm(f => ({ ...f, tenant_name: e.target.value }))} placeholder="Max Mustermann" />
                  </div>
                  <div>
                    <Label className="text-xs">Einheit</Label>
                    <Input value={form.unit_number} onChange={e => setForm(f => ({ ...f, unit_number: e.target.value }))} placeholder="WE 1" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label className="text-xs">Vertragsbeginn</Label>
                    <Input type="date" value={form.contract_start} onChange={e => setForm(f => ({ ...f, contract_start: e.target.value }))} />
                  </div>
                  <div>
                    <Label className="text-xs">Unbefristet</Label>
                    <div className="flex items-center gap-2 mt-1.5">
                      <Switch checked={form.is_indefinite} onCheckedChange={v => setForm(f => ({ ...f, is_indefinite: v }))} />
                      <span className="text-xs">{form.is_indefinite ? "Ja" : "Nein"}</span>
                    </div>
                  </div>
                </div>
                {!form.is_indefinite && (
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label className="text-xs">Vertragsende</Label>
                      <Input type="date" value={form.contract_end} onChange={e => setForm(f => ({ ...f, contract_end: e.target.value }))} />
                    </div>
                    <div>
                      <Label className="text-xs">Kündigungsfrist (Monate)</Label>
                      <Input type="number" value={form.notice_period_months} onChange={e => setForm(f => ({ ...f, notice_period_months: Number(e.target.value) }))} />
                    </div>
                  </div>
                )}
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <Label className="text-xs">Nettokaltmiete</Label>
                    <Input type="number" value={form.base_rent || ""} onChange={e => setForm(f => ({ ...f, base_rent: Number(e.target.value) }))} placeholder="€" />
                  </div>
                  <div>
                    <Label className="text-xs">Kaltmiete</Label>
                    <Input type="number" value={form.cold_rent || ""} onChange={e => setForm(f => ({ ...f, cold_rent: Number(e.target.value) }))} placeholder="€" />
                  </div>
                  <div>
                    <Label className="text-xs">Warmmiete</Label>
                    <Input type="number" value={form.warm_rent || ""} onChange={e => setForm(f => ({ ...f, warm_rent: Number(e.target.value) }))} placeholder="€" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label className="text-xs">Kaution</Label>
                    <Input type="number" value={form.deposit_amount || ""} onChange={e => setForm(f => ({ ...f, deposit_amount: Number(e.target.value) }))} placeholder="€" />
                  </div>
                  <div>
                    <Label className="text-xs">Mieterhöhungsart</Label>
                    <Select value={form.rent_increase_type} onValueChange={v => setForm(f => ({ ...f, rent_increase_type: v }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="mietspiegel">Mietspiegel (§558)</SelectItem>
                        <SelectItem value="index">Indexmiete (§557b)</SelectItem>
                        <SelectItem value="staffel">Staffelmiete (§557a)</SelectItem>
                        <SelectItem value="none">Keine</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <Button
                  onClick={() => addMutation.mutate()}
                  disabled={addMutation.isPending || !form.tenant_name?.trim() || !form.property_id}
                  aria-busy={addMutation.isPending}
                  className="w-full"
                >
                  {addMutation.isPending ? "Wird angelegt…" : "Vertrag anlegen"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* MIETVERTRAG-8: Summary badges */}
      <div className="flex flex-wrap gap-2 mb-4">
        <Badge variant="outline" className="gap-1">
          <CheckCircle className="h-3 w-3 text-profit" />
          {summary.active} aktiv
        </Badge>
        {summary.expiring > 0 && (
          <Badge variant="destructive" className="gap-1">
            <Clock className="h-3 w-3" />
            {summary.expiring} laufen aus
          </Badge>
        )}
        {summary.needsIncrease > 0 && (
          <Badge className="bg-gold/15 text-gold border-gold/30 gap-1">
            <TrendingUp className="h-3 w-3" />
            {summary.needsIncrease} Erhöhung möglich
          </Badge>
        )}
        <Badge variant="secondary" className="gap-1">
          Gesamtmiete: {formatCurrency(summary.totalRent)}/M
        </Badge>
      </div>

      {/* MIETVERTRAG-9: Contract table */}
      {isLoading ? (
        <p className="text-sm text-muted-foreground">Laden...</p>
      ) : contracts.length === 0 ? (
        <p className="text-sm text-muted-foreground">Noch keine Mietverträge angelegt.</p>
      ) : (
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                {!propertyId && <TableHead className="text-xs">Objekt</TableHead>}
                <TableHead className="text-xs">Mieter</TableHead>
                <TableHead className="text-xs">Einheit</TableHead>
                <TableHead className="text-xs">Beginn</TableHead>
                <TableHead className="text-xs">Ende</TableHead>
                <TableHead className="text-xs text-right">Warmmiete</TableHead>
                <TableHead className="text-xs">Status</TableHead>
                <TableHead className="text-xs">§558 Erhöhung</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {contracts.map(c => {
                const status = calcContractStatus(c);
                const increaseInfo = calcRentIncreaseInfo(c, isAngespannt);
                const StatusIcon = status.icon;
                return (
                  <TableRow key={c.id}>
                    {!propertyId && <TableCell className="text-xs">{getPropertyName(c.property_id)}</TableCell>}
                    <TableCell className="text-xs font-medium">{c.tenant_name}</TableCell>
                    <TableCell className="text-xs">{c.unit_number || "–"}</TableCell>
                    <TableCell className="text-xs">{formatDate(c.contract_start)}</TableCell>
                    <TableCell className="text-xs">
                      {c.is_indefinite ? (
                        <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> Unbefristet</span>
                      ) : c.contract_end ? formatDate(c.contract_end) : "–"}
                    </TableCell>
                    <TableCell className="text-xs text-right font-mono">{formatCurrency(Number(c.warm_rent))}</TableCell>
                    <TableCell>
                      <Badge variant={status.variant} className="text-[10px] gap-1">
                        <StatusIcon className="h-3 w-3" />
                        {status.label}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {c.rent_increase_type === "none" ? (
                        <span className="text-xs text-muted-foreground">–</span>
                      ) : increaseInfo.canIncreaseNow ? (
                        <Tooltip>
                          <TooltipTrigger>
                            <Badge className="bg-profit/15 text-profit border-profit/30 text-[10px] gap-1">
                              <TrendingUp className="h-3 w-3" />
                              Jetzt möglich
                            </Badge>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p className="text-xs">
                              Kappungsgrenze: max. {increaseInfo.kappungsgrenze}% in 3 Jahren<br />
                              §558 BGB Mieterhöhung ist zulässig
                            </p>
                          </TooltipContent>
                        </Tooltip>
                      ) : (
                        <Tooltip>
                          <TooltipTrigger>
                            <span className="text-[10px] text-muted-foreground">
                              {formatDaysUntil(increaseInfo.nextIncreaseDate!.toISOString().split("T")[0])}
                            </span>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p className="text-xs">
                              Nächste Erhöhung ab: {formatDate(increaseInfo.nextIncreaseDate!.toISOString())}<br />
                              Sperrfrist: {increaseInfo.cooldownMonths} Monate (§558 BGB)
                            </p>
                          </TooltipContent>
                        </Tooltip>
                      )}
                    </TableCell>
                    <TableCell>
                      <Button variant="ghost" size="sm" onClick={() => { lastDeletedIdRef.current = c.id; deleteMutation.mutate(c.id); }}>
                        <Trash2 className="h-3.5 w-3.5 text-destructive" />
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      {/* MIETVERTRAG-10: §558 BGB info footer */}
      <div className="mt-4 p-3 bg-secondary/50 rounded-lg">
        <p className="text-[10px] text-muted-foreground leading-relaxed">
          <strong>§558 BGB Mieterhöhung:</strong> Vermieter kann die Miete bis zur ortsüblichen Vergleichsmiete erhöhen.
          Kappungsgrenze: max. {isAngespannt ? "15" : "20"}% in 3 Jahren.
          Sperrfrist: 15 Monate zwischen Erhöhungen. Mieterhöhungsverlangen muss schriftlich begründet werden.
          {isAngespannt && " (Angespannter Wohnungsmarkt aktiv — §558 Abs. 3 BGB)"}
        </p>
      </div>
    </Card>
  );
};

export default Mietvertragsverwaltung;
