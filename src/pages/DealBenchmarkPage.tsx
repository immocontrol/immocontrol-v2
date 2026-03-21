/**
 * Deal-Benchmark — erwartete vs. realisierte Rendite, Durchschnittswerte.
 * Aggregierte Stats aus abgeschlossenen Deals.
 */
import { useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { TrendingUp, Landmark, BarChart3, Home, Receipt } from "lucide-react";
import { ROUTES } from "@/lib/routes";
import { EmptyState } from "@/components/EmptyState";
import { Button } from "@/components/ui/button";
import { PageHeader, PageHeaderActions, PageHeaderDescription, PageHeaderMain, PageHeaderTitle } from "@/components/ui/page-header";
import { formatCurrency } from "@/lib/formatters";

interface DealRecord {
  id: string;
  title: string;
  address?: string;
  stage: string;
  purchase_price?: number;
  expected_rent?: number;
  expected_yield?: number;
  sqm?: number;
  units?: number;
  created_at: string;
}

const DealBenchmarkPage = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const { data: deals = [] } = useQuery({
    queryKey: ["deal_benchmark"],
    queryFn: async () => {
      const { data } = await supabase
        .from("deals")
        .select("id, title, address, stage, purchase_price, expected_rent, expected_yield, sqm, units, created_at")
        .eq("user_id", user!.id);
      return (data || []) as DealRecord[];
    },
    enabled: !!user,
  });

  const completed = deals.filter((d) => d.stage === "abgeschlossen");
  const stats = (() => {
    if (completed.length === 0) return null;
    const prices = completed.filter((d) => (d.purchase_price ?? 0) > 0);
    const rents = completed.filter((d) => (d.expected_rent ?? 0) > 0);
    const yields = completed.filter((d) => (d.expected_yield ?? 0) > 0);
    let impliedYield = 0;
    if (prices.length > 0 && rents.length > 0) {
      const totalRent = rents.reduce((s, d) => s + (d.expected_rent ?? 0) * 12, 0);
      const totalPrice = prices.reduce((s, d) => s + (d.purchase_price ?? 0), 0);
      impliedYield = totalPrice > 0 ? (totalRent / totalPrice) * 100 : 0;
    }
    const avgYield = yields.length > 0
      ? yields.reduce((s, d) => s + (d.expected_yield ?? 0), 0) / yields.length
      : impliedYield;
    const avgPrice = prices.length > 0
      ? prices.reduce((s, d) => s + (d.purchase_price ?? 0), 0) / prices.length
      : 0;
    const avgFactor = prices.length > 0 && rents.length > 0
      ? prices.reduce((s, d) => s + (d.purchase_price ?? 0), 0) / (rents.reduce((s, d) => s + (d.expected_rent ?? 0) * 12, 0) || 1)
      : 0;
    return { count: completed.length, avgYield, avgPrice, avgFactor };
  })();

  useEffect(() => {
    document.title = "Deal-Benchmark – ImmoControl";
  }, []);

  if (deals.length === 0) {
    return (
      <div className="max-w-xl mx-auto px-4 py-8" role="main" aria-label="Deal-Benchmark">
        <EmptyState
          icon={TrendingUp}
          title="Keine Deals"
          description="Deal-Benchmark zeigt Kennzahlen aus abgeschlossenen Deals. Lege Deals an und markiere sie als abgeschlossen."
          action={
            <button
              type="button"
              className="text-sm text-primary hover:underline"
              onClick={() => navigate(ROUTES.DEALS)}
            >
              Zu Deals
            </button>
          }
        />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-3xl mx-auto px-4 py-6" role="main" aria-label="Deal-Benchmark">
      <PageHeader>
        <PageHeaderMain>
          <PageHeaderTitle>
            <TrendingUp className="h-5 w-5 sm:h-6 sm:w-6 text-primary shrink-0" /> Deal-Benchmark
          </PageHeaderTitle>
          <PageHeaderDescription>
            Kennzahlen aus abgeschlossenen Deals — erwartete Rendite, Kaufpreisfaktor
          </PageHeaderDescription>
        </PageHeaderMain>
        <PageHeaderActions>
          <Button variant="outline" size="sm" asChild>
            <Link to={ROUTES.DEALS} className="gap-1.5 touch-target min-h-[36px]" aria-label="Deals">
              <TrendingUp className="h-3.5 w-3.5" /> Deals
            </Link>
          </Button>
          <Button variant="outline" size="sm" asChild>
            <Link to={ROUTES.ANALYSE} className="gap-1.5 touch-target min-h-[36px]" aria-label="Analyse">
              <BarChart3 className="h-3.5 w-3.5" /> Analyse
            </Link>
          </Button>
          <Button variant="outline" size="sm" asChild>
            <Link to={ROUTES.OBJEKTE} className="gap-1.5 touch-target min-h-[36px]" aria-label="Objekte">
              <Home className="h-3.5 w-3.5" /> Objekte
            </Link>
          </Button>
          <Button variant="outline" size="sm" asChild>
            <Link to={ROUTES.STEUER_COCKPIT} className="gap-1.5 touch-target min-h-[36px]" aria-label="Steuer-Cockpit">
              <Receipt className="h-3.5 w-3.5" /> Steuer-Cockpit
            </Link>
          </Button>
        </PageHeaderActions>
      </PageHeader>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-border p-4 text-center">
          <p className="text-xs text-muted-foreground uppercase tracking-wider">Abgeschlossene Deals</p>
          <p className="text-2xl font-bold mt-1">{completed.length}</p>
          <p className="text-xs text-muted-foreground mt-1">von {deals.length} insgesamt</p>
        </div>
        {stats && (
          <>
            <div className="rounded-xl border border-border p-4 text-center">
              <p className="text-xs text-muted-foreground uppercase tracking-wider">Ø erwartete Rendite</p>
              <p className="text-2xl font-bold text-profit mt-1">{stats.avgYield.toFixed(1)}%</p>
            </div>
            <div className="rounded-xl border border-border p-4 text-center">
              <p className="text-xs text-muted-foreground uppercase tracking-wider">Ø Kaufpreis</p>
              <p className="text-2xl font-bold mt-1">{formatCurrency(stats.avgPrice)}</p>
            </div>
          </>
        )}
      </div>

      {stats && stats.avgFactor > 0 && (
        <div className="rounded-xl border border-border p-4">
          <p className="text-sm font-semibold">Ø Kaufpreisfaktor</p>
          <p className="text-lg font-bold text-primary">{stats.avgFactor.toFixed(1)}</p>
          <p className="text-xs text-muted-foreground mt-1">
            Kaufpreis / Jahreskaltmiete — typisch 15–25, niedriger = besser
          </p>
        </div>
      )}

      <div className="text-sm text-muted-foreground">
        Tipp: Vergleiche deine erwartete Rendite mit dem tatsächlichen Ergebnis im Objekt, nachdem du den Deal
        konvertiert hast. So lernst du, deine Bewertung zu verbessern.
      </div>
    </div>
  );
};

export default DealBenchmarkPage;
