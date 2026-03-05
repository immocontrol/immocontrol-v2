/**
 * MOB5-11: Mobile Color Picker
 * Touch-optimized color picker for categories, labels, and tags.
 * Preset palette + custom color input. Compact mobile-first design.
 */
import { useState, useCallback, memo } from "react";
import { useIsMobile } from "@/hooks/use-mobile";
import { Check, Palette } from "lucide-react";
import { cn } from "@/lib/utils";

const PRESET_COLORS = [
  { name: "Rot", value: "#ef4444" },
  { name: "Orange", value: "#f97316" },
  { name: "Gelb", value: "#eab308" },
  { name: "Grün", value: "#22c55e" },
  { name: "Türkis", value: "#14b8a6" },
  { name: "Blau", value: "#3b82f6" },
  { name: "Indigo", value: "#6366f1" },
  { name: "Lila", value: "#a855f7" },
  { name: "Rosa", value: "#ec4899" },
  { name: "Grau", value: "#6b7280" },
  { name: "Braun", value: "#92400e" },
  { name: "Dunkelblau", value: "#1e3a5f" },
];

interface MobileColorPickerProps {
  /** Currently selected color */
  value?: string;
  /** Color change handler */
  onChange?: (color: string) => void;
  /** Custom preset colors (overrides defaults) */
  presets?: { name: string; value: string }[];
  /** Allow custom color input */
  allowCustom?: boolean;
  /** Compact mode (single row) */
  compact?: boolean;
  /** Label */
  label?: string;
  /** Additional class */
  className?: string;
}

export const MobileColorPicker = memo(function MobileColorPicker({
  value,
  onChange,
  presets = PRESET_COLORS,
  allowCustom = true,
  compact = false,
  label,
  className,
}: MobileColorPickerProps) {
  const isMobile = useIsMobile();
  const [customColor, setCustomColor] = useState(value || "#3b82f6");
  const [showCustom, setShowCustom] = useState(false);

  const handleSelect = useCallback((color: string) => {
    onChange?.(color);
  }, [onChange]);

  const handleCustomChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const color = e.target.value;
    setCustomColor(color);
    onChange?.(color);
  }, [onChange]);

  return (
    <div className={cn("w-full", className)}>
      {label && (
        <div className="flex items-center gap-1.5 mb-2">
          <Palette className="w-3.5 h-3.5 text-muted-foreground" />
          <span className="text-xs font-medium">{label}</span>
          {value && (
            <span
              className="w-4 h-4 rounded-full border shadow-sm"
              style={{ backgroundColor: value }}
            />
          )}
        </div>
      )}

      {/* Color grid */}
      <div className={cn(
        compact
          ? "flex gap-1.5 overflow-x-auto scrollbar-none pb-1"
          : "grid grid-cols-6 gap-2",
        isMobile && !compact && "grid-cols-6"
      )}>
        {presets.map(preset => {
          const isSelected = value === preset.value;
          return (
            <button
              key={preset.value}
              onClick={() => handleSelect(preset.value)}
              className={cn(
                "rounded-full transition-all relative",
                compact ? "w-8 h-8 shrink-0" : "w-full aspect-square",
                isMobile && "min-w-[36px] min-h-[36px]",
                isSelected && "ring-2 ring-offset-2 ring-primary",
                "hover:scale-110 active:scale-95"
              )}
              style={{ backgroundColor: preset.value }}
              aria-label={`${preset.name}${isSelected ? " (ausgewählt)" : ""}`}
              title={preset.name}
            >
              {isSelected && (
                <Check className={cn(
                  "absolute inset-0 m-auto w-4 h-4",
                  isLightColor(preset.value) ? "text-gray-800" : "text-white"
                )} />
              )}
            </button>
          );
        })}

        {/* Custom color button */}
        {allowCustom && (
          <button
            onClick={() => setShowCustom(!showCustom)}
            className={cn(
              "rounded-full border-2 border-dashed border-border transition-all",
              "flex items-center justify-center",
              compact ? "w-8 h-8 shrink-0" : "w-full aspect-square",
              isMobile && "min-w-[36px] min-h-[36px]",
              showCustom && "border-primary bg-primary/5",
              "hover:border-primary hover:bg-primary/5"
            )}
            aria-label="Eigene Farbe wählen"
            title="Eigene Farbe"
          >
            <Palette className="w-3.5 h-3.5 text-muted-foreground" />
          </button>
        )}
      </div>

      {/* Custom color input */}
      {showCustom && allowCustom && (
        <div className="mt-3 flex items-center gap-3 p-2 rounded-lg bg-muted/50">
          <input
            type="color"
            value={customColor}
            onChange={handleCustomChange}
            className={cn(
              "w-10 h-10 rounded-lg border-0 cursor-pointer",
              "appearance-none bg-transparent",
              "[&::-webkit-color-swatch-wrapper]:p-0",
              "[&::-webkit-color-swatch]:rounded-lg [&::-webkit-color-swatch]:border-2 [&::-webkit-color-swatch]:border-border"
            )}
            aria-label="Eigene Farbe"
          />
          <div className="flex-1">
            <input
              type="text"
              value={customColor}
              onChange={(e) => {
                const val = e.target.value;
                setCustomColor(val);
                if (/^#[0-9a-fA-F]{6}$/.test(val)) {
                  onChange?.(val);
                }
              }}
              className="w-full text-xs px-2 py-1.5 rounded border bg-background font-mono"
              placeholder="#000000"
              maxLength={7}
            />
            <p className="text-[10px] text-muted-foreground mt-0.5">HEX-Farbcode eingeben</p>
          </div>
        </div>
      )}
    </div>
  );
});

/** Check if a hex color is light (for contrast text) */
function isLightColor(hex: string): boolean {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.5;
}
