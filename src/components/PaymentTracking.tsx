import { useState, useEffect, useCallback } from "react";
import { CreditCard, Plus, CheckCircle2, Clock, AlertTriangle, XCircle, Euro, Zap, RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";
import { formatCurrency } from "@/lib/formatters";

type PaymentStatus = "pending" | "confirmed" | "overdue" | "cancelled";

interface Payment {
  id: string;
  tenant_id: string;
  property_id: string;
  landlord_id: string;
  amount: number;
  due_date: string;
  paid_date: string | null;
  status: PaymentStatus;
  note: string | null;
  created_at: string;
  updated_at: string;
}

const statusConfig: Record<PaymentStatus, { label: string; icon: typeof Clock; color: string }> = {
  pending: { label: "Ausstehend", icon: Clock, color: "text-gold bg-gold/10" },
  confirmed: { label: "Bestätigt", icon: CheckCircle2, color: "text-profit bg-profit/10" },
  overdue: { label: "Überfällig", icon: AlertTriangle, color: "text-loss bg-loss/10" },
  cancelled: { label: "Storniert", icon: XCircle, color: "text-muted-foreground bg-secondary" },
};

/* FUNC-46: Payment status color mapping */
const PAYMENT_STATUS_COLORS: Record<string, string> = {
  confirmed: "text-profit bg-profit/10",
  pending: "text-gold bg-gold/10",
  overdue: "text-loss bg-loss/10",
  cancelled: "text-muted-foreground bg-muted",
};

/* OPT-34: Payment amount formatter */
const formatPaymentAmount = (amount: number, status: string): string => {
  const formatted = new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(amount);
  return status === "cancelled" ? `~${formatted}~` : formatted;
};

// ─── TENANT VIEW ────────────────────────────────────────────────
interface TenantPaymentsProps {
  tenantId: string;
  monthlyRent: number;
  deposit: number;
}

const PAGE_SIZE = 20;

export const TenantPayments = ({ tenantId, monthlyRent, deposit }: TenantPaymentsProps) => {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  const fetchPayments = async (offset = 0, append = false) => {
    if (offset > 0) setLoadingMore(true);
    const { data } = await supabase
      .from("rent_payments")
      .select("*")
      .eq("tenant_id", tenantId)
      .order("due_date", { ascending: false })
      .range(offset, offset + PAGE_SIZE - 1);
    if (data) {
      setPayments(prev => append ? [...prev, ...(data as unknown as Payment[])] : (data as unknown as Payment[]));
      setHasMore(data.length === PAGE_SIZE);
    }
    setLoadingMore(false);
  };

  useEffect(() => {
    fetchPayments();
  }, [tenantId]);

  const confirmedTotal = payments.filter(p => p.status === "confirmed").reduce((s, p) => s + Number(p.amount), 0);
  const pendingCount = payments.filter(p => p.status === "pending").length;
  const overdueCount = payments.filter(p => p.status === "overdue").length;

  return (
    <div className="space-y-4">
      <div className="gradient-card rounded-xl border border-border p-5 animate-fade-in">
        <h2 className="text-sm font-semibold mb-4 flex items-center gap-2">
          <CreditCard className="h-4 w-4 text-muted-foreground" /> Zahlungsübersicht
        </h2>

        {/* Summary */}
        <div className="grid grid-cols-2 gap-3 mb-4">
          <div className="p-3 bg-secondary/50 rounded-lg">
            <span className="text-xs text-muted-foreground">Kaltmiete</span>
            <div className="text-sm font-bold mt-0.5">{formatCurrency(monthlyRent)}</div>
          </div>
          <div className="p-3 bg-secondary/50 rounded-lg">
            <span className="text-xs text-muted-foreground">Kaution</span>
            <div className="text-sm font-bold mt-0.5">{formatCurrency(deposit)}</div>
          </div>
        </div>

        {overdueCount > 0 && (
          <div className="bg-loss/10 border border-loss/20 rounded-lg p-3 mb-4 flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-loss shrink-0" />
            <span className="text-xs text-loss font-medium">{overdueCount} überfällige Zahlung(en)</span>
          </div>
        )}

        <h3 className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wider">Zahlungen</h3>
        {payments.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-6">
            Noch keine Zahlungen erfasst. Der Vermieter wird Zahlungen hier eintragen.
          </p>
        ) : (
          <div className="space-y-1.5">
            {payments.map((payment) => {
              const status = statusConfig[payment.status];
              const StatusIcon = status.icon;
              return (
                <div key={payment.id} className="flex items-center justify-between py-2.5 border-b border-border/50 last:border-0">
                  <div className="flex items-center gap-2">
                    <div className={`w-6 h-6 rounded flex items-center justify-center shrink-0 ${status.color}`}>
                      <StatusIcon className="h-3 w-3" />
                    </div>
                    <div>
                      <div className="text-sm">
                        {new Date(payment.due_date).toLocaleDateString("de-DE", { month: "long", year: "numeric" })}
                      </div>
                      {payment.note && (
                        <div className="text-[10px] text-muted-foreground truncate max-w-[150px]">{payment.note}</div>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">{formatCurrency(Number(payment.amount))}</span>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${status.color}`}>
                      {status.label}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
        {hasMore && (
          <Button
            variant="ghost"
            size="sm"
            className="w-full mt-2 text-xs text-muted-foreground"
            onClick={() => fetchPayments(payments.length, true)}
            disabled={loadingMore}
          >
            {loadingMore ? "Laden…" : "Mehr laden"}
          </Button>
        )}
      </div>
    </div>
  );
};

// ─── LANDLORD VIEW ──────────────────────────────────────────────
interface LandlordPaymentsProps {
  propertyId: string;
}

type PaymentFilter = "all" | "pending" | "overdue" | "confirmed";

export const LandlordPayments = ({ propertyId }: LandlordPaymentsProps) => {
  const { user } = useAuth();
  const [payments, setPayments] = useState<(Payment & { tenants?: { first_name: string; last_name: string; unit_label: string; monthly_rent: number } })[]>([]);
  const [tenants, setTenants] = useState<{ id: string; first_name: string; last_name: string; unit_label: string; monthly_rent: number }[]>([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ tenant_id: "", amount: "", due_date: "", note: "" });
  const [bulkMonth, setBulkMonth] = useState("");
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [paymentFilter, setPaymentFilter] = useState<PaymentFilter>("all");
  const [autoGenerating, setAutoGenerating] = useState(false);
  const [markingOverdue, setMarkingOverdue] = useState(false);

  const fetchPayments = async (offset = 0, append = false) => {
    if (offset > 0) setLoadingMore(true);
    const { data } = await supabase
      .from("rent_payments")
      .select("*, tenants(first_name, last_name, unit_label, monthly_rent)")
      .eq("property_id", propertyId)
      .order("due_date", { ascending: false })
      .range(offset, offset + PAGE_SIZE - 1);
    if (data) {
      setPayments(prev => append ? [...prev, ...(data as any)] : (data as any));
      setHasMore(data.length === PAGE_SIZE);
    }
    setLoadingMore(false);
  };

  const fetchTenants = async () => {
    const { data } = await supabase
      .from("tenants")
      .select("id, first_name, last_name, unit_label, monthly_rent")
      .eq("property_id", propertyId)
      .eq("is_active", true);
    if (data) setTenants(data as any);
  };

  useEffect(() => {
    fetchPayments();
    fetchTenants();
  }, [propertyId]);

  const createPayment = async () => {
    if (!user || !form.tenant_id || !form.amount || !form.due_date) {
      toast.error("Mieter, Betrag und Fälligkeitsdatum sind erforderlich");
      return;
    }
    const { error } = await supabase.from("rent_payments").insert({
      tenant_id: form.tenant_id,
      property_id: propertyId,
      landlord_id: user!.id,
      amount: parseFloat(form.amount),
      due_date: form.due_date,
      note: form.note.trim() || null,
    });
    if (error) { toast.error("Fehler beim Erstellen"); return; }
    toast.success("Zahlung erstellt");
    setForm({ tenant_id: "", amount: "", due_date: "", note: "" });
    setOpen(false);
    fetchPayments();
  };

  const createBulkPayments = async () => {
    if (!user || !bulkMonth || tenants.length === 0) {
      toast.error("Monat auswählen und mindestens einen aktiven Mieter haben");
      return;
    }
    const dueDate = `${bulkMonth}-01`;
    const inserts = tenants
      .filter(t => t.monthly_rent > 0)
      .map(t => ({
        tenant_id: t.id,
        property_id: propertyId,
        landlord_id: user!.id,
        amount: t.monthly_rent,
        due_date: dueDate,
      }));
    if (inserts.length === 0) { toast.error("Keine Mieter mit Miete gefunden"); return; }
    const { error } = await supabase.from("rent_payments").insert(inserts);
    if (error) { toast.error("Fehler beim Erstellen"); return; }
    toast.success(`${inserts.length} Zahlungen für ${new Date(dueDate).toLocaleDateString("de-DE", { month: "long", year: "numeric" })} erstellt`);
    setBulkMonth("");
    fetchPayments();
  };

  const updateStatus = async (paymentId: string, newStatus: PaymentStatus, paidDate?: string) => {
    const update: any = { status: newStatus };
    if (newStatus === "confirmed") update.paid_date = paidDate || new Date().toISOString().split("T")[0];
    if (newStatus !== "confirmed") update.paid_date = null;
    const { error } = await supabase.from("rent_payments").update(update).eq("id", paymentId);
    if (error) { toast.error("Fehler"); return; }
    toast.success("Status aktualisiert");
    fetchPayments();
  };

  const deletePayment = async (paymentId: string) => {
    const { error } = await supabase.from("rent_payments").delete().eq("id", paymentId);
    if (error) { toast.error("Fehler beim Löschen"); return; }
    toast.success("Zahlung gelöscht");
    fetchPayments();
  };

  const autoGenerate = async (month: string) => {
    if (!user) return;
    setAutoGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke("auto-rent-payments", {
        body: { action: "generate", month },
      });
      if (error) throw error;
      toast.success(data.message || `${data.created} Zahlungen erstellt`);
      fetchPayments();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Fehler bei automatischer Erstellung");
    } finally {
      setAutoGenerating(false);
    }
  };

  const markOverdue = async () => {
    if (!user) return;
    setMarkingOverdue(true);
    try {
      const { data, error } = await supabase.functions.invoke("auto-rent-payments", {
        body: { action: "mark_overdue" },
      });
      if (error) throw error;
      toast.success(data.message || `${data.marked} als überfällig markiert`);
      fetchPayments();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Fehler");
    } finally {
      setMarkingOverdue(false);
    }
  };

  // Auto-suggest next month
  const nextMonth = (() => {
    const d = new Date();
    d.setMonth(d.getMonth() + 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  })();
  const currentMonth = (() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  })();

  const pendingCount = payments.filter(p => p.status === "pending").length;
  const overdueCount = payments.filter(p => p.status === "overdue").length;
  const confirmedThisMonth = payments.filter(p => {
    const d = new Date(p.due_date);
    const now = new Date();
    return p.status === "confirmed" && d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  }).reduce((s, p) => s + Number(p.amount), 0);
  // Improvement 12: Total confirmed revenue
  const totalConfirmed = payments.filter(p => p.status === "confirmed").reduce((s, p) => s + Number(p.amount), 0);
  // Improvement 13: Overdue total amount
  const overdueAmount = payments.filter(p => p.status === "overdue").reduce((s, p) => s + Number(p.amount), 0);

  return (
    <div className="gradient-card rounded-xl border border-border p-5 animate-fade-in">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-semibold flex items-center gap-2">
          <Euro className="h-4 w-4 text-muted-foreground" /> Zahlungsverfolgung
          {(pendingCount > 0 || overdueCount > 0) && (
            <span className="text-[10px] bg-gold/15 text-gold px-1.5 py-0.5 rounded-full font-bold">
              {pendingCount + overdueCount} offen
            </span>
          )}
        </h2>
        <div className="flex flex-wrap gap-2">
          {/* Auto-generate */}
          <div className="flex items-center gap-1">
            <Button
              size="sm"
              variant="outline"
              className="h-8 text-xs gap-1.5"
              onClick={() => autoGenerate(currentMonth)}
              disabled={autoGenerating}
            >
              <Zap className="h-3.5 w-3.5" />
              {autoGenerating ? "Erstelle…" : "Auto (aktuell)"}
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="h-8 text-xs gap-1.5"
              onClick={() => autoGenerate(nextMonth)}
              disabled={autoGenerating}
            >
              <Zap className="h-3.5 w-3.5" />
              {autoGenerating ? "…" : "Nächster M."}
            </Button>
          </div>
          {/* Mark overdue */}
          <Button
            size="sm"
            variant="outline"
            className="h-8 text-xs gap-1.5 text-loss hover:text-loss"
            onClick={markOverdue}
            disabled={markingOverdue}
          >
            <RefreshCw className={`h-3.5 w-3.5 ${markingOverdue ? "animate-spin" : ""}`} />
            {markingOverdue ? "…" : "Überfällige prüfen"}
          </Button>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="gap-1.5 h-8">
                <Plus className="h-3.5 w-3.5" /> Einzeln
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Zahlung erfassen</DialogTitle>
              </DialogHeader>
              <div className="space-y-3">
                <div className="space-y-1">
                  <Label className="text-xs">Mieter *</Label>
                  <Select value={form.tenant_id} onValueChange={(v) => {
                    const t = tenants.find(t => t.id === v);
                    setForm({ ...form, tenant_id: v, amount: t ? String(t.monthly_rent) : form.amount });
                  }}>
                    <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Mieter wählen" /></SelectTrigger>
                    <SelectContent>
                      {tenants.map(t => (
                        <SelectItem key={t.id} value={t.id}>
                          {t.first_name} {t.last_name} {t.unit_label ? `(${t.unit_label})` : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">Betrag (€) *</Label>
                    <Input type="number" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} className="h-9 text-sm" step="0.01" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Fällig am *</Label>
                    <Input type="date" value={form.due_date} onChange={(e) => setForm({ ...form, due_date: e.target.value })} className="h-9 text-sm" />
                  </div>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Notiz</Label>
                  <Input value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} placeholder="z.B. Miete Januar" className="h-9 text-sm" maxLength={200} />
                </div>
                <Button onClick={createPayment} className="w-full">Zahlung erfassen</Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Stats - Improvement 12+13: Enhanced payment stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4">
        <div className="p-2 bg-profit/10 rounded-lg text-center">
          <div className="text-[10px] text-profit">Bestätigt (Monat)</div>
          <div className="text-sm font-bold text-profit">{formatCurrency(confirmedThisMonth)}</div>
        </div>
        <div className="p-2 bg-profit/5 rounded-lg text-center">
          <div className="text-[10px] text-profit">Gesamt bestätigt</div>
          <div className="text-sm font-bold text-profit">{formatCurrency(totalConfirmed)}</div>
        </div>
        <div className="p-2 bg-gold/10 rounded-lg text-center">
          <div className="text-[10px] text-gold">Ausstehend</div>
          <div className="text-sm font-bold text-gold">{pendingCount}</div>
        </div>
        <div className="p-2 bg-loss/10 rounded-lg text-center">
          <div className="text-[10px] text-loss">Überfällig</div>
          <div className="text-sm font-bold text-loss">{overdueCount}</div>
          {overdueAmount > 0 && (
            <div className="text-[9px] text-loss font-medium mt-0.5">{formatCurrency(overdueAmount)}</div>
          )}
        </div>
      </div>

      {/* Payment filter tabs */}
      {payments.length > 0 && (
        <div className="flex gap-1 mb-3">
          {([
            { key: "all" as PaymentFilter, label: "Alle", count: payments.length },
            { key: "pending" as PaymentFilter, label: "Ausstehend", count: pendingCount },
            { key: "overdue" as PaymentFilter, label: "Überfällig", count: overdueCount },
            { key: "confirmed" as PaymentFilter, label: "Bestätigt", count: payments.filter(p => p.status === "confirmed").length },
          ]).map(f => (
            <button
              key={f.key}
              onClick={() => setPaymentFilter(f.key)}
              className={`text-[10px] px-2.5 py-1 rounded-md font-medium transition-colors ${
                paymentFilter === f.key ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-secondary"
              }`}
            >
              {f.label} ({f.count})
            </button>
          ))}
        </div>
      )}

      {payments.length === 0 ? (
        <p className="text-xs text-muted-foreground text-center py-6">
          Noch keine Zahlungen erfasst. Erstelle Zahlungen einzeln oder für alle Mieter eines Monats.
        </p>
      ) : (() => {
        const filtered = payments.filter(p => paymentFilter === "all" ? true : p.status === paymentFilter);
        return filtered.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-6">Keine Zahlungen in dieser Ansicht</p>
        ) : (
        <div className="space-y-1.5">
          {filtered.map((payment) => {
            const status = statusConfig[payment.status];
            const StatusIcon = status.icon;
            const tenantName = payment.tenants
              ? `${payment.tenants.first_name} ${payment.tenants.last_name}`
              : "Mieter";

            return (
              <div key={payment.id} className="flex items-center gap-3 py-2.5 border-b border-border/50 last:border-0">
                <div className={`w-7 h-7 rounded flex items-center justify-center shrink-0 ${status.color}`}>
                  <StatusIcon className="h-3.5 w-3.5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium truncate">{tenantName}</span>
                    {payment.tenants?.unit_label && (
                      <span className="text-[10px] bg-secondary px-1 rounded">{payment.tenants.unit_label}</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-[10px] text-muted-foreground">
                      Fällig: {new Date(payment.due_date).toLocaleDateString("de-DE", { month: "short", year: "numeric" })}
                    </span>
                    {payment.note && (
                      <span className="text-[10px] text-muted-foreground truncate max-w-[100px]">· {payment.note}</span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <span className="text-sm font-bold">{formatCurrency(Number(payment.amount))}</span>
                  {payment.status === "pending" && (
                    <>
                      <Button size="sm" variant="ghost" className="h-6 w-6 p-0 text-profit hover:bg-profit/10" onClick={() => updateStatus(payment.id, "confirmed")}>
                        <CheckCircle2 className="h-4 w-4" />
                      </Button>
                      <Button size="sm" variant="ghost" className="h-6 w-6 p-0 text-loss hover:bg-loss/10" onClick={() => updateStatus(payment.id, "overdue")}>
                        <AlertTriangle className="h-4 w-4" />
                      </Button>
                    </>
                  )}
                  {payment.status === "overdue" && (
                    <Button size="sm" variant="ghost" className="h-6 w-6 p-0 text-profit hover:bg-profit/10" onClick={() => updateStatus(payment.id, "confirmed")}>
                      <CheckCircle2 className="h-4 w-4" />
                    </Button>
                  )}
                  {payment.status === "confirmed" && (
                    <Button size="sm" variant="ghost" className="h-6 w-6 p-0 text-muted-foreground hover:bg-secondary" onClick={() => updateStatus(payment.id, "pending")}>
                      <Clock className="h-3.5 w-3.5" />
                    </Button>
                  )}
                  <Button size="sm" variant="ghost" className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive" onClick={() => deletePayment(payment.id)}>
                    <XCircle className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            );
        })}
        </div>
        );
      })()}
      {hasMore && (
        <Button
          variant="ghost"
          size="sm"
          className="w-full mt-2 text-xs text-muted-foreground"
          onClick={() => fetchPayments(payments.length, true)}
          disabled={loadingMore}
        >
          {loadingMore ? "Laden…" : "Mehr laden"}
        </Button>
      )}
    </div>
  );
};
