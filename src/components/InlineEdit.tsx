/**
 * #9: Inline-Editing Component — Click to edit table cells without opening dialogs.
 * Supports text, number, and currency inputs with Enter to save, Escape to cancel.
 */
import { useState, useRef, useEffect, useCallback } from "react";
import { Input } from "@/components/ui/input";
import { Check, X } from "lucide-react";
import { formatCurrency } from "@/lib/formatters";

interface InlineEditProps {
  value: string | number;
  onSave: (value: string | number) => void | Promise<void>;
  type?: "text" | "number" | "currency";
  placeholder?: string;
  className?: string;
  /** Minimum width of the edit input */
  minWidth?: number;
}

export function InlineEdit({
  value,
  onSave,
  type = "text",
  placeholder = "–",
  className = "",
  minWidth = 60,
}: InlineEditProps) {
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState(String(value));
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) {
      setEditValue(String(value));
      requestAnimationFrame(() => inputRef.current?.select());
    }
  }, [editing, value]);

  const handleSave = useCallback(async () => {
    if (saving) return;
    const newValue = type === "number" || type === "currency"
      /* FIX-1: Use global /,/g to replace ALL commas */
      ? parseFloat(editValue.replace(/,/g, ".")) || 0
      : editValue.trim();

    if (newValue === value) {
      setEditing(false);
      return;
    }

    setSaving(true);
    try {
      await onSave(newValue);
    } finally {
      setSaving(false);
      setEditing(false);
    }
  }, [editValue, value, type, onSave, saving]);

  const handleCancel = () => {
    setEditValue(String(value));
    setEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleSave();
    } else if (e.key === "Escape") {
      handleCancel();
    }
  };

  if (editing) {
    return (
      <div className={`inline-flex items-center gap-1 ${className}`}>
        <Input
          ref={inputRef}
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={handleSave}
          onMouseDown={(e) => e.stopPropagation()}
          type={type === "text" ? "text" : "number"}
          step={type === "currency" ? "0.01" : undefined}
          className="h-6 text-xs px-1.5 min-w-0"
          style={{ minWidth }}
          disabled={saving}
          autoFocus
        />
        <button
          onMouseDown={(e) => { e.preventDefault(); handleSave(); }}
          className="h-5 w-5 flex items-center justify-center rounded hover:bg-profit/10 text-profit transition-colors"
          aria-label="Speichern"
        >
          <Check className="h-3 w-3" />
        </button>
        <button
          onMouseDown={(e) => { e.preventDefault(); handleCancel(); }}
          className="h-5 w-5 flex items-center justify-center rounded hover:bg-loss/10 text-loss transition-colors"
          aria-label="Abbrechen"
        >
          <X className="h-3 w-3" />
        </button>
      </div>
    );
  }

  const displayValue = type === "currency"
    ? formatCurrency(Number(value))
    : type === "number"
      ? Number(value).toLocaleString("de-DE")
      : String(value);

  return (
    <button
      onClick={() => setEditing(true)}
      className={`inline-block text-left cursor-pointer hover:bg-secondary/50 rounded px-1 py-0.5 -mx-1 transition-colors group ${className}`}
      title="Klicken zum Bearbeiten"
    >
      <span className="border-b border-dashed border-transparent group-hover:border-muted-foreground/30">
        {displayValue || <span className="text-muted-foreground">{placeholder}</span>}
      </span>
    </button>
  );
}
