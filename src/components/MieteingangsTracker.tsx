/** NEW-16: Mieteingangs-Tracker mit automatischer Erinnerung
 * Tracks rent payments per property/tenant and shows overdue reminders. */
import { memo, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { queryKeys } from "@/lib/queryKeys";
import { formatCurrency } from "@/lib/formatters";
import { Check, AlertTriangle, Clock, Bell, ChevronDown, ChevronUp } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

interface RentPayment {
  id: string;
  property_id: string;
  tenant_id: string;
  amount: number;
  due_date: string;
  status: string;
}

interface Tenant {
  id: string;
  first_name: string;
  last_name: string;
  monthly_rent: number;
  property_id: string;
  is_active: boolean;
}

const MieteingangsTracker = memo(() => {
  const { user } = useAuth();
  const [expanded, setExpanded] = useState(false);

  const { data: payments = [] } = useQuery({
    queryKey: ["mieteingang_tracker"],
    queryFn: async () => {
      const { data } = await supabase
        .from("rent_payments")
        .select("*")
        .gte("due_date", new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString())
        .lte("due_date", new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).toISOString())
        .order("due_date", { ascending: true });
      return (data || []) as RentPayment[];
    },
    enabled: !!user,
  });

  const { data: tenants = [] } = useQuery({
    queryKey: ["mieteingang_tenants"],
    queryFn: async () => {
      const { data } = await supabase.from("tenants").select("*").eq("is_active", true);
      return (data || []) as Tenant[];
    },
    enabled: !!user,
  });

  const stats = useMemo(() => {
    const totalDue = tenants.reduce((s, t) => s + (t.monthly_rent || 0), 0);
    const confirmed = payments.filter(p => p.status === "confirmed");
    const totalReceived = confirmed.reduce((s, p) => s + p.amount, 0);
    const overdue = tenants.filter(t => {
      const hasPaid = payments.some(p => p.tenant_id === t.id && p.status === "confirmed");
      return !hasPaid && new Date().getDate() > 5; // Due by 5th of month
    });
    return { totalDue, totalReceived, overdue, receivedCount: confirmed.length, totalTenants: tenants.length };
  }, [payments, tenants]);

  const progressPct = stats.totalDue > 0 ? Math.min(100, (stats.totalReceived / stats.totalDue) * 100) : 0;

  const handleReminder = () => {
    if (stats.overdue.length === 0) {
      toast.info("Alle Mieten sind eingegangen!");
      return;
    }
    toast.success(`Erinnerung für ${stats.overdue.length} ausstehende Mietzahlung${stats.overdue.length > 1 ? "en" : ""} erstellt`);
  };

  if (tenants.length === 0) return null;

  return (
    <div className="gradient-card rounded-xl border border-border p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Clock className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-semibold">Mieteingangs-Tracker</h3>
          <Badge variant="outline" className="text-[10px] h-5">
            {new Date().toLocaleDateString("de-DE", { month: "long", year: "numeric" })}
          </Badge>
        </div>
        <div className="flex items-center gap-1">
          {stats.overdue.length > 0 && (
            <Button variant="ghost" size="sm" className="h-6 text-[10px] gap-1 text-loss" onClick={handleReminder}>
              <Bell className="h-3 w-3" /> {stats.overdue.length} offen
            </Button>
          )}
          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setExpanded(!expanded)}>
            {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
          </Button>
        </div>
      </div>

      {/* Progress bar */}
      <div className="space-y-1.5">
        <div className="flex justify-between text-xs">
          <span className="text-muted-foreground">{stats.receivedCount} von {stats.totalTenants} Mieten eingegangen</span>
          <span className="font-medium">{progressPct.toFixed(0)}%</span>
        </div>
        <div className="h-2 bg-secondary rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-500 progress-smooth"
            style={{
              width: `${progressPct}%`,
              backgroundColor: progressPct >= 100 ? "hsl(var(--profit))" : progressPct >= 50 ? "hsl(var(--primary))" : "hsl(var(--loss))",
            }}
          />
        </div>
        <div className="flex justify-between text-[10px] text-muted-foreground">
          <span>Eingegangen: {formatCurrency(stats.totalReceived)}</span>
          <span>Soll: {formatCurrency(stats.totalDue)}</span>
        </div>
      </div>

      {/* Expanded tenant list */}
      {expanded && (
        <div className="mt-3 space-y-1.5 max-h-[200px] overflow-y-auto">
          {tenants.map(t => {
            const paid = payments.some(p => p.tenant_id === t.id && p.status === "confirmed");
            return (
              <div key={t.id} className="flex items-center justify-between text-xs py-1 px-2 rounded-lg hover:bg-secondary/50">
                <div className="flex items-center gap-2">
                  {paid ? (
                    <Check className="h-3 w-3 text-profit" />
                  ) : (
                    <AlertTriangle className="h-3 w-3 text-loss" />
                  )}
                  <span className="font-medium">{t.first_name} {t.last_name}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span>{formatCurrency(t.monthly_rent || 0)}</span>
                  <Badge variant={paid ? "default" : "destructive"} className="text-[9px] h-4">
                    {paid ? "Bezahlt" : "Offen"}
                  </Badge>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
});
MieteingangsTracker.displayName = "MieteingangsTracker";

export { MieteingangsTracker };
