/**
 * Einheitliche Toggle-Zeile wie bei AI Chat (Einstellungen).
 * Label + Beschreibung links, Switch rechts, in abgerundeter Box.
 */
import * as React from "react";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";

interface SettingsToggleRowProps {
  /** Titelzeile (z. B. "AI Chat anzeigen") */
  label: string;
  /** Optionale Beschreibung unter dem Titel */
  description?: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  disabled?: boolean;
  /** aria-label für den Switch */
  ariaLabel?: string;
  className?: string;
}

export function SettingsToggleRow({
  label,
  description,
  checked,
  onCheckedChange,
  disabled,
  ariaLabel,
  className,
}: SettingsToggleRowProps) {
  return (
    <div
      className={cn(
        "flex items-center justify-between gap-3 p-3 rounded-lg bg-secondary/30 border border-border",
        className
      )}
    >
      <div className="min-w-0">
        <p className="text-xs font-medium">{label}</p>
        {description != null && (
          <p className="text-[11px] text-muted-foreground mt-0.5">{description}</p>
        )}
      </div>
      <Switch
        checked={checked}
        onCheckedChange={onCheckedChange}
        disabled={disabled}
        aria-label={ariaLabel ?? `${label} ein oder aus`}
      />
    </div>
  );
}
