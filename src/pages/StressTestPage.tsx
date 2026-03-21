/**
 * Stress-Test / Risiko-Simulation — Leerstand, Zinsanstieg,
 * Mietausfall, Sondereffekte kombiniert durchrechnen.
 */
import { useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { ShieldAlert, PieChart, RefreshCw } from "lucide-react";
import { PortfolioStresstest } from "@/components/PortfolioStresstest";
import { useProperties } from "@/context/PropertyContext";
import { ROUTES } from "@/lib/routes";
import { EmptyState } from "@/components/EmptyState";
import { Button } from "@/components/ui/button";
import { PageHeader, PageHeaderActions, PageHeaderDescription, PageHeaderMain, PageHeaderTitle } from "@/components/ui/page-header";

const StressTestPage = () => {
  const { properties } = useProperties();
  const navigate = useNavigate();

  useEffect(() => {
    document.title = "Stress-Test – ImmoControl";
  }, []);

  if (properties.length === 0) {
    return (
      <div className="max-w-xl mx-auto px-4 py-8" role="main" aria-label="Stress-Test">
        <EmptyState
          icon={ShieldAlert}
          title="Keine Objekte"
          description="Stress-Tests basieren auf deinem Portfolio. Lege zuerst Objekte an."
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
    <div className="space-y-6 max-w-3xl mx-auto px-4 py-6" role="main" aria-label="Stress-Test">
      <PageHeader>
        <PageHeaderMain>
          <PageHeaderTitle>
            <ShieldAlert className="h-5 w-5 sm:h-6 sm:w-6 text-primary shrink-0" /> Stress-Test
          </PageHeaderTitle>
          <PageHeaderDescription>
            Portfolio-Resilienz: Leerstand, Zinsanstieg, Mietausfall und Sondereffekte durchrechnen
          </PageHeaderDescription>
        </PageHeaderMain>
        <PageHeaderActions>
          <Button variant="outline" size="sm" asChild>
            <Link to={ROUTES.DIVERSIFIKATION} className="gap-1.5 touch-target min-h-[36px]" aria-label="Diversifikation">
              <PieChart className="h-3.5 w-3.5" /> Diversifikation
            </Link>
          </Button>
          <Button variant="outline" size="sm" asChild>
            <Link to={ROUTES.REFINANZIERUNG} className="gap-1.5 touch-target min-h-[36px]" aria-label="Refinanzierung">
              <RefreshCw className="h-3.5 w-3.5" /> Refinanzierung
            </Link>
          </Button>
        </PageHeaderActions>
      </PageHeader>

      <PortfolioStresstest />
    </div>
  );
};

export default StressTestPage;
