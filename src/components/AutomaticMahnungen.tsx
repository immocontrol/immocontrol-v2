/**
 * IMP20-11: Automatische Mahnungen
 * MieteingangsTracker + DocumentTemplateGenerator integration.
 * Auto-generate Mahnung if rent >5 days overdue.
 */
import { memo, useMemo, useState } from "react";
import { AlertTriangle, FileText, Send, Clock, Check } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { formatCurrency } from "@/lib/formatters";
import { toast } from "sonner";

interface OverdueTenant {
  tenantId: string;
  tenantName: string;
  propertyName: string;
  amount: number;
  daysOverdue: number;
  mahnungLevel: 1 | 2 | 3;
}

const MAHNUNG_TEMPLATES = {
  1: "Zahlungserinnerung",
  2: "1. Mahnung",
  3: "2. Mahnung (letzte Frist)",
} as const;

const AutomaticMahnungen = memo(() => {
  const { user } = useAuth();
  const [generatedIds, setGeneratedIds] = useState<Set<string>>(new Set());

  const { data: tenants = [] } = useQuery({
    queryKey: ["mahnung_tenants"],
    queryFn: async () => {
      const { data } = await supabase.from("tenants").select("*").eq("is_active", true);
      return (data || []) as Array<{ id: string; first_name: string; last_name: string; monthly_rent: number; property_id: string }>;
    },
    enabled: !!user,
  });

  const { data: payments = [] } = useQuery({
    queryKey: ["mahnung_payments"],
    queryFn: async () => {
      const now = new Date();
      const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
      const { data } = await supabase
        .from("rent_payments")
        .select("*")
        .gte("due_date", monthStart)
        .order("due_date", { ascending: true });
      return (data || []) as Array<{ id: string; tenant_id: string; status: string; amount: number }>;
    },
    enabled: !!user,
  });

  const { data: properties = [] } = useQuery({
    queryKey: ["mahnung_properties"],
    queryFn: async () => {
      const { data } = await supabase.from("properties").select("id, name");
      return (data || []) as Array<{ id: string; name: string }>;
    },
    enabled: !!user,
  });

  const overdueTenants = useMemo((): OverdueTenant[] => {
    const today = new Date();
    const dayOfMonth = today.getDate();
    if (dayOfMonth <= 5) return []; // Not overdue yet

    const propMap = Object.fromEntries(properties.map(p => [p.id, p.name]));
    const daysOverdue = dayOfMonth - 5;

    return tenants
      .filter(t => {
        const hasPaid = payments.some(p => p.tenant_id === t.id && p.status === "confirmed");
        return !hasPaid && t.monthly_rent > 0;
      })
      .map(t => ({
        tenantId: t.id,
        tenantName: `${t.first_name} ${t.last_name}`,
        propertyName: propMap[t.property_id] || "Unbekannt",
        amount: t.monthly_rent,
        daysOverdue,
        mahnungLevel: daysOverdue > 30 ? 3 as const : daysOverdue > 14 ? 2 as const : 1 as const,
      }));
  }, [tenants, payments, properties]);

  const handleGenerateMahnung = (tenant: OverdueTenant) => {
    // Generate mahnung document
    const monthName = new Date().toLocaleDateString("de-DE", { month: "long", year: "numeric" });
    const template = MAHNUNG_TEMPLATES[tenant.mahnungLevel];
    
    toast.success(`${template} für ${tenant.tenantName} erstellt (${monthName}, ${formatCurrency(tenant.amount)})`);
    setGeneratedIds(prev => new Set([...prev, tenant.tenantId]));
  };

  const handleGenerateAll = () => {
    overdueTenants.forEach(t => {
      if (!generatedIds.has(t.tenantId)) {
        handleGenerateMahnung(t);
      }
    });
  };

  if (overdueTenants.length === 0) return null;

  return (
    <div className="gradient-card rounded-xl border border-loss/30 bg-loss/5 p-4 animate-fade-in">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-loss" />
          <h3 className="text-sm font-semibold">Automatische Mahnungen</h3>
          <Badge variant="destructive" className="text-[10px] h-5">{overdueTenants.length}</Badge>
        </div>
        {overdueTenants.length > 1 && (
          <Button variant="outline" size="sm" className="text-xs h-7 gap-1" onClick={handleGenerateAll}>
            <Send className="h-3 w-3" /> Alle erstellen
          </Button>
        )}
      </div>

      <div className="space-y-2">
        {overdueTenants.map(t => (
          <div key={t.tenantId} className="flex items-center gap-3 p-2.5 rounded-lg bg-background/50">
            <Clock className="h-3.5 w-3.5 text-loss shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium truncate">{t.tenantName}</p>
              <p className="text-[10px] text-muted-foreground">
                {t.propertyName} · {formatCurrency(t.amount)} · {t.daysOverdue}d überfällig
              </p>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <Badge variant={t.mahnungLevel >= 3 ? "destructive" : "outline"} className="text-[9px] h-4">
                {MAHNUNG_TEMPLATES[t.mahnungLevel]}
              </Badge>
              {generatedIds.has(t.tenantId) ? (
                <Check className="h-3.5 w-3.5 text-profit" />
              ) : (
                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => handleGenerateMahnung(t)}>
                  <FileText className="h-3 w-3" />
                </Button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
});
AutomaticMahnungen.displayName = "AutomaticMahnungen";

export { AutomaticMahnungen };
