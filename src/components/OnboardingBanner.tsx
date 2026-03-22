import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Building2, Users, Calculator, CreditCard, CheckCircle2, ArrowRight, X, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useProperties } from "@/context/PropertyContext";
import { ROUTES, objekteWithAdd } from "@/lib/routes";

const ONBOARDING_KEY = "immocontrol_onboarding_dismissed";

interface OnboardingStep {
  icon: typeof Building2;
  title: string;
  description: string;
  action?: string;
  path?: string;
  complete?: boolean;
}

export const OnboardingBanner = () => {
  const { properties } = useProperties();
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    const stored = localStorage.getItem(ONBOARDING_KEY);
    if (!stored) setDismissed(false);
  }, []);

  if (dismissed) return null;

  const steps: OnboardingStep[] = [
    {
      icon: Building2,
      title: "Objekt hinzufügen",
      description: "Füge dein erstes Investmentobjekt mit allen Finanzdaten hinzu.",
      action: "Objekt anlegen",
      path: objekteWithAdd(),
      complete: properties.length > 0,
    },
    {
      icon: Users,
      title: "Mieter verwalten",
      description: "Hinterlege Mieter und lade sie zum Mieterportal ein.",
      complete: false,
    },
    {
      icon: CreditCard,
      title: "Zahlungen erfassen",
      description: "Nutze die automatische Mietbuchung oder erfasse Zahlungen manuell.",
      complete: false,
    },
    {
      icon: Calculator,
      title: "Analyse nutzen",
      description: "Bewerte neue Objekte mit dem Investitionsrechner.",
      action: "Zum Rechner",
      path: ROUTES.ANALYSE,
      complete: false,
    },
  ];

  const completedCount = steps.filter(s => s.complete).length;
  const allDone = completedCount === steps.length;

  const dismiss = () => {
    localStorage.setItem(ONBOARDING_KEY, "true");
    setDismissed(true);
  };

  return (
    <div className="gradient-card rounded-xl border border-primary/25 p-5 md:p-6 animate-fade-in relative shadow-[var(--surface-elevate)] card-depth-hover">
      <button
        onClick={dismiss}
        className="absolute top-3 right-3 text-muted-foreground hover:text-foreground transition-colors"
      >
        <X className="h-4 w-4" />
      </button>

      <div className="mb-4">
        <h2 className="text-base font-semibold tracking-tight">Willkommen bei ImmoControl 🏠</h2>
        <p className="text-sm text-muted-foreground mt-1.5">
          {allDone
            ? "Du hast alle Schritte abgeschlossen! 🎉"
            : `Schritt ${completedCount + 1} von ${steps.length} — ${Math.round((completedCount / steps.length) * 100)}% abgeschlossen`
          }
        </p>
        <div className="flex gap-1 mt-2">
          {steps.map((_, i) => (
            <div
              key={i}
              className={`h-1 flex-1 rounded-full ${i < completedCount ? "bg-profit" : i === completedCount ? "bg-primary" : "bg-secondary"}`}
            />
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {steps.map((step, i) => {
          const Icon = step.icon;
          return (
            <div
              key={i}
              className={`p-3 rounded-lg border transition-colors ${
                step.complete
                  ? "bg-profit/5 border-profit/20"
                  : i === completedCount
                  ? "bg-primary/5 border-primary/20"
                  : "bg-secondary/50 border-border/50"
              }`}
            >
              <div className="flex items-center gap-2 mb-1.5">
                {step.complete ? (
                  <CheckCircle2 className="h-4 w-4 text-profit shrink-0" />
                ) : (
                  <Icon className={`h-4 w-4 shrink-0 ${i === completedCount ? "text-primary" : "text-muted-foreground"}`} />
                )}
                <span className={`text-xs font-semibold ${step.complete ? "text-profit" : ""}`}>
                  {step.title}
                </span>
              </div>
              <p className="text-[10px] text-muted-foreground leading-relaxed">{step.description}</p>
              {step.action && step.path && !step.complete && i === completedCount && (
                <a href={step.path} className="inline-flex items-center gap-1 text-[10px] text-primary font-medium mt-2 hover:underline">
                  {step.action} <ArrowRight className="h-3 w-3" />
                </a>
              )}
            </div>
          );
        })}
      </div>

      {properties.length === 0 && (
        <Link to={ROUTES.ONBOARDING} className="inline-flex items-center gap-1.5 mt-3 text-xs text-primary font-medium hover:underline">
          <Sparkles className="h-3.5 w-3.5" /> Geführtes Onboarding starten
          <ArrowRight className="h-3 w-3" />
        </Link>
      )}
      {allDone && (
        <Button size="sm" variant="outline" className="mt-3 text-xs" onClick={dismiss}>
          Onboarding schließen
        </Button>
      )}
    </div>
  );
};
