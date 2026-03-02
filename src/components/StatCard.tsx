import { ReactNode, useState, useCallback } from "react";
import { TrendingUp, TrendingDown, Check } from "lucide-react";

interface StatCardProps {
  label: string;
  value: string;
  subValue?: string;
  icon?: ReactNode;
  trend?: "up" | "down" | "neutral";
  delay?: number;
  tooltip?: string;
}

const StatCard = ({ label, value, subValue, icon, trend, delay = 0, tooltip }: StatCardProps) => {
  const [copied, setCopied] = useState(false);

  const copyValue = useCallback(() => {
    navigator.clipboard.writeText(value).then(
      () => { setCopied(true); setTimeout(() => setCopied(false), 1500); },
      () => { /* clipboard unavailable — fail silently for stat cards */ }
    );
  }, [value]);

  return (
    <div
      role="button"
      tabIndex={0}
      className="gradient-card rounded-xl border border-border p-4 animate-fade-in hover-lift group relative overflow-hidden cursor-pointer select-none focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2"
      style={{ animationDelay: `${delay}ms` }}
      title={tooltip || `${label}: ${value} – Klicken zum Kopieren`}
      onClick={copyValue}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); copyValue(); } }}
      aria-label={`${label}: ${value}. Klicken zum Kopieren`}
    >
      <div className="absolute inset-0 bg-gradient-to-br from-primary/0 to-primary/0 group-hover:from-primary/[0.03] group-hover:to-transparent transition-all duration-500" />
      {trend && (
        <div className={`absolute inset-0 opacity-[0.03] ${trend === "up" ? "bg-profit" : "bg-loss"}`} />
      )}
      <div className="relative">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            {label}
          </span>
          <span className="text-muted-foreground group-hover:text-primary transition-colors">
            {copied ? <Check className="h-4 w-4 text-profit" /> : icon}
          </span>
        </div>
        <div className="text-2xl font-bold tracking-tight animate-count">{value}</div>
        {subValue && (
          <div className="flex items-center gap-1 mt-1">
            {trend === "up" && <TrendingUp className="h-3 w-3 text-profit" />}
            {trend === "down" && <TrendingDown className="h-3 w-3 text-loss" />}
            <span
              className={`text-xs font-medium ${
                trend === "up" ? "text-profit" : trend === "down" ? "text-loss" : "text-muted-foreground"
              }`}
            >
              {subValue}
            </span>
          </div>
        )}
      </div>
      {copied && (
        <div className="absolute bottom-2 right-2 text-[9px] text-profit font-medium animate-fade-in">
          Kopiert
        </div>
      )}
    </div>
  );
};

export default StatCard;
