/**
 * MOB-7: Mobile-First Formular-Wizard
 * Fullscreen wizard with one field per page on mobile.
 * Large touch targets, progress bar, swipe navigation between steps.
 */
import { memo, useState, useCallback, useRef, useEffect } from "react";
import { ArrowLeft, ArrowRight, Check, X } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";
import { useHaptic } from "@/hooks/useHaptic";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface WizardStep {
  id: string;
  label: string;
  /** Whether this step is required */
  required?: boolean;
  /** Content to render for this step */
  content: React.ReactNode;
  /** Validate step before moving forward — return error string or null */
  validate?: () => string | null;
}

interface MobileFormWizardProps {
  steps: WizardStep[];
  onComplete: () => void;
  onCancel: () => void;
  title: string;
  /** Submit button label */
  submitLabel?: string;
  className?: string;
}

export const MobileFormWizard = memo(function MobileFormWizard({
  steps, onComplete, onCancel, title, submitLabel = "Speichern", className,
}: MobileFormWizardProps) {
  const isMobile = useIsMobile();
  const haptic = useHaptic();
  const [currentStep, setCurrentStep] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  // Auto-focus first input in current step
  useEffect(() => {
    if (!contentRef.current) return;
    const timer = setTimeout(() => {
      const input = contentRef.current?.querySelector<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>(
        "input:not([type=hidden]), textarea, select"
      );
      if (input && isMobile) {
        input.focus();
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [currentStep, isMobile]);

  const goNext = useCallback(() => {
    const step = steps[currentStep];
    if (step.validate) {
      const validationError = step.validate();
      if (validationError) {
        setError(validationError);
        haptic.error();
        return;
      }
    }
    setError(null);
    haptic.tap();
    if (currentStep < steps.length - 1) {
      setCurrentStep(prev => prev + 1);
    } else {
      haptic.success();
      onComplete();
    }
  }, [currentStep, steps, haptic, onComplete]);

  const goBack = useCallback(() => {
    setError(null);
    haptic.tap();
    if (currentStep > 0) {
      setCurrentStep(prev => prev - 1);
    } else {
      onCancel();
    }
  }, [currentStep, haptic, onCancel]);

  // Touch swipe handling for step navigation
  const touchStart = useRef<{ x: number; y: number } | null>(null);
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    touchStart.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
  }, []);

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    if (!touchStart.current) return;
    const diffX = e.changedTouches[0].clientX - touchStart.current.x;
    const diffY = e.changedTouches[0].clientY - touchStart.current.y;
    touchStart.current = null;

    if (Math.abs(diffX) < 60 || Math.abs(diffY) > Math.abs(diffX)) return;

    if (diffX > 0) {
      goBack(); // Swipe right = go back
    } else {
      goNext(); // Swipe left = go forward
    }
  }, [goBack, goNext]);

  if (!isMobile) {
    // Desktop: render all steps at once
    return (
      <div className={className}>
        {steps.map((step) => (
          <div key={step.id} className="mb-4">
            {step.content}
          </div>
        ))}
      </div>
    );
  }

  const progress = ((currentStep + 1) / steps.length) * 100;
  const step = steps[currentStep];
  const isLastStep = currentStep === steps.length - 1;

  return (
    <div
      className={cn("fixed inset-0 z-[250] bg-background flex flex-col", className)}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      {/* Header with progress */}
      <div className="sticky top-0 z-10 bg-background border-b border-border">
        <div className="flex items-center justify-between px-4 py-3">
          <button onClick={goBack} className="p-2 -ml-2 rounded-full hover:bg-secondary active:scale-95">
            {currentStep === 0 ? <X className="h-5 w-5" /> : <ArrowLeft className="h-5 w-5" />}
          </button>
          <span className="text-sm font-semibold">{title}</span>
          <span className="text-xs text-muted-foreground">{currentStep + 1}/{steps.length}</span>
        </div>
        {/* Progress bar */}
        <div className="h-1 bg-secondary">
          <div
            className="h-full bg-primary transition-all duration-300 rounded-r-full"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Step content */}
      <div ref={contentRef} className="flex-1 overflow-y-auto px-5 py-6">
        <div className="mb-3">
          <h3 className="text-lg font-bold">{step.label}</h3>
          {step.required && (
            <span className="text-[10px] text-muted-foreground">Pflichtfeld</span>
          )}
        </div>

        {/* Step content */}
        <div className="space-y-4">
          {step.content}
        </div>

        {/* Error message */}
        {error && (
          <div className="mt-3 text-sm text-destructive bg-destructive/10 rounded-lg px-3 py-2 animate-fade-in">
            {error}
          </div>
        )}
      </div>

      {/* Footer with navigation buttons */}
      <div className="sticky bottom-0 bg-background border-t border-border px-5 py-4" style={{ paddingBottom: "calc(1rem + env(safe-area-inset-bottom, 0px))" }}>
        <div className="flex gap-3">
          {currentStep > 0 && (
            <Button variant="outline" onClick={goBack} className="flex-1 h-12 text-base">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Zurück
            </Button>
          )}
          <Button onClick={goNext} className="flex-1 h-12 text-base">
            {isLastStep ? (
              <>
                <Check className="h-4 w-4 mr-2" />
                {submitLabel}
              </>
            ) : (
              <>
                Weiter
                <ArrowRight className="h-4 w-4 ml-2" />
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
});
