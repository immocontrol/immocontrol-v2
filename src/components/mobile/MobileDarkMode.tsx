/**
 * MOB4-13: Mobile Dark Mode Optimization
 * OLED-black dark mode with reduced brightness for mobile.
 * Saves battery on OLED displays. Applies mobile-specific dark overrides.
 */
import { useEffect, useCallback, memo, useState } from "react";
import { useIsMobile } from "@/hooks/use-mobile";
import { Moon, Sun, Smartphone } from "lucide-react";
import { cn } from "@/lib/utils";

type DarkModePreference = "light" | "dark" | "system" | "oled";

const STORAGE_KEY = "immo-dark-mode-pref";

/**
 * Hook for mobile dark mode with OLED support.
 * Returns current mode and toggle function.
 */
export function useMobileDarkMode() {
  const isMobile = useIsMobile();

  const [preference, setPreference] = useState<DarkModePreference>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored && ["light", "dark", "system", "oled"].includes(stored)) {
        return stored as DarkModePreference;
      }
    } catch {
      // ignore
    }
    return "system";
  });

  const [systemDark, setSystemDark] = useState(() =>
    typeof window !== "undefined"
      ? window.matchMedia("(prefers-color-scheme: dark)").matches
      : false
  );

  // Listen for system theme changes
  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = (e: MediaQueryListEvent) => setSystemDark(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  const isDark = preference === "dark" || preference === "oled" || (preference === "system" && systemDark);
  const isOLED = preference === "oled";

  // Apply dark mode classes
  useEffect(() => {
    const root = document.documentElement;

    if (isDark) {
      root.classList.add("dark");
    } else {
      root.classList.remove("dark");
    }

    if (isOLED && isMobile) {
      root.classList.add("oled-dark");
      // Set OLED-specific CSS custom properties
      root.style.setProperty("--mob4-oled-bg", "#000000");
      root.style.setProperty("--mob4-oled-card", "#0a0a0a");
      root.style.setProperty("--mob4-oled-border", "#1a1a1a");
    } else {
      root.classList.remove("oled-dark");
      root.style.removeProperty("--mob4-oled-bg");
      root.style.removeProperty("--mob4-oled-card");
      root.style.removeProperty("--mob4-oled-border");
    }

    // Set meta theme-color for mobile browser chrome
    const metaTheme = document.querySelector('meta[name="theme-color"]');
    if (metaTheme) {
      metaTheme.setAttribute("content", isDark ? (isOLED ? "#000000" : "#0a0a0a") : "#ffffff");
    }

    return () => {
      root.classList.remove("oled-dark");
      root.style.removeProperty("--mob4-oled-bg");
      root.style.removeProperty("--mob4-oled-card");
      root.style.removeProperty("--mob4-oled-border");
    };
  }, [isDark, isOLED, isMobile]);

  const setMode = useCallback((mode: DarkModePreference) => {
    setPreference(mode);
    try {
      localStorage.setItem(STORAGE_KEY, mode);
    } catch {
      // ignore
    }
  }, []);

  const toggle = useCallback(() => {
    const order: DarkModePreference[] = isMobile
      ? ["system", "light", "dark", "oled"]
      : ["system", "light", "dark"];
    const currentIdx = order.indexOf(preference);
    const nextIdx = (currentIdx + 1) % order.length;
    setMode(order[nextIdx]);
  }, [preference, isMobile, setMode]);

  return {
    preference,
    isDark,
    isOLED,
    setMode,
    toggle,
  };
}

/** Dark mode toggle button component */
export const MobileDarkModeToggle = memo(function MobileDarkModeToggle({
  className,
  showLabel = false,
}: {
  className?: string;
  showLabel?: boolean;
}) {
  const { preference, toggle } = useMobileDarkMode();
  const isMobile = useIsMobile();

  const icon = preference === "light"
    ? <Sun className="w-4 h-4" />
    : preference === "oled"
      ? <Smartphone className="w-4 h-4" />
      : <Moon className="w-4 h-4" />;

  const label = preference === "light"
    ? "Hell"
    : preference === "dark"
      ? "Dunkel"
      : preference === "oled"
        ? "OLED"
        : "System";

  return (
    <button
      onClick={toggle}
      className={cn(
        "flex items-center gap-2 p-2 rounded-md hover:bg-muted active:bg-muted/80 transition-colors",
        className
      )}
      aria-label={`Modus: ${label}`}
      title={`Modus: ${label}`}
    >
      {icon}
      {showLabel && <span className="text-sm">{label}</span>}
    </button>
  );
});

/**
 * CSS to add to global styles for OLED dark mode:
 *
 * .oled-dark {
 *   --background: 0 0% 0%;
 *   --card: 0 0% 4%;
 *   --popover: 0 0% 4%;
 *   --border: 0 0% 10%;
 *   --muted: 0 0% 6%;
 * }
 */
