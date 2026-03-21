/**
 * Einheitlicher leerer Zustand für Listen/Tabellen.
 * Verbessert UX durch klare Botschaft und optionale Aktion.
 */
import { ReactNode } from "react";
import { FileQuestion, LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

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
      className={cn(
        "flex flex-col items-center justify-center py-10 md:py-12 px-4 text-center rounded-xl border border-dashed border-border/80 bg-gradient-to-b from-muted/25 to-muted/10 shadow-sm backdrop-blur-[2px] transition-shadow duration-200",
        className,
      )}
      role="status"
      aria-label={title}
      data-testid="empty-state"
    >
      <div className="mb-4 mx-auto w-14 h-14 rounded-2xl bg-primary/10 border border-primary/15 flex items-center justify-center shadow-sm">
        <Icon className="h-7 w-7 text-primary/90" aria-hidden />
      </div>
      <h3 className="text-base font-semibold tracking-tight text-foreground mb-1">{title}</h3>
      {description && (
        <p className="text-sm text-muted-foreground max-w-md mb-4 text-wrap-safe">{description}</p>
      )}
      {action && <div className="mt-1 flex flex-wrap items-center justify-center gap-2">{action}</div>}
    </div>
  );
}
