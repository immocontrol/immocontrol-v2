/**
 * IMP20-7: Monatsabschluss-Workflow Widget
 * Dashboard widget showing: unpaid rents, due maintenance, expiring documents,
 * interest lock countdowns — all on one view at month-end.
 */
import { memo, useMemo } from "react";
import { CalendarCheck, AlertTriangle, Clock, FileWarning, Landmark, CheckCircle2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useProperties } from "@/context/PropertyContext";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { formatCurrency } from "@/lib/formatters";

const MonatsabschlussWidget = memo(() => {
  const { user } = useAuth();
  const { properties, stats } = useProperties();

  // Fetch unpaid rents
  const { data: unpaidRents = [] } = useQuery({
    queryKey: ["monatsabschluss_rents"],
    queryFn: async () => {
      const now = new Date();
      const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
      const { data } = await supabase
        .from("rent_payments")
        .select("*")
        .gte("due_date", monthStart)
        .neq("status", "confirmed");
      return (data || []) as Array<{ id: string; amount: number; tenant_id: string }>;
    },
    enabled: !!user,
  });

  // Fetch due maintenance items
  const { data: dueMaintenance = [] } = useQuery({
    queryKey: ["monatsabschluss_maintenance"],
    queryFn: async () => {
      const now = new Date();
      const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, now.getDate());
      const { data } = await supabase
        .from("maintenance_items")
        .select("*")
        .lte("next_due_date", nextMonth.toISOString().slice(0, 10))
        .eq("status", "pending");
      return (data || []) as Array<{ id: string; title: string; estimated_cost: number }>;
    },
    enabled: !!user,
  });

  // Fetch expiring documents
  const { data: expiringDocs = [] } = useQuery({
    queryKey: ["monatsabschluss_docs"],
    queryFn: async () => {
      const now = new Date();
      const nextMonth = new Date(now.getFullYear(), now.getMonth() + 2, 0);
      const { data } = await supabase
        .from("document_expiries")
        .select("*")
        .lte("expiry_date", nextMonth.toISOString().slice(0, 10))
        .gte("expiry_date", now.toISOString().slice(0, 10));
      return (data || []) as Array<{ id: string; document_name: string; expiry_date: string }>;
    },
    enabled: !!user,
  });

  // Fetch loans with expiring interest locks
  const { data: expiringLoans = [] } = useQuery({
    queryKey: ["monatsabschluss_loans"],
    queryFn: async () => {
      const now = new Date();
      const in90Days = new Date(now.getTime() + 90 * 86400000);
      const { data } = await supabase
        .from("loans")
        .select("*")
        .lte("fixed_interest_until", in90Days.toISOString().slice(0, 10))
        .gte("fixed_interest_until", now.toISOString().slice(0, 10));
      return (data || []) as Array<{ id: string; bank_name: string; remaining_balance: number; fixed_interest_until: string }>;
    },
    enabled: !!user,
  });

  const items = useMemo(() => {
    const result: Array<{ icon: typeof AlertTriangle; label: string; count: number; severity: "red" | "yellow" | "green"; detail: string }> = [];

    if (unpaidRents.length > 0) {
      const totalUnpaid = unpaidRents.reduce((s, r) => s + (r.amount || 0), 0);
      result.push({ icon: Clock, label: "Offene Mieten", count: unpaidRents.length, severity: "red", detail: formatCurrency(totalUnpaid) });
    }
    if (dueMaintenance.length > 0) {
      const totalCost = dueMaintenance.reduce((s, m) => s + (m.estimated_cost || 0), 0);
      result.push({ icon: AlertTriangle, label: "Fällige Wartung", count: dueMaintenance.length, severity: "yellow", detail: formatCurrency(totalCost) });
    }
    if (expiringDocs.length > 0) {
      result.push({ icon: FileWarning, label: "Ablaufende Dokumente", count: expiringDocs.length, severity: "yellow", detail: `${expiringDocs.length} Dok.` });
    }
    if (expiringLoans.length > 0) {
      const totalBalance = expiringLoans.reduce((s, l) => s + (l.remaining_balance || 0), 0);
      result.push({ icon: Landmark, label: "Zinsbindung endet", count: expiringLoans.length, severity: "red", detail: formatCurrency(totalBalance) });
    }

    return result;
  }, [unpaidRents, dueMaintenance, expiringDocs, expiringLoans]);

  const allClear = items.length === 0;
  const currentMonth = new Date().toLocaleDateString("de-DE", { month: "long", year: "numeric" });

  return (
    <div className="gradient-card rounded-xl border border-border p-4 animate-fade-in">
      <div className="flex items-center gap-2 mb-3">
        <CalendarCheck className="h-4 w-4 text-primary" />
        <h3 className="text-sm font-semibold">Monatsabschluss</h3>
        <Badge variant="outline" className="text-[10px] h-5">{currentMonth}</Badge>
        {allClear && (
          <Badge className="text-[10px] h-5 bg-profit/20 text-profit ml-auto">
            <CheckCircle2 className="h-3 w-3 mr-0.5" /> Alles erledigt
          </Badge>
        )}
      </div>

      {allClear ? (
        <p className="text-xs text-muted-foreground text-center py-2">
          Keine offenen Punkte für diesen Monat
        </p>
      ) : (
        <div className="space-y-2">
          {items.map((item, i) => (
            <div key={i} className="flex items-center gap-3 p-2.5 rounded-lg bg-background/50">
              <item.icon className={`h-3.5 w-3.5 shrink-0 ${item.severity === "red" ? "text-loss" : item.severity === "yellow" ? "text-gold" : "text-profit"}`} />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium">{item.label}</p>
                <p className="text-[10px] text-muted-foreground">{item.detail}</p>
              </div>
              <Badge variant={item.severity === "red" ? "destructive" : "outline"} className="text-[10px] h-5">
                {item.count}
              </Badge>
            </div>
          ))}
        </div>
      )}
    </div>
  );
});
MonatsabschlussWidget.displayName = "MonatsabschlussWidget";

export { MonatsabschlussWidget };
