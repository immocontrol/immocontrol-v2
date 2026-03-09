/**
 * Steuer-Cockpit — zentrale Steuerübersicht für Immobilieninvestoren.
 * Anlage V, AfA, Verlustverrechnung, Veräußerungsgewinn-Simulation.
 */
import { useEffect } from "react";
import { Link } from "react-router-dom";
import { Receipt, FileBarChart, ChevronRight, Scale, RefreshCw } from "lucide-react";
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
      <div className="max-w-xl mx-auto px-4 py-8" role="main" aria-label="Steuer-Cockpit">
        <EmptyState
          icon={Receipt}
          title="Keine Objekte"
          description="Steuer-Übersichten basieren auf deinen Objekten. Lege zuerst ein Objekt an."
          action={
            <Button size="sm" onClick={() => navigate(ROUTES.OBJEKTE)}>
              Objekte anlegen
            </Button>
          }
        />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-3xl mx-auto px-4 py-6" role="main" aria-label="Steuer-Cockpit">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold tracking-tight flex items-center gap-2">
          <Receipt className="h-5 w-5 sm:h-6 sm:w-6 text-primary" /> Steuer-Cockpit
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Anlage V, AfA, Verlustverrechnung und Veräußerungsgewinn auf einen Blick
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button variant="outline" size="sm" asChild>
          <Link to={ROUTES.REPORTS} className="gap-1.5 touch-target min-h-[36px]">
            <FileBarChart className="h-3.5 w-3.5" /> Berichte-Center
            <ChevronRight className="h-3 w-3" />
          </Link>
        </Button>
        <Button variant="outline" size="sm" asChild>
          <Link to={ROUTES.MIETSPIEGEL} className="gap-1.5 touch-target min-h-[36px]" aria-label="Mietspiegel-Check">
            <Scale className="h-3.5 w-3.5" /> Mietspiegel-Check
          </Link>
        </Button>
        <Button variant="outline" size="sm" asChild>
          <Link to={ROUTES.REFINANZIERUNG} className="gap-1.5 touch-target min-h-[36px]" aria-label="Refinanzierung">
            <RefreshCw className="h-3.5 w-3.5" /> Refinanzierung
          </Link>
        </Button>
      </div>

      <SteuerCockpit />
      <SteuerOptimierung />
      <ExitStrategiePlaner />
    </div>
  );
};

export default SteuerCockpitPage;
