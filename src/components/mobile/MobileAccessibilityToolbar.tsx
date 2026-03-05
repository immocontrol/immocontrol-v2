/**
 * MOB4-19: Mobile Accessibility Toolbar
 * Accessibility tools: font size +/-, high contrast, reduce animations.
 * Important for older users in the real estate industry.
 */
import { useState, useEffect, useCallback, memo } from "react";
import { useIsMobile } from "@/hooks/use-mobile";
import { Accessibility, Plus, Minus, Eye, Zap, X, Type, Contrast } from "lucide-react";
import { cn } from "@/lib/utils";

interface AccessibilitySettings {
  fontScale: number; // 0.8 - 1.5
  highContrast: boolean;
  reduceAnimations: boolean;
  largeTargets: boolean;
}

const STORAGE_KEY = "immo-a11y-settings";
const DEFAULT_SETTINGS: AccessibilitySettings = {
  fontScale: 1,
  highContrast: false,
  reduceAnimations: false,
  largeTargets: false,
};

function loadSettings(): AccessibilitySettings {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      return { ...DEFAULT_SETTINGS, ...JSON.parse(stored) };
    }
  } catch {
    // ignore
  }
  return DEFAULT_SETTINGS;
}

function saveSettings(settings: AccessibilitySettings) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // ignore
  }
}

/**
 * Hook for managing accessibility settings.
 */
export function useAccessibilitySettings() {
  const [settings, setSettings] = useState<AccessibilitySettings>(loadSettings);

  // Apply settings to DOM
  useEffect(() => {
    const root = document.documentElement;

    // Font scale
    root.style.setProperty("--mob4-a11y-font-scale", String(settings.fontScale));
    root.style.fontSize = `${settings.fontScale * 100}%`;

    // High contrast
    if (settings.highContrast) {
      root.classList.add("mob4-high-contrast");
    } else {
      root.classList.remove("mob4-high-contrast");
    }

    // Reduce animations
    if (settings.reduceAnimations) {
      root.classList.add("mob4-reduce-motion");
      root.style.setProperty("--mob4-animation-duration", "0ms");
    } else {
      root.classList.remove("mob4-reduce-motion");
      root.style.removeProperty("--mob4-animation-duration");
    }

    // Large touch targets
    if (settings.largeTargets) {
      root.classList.add("mob4-large-targets");
      root.style.setProperty("--mob4-min-target", "48px");
    } else {
      root.classList.remove("mob4-large-targets");
      root.style.removeProperty("--mob4-min-target");
    }

    return () => {
      root.style.removeProperty("--mob4-a11y-font-scale");
      root.style.fontSize = "";
      root.classList.remove("mob4-high-contrast", "mob4-reduce-motion", "mob4-large-targets");
      root.style.removeProperty("--mob4-animation-duration");
      root.style.removeProperty("--mob4-min-target");
    };
  }, [settings]);

  const updateSetting = useCallback(<K extends keyof AccessibilitySettings>(
    key: K,
    value: AccessibilitySettings[K]
  ) => {
    setSettings(prev => {
      const next = { ...prev, [key]: value };
      saveSettings(next);
      return next;
    });
  }, []);

  const resetAll = useCallback(() => {
    setSettings(DEFAULT_SETTINGS);
    saveSettings(DEFAULT_SETTINGS);
  }, []);

  return { settings, updateSetting, resetAll };
}

interface MobileAccessibilityToolbarProps {
  /** Additional class */
  className?: string;
  /** Position when expanded */
  position?: "bottom-right" | "bottom-left";
}

export const MobileAccessibilityToolbar = memo(function MobileAccessibilityToolbar({
  className,
  position = "bottom-right",
}: MobileAccessibilityToolbarProps) {
  const isMobile = useIsMobile();
  const [isOpen, setIsOpen] = useState(false);
  const { settings, updateSetting, resetAll } = useAccessibilitySettings();

  const increaseFontSize = useCallback(() => {
    updateSetting("fontScale", Math.min(Math.round((settings.fontScale + 0.1) * 10) / 10, 1.5));
  }, [settings.fontScale, updateSetting]);

  const decreaseFontSize = useCallback(() => {
    updateSetting("fontScale", Math.max(Math.round((settings.fontScale - 0.1) * 10) / 10, 0.8));
  }, [settings.fontScale, updateSetting]);

  const fontSizePercent = Math.round(settings.fontScale * 100);
  const hasCustomSettings = settings.fontScale !== 1 || settings.highContrast || settings.reduceAnimations || settings.largeTargets;

  return (
    <>
      {/* Toggle button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "fixed z-40 w-11 h-11 rounded-full shadow-lg",
          "flex items-center justify-center transition-all",
          "bg-primary text-primary-foreground",
          "hover:shadow-xl active:scale-95",
          position === "bottom-right" ? "right-4" : "left-4",
          isMobile ? "bottom-20" : "bottom-4",
          hasCustomSettings && "ring-2 ring-primary/30",
          className
        )}
        aria-label="Barrierefreiheit"
        title="Barrierefreiheit"
      >
        <Accessibility className="w-5 h-5" />
      </button>

      {/* Toolbar panel */}
      {isOpen && (
        <div className="fixed inset-0 z-50" role="dialog" aria-label="Barrierefreiheits-Einstellungen">
          <div
            className="absolute inset-0 bg-black/30"
            onClick={() => setIsOpen(false)}
          />
          <div
            className={cn(
              "absolute bg-background rounded-2xl shadow-2xl border p-4 w-[280px]",
              "animate-in zoom-in-95 fade-in duration-200",
              position === "bottom-right" ? "right-4" : "left-4",
              isMobile ? "bottom-20" : "bottom-4"
            )}
          >
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Accessibility className="w-4 h-4 text-primary" />
                <h3 className="text-sm font-semibold">Barrierefreiheit</h3>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="p-1 rounded-full hover:bg-muted transition-colors"
                aria-label="Schließen"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-4">
              {/* Font size */}
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Type className="w-3.5 h-3.5 text-muted-foreground" />
                  <span className="text-xs font-medium">Schriftgröße: {fontSizePercent}%</span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={decreaseFontSize}
                    disabled={settings.fontScale <= 0.8}
                    className="w-9 h-9 rounded-full border flex items-center justify-center hover:bg-muted active:bg-muted/80 transition-colors disabled:opacity-30"
                    aria-label="Schrift verkleinern"
                  >
                    <Minus className="w-4 h-4" />
                  </button>
                  <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full bg-primary rounded-full transition-all"
                      style={{ width: `${((settings.fontScale - 0.8) / 0.7) * 100}%` }}
                    />
                  </div>
                  <button
                    onClick={increaseFontSize}
                    disabled={settings.fontScale >= 1.5}
                    className="w-9 h-9 rounded-full border flex items-center justify-center hover:bg-muted active:bg-muted/80 transition-colors disabled:opacity-30"
                    aria-label="Schrift vergrößern"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* High contrast */}
              <label className="flex items-center justify-between cursor-pointer">
                <div className="flex items-center gap-2">
                  <Contrast className="w-3.5 h-3.5 text-muted-foreground" />
                  <span className="text-xs font-medium">Hoher Kontrast</span>
                </div>
                <button
                  role="switch"
                  aria-checked={settings.highContrast}
                  onClick={() => updateSetting("highContrast", !settings.highContrast)}
                  className={cn(
                    "relative w-10 h-6 rounded-full transition-colors",
                    settings.highContrast ? "bg-primary" : "bg-muted"
                  )}
                >
                  <span
                    className={cn(
                      "absolute top-1 left-1 w-4 h-4 rounded-full bg-white transition-transform shadow-sm",
                      settings.highContrast && "translate-x-4"
                    )}
                  />
                </button>
              </label>

              {/* Reduce animations */}
              <label className="flex items-center justify-between cursor-pointer">
                <div className="flex items-center gap-2">
                  <Zap className="w-3.5 h-3.5 text-muted-foreground" />
                  <span className="text-xs font-medium">Animationen reduzieren</span>
                </div>
                <button
                  role="switch"
                  aria-checked={settings.reduceAnimations}
                  onClick={() => updateSetting("reduceAnimations", !settings.reduceAnimations)}
                  className={cn(
                    "relative w-10 h-6 rounded-full transition-colors",
                    settings.reduceAnimations ? "bg-primary" : "bg-muted"
                  )}
                >
                  <span
                    className={cn(
                      "absolute top-1 left-1 w-4 h-4 rounded-full bg-white transition-transform shadow-sm",
                      settings.reduceAnimations && "translate-x-4"
                    )}
                  />
                </button>
              </label>

              {/* Large touch targets */}
              <label className="flex items-center justify-between cursor-pointer">
                <div className="flex items-center gap-2">
                  <Eye className="w-3.5 h-3.5 text-muted-foreground" />
                  <span className="text-xs font-medium">Große Schaltflächen</span>
                </div>
                <button
                  role="switch"
                  aria-checked={settings.largeTargets}
                  onClick={() => updateSetting("largeTargets", !settings.largeTargets)}
                  className={cn(
                    "relative w-10 h-6 rounded-full transition-colors",
                    settings.largeTargets ? "bg-primary" : "bg-muted"
                  )}
                >
                  <span
                    className={cn(
                      "absolute top-1 left-1 w-4 h-4 rounded-full bg-white transition-transform shadow-sm",
                      settings.largeTargets && "translate-x-4"
                    )}
                  />
                </button>
              </label>

              {/* Reset */}
              {hasCustomSettings && (
                <button
                  onClick={resetAll}
                  className="w-full text-xs text-muted-foreground hover:text-foreground py-1.5 transition-colors"
                >
                  Alle zurücksetzen
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
});
