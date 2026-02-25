import { useMemo } from "react";
import { useProperties } from "@/context/PropertyContext";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useQuery } from "@tanstack/react-query";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from "recharts";
import { formatCurrency } from "@/lib/formatters";

const COLORS = ["hsl(var(--primary))", "hsl(var(--gold))", "hsl(var(--chart-3))", "hsl(var(--loss))", "hsl(var(--profit))"];

const ExpenseCategoryBreakdown = () => {
  const { user } = useAuth();
  const { properties } = useProperties();

  const { data: loans = [] } = useQuery({
    queryKey: ["expense_cat_loans"],
    queryFn: async () => {
      const { data } = await supabase.from("loans").select("remaining_balance, interest_rate, monthly_payment");
      return data || [];
    },
    enabled: !!user,
  });

  const { data: insurances = [] } = useQuery({
    queryKey: ["expense_cat_insurance"],
    queryFn: async () => {
      const { data } = await supabase.from("property_insurances").select("annual_premium");
      return data || [];
    },
    enabled: !!user,
  });

  const { data: services = [] } = useQuery({
    queryKey: ["expense_cat_services"],
    queryFn: async () => {
      const { data } = await supabase.from("service_contracts").select("annual_cost").eq("status", "active");
      return data || [];
    },
    enabled: !!user,
  });

  const data = useMemo(() => {
    const creditRates = loans.reduce((s, l) => s + Number(l.monthly_payment || 0), 0) * 12;
    const operating = properties.reduce((s, p) => s + p.monthlyExpenses * 12, 0);
    const insurance = insurances.reduce((s, i) => s + Number(i.annual_premium || 0), 0);
    const service = services.reduce((s, c) => s + Number(c.annual_cost || 0), 0);

    return [
      { name: "Kreditraten", value: creditRates },
      { name: "Bewirtschaftung", value: operating },
      { name: "Versicherungen", value: insurance },
      { name: "Dienstleister", value: service },
    ].filter(d => d.value > 0);
  }, [properties, loans, insurances, services]);

  if (data.length === 0) return null;

  const total = data.reduce((s, d) => s + d.value, 0);

  return (
    <div className="gradient-card rounded-xl border border-border p-5 animate-fade-in">
      <h3 className="text-sm font-semibold mb-1">Kostenstruktur (p.a.)</h3>
      <p className="text-[10px] text-muted-foreground mb-3">Gesamt: {formatCurrency(total)}</p>
      <ResponsiveContainer width="100%" height={200}>
        <PieChart>
          <Pie data={data} cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={3} dataKey="value">
            {data.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
          </Pie>
          <Tooltip formatter={(v: number) => formatCurrency(v)} contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid hsl(var(--border))", background: "hsl(var(--background))" }} />
          <Legend iconSize={8} wrapperStyle={{ fontSize: 11 }} />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
};

export default ExpenseCategoryBreakdown;
