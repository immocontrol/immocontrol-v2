/**
 * MOB3-8: Mobile Double-Tap Quick Edit
 * Double-tap on values opens inline edit mode instead of a dialog.
 * Safari-safe: uses touchend timing for double-tap detection.
 */
import { memo, useRef, useState, useCallback, useEffect, type ReactNode } from "react";
import { Check, X } from "lucide-react";
import { useHaptic } from "@/hooks/useHaptic";
import { cn } from "@/lib/utils";

interface MobileDoubleTapEditProps {
  /** Current display value */
  value: string;
  /** Called when user confirms edit */
  onSave: (newValue: string) => void;
  /** Input type (default: "text") */
  inputType?: "text" | "number" | "tel";
  /** Placeholder text */
  placeholder?: string;
  /** Format function for display */
  formatDisplay?: (value: string) => ReactNode;
  /** Prefix shown before input (e.g. "€") */
  prefix?: string;
  /** Suffix shown after input (e.g. "/Monat") */
  suffix?: string;
  className?: string;
  disabled?: boolean;
}

export const MobileDoubleTapEdit = memo(function MobileDoubleTapEdit({
  value, onSave, inputType = "text", placeholder, formatDisplay,
  prefix, suffix, className, disabled,
}: MobileDoubleTapEditProps) {
  const haptic = useHaptic();
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState(value);
  const lastTapRef = useRef(0);
  const inputRef = useRef<HTMLInputElement>(null);

  // Update edit value when prop changes
  useEffect(() => {
    if (!editing) setEditValue(value);
  }, [value, editing]);

  // Focus input when entering edit mode
  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editing]);

  const handleTap = useCallback(() => {
    if (disabled) return;
    const now = Date.now();
    if (now - lastTapRef.current < 350) {
      // Double tap detected
      haptic.tap();
      setEditing(true);
      lastTapRef.current = 0;
    } else {
      lastTapRef.current = now;
    }
  }, [disabled, haptic]);

  const handleSave = useCallback(() => {
    if (editValue.trim() !== value) {
      onSave(editValue.trim());
      haptic.success();
    }
    setEditing(false);
  }, [editValue, value, onSave, haptic]);

  const handleCancel = useCallback(() => {
    setEditValue(value);
    setEditing(false);
  }, [value]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === "Enter") handleSave();
    if (e.key === "Escape") handleCancel();
  }, [handleSave, handleCancel]);

  if (editing) {
    return (
      <div className={cn("flex items-center gap-1", className)}>
        {prefix && <span className="text-muted-foreground text-sm shrink-0">{prefix}</span>}
        <input
          ref={inputRef}
          type={inputType}
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={handleSave}
          placeholder={placeholder}
          className="flex-1 min-w-0 bg-transparent border-b-2 border-primary outline-none text-sm font-medium py-0.5 px-0"
          inputMode={inputType === "number" || inputType === "tel" ? "decimal" : "text"}
          /* Safari: prevent zoom on focus */
          style={{ fontSize: "16px" }}
        />
        {suffix && <span className="text-muted-foreground text-xs shrink-0">{suffix}</span>}
        <button onClick={handleSave} className="p-1 rounded-full bg-primary/10 text-primary" aria-label="Speichern">
          <Check className="h-3.5 w-3.5" />
        </button>
        <button onClick={handleCancel} className="p-1 rounded-full bg-secondary text-muted-foreground" aria-label="Abbrechen">
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    );
  }

  return (
    <div
      onClick={handleTap}
      className={cn(
        "cursor-pointer select-none transition-colors rounded px-1 -mx-1",
        !disabled && "hover:bg-secondary/50 active:bg-secondary",
        className,
      )}
      role="button"
      aria-label={`Doppeltippen zum Bearbeiten: ${value}`}
      title="Doppeltippen zum Bearbeiten"
    >
      {formatDisplay ? formatDisplay(value) : value}
    </div>
  );
});
