/**
 * Refinanzierungs-Szenario-Rechner — Darlehen mit Zinsbindungsende,
 * Umschuldungs-Szenarien, Vergleich aktueller vs. Marktzins.
 */
import { useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { RefreshCw, Calendar, Landmark, Receipt, ShieldAlert, Building2 } from "lucide-react";
import LoanRefinancingCalc from "@/components/LoanRefinancingCalc";
import { LoanFixedInterestCountdown } from "@/components/LoanFixedInterestCountdown";
import LoanFixedInterestAlerts from "@/components/LoanFixedInterestAlerts";
import { useProperties } from "@/context/PropertyContext";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { ROUTES } from "@/lib/routes";
import { EmptyState } from "@/components/EmptyState";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/formatters";

const RefinanzierungPage = () => {
  const { user } = useAuth();
  const { properties } = useProperties();
  const navigate = useNavigate();

  const { data: loans = [], isLoading } = useQuery({
    queryKey: ["refinanzierung_loans"],
    queryFn: async () => {
      const { data } = await supabase.from("loans").select("*");
      return data || [];
    },
    enabled: !!user,
  });

  const loansWithFixedInterest = loans.filter(
    (l) => l.fixed_interest_until && new Date(l.fixed_interest_until) > new Date()
  );

  useEffect(() => {
    document.title = "Refinanzierung – ImmoControl";
  }, []);

  if (isLoading) {
    return (
      <div className="space-y-6 max-w-3xl mx-auto px-4 py-6 min-w-0" role="main" aria-label="Refinanzierung">
        <div className="min-w-0">
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight flex items-center gap-2">
            <RefreshCw className="h-6 w-6 text-primary shrink-0" /> Refinanzierungs-Szenario
          </h1>
          <p className="text-sm text-muted-foreground mt-1">Zinsbindungsende im Blick, Umschuldungs-Potenzial und Szenarien</p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 min-w-0">
          <div className="h-32 rounded-xl border border-border bg-muted/20 animate-pulse" />
          <div className="h-32 rounded-xl border border-border bg-muted/20 animate-pulse" />
        </div>
        <div className="h-48 rounded-xl border border-border bg-muted/20 animate-pulse min-w-0" role="status" aria-label="Refinanzierung wird geladen" />
      </div>
    );
  }

  if (properties.length === 0 && loans.length === 0) {
    return (
      <div className="max-w-xl mx-auto px-4 py-8 min-w-0" role="main" aria-label="Refinanzierung">
        <EmptyState
          icon={RefreshCw}
          title="Keine Darlehen"
          description="Refinanzierungs-Szenarien basieren auf deinen Darlehen. Lege zuerst Objekte und Darlehen an."
          action={
            <div className="flex flex-wrap items-center justify-center gap-2">
              <Button variant="outline" size="sm" className="touch-target min-h-[44px] gap-1.5" onClick={() => navigate(ROUTES.LOANS)}>
                <Landmark className="h-4 w-4 shrink-0" /> Zu Darlehen
              </Button>
              <Button variant="outline" size="sm" asChild className="touch-target min-h-[44px] gap-1.5">
                <Link to={ROUTES.OBJEKTE}>
                  <Building2 className="h-4 w-4 shrink-0" /> Objekte
                </Link>
              </Button>
            </div>
          }
        />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-3xl mx-auto px-4 py-6 min-w-0" role="main" aria-label="Refinanzierung">
      <div className="min-w-0">
        <h1 className="text-xl sm:text-2xl font-bold tracking-tight flex items-center gap-2">
          <RefreshCw className="h-5 w-5 sm:h-6 sm:w-6 text-primary shrink-0" /> Refinanzierungs-Szenario
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Zinsbindungsende im Blick, Umschuldungs-Potenzial und Szenarien
        </p>
        <div className="flex flex-wrap gap-2 mt-3">
          <Button variant="outline" size="sm" asChild className="touch-target min-h-[44px]">
            <Link to={ROUTES.LOANS} className="gap-1.5" aria-label="Darlehen">
              <Landmark className="h-3.5 w-3.5 shrink-0" /> Darlehen
            </Link>
          </Button>
          <Button variant="outline" size="sm" asChild className="touch-target min-h-[44px]">
            <Link to={ROUTES.STEUER_COCKPIT} className="gap-1.5" aria-label="Steuer-Cockpit">
              <Receipt className="h-3.5 w-3.5 shrink-0" /> Steuer-Cockpit
            </Link>
          </Button>
          <Button variant="outline" size="sm" asChild className="touch-target min-h-[44px]">
            <Link to={ROUTES.STRESS_TEST} className="gap-1.5" aria-label="Stress-Test">
              <ShieldAlert className="h-3.5 w-3.5 shrink-0" /> Stress-Test
            </Link>
          </Button>
        </div>
      </div>

      <LoanFixedInterestAlerts loans={loans} />

      <div className="grid gap-4 sm:grid-cols-2 min-w-0">
        <Card className="min-w-0">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Calendar className="h-4 w-4 shrink-0 text-muted-foreground" /> Zinsbindung endet
            </CardTitle>
          </CardHeader>
          <CardContent>
            <LoanFixedInterestCountdown />
          </CardContent>
        </Card>
        <Card className="min-w-0">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Landmark className="h-4 w-4 shrink-0 text-muted-foreground" /> Offene Restschuld
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold tabular-nums">
              {formatCurrency(loans.reduce((s, l) => s + Number(l.remaining_balance || 0), 0))}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              {loansWithFixedInterest.length} Darlehen mit Zinsbindung
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="min-w-0">
        <LoanRefinancingCalc />
      </div>
    </div>
  );
};

export default RefinanzierungPage;
