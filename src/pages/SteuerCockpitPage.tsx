/**
 * Steuer-Cockpit — zentrale Steuerübersicht für Immobilieninvestoren.
 * Anlage V, AfA, Verlustverrechnung, Veräußerungsgewinn-Simulation.
 */
import { useEffect } from "react";
import { Link } from "react-router-dom";
import { Receipt, FileBarChart, ChevronRight, Scale, RefreshCw, Building2 } from "lucide-react";
import { SteuerCockpit } from "@/components/SteuerCockpit";
import { SteuerOptimierung } from "@/components/SteuerOptimierung";
import { ExitStrategiePlaner } from "@/components/ExitStrategiePlaner";
import { useProperties } from "@/context/PropertyContext";
import { ROUTES } from "@/lib/routes";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/EmptyState";
import { useNavigate } from "react-router-dom";

const SteuerCockpitPage = () => {
  const { properties } = useProperties();
  const navigate = useNavigate();

  useEffect(() => {
    document.title = "Steuer-Cockpit – ImmoControl";
  }, []);

  if (properties.length === 0) {
    return (
      <div className="max-w-xl mx-auto px-4 py-8 min-w-0" role="main" aria-label="Steuer-Cockpit">
        <EmptyState
          icon={Receipt}
          title="Keine Objekte"
          description="Steuer-Übersichten basieren auf deinen Objekten. Lege zuerst ein Objekt an."
          action={
            <Button size="sm" className="touch-target min-h-[44px] gap-1.5" onClick={() => navigate(ROUTES.OBJEKTE)}>
              <Building2 className="h-4 w-4 shrink-0" /> Objekte anlegen
            </Button>
          }
        />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-3xl mx-auto px-4 py-6 min-w-0" role="main" aria-label="Steuer-Cockpit">
      <div className="min-w-0">
        <h1 className="text-xl sm:text-2xl font-bold tracking-tight flex items-center gap-2">
          <Receipt className="h-5 w-5 sm:h-6 sm:w-6 text-primary shrink-0" /> Steuer-Cockpit
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Anlage V, AfA, Verlustverrechnung und Veräußerungsgewinn auf einen Blick
        </p>
      </div>

      <div className="flex flex-wrap gap-2 min-w-0">
        <Button variant="outline" size="sm" asChild className="touch-target min-h-[44px]">
          <Link to={ROUTES.REPORTS} className="gap-1.5">
            <FileBarChart className="h-3.5 w-3.5 shrink-0" /> Berichte-Center
            <ChevronRight className="h-3 w-3 shrink-0" />
          </Link>
        </Button>
        <Button variant="outline" size="sm" asChild className="touch-target min-h-[44px]">
          <Link to={ROUTES.MIETSPIEGEL} className="gap-1.5" aria-label="Mietspiegel-Check">
            <Scale className="h-3.5 w-3.5 shrink-0" /> Mietspiegel-Check
          </Link>
        </Button>
        <Button variant="outline" size="sm" asChild className="touch-target min-h-[44px]">
          <Link to={ROUTES.REFINANZIERUNG} className="gap-1.5" aria-label="Refinanzierung">
            <RefreshCw className="h-3.5 w-3.5 shrink-0" /> Refinanzierung
          </Link>
        </Button>
      </div>

      <div className="min-w-0 space-y-6">
        <SteuerCockpit />
        <SteuerOptimierung />
        <ExitStrategiePlaner />
      </div>
    </div>
  );
};

export default SteuerCockpitPage;
