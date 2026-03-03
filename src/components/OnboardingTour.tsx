/**
 * #11: Onboarding Tour — Lightweight guided tour for new users.
 * No external dependencies — pure React implementation with step-by-step tooltips.
 */
import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { X, ChevronRight, ChevronLeft } from "lucide-react";

interface TourStep {
  /** CSS selector of the target element */
  target: string;
  /** Title of the step */
  title: string;
  /** Description text */
  content: string;
  /** Position of the tooltip relative to the target */
  placement?: "top" | "bottom" | "left" | "right";
}

const TOUR_STEPS: TourStep[] = [
  {
    target: "[data-add-property]",
    title: "Objekt hinzufügen",
    content: "Klicke hier, um dein erstes Investmentobjekt anzulegen. Du kannst Adresse, Kaufpreis, Mieteinnahmen und mehr eingeben.",
    placement: "bottom",
  },
  {
    target: "[data-nav-portfolio]",
    title: "Portfolio-Übersicht",
    content: "Hier siehst du alle deine Objekte mit Kennzahlen wie Rendite, Cashflow und Wertentwicklung.",
    placement: "right",
  },
  {
    target: "[data-nav-loans]",
    title: "Darlehen verwalten",
    content: "Verwalte alle Kredite deiner Objekte — Zinsbindung, Tilgungsfortschritt und Refinanzierungsoptionen.",
    placement: "right",
  },
  {
    target: "[data-nav-rent]",
    title: "Mietübersicht",
    content: "Überprüfe Mieteingänge, verfolge offene Zahlungen und starte bei Bedarf das Mahnwesen.",
    placement: "right",
  },
  {
    target: "[data-nav-contacts]",
    title: "Kontakte",
    content: "Verwalte Handwerker, Hausverwaltungen und andere Kontakte zentral an einem Ort.",
    placement: "right",
  },
  {
    target: "[data-nav-settings]",
    title: "Einstellungen",
    content: "Passe die App an: Theme, 2FA, Tastenkürzel, Telegram-Integration und mehr.",
    placement: "right",
  },
];

const TOUR_STORAGE_KEY = "immocontrol_tour_completed";

export function OnboardingTour() {
  const [active, setActive] = useState(false);
  const [step, setStep] = useState(0);
  const [position, setPosition] = useState({ top: 0, left: 0 });

  useEffect(() => {
    try {
      const completed = localStorage.getItem(TOUR_STORAGE_KEY);
      if (!completed) {
        /* Delay tour start to let the page render */
        const timer = setTimeout(() => setActive(true), 2000);
        return () => clearTimeout(timer);
      }
    } catch { /* ignore */ }
  }, []);

  const updatePosition = useCallback(() => {
    if (!active || step >= TOUR_STEPS.length) return;
    const currentStep = TOUR_STEPS[step];
    const el = document.querySelector(currentStep.target);
    if (el) {
      const rect = el.getBoundingClientRect();
      const placement = currentStep.placement || "bottom";
      let top = 0;
      let left = 0;
      switch (placement) {
        case "bottom":
          top = rect.bottom + 12;
          left = rect.left + rect.width / 2 - 150;
          break;
        case "top":
          top = rect.top - 12 - 160;
          left = rect.left + rect.width / 2 - 150;
          break;
        case "right":
          top = rect.top + rect.height / 2 - 60;
          left = rect.right + 12;
          break;
        case "left":
          top = rect.top + rect.height / 2 - 60;
          left = rect.left - 12 - 300;
          break;
      }
      /* Keep tooltip in viewport */
      top = Math.max(8, Math.min(top, window.innerHeight - 200));
      left = Math.max(8, Math.min(left, window.innerWidth - 320));
      setPosition({ top, left });

      /* Highlight the target element */
      el.classList.add("ring-2", "ring-primary", "ring-offset-2", "z-50", "relative");
    }
  }, [active, step]);

  useEffect(() => {
    updatePosition();
    /* Clean up highlight from previous step */
    return () => {
      if (step > 0 && step <= TOUR_STEPS.length) {
        const prevStep = TOUR_STEPS[step - 1];
        if (prevStep) {
          const el = document.querySelector(prevStep.target);
          el?.classList.remove("ring-2", "ring-primary", "ring-offset-2", "z-50", "relative");
        }
      }
    };
  }, [step, active, updatePosition]);

  const closeTour = useCallback(() => {
    setActive(false);
    localStorage.setItem(TOUR_STORAGE_KEY, "true");
    /* Clean up all highlights */
    TOUR_STEPS.forEach((s) => {
      const el = document.querySelector(s.target);
      el?.classList.remove("ring-2", "ring-primary", "ring-offset-2", "z-50", "relative");
    });
  }, []);

  const nextStep = () => {
    /* Clean current highlight */
    const currentStep = TOUR_STEPS[step];
    const el = document.querySelector(currentStep.target);
    el?.classList.remove("ring-2", "ring-primary", "ring-offset-2", "z-50", "relative");

    if (step < TOUR_STEPS.length - 1) {
      setStep(step + 1);
    } else {
      closeTour();
    }
  };

  const prevStep = () => {
    if (step > 0) {
      const currentStep = TOUR_STEPS[step];
      const el = document.querySelector(currentStep.target);
      el?.classList.remove("ring-2", "ring-primary", "ring-offset-2", "z-50", "relative");
      setStep(step - 1);
    }
  };

  if (!active || step >= TOUR_STEPS.length) return null;

  const currentStep = TOUR_STEPS[step];

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/30 z-[998]" onClick={closeTour} />

      {/* Tooltip */}
      <div
        className="fixed z-[999] w-[300px] bg-card border border-border rounded-xl shadow-xl p-4 animate-fade-in"
        style={{ top: position.top, left: position.left }}
      >
        <div className="flex items-start justify-between mb-2">
          <h3 className="text-sm font-semibold">{currentStep.title}</h3>
          <button onClick={closeTour} className="text-muted-foreground hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
        </div>
        <p className="text-xs text-muted-foreground mb-4">{currentStep.content}</p>
        <div className="flex items-center justify-between">
          <span className="text-[10px] text-muted-foreground">
            {step + 1} / {TOUR_STEPS.length}
          </span>
          <div className="flex items-center gap-1.5">
            {step > 0 && (
              <Button variant="ghost" size="sm" className="h-7 text-xs gap-1" onClick={prevStep}>
                <ChevronLeft className="h-3 w-3" /> Zurück
              </Button>
            )}
            <Button size="sm" className="h-7 text-xs gap-1" onClick={nextStep}>
              {step === TOUR_STEPS.length - 1 ? "Fertig" : "Weiter"}
              {step < TOUR_STEPS.length - 1 && <ChevronRight className="h-3 w-3" />}
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}

/** Restart the tour from settings */
export function restartOnboardingTour() {
  localStorage.removeItem(TOUR_STORAGE_KEY);
  window.location.reload();
}
