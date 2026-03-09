/**
 * Refinanzierungs-Szenario-Rechner — Darlehen mit Zinsbindungsende,
 * Umschuldungs-Szenarien, Vergleich aktueller vs. Marktzins.
 */
import { useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { RefreshCw, Calendar, Landmark, Receipt, ShieldAlert } from "lucide-react";
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

  const { data: loans = [] } = useQuery({
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

  if (properties.length === 0 && loans.length === 0) {
    return (
      <div className="max-w-xl mx-auto px-4 py-8" role="main" aria-label="Refinanzierung">
        <EmptyState
          icon={RefreshCw}
          title="Keine Darlehen"
          description="Refinanzierungs-Szenarien basieren auf deinen Darlehen. Lege zuerst Objekte und Darlehen an."
          action={
            <button
              type="button"
              className="text-sm text-primary hover:underline"
              onClick={() => navigate(ROUTES.LOANS)}
            >
              Zu Darlehen
            </button>
          }
        />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-3xl mx-auto px-4 py-6" role="main" aria-label="Refinanzierung">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold tracking-tight flex items-center gap-2">
          <RefreshCw className="h-5 w-5 sm:h-6 sm:w-6 text-primary" /> Refinanzierungs-Szenario
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Zinsbindungsende im Blick, Umschuldungs-Potenzial und Szenarien
        </p>
        <div className="flex flex-wrap gap-2 mt-3">
          <Button variant="outline" size="sm" asChild>
            <Link to={ROUTES.STEUER_COCKPIT} className="gap-1.5 touch-target min-h-[36px]" aria-label="Steuer-Cockpit">
              <Receipt className="h-3.5 w-3.5" /> Steuer-Cockpit
            </Link>
          </Button>
          <Button variant="outline" size="sm" asChild>
            <Link to={ROUTES.STRESS_TEST} className="gap-1.5 touch-target min-h-[36px]" aria-label="Stress-Test">
              <ShieldAlert className="h-3.5 w-3.5" /> Stress-Test
            </Link>
          </Button>
        </div>
      </div>

      <LoanFixedInterestAlerts loans={loans} />

      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Calendar className="h-4 w-4" /> Zinsbindung endet
            </CardTitle>
          </CardHeader>
          <CardContent>
            <LoanFixedInterestCountdown />
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Landmark className="h-4 w-4" /> Offene Restschuld
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">
              {formatCurrency(loans.reduce((s, l) => s + Number(l.remaining_balance || 0), 0))}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              {loansWithFixedInterest.length} Darlehen mit Zinsbindung
            </p>
          </CardContent>
        </Card>
      </div>

      <LoanRefinancingCalc />
    </div>
  );
};

export default RefinanzierungPage;
