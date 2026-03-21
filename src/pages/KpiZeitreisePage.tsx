/**
 * KPIs im Zeitverlauf — Rendite, Cashflow, Wertentwicklung über die Zeit.
 * Nutzt usePortfolioSnapshots (localStorage) und zeigt Charts.
 */
import { useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { TrendingUp, BarChart3, ShieldAlert, PieChart } from "lucide-react";
import { useProperties } from "@/context/PropertyContext";
import { usePortfolioSnapshots } from "@/hooks/usePortfolioSnapshots";
import { ROUTES } from "@/lib/routes";
import { EmptyState } from "@/components/EmptyState";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { formatCurrency } from "@/lib/formatters";
import { Button } from "@/components/ui/button";
import { PageHeader, PageHeaderActions, PageHeaderDescription, PageHeaderMain, PageHeaderTitle } from "@/components/ui/page-header";

const KpiZeitreisePage = () => {
  const { properties, stats } = useProperties();
  const { trendData } = usePortfolioSnapshots(stats);
  const navigate = useNavigate();

  useEffect(() => {
    document.title = "KPIs im Zeitverlauf – ImmoControl";
  }, []);

  if (properties.length === 0) {
    return (
      <div className="max-w-xl mx-auto px-4 py-8" role="main" aria-label="KPIs im Zeitverlauf">
        <EmptyState
          icon={TrendingUp}
          title="Keine Objekte"
          description="KPI-Verlauf basiert auf monatlichen Snapshots. Lege zuerst Objekte an — Snapshots werden automatisch erfasst."
          action={
            <button
              type="button"
              className="text-sm text-primary hover:underline"
              onClick={() => navigate(ROUTES.OBJEKTE)}
            >
              Objekte anlegen
            </button>
          }
        />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto px-4 py-6" role="main" aria-label="KPIs im Zeitverlauf">
      <PageHeader>
        <PageHeaderMain>
          <PageHeaderTitle>
            <TrendingUp className="h-5 w-5 sm:h-6 sm:w-6 text-primary shrink-0" /> KPIs im Zeitverlauf
          </PageHeaderTitle>
          <PageHeaderDescription>
            Monatliche Snapshots: Wertentwicklung, Cashflow, Rendite — Daten in localStorage
          </PageHeaderDescription>
        </PageHeaderMain>
        <PageHeaderActions>
          <Button variant="outline" size="sm" asChild>
            <Link to={ROUTES.REPORTS} className="gap-1.5 touch-target min-h-[36px]" aria-label="Berichte">
              <BarChart3 className="h-3.5 w-3.5" /> Berichte
            </Link>
          </Button>
          <Button variant="outline" size="sm" asChild>
            <Link to={ROUTES.STRESS_TEST} className="gap-1.5 touch-target min-h-[36px]" aria-label="Stress-Test">
              <ShieldAlert className="h-3.5 w-3.5" /> Stress-Test
            </Link>
          </Button>
          <Button variant="outline" size="sm" asChild>
            <Link to={ROUTES.DIVERSIFIKATION} className="gap-1.5 touch-target min-h-[36px]" aria-label="Diversifikation">
              <PieChart className="h-3.5 w-3.5" /> Diversifikation
            </Link>
          </Button>
        </PageHeaderActions>
      </PageHeader>

      {trendData.length < 2 ? (
        <div className="rounded-xl border border-border p-6 text-center text-muted-foreground text-sm">
          Noch nicht genug Daten. Snapshots werden automatisch monatlich erfasst. Nach 2+ Monaten
          siehst du hier die Entwicklung.
        </div>
      ) : (
        <div className="rounded-xl border border-border p-4 space-y-6">
          <ResponsiveContainer width="100%" height={280}>
            <AreaChart data={trendData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis dataKey="label" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => formatCurrency(v).replace(/[^\d.,]/g, "")} />
              <Tooltip
                formatter={(value: number) => formatCurrency(value)}
                contentStyle={{ fontSize: 12 }}
              />
              <Legend />
              <Area type="monotone" dataKey="value" name="Portfoliowert" stroke="hsl(var(--primary))" fill="hsl(var(--primary) / 0.2)" />
              <Area type="monotone" dataKey="equity" name="Eigenkapital" stroke="hsl(var(--profit))" fill="hsl(var(--profit) / 0.2)" />
              <Area type="monotone" dataKey="cashflow" name="Cashflow/M" stroke="hsl(var(--accent))" fill="hsl(var(--accent) / 0.2)" />
            </AreaChart>
          </ResponsiveContainer>

          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={trendData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis dataKey="label" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => `${v}%`} />
              <Tooltip formatter={(v: number) => [`${v.toFixed(1)}%`, "Rendite"]} contentStyle={{ fontSize: 12 }} />
              <Legend />
              <Area type="monotone" dataKey="yield" name="Ø Rendite %" stroke="hsl(var(--chart-2))" fill="hsl(var(--chart-2) / 0.2)" />
              <Area type="monotone" dataKey="ltv" name="LTV %" stroke="hsl(var(--chart-3))" fill="hsl(var(--chart-3) / 0.2)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
};

export default KpiZeitreisePage;
