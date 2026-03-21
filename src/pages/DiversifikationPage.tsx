/**
 * Portfolio-Diversifikation — Verteilung nach Region, Objekttyp,
 * Mieterkonzentration, Risiko-Indikatoren.
 */
import { useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { PieChart, ShieldAlert, Scale } from "lucide-react";
import { PortfolioDiversifikation } from "@/components/PortfolioDiversifikation";
import { useProperties } from "@/context/PropertyContext";
import { ROUTES } from "@/lib/routes";
import { EmptyState } from "@/components/EmptyState";
import { Button } from "@/components/ui/button";
import { PageHeader, PageHeaderActions, PageHeaderDescription, PageHeaderMain, PageHeaderTitle } from "@/components/ui/page-header";

const DiversifikationPage = () => {
  const { properties } = useProperties();
  const navigate = useNavigate();

  useEffect(() => {
    document.title = "Portfolio-Diversifikation – ImmoControl";
  }, []);

  if (properties.length === 0) {
    return (
      <div className="max-w-xl mx-auto px-4 py-8" role="main" aria-label="Portfolio-Diversifikation">
        <EmptyState
          icon={PieChart}
          title="Keine Objekte"
          description="Diversifikation basiert auf deinem Portfolio. Lege zuerst Objekte an."
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
    <div className="space-y-6 max-w-3xl mx-auto px-4 py-6" role="main" aria-label="Portfolio-Diversifikation">
      <PageHeader>
        <PageHeaderMain>
          <PageHeaderTitle>
            <PieChart className="h-5 w-5 sm:h-6 sm:w-6 text-primary shrink-0" /> Portfolio-Diversifikation
          </PageHeaderTitle>
          <PageHeaderDescription>
            Verteilung nach Region, Objekttyp und Mieterkonzentration — Risiko im Blick
          </PageHeaderDescription>
        </PageHeaderMain>
        <PageHeaderActions>
          <Button variant="outline" size="sm" asChild>
            <Link to={ROUTES.STRESS_TEST} className="gap-1.5 touch-target min-h-[36px]" aria-label="Stress-Test">
              <ShieldAlert className="h-3.5 w-3.5" /> Stress-Test
            </Link>
          </Button>
          <Button variant="outline" size="sm" asChild>
            <Link to={ROUTES.MIETSPIEGEL} className="gap-1.5 touch-target min-h-[36px]" aria-label="Mietspiegel-Check">
              <Scale className="h-3.5 w-3.5" /> Mietspiegel-Check
            </Link>
          </Button>
        </PageHeaderActions>
      </PageHeader>

      <PortfolioDiversifikation />
    </div>
  );
};

export default DiversifikationPage;
