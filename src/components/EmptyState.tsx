/**
 * Einheitlicher leerer Zustand für Listen/Tabellen.
 * Verbessert UX durch klare Botschaft und optionale Aktion.
 */
import { ReactNode } from "react";
import { FileQuestion, LucideIcon } from "lucide-react";

interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}

export function EmptyState({
  icon: Icon = FileQuestion,
  title,
  description,
  action,
  className = "",
}: EmptyStateProps) {
  return (
    <div
      className={`flex flex-col items-center justify-center py-10 px-4 text-center rounded-xl border border-dashed border-border bg-muted/20 ${className}`}
      role="status"
      aria-label={title}
    >
      <div className="w-12 h-12 rounded-xl bg-muted flex items-center justify-center mb-3">
        <Icon className="h-6 w-6 text-muted-foreground" />
      </div>
      <h3 className="text-sm font-medium mb-1">{title}</h3>
      {description && <p className="text-xs text-muted-foreground max-w-sm mb-4">{description}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}
