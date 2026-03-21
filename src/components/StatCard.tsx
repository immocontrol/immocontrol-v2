import React from "react";
import { ReactNode, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { TrendingUp, TrendingDown, Check } from "lucide-react";

interface StatCardProps {
  label: string;
  value: string;
  subValue?: string;
  icon?: ReactNode;
  trend?: "up" | "down" | "neutral";
  delay?: number;
  tooltip?: string;
  /** When set, card navigates on click instead of copying */
  href?: string;
}

/** Coerce to string for display — prevents React #310 (objects as React child) */
const toDisplayString = (v: unknown): string => {
  if (v == null) return "–";
  if (typeof v === "string" || typeof v === "number") return String(v);
  return "–";
};

const StatCard = ({ label, value, subValue, icon, trend, delay = 0, tooltip, href }: StatCardProps) => {
  const [copied, setCopied] = useState(false);
  const displayValue = toDisplayString(value);
  const displaySubValue = subValue != null ? toDisplayString(subValue) : undefined;

  const copyValue = useCallback(() => {
    navigator.clipboard.writeText(displayValue).then(
      () => { setCopied(true); setTimeout(() => setCopied(false), 1500); toast.success("Kopiert"); },
      () => toast.error("Kopieren fehlgeschlagen")
    );
  }, [displayValue]);

  const content = (
    <div
      className={`gradient-card rounded-xl border border-border p-4 animate-fade-in hover-lift group relative overflow-hidden cursor-pointer select-none focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2 ${href ? "block" : ""}`}
      style={{ animationDelay: `${delay}ms` }}
      title={tooltip || (href ? `${label}: ${displayValue} – Zur Seite` : `${label}: ${displayValue} – Klicken zum Kopieren`)}
      onClick={href ? undefined : copyValue}
      onKeyDown={href ? undefined : (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); copyValue(); } }}
      aria-label={href ? `${label}: ${displayValue}. Zur Seite navigieren` : `${label}: ${displayValue}. Klicken zum Kopieren`}
      role={href ? "link" : "button"}
      tabIndex={0}
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
        <div className="text-2xl font-bold tracking-tight animate-count tabular-nums kpi-number">{displayValue}</div>
        {displaySubValue != null && (
          <div className="flex items-center gap-1 mt-1">
            {trend === "up" && <TrendingUp className="h-3 w-3 text-profit" />}
            {trend === "down" && <TrendingDown className="h-3 w-3 text-loss" />}
            <span
              className={`text-xs font-medium ${
                trend === "up" ? "text-profit" : trend === "down" ? "text-loss" : "text-muted-foreground"
              }`}
            >
              {displaySubValue}
            </span>
          </div>
        )}
      </div>
      {copied && !href && (
        <div className="absolute bottom-2 right-2 text-[9px] text-profit font-medium animate-fade-in">
          Kopiert
        </div>
      )}
    </div>
  );

  if (href) {
    return <Link to={href} className="block">{content}</Link>;
  }
  return content;
};

/* IMP-51: Memoize StatCard to prevent unnecessary re-renders */
export default React.memo(StatCard);
