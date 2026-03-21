import * as React from "react";
import { cn } from "@/lib/utils";

/** Flächiger Ladezustand mit Shimmer (einzelfarbig, barrierearm). */
export function LoadingBlock({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "rounded-xl border border-border/50 bg-muted/15 skeleton-shimmer min-h-[8rem] w-full",
        className,
      )}
      role="status"
      aria-busy="true"
      aria-label="Laden"
      {...props}
    />
  );
}

/** Kompakte Zeile für eingebettete Ladezustände. */
export function LoadingLine({ className }: { className?: string }) {
  return <div className={cn("h-4 rounded-md skeleton-shimmer", className)} />;
}
