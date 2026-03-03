/**
 * #1: Page-Splitting — Appearance section extracted from Settings.tsx
 */
import { Sun, Moon, Monitor } from "lucide-react";
import { useTheme } from "@/hooks/useTheme";
import { useMemo } from "react";

export function AppearanceSettings() {
  const { theme, setTheme } = useTheme();

  const themeOptions = useMemo(() => [
    { value: "light", label: "Hell", icon: Sun },
    { value: "dark", label: "Dunkel", icon: Moon },
    { value: "system", label: "System", icon: Monitor },
  ], []);

  return (
    <div className="gradient-card rounded-xl border border-border p-5 space-y-4 animate-fade-in scroll-mt-20">
      <h2 className="text-sm font-semibold flex items-center gap-2">
        <Sun className="h-4 w-4 text-muted-foreground" /> Erscheinungsbild
      </h2>
      <div className="grid grid-cols-3 gap-2 card-stagger-enter">
        {themeOptions.map((opt) => {
          const isActive = theme === opt.value;
          return (
            <button
              key={opt.value}
              onClick={() => setTheme(opt.value as "light" | "dark" | "system")}
              className={`flex flex-col items-center gap-2 p-3 rounded-lg border-2 transition-all ${
                isActive
                  ? "border-primary bg-primary/10"
                  : "border-border hover:border-muted-foreground/30 hover:bg-secondary/50"
              }`}
            >
              <opt.icon className={`h-5 w-5 ${isActive ? "text-primary" : "text-muted-foreground"}`} />
              <span className={`text-xs font-medium ${isActive ? "text-primary" : "text-muted-foreground"}`}>
                {opt.label}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
