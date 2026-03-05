/**
 * MOB2-4: Touch-optimierte Formulare (Fullscreen Wizard)
 * On mobile, complex forms become fullscreen step-by-step wizards.
 * One field per page, progress bar, swipe navigation between steps.
 */
import { memo, useState, useCallback, useRef } from "react";
import { ArrowLeft, ArrowRight, Check, X } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";
import { useHaptic } from "@/hooks/useHaptic";
import { cn } from "@/lib/utils";

export interface FormField {
  id: string;
  label: string;
  /** Hint text below the input */
  hint?: string;
  /** The rendered input element */
  render: (props: { autoFocus: boolean }) => React.ReactNode;
  /** Whether this field is required */
  required?: boolean;
  /** Validation function — return error string or null */
  validate?: (value: unknown) => string | null;
}

interface MobileFullscreenFormProps {
  open: boolean;
  onClose: () => void;
  onSubmit: () => void;
  title: string;
  fields: FormField[];
  /** Current step (controlled) */
  currentStep?: number;
  onStepChange?: (step: number) => void;
  /** Whether to show the submit button on the last step */
  submitLabel?: string;
  loading?: boolean;
  className?: string;
}

export const MobileFullscreenForm = memo(function MobileFullscreenForm({
  open, onClose, onSubmit, title, fields,
  currentStep: controlledStep, onStepChange,
  submitLabel = "Speichern", loading = false, className,
}: MobileFullscreenFormProps) {
  const isMobile = useIsMobile();
  const haptic = useHaptic();
  const [internalStep, setInternalStep] = useState(0);
  const touchStartX = useRef(0);
  const touchStartY = useRef(0);

  const step = controlledStep ?? internalStep;
  const setStep = onStepChange ?? setInternalStep;
  const totalSteps = fields.length;
  const isLastStep = step >= totalSteps - 1;
  const progress = totalSteps > 0 ? ((step + 1) / totalSteps) * 100 : 0;

  const goNext = useCallback(() => {
    if (isLastStep) {
      haptic.success();
      onSubmit();
    } else {
      haptic.tap();
      setStep(step + 1);
    }
  }, [step, isLastStep, haptic, onSubmit, setStep]);

  const goPrev = useCallback(() => {
    if (step > 0) {
      haptic.tap();
      setStep(step - 1);
    }
  }, [step, haptic, setStep]);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
  }, []);

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    const diffX = e.changedTouches[0].clientX - touchStartX.current;
    const diffY = e.changedTouches[0].clientY - touchStartY.current;
    if (Math.abs(diffY) > Math.abs(diffX)) return;
    if (diffX > 80) goPrev();
    else if (diffX < -80) goNext();
  }, [goNext, goPrev]);

  if (!open || !isMobile) return null;

  const currentField = fields[step];
  if (!currentField) return null;

  return (
    <div className={cn("fixed inset-0 z-[300] bg-background flex flex-col", className)}>
      {/* Header */}
      <div className="shrink-0 flex items-center justify-between px-4 py-3 border-b border-border">
        <button onClick={onClose} className="p-2 -ml-2 rounded-lg hover:bg-secondary" aria-label="Schließen">
          <X className="h-5 w-5" />
        </button>
        <span className="text-sm font-semibold">{title}</span>
        <span className="text-xs text-muted-foreground">{step + 1}/{totalSteps}</span>
      </div>

      {/* Progress bar */}
      <div className="shrink-0 h-1 bg-secondary">
        <div
          className="h-full bg-primary transition-all duration-300 ease-out"
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* Field content */}
      <div
        className="flex-1 flex flex-col justify-center px-6 py-8"
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        <label className="text-lg font-semibold mb-2">{currentField.label}</label>
        {currentField.hint && (
          <p className="text-sm text-muted-foreground mb-4">{currentField.hint}</p>
        )}
        <div className="w-full">
          {currentField.render({ autoFocus: true })}
        </div>
      </div>

      {/* Navigation */}
      <div className="shrink-0 flex items-center gap-3 px-4 py-4 border-t border-border"
        style={{ paddingBottom: "calc(1rem + env(safe-area-inset-bottom, 0px))" }}
      >
        <button
          onClick={goPrev}
          disabled={step === 0}
          className="flex items-center gap-1 px-4 py-3 rounded-xl text-sm font-medium text-muted-foreground hover:bg-secondary disabled:opacity-30 transition-all"
        >
          <ArrowLeft className="h-4 w-4" /> Zurück
        </button>
        <button
          onClick={goNext}
          disabled={loading}
          className={cn(
            "flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-medium transition-all active:scale-[0.98]",
            isLastStep
              ? "bg-primary text-primary-foreground"
              : "bg-secondary text-foreground hover:bg-secondary/80",
          )}
        >
          {isLastStep ? (
            <>{loading ? "Speichere..." : submitLabel} <Check className="h-4 w-4" /></>
          ) : (
            <>Weiter <ArrowRight className="h-4 w-4" /></>
          )}
        </button>
      </div>
    </div>
  );
});
