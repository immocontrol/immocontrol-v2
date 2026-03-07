/**
 * Shared step indicator for multi-step dialogs (AddProperty, AddTenant, AddLoan, AddContact).
 */
import { cn } from "@/lib/utils";

interface StepIndicatorProps {
  current: number;
  total: number;
  className?: string;
}

export function StepIndicator({ current, total, className }: StepIndicatorProps) {
  return (
    <div className={cn("flex items-center justify-center gap-0 mb-6", className)}>
      {Array.from({ length: total }, (_, i) => {
        const isCompleted = i < current;
        const isActive = i === current;
        return (
          <div key={i} className="flex items-center">
            <div
              className={cn(
                "w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold transition-all duration-300",
                isCompleted && "bg-primary text-primary-foreground",
                isActive && "bg-primary text-primary-foreground ring-2 ring-primary/30 ring-offset-2 ring-offset-background",
                !isCompleted && !isActive && "bg-muted text-muted-foreground"
              )}
            >
              {i + 1}
            </div>
            {i < total - 1 && (
              <div
                className={cn(
                  "w-12 h-0.5 transition-all duration-300",
                  i < current ? "bg-primary" : "bg-muted"
                )}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
