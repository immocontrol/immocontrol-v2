/**
 * MOB4-10: Mobile Inline Edit Mode
 * Tap on a value to edit it directly without opening a dialog.
 * Saves dialog open/close overhead on small screens.
 */
import { useState, useRef, useCallback, useEffect, memo, type ReactNode } from "react";
import { useIsMobile } from "@/hooks/use-mobile";
import { Check, X, Pencil } from "lucide-react";
import { cn } from "@/lib/utils";
import { useHaptic } from "@/hooks/useHaptic";

interface MobileInlineEditProps {
  /** Current display value */
  value: string;
  /** Called when edit is confirmed */
  onSave: (newValue: string) => void | Promise<void>;
  /** Input type */
  type?: "text" | "number" | "email" | "tel";
  /** Placeholder when empty */
  placeholder?: string;
  /** Label above the value */
  label?: string;
  /** Whether editing is allowed */
  editable?: boolean;
  /** Additional class */
  className?: string;
  /** Display formatter (e.g. currency formatting) */
  formatDisplay?: (value: string) => ReactNode;
  /** Validation function */
  validate?: (value: string) => string | null;
  /** Input suffix (e.g. "€", "%") */
  suffix?: string;
}

export const MobileInlineEdit = memo(function MobileInlineEdit({
  value,
  onSave,
  type = "text",
  placeholder = "Tippen zum Bearbeiten",
  label,
  editable = true,
  className,
  formatDisplay,
  validate,
  suffix,
}: MobileInlineEditProps) {
  const isMobile = useIsMobile();
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(value);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const haptic = useHaptic();

  // Sync when value changes externally
  useEffect(() => {
    if (!isEditing) {
      setEditValue(value);
    }
  }, [value, isEditing]);

  const startEditing = useCallback(() => {
    if (!editable) return;
    haptic.tap();
    setIsEditing(true);
    setEditValue(value);
    setError(null);
    // Focus after render
    requestAnimationFrame(() => {
      inputRef.current?.focus();
      inputRef.current?.select();
    });
  }, [editable, value, haptic]);

  const cancelEditing = useCallback(() => {
    setIsEditing(false);
    setEditValue(value);
    setError(null);
  }, [value]);

  const confirmEdit = useCallback(async () => {
    // Validate
    if (validate) {
      const err = validate(editValue);
      if (err) {
        setError(err);
        haptic.error();
        return;
      }
    }

    // Skip if unchanged
    if (editValue === value) {
      setIsEditing(false);
      return;
    }

    setSaving(true);
    try {
      await onSave(editValue);
      haptic.success();
      setIsEditing(false);
      setError(null);
    } catch {
      haptic.error();
      setError("Speichern fehlgeschlagen");
    } finally {
      setSaving(false);
    }
  }, [editValue, value, onSave, validate, haptic]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      confirmEdit();
    } else if (e.key === "Escape") {
      cancelEditing();
    }
  }, [confirmEdit, cancelEditing]);

  if (isEditing) {
    return (
      <div className={cn("space-y-1", className)}>
        {label && (
          <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">
            {label}
          </span>
        )}
        <div className="flex items-center gap-1.5">
          <div className="relative flex-1">
            <input
              ref={inputRef}
              type={type}
              value={editValue}
              onChange={(e) => { setEditValue(e.target.value); setError(null); }}
              onKeyDown={handleKeyDown}
              onBlur={() => {
                // Delay to allow button clicks
                setTimeout(() => {
                  if (isEditing) cancelEditing();
                }, 200);
              }}
              className={cn(
                "w-full h-9 px-2 text-sm rounded-md border bg-background outline-none transition-colors",
                "focus:border-primary focus:ring-1 focus:ring-primary",
                error && "border-destructive",
                suffix && "pr-8"
              )}
              inputMode={type === "number" ? "decimal" : undefined}
              disabled={saving}
            />
            {suffix && (
              <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                {suffix}
              </span>
            )}
          </div>
          <button
            onClick={confirmEdit}
            disabled={saving}
            className="p-1.5 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 active:bg-primary/80 transition-colors shrink-0"
            aria-label="Speichern"
          >
            <Check className="w-4 h-4" />
          </button>
          <button
            onClick={cancelEditing}
            disabled={saving}
            className="p-1.5 rounded-md border hover:bg-muted active:bg-muted/80 transition-colors shrink-0"
            aria-label="Abbrechen"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        {error && <p className="text-xs text-destructive">{error}</p>}
      </div>
    );
  }

  return (
    <div
      className={cn(
        "group",
        editable && "cursor-pointer",
        className
      )}
      onClick={startEditing}
      role={editable ? "button" : undefined}
      tabIndex={editable ? 0 : undefined}
      onKeyDown={editable ? (e) => { if (e.key === "Enter") startEditing(); } : undefined}
    >
      {label && (
        <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium block">
          {label}
        </span>
      )}
      <div className="flex items-center gap-1.5">
        <span className={cn(
          "text-sm font-medium",
          !value && "text-muted-foreground italic"
        )}>
          {value ? (formatDisplay ? formatDisplay(value) : value) : placeholder}
          {value && suffix && <span className="text-muted-foreground ml-0.5">{suffix}</span>}
        </span>
        {editable && isMobile && (
          <Pencil className="w-3 h-3 text-muted-foreground opacity-0 group-hover:opacity-100 group-active:opacity-100 transition-opacity shrink-0" />
        )}
      </div>
    </div>
  );
});
