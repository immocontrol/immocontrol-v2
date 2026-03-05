/**
 * MOB6-9: Mobile Contextual Help
 * Context-sensitive help tooltips with coach marks for onboarding and feature discovery.
 * Guides users through new features with step-by-step highlights.
 */
import { useState, useCallback, useRef, useEffect, memo } from "react";
import { useIsMobile } from "@/hooks/use-mobile";
import { HelpCircle, X, ChevronLeft, ChevronRight, Lightbulb, Check } from "lucide-react";
import { cn } from "@/lib/utils";

export interface CoachMark {
  /** Unique ID */
  id: string;
  /** CSS selector for the target element */
  targetSelector: string;
  /** Title */
  title: string;
  /** Description */
  description: string;
  /** Position relative to target */
  position?: "top" | "bottom" | "left" | "right";
  /** Optional action button */
  action?: { label: string; onClick: () => void };
}

interface MobileContextualHelpProps {
  /** Coach marks to show */
  marks: CoachMark[];
  /** Called when tour is completed */
  onComplete?: () => void;
  /** Called when tour is skipped */
  onSkip?: () => void;
  /** Whether to start the tour automatically */
  autoStart?: boolean;
  /** LocalStorage key to track completion */
  storageKey?: string;
  /** Additional class */
  className?: string;
}

interface TargetRect {
  top: number;
  left: number;
  width: number;
  height: number;
}

export const MobileContextualHelp = memo(function MobileContextualHelp({
  marks,
  onComplete,
  onSkip,
  autoStart = false,
  storageKey,
  className,
}: MobileContextualHelpProps) {
  const isMobile = useIsMobile();
  const [isActive, setIsActive] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [targetRect, setTargetRect] = useState<TargetRect | null>(null);
  const observerRef = useRef<ResizeObserver | null>(null);

  // Check if already completed
  useEffect(() => {
    if (storageKey) {
      try {
        const completed = localStorage.getItem(`help_${storageKey}`);
        if (completed === "true") return;
      } catch {
        // localStorage not available
      }
    }
    if (autoStart && marks.length > 0) {
      // Delay start to let page render
      const timer = setTimeout(() => setIsActive(true), 1000);
      return () => clearTimeout(timer);
    }
  }, [autoStart, marks.length, storageKey]);

  // Update target position
  useEffect(() => {
    if (!isActive || marks.length === 0) return;

    const mark = marks[currentStep];
    if (!mark) return;

    const updatePosition = () => {
      const el = document.querySelector(mark.targetSelector);
      if (el) {
        const rect = el.getBoundingClientRect();
        setTargetRect({
          top: rect.top,
          left: rect.left,
          width: rect.width,
          height: rect.height,
        });
        // Scroll into view
        el.scrollIntoView({ behavior: "smooth", block: "center" });
      } else {
        setTargetRect(null);
      }
    };

    updatePosition();

    // Observe resize
    const el = document.querySelector(mark.targetSelector);
    if (el) {
      observerRef.current = new ResizeObserver(updatePosition);
      observerRef.current.observe(el);
    }

    window.addEventListener("scroll", updatePosition, { passive: true });
    window.addEventListener("resize", updatePosition);

    return () => {
      observerRef.current?.disconnect();
      window.removeEventListener("scroll", updatePosition);
      window.removeEventListener("resize", updatePosition);
    };
  }, [isActive, currentStep, marks]);

  const handleNext = useCallback(() => {
    if (currentStep < marks.length - 1) {
      setCurrentStep(prev => prev + 1);
    } else {
      // Complete
      setIsActive(false);
      if (storageKey) {
        try { localStorage.setItem(`help_${storageKey}`, "true"); } catch { /* noop */ }
      }
      onComplete?.();
    }
  }, [currentStep, marks.length, onComplete, storageKey]);

  const handlePrev = useCallback(() => {
    if (currentStep > 0) {
      setCurrentStep(prev => prev - 1);
    }
  }, [currentStep]);

  const handleSkip = useCallback(() => {
    setIsActive(false);
    if (storageKey) {
      try { localStorage.setItem(`help_${storageKey}`, "true"); } catch { /* noop */ }
    }
    onSkip?.();
  }, [onSkip, storageKey]);

  const startTour = useCallback(() => {
    setCurrentStep(0);
    setIsActive(true);
  }, []);

  const currentMark = marks[currentStep];

  // Tooltip position calculation
  const getTooltipStyle = (): React.CSSProperties => {
    if (!targetRect || !currentMark) return {};
    const pos = currentMark.position || "bottom";
    const padding = 12;

    switch (pos) {
      case "top":
        return {
          position: "absolute",
          left: targetRect.left,
          top: targetRect.top - padding,
          transform: "translateY(-100%)",
          maxWidth: "280px",
        };
      case "bottom":
        return {
          position: "absolute",
          left: targetRect.left,
          top: targetRect.top + targetRect.height + padding,
          maxWidth: "280px",
        };
      case "left":
        return {
          position: "absolute",
          left: targetRect.left - padding,
          top: targetRect.top,
          transform: "translateX(-100%)",
          maxWidth: "240px",
        };
      case "right":
        return {
          position: "absolute",
          left: targetRect.left + targetRect.width + padding,
          top: targetRect.top,
          maxWidth: "240px",
        };
      default:
        return {};
    }
  };

  return (
    <>
      {/* Help trigger button (when not active) */}
      {!isActive && marks.length > 0 && (
        <button
          onClick={startTour}
          className={cn(
            "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs",
            "hover:bg-muted active:bg-muted/80 transition-colors border",
            isMobile && "min-h-[44px]",
            className
          )}
          aria-label="Hilfe starten"
        >
          <HelpCircle className="w-4 h-4 text-muted-foreground" />
          <span>Einführung</span>
        </button>
      )}

      {/* Coach mark overlay */}
      {isActive && currentMark && (
        <div className="fixed inset-0 z-[100]">
          {/* Backdrop with spotlight cutout */}
          <div className="absolute inset-0 bg-black/50" onClick={handleSkip} />

          {/* Target highlight */}
          {targetRect && (
            <div
              className="absolute border-2 border-primary rounded-lg pointer-events-none"
              style={{
                top: targetRect.top - 4,
                left: targetRect.left - 4,
                width: targetRect.width + 8,
                height: targetRect.height + 8,
                boxShadow: "0 0 0 9999px rgba(0,0,0,0.5)",
              }}
            />
          )}

          {/* Tooltip */}
          <div
            style={getTooltipStyle()}
            className="z-[101] animate-in fade-in slide-in-from-bottom-2 duration-300"
          >
            <div className={cn(
              "rounded-xl bg-background border shadow-2xl overflow-hidden",
              isMobile ? "mx-3" : ""
            )}>
              {/* Header */}
              <div className="flex items-center justify-between px-3 py-2 bg-primary/5">
                <div className="flex items-center gap-1.5">
                  <Lightbulb className="w-3.5 h-3.5 text-primary" />
                  <span className="text-[10px] font-medium text-primary">
                    Schritt {currentStep + 1} von {marks.length}
                  </span>
                </div>
                <button
                  onClick={handleSkip}
                  className="p-1 rounded hover:bg-muted"
                  aria-label="Überspringen"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Content */}
              <div className="px-3 py-2.5">
                <h3 className="text-sm font-semibold">{currentMark.title}</h3>
                <p className="text-xs text-muted-foreground mt-1">{currentMark.description}</p>
                {currentMark.action && (
                  <button
                    onClick={currentMark.action.onClick}
                    className="text-xs text-primary font-medium mt-2 hover:underline"
                  >
                    {currentMark.action.label}
                  </button>
                )}
              </div>

              {/* Navigation */}
              <div className="flex items-center justify-between px-3 py-2 border-t">
                <button
                  onClick={handleSkip}
                  className={cn(
                    "text-[10px] text-muted-foreground hover:text-foreground",
                    isMobile && "min-h-[36px] flex items-center"
                  )}
                >
                  Überspringen
                </button>
                <div className="flex items-center gap-1.5">
                  {currentStep > 0 && (
                    <button
                      onClick={handlePrev}
                      className={cn(
                        "p-1.5 rounded-lg hover:bg-muted transition-colors",
                        isMobile && "min-w-[36px] min-h-[36px] flex items-center justify-center"
                      )}
                      aria-label="Zurück"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                  )}
                  <button
                    onClick={handleNext}
                    className={cn(
                      "flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium",
                      "bg-primary text-primary-foreground hover:bg-primary/90",
                      isMobile && "min-h-[36px]"
                    )}
                  >
                    {currentStep === marks.length - 1 ? (
                      <>
                        <Check className="w-3 h-3" />
                        Fertig
                      </>
                    ) : (
                      <>
                        Weiter
                        <ChevronRight className="w-3 h-3" />
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Step dots */}
              <div className="flex justify-center gap-1 pb-2">
                {marks.map((_, i) => (
                  <div
                    key={i}
                    className={cn(
                      "w-1.5 h-1.5 rounded-full transition-colors",
                      i === currentStep ? "bg-primary" : i < currentStep ? "bg-primary/40" : "bg-muted-foreground/20"
                    )}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
});
