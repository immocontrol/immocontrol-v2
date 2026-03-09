/**
 * Mietspiegel- und Markt-Check — Ist-Miete vs. ortsüblich,
 * Umsetzungspotenzial bei Mieterhöhung.
 */
import { useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Scale, Receipt, RefreshCw, ShieldAlert, FileText } from "lucide-react";
import { MietspiegelCheck } from "@/components/MietspiegelCheck";
import { useProperties } from "@/context/PropertyContext";
import { ROUTES } from "@/lib/routes";
import { EmptyState } from "@/components/EmptyState";
import { Button } from "@/components/ui/button";

const MietspiegelPage = () => {
  const { properties } = useProperties();
  const navigate = useNavigate();

  useEffect(() => {
    document.title = "Mietspiegel-Check – ImmoControl";
  }, []);

  if (properties.length === 0) {
    return (
      <div className="max-w-xl mx-auto px-4 py-8" role="main" aria-label="Mietspiegel-Check">
        <EmptyState
          icon={Scale}
          title="Keine Objekte"
          description="Mietspiegel-Check basiert auf deinen Objekten. Lege zuerst Objekte an."
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
    <div className="space-y-6 max-w-3xl mx-auto px-4 py-6" role="main" aria-label="Mietspiegel-Check">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold tracking-tight flex items-center gap-2">
          <Scale className="h-5 w-5 sm:h-6 sm:w-6 text-primary" /> Mietspiegel-Check
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Ist-Miete vs. ortsüblich — Umsetzungspotenzial bei Mieterhöhung (§558 BGB)
        </p>
        <div className="flex flex-wrap gap-2 mt-3">
          <Button variant="outline" size="sm" asChild>
            <Link to={ROUTES.STEUER_COCKPIT} className="gap-1.5 touch-target min-h-[36px]" aria-label="Steuer-Cockpit">
              <Receipt className="h-3.5 w-3.5" /> Steuer-Cockpit
            </Link>
          </Button>
          <Button variant="outline" size="sm" asChild>
            <Link to={ROUTES.REFINANZIERUNG} className="gap-1.5 touch-target min-h-[36px]" aria-label="Refinanzierung">
              <RefreshCw className="h-3.5 w-3.5" /> Refinanzierung
            </Link>
          </Button>
          <Button variant="outline" size="sm" asChild>
            <Link to={ROUTES.STRESS_TEST} className="gap-1.5 touch-target min-h-[36px]" aria-label="Stress-Test">
              <ShieldAlert className="h-3.5 w-3.5" /> Stress-Test
            </Link>
          </Button>
          <Button variant="outline" size="sm" asChild>
            <Link to={ROUTES.CONTRACTS} className="gap-1.5 touch-target min-h-[36px]" aria-label="Verträge (Mieterhöhung §558)">
              <FileText className="h-3.5 w-3.5" /> Verträge
            </Link>
          </Button>
        </div>
      </div>

      <MietspiegelCheck defaultMietspiegelPerSqm={12} />
    </div>
  );
};

export default MietspiegelPage;
