/**
 * FUND-16: Consistent form feedback pattern — reusable form field wrapper
 * with error display, success indicators, and character counts.
 */
import { cn } from "@/lib/utils";
import { AlertCircle, CheckCircle2 } from "lucide-react";

interface FormFeedbackProps {
  /** Error message (from Zod, react-hook-form, etc.) */
  error?: string | null;
  /** Show success indicator */
  success?: boolean;
  /** Helper text shown below the field */
  helperText?: string;
  /** Current character count */
  charCount?: number;
  /** Max character count */
  maxChars?: number;
  /** Additional class names */
  className?: string;
  children: React.ReactNode;
}

/**
 * FUND-16: Wraps a form field with consistent error/success/helper feedback.
 *
 * Usage:
 * ```tsx
 * <FormFeedback error={errors.name?.message} helperText="Min. 3 Zeichen">
 *   <Input {...register("name")} />
 * </FormFeedback>
 * ```
 */
export function FormFeedback({
  error,
  success,
  helperText,
  charCount,
  maxChars,
  className,
  children,
}: FormFeedbackProps) {
  const hasError = !!error;
  const showCharCount = charCount !== undefined && maxChars !== undefined;
  const charOverLimit = showCharCount && charCount > maxChars;

  return (
    <div className={cn("space-y-1", className)}>
      <div
        className={cn(
          "relative",
          hasError && "[&_input]:border-destructive [&_textarea]:border-destructive [&_select]:border-destructive",
          success && "[&_input]:border-green-500 [&_textarea]:border-green-500",
        )}
      >
        {children}
        {/* Success indicator */}
        {success && !hasError && (
          <CheckCircle2
            className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-green-500 pointer-events-none"
            aria-hidden="true"
          />
        )}
      </div>

      {/* Error message */}
      {hasError && (
        <div className="flex items-center gap-1.5 text-sm text-destructive" role="alert">
          <AlertCircle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          <span>{error}</span>
        </div>
      )}

      {/* Helper text + character count row */}
      <div className="flex items-center justify-between">
        {helperText && !hasError && (
          <p className="text-xs text-muted-foreground">{helperText}</p>
        )}
        {showCharCount && (
          <p
            className={cn(
              "text-xs ml-auto",
              charOverLimit ? "text-destructive font-medium" : "text-muted-foreground",
            )}
          >
            {charCount}/{maxChars}
          </p>
        )}
      </div>
    </div>
  );
}

/**
 * FUND-16: Form section header with description.
 */
export function FormSection({
  title,
  description,
  children,
  className,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <fieldset className={cn("space-y-4", className)}>
      <legend className="text-base font-semibold">{title}</legend>
      {description && (
        <p className="text-sm text-muted-foreground -mt-2">{description}</p>
      )}
      {children}
    </fieldset>
  );
}

/**
 * FUND-16: Inline validation status for real-time feedback.
 */
export function ValidationStatus({
  isValid,
  message,
}: {
  isValid: boolean;
  message: string;
}) {
  return (
    <div
      className={cn(
        "flex items-center gap-1.5 text-xs",
        isValid ? "text-green-600 dark:text-green-400" : "text-muted-foreground",
      )}
    >
      {isValid ? (
        <CheckCircle2 className="h-3 w-3" aria-hidden="true" />
      ) : (
        <div className="h-3 w-3 rounded-full border border-muted-foreground/50" />
      )}
      <span>{message}</span>
    </div>
  );
}
