import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { AlertTriangle, X, CreditCard } from "lucide-react";
import { formatCurrency } from "@/lib/formatters";
import { Link } from "react-router-dom";

const OverduePaymentBanner = () => {
  const { user } = useAuth();
  const [dismissed, setDismissed] = useState(false);

  const { data: overdue = [] } = useQuery({
    queryKey: ["overdue_payments_banner"],
    queryFn: async () => {
      const { data } = await supabase
        .from("rent_payments")
        .select("id, amount, property_id, tenant_id")
        .eq("status", "overdue");
      return data || [];
    },
    enabled: !!user,
  });

  if (overdue.length === 0 || dismissed) return null;

  const total = overdue.reduce((s, p) => s + Number(p.amount || 0), 0);

  return (
    <div className="rounded-xl border border-loss/30 bg-loss/5 p-3 flex items-center gap-3 animate-fade-in">
      <div className="w-8 h-8 rounded-lg bg-loss/10 flex items-center justify-center shrink-0">
        <AlertTriangle className="h-4 w-4 text-loss" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-loss">
          {overdue.length} überfällige Mietzahlung{overdue.length !== 1 ? "en" : ""}
        </p>
        <p className="text-xs text-muted-foreground">
          Offener Betrag: <span className="font-medium text-loss">{formatCurrency(total)}</span>
        </p>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <button
          onClick={() => setDismissed(true)}
          className="h-6 w-6 flex items-center justify-center rounded text-muted-foreground hover:text-foreground transition-colors"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
};

export default OverduePaymentBanner;
