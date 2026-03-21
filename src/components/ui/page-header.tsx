import * as React from "react";
import { cn } from "@/lib/utils";

/** Einheitlicher Seitenkopf: Titel, Beschreibung, Aktionen (responsive). */
export function PageHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4 min-w-0 mb-6 md:mb-8 page-header-enter",
        className,
      )}
      {...props}
    />
  );
}

export function PageHeaderMain({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("min-w-0 flex-1", className)} {...props} />;
}

export function PageHeaderTitle({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h1
      className={cn(
        "text-xl sm:text-2xl font-bold tracking-tight text-foreground flex items-center gap-2 min-w-0 text-balance",
        className,
      )}
      {...props}
    />
  );
}

export function PageHeaderDescription({ className, ...props }: React.HTMLAttributes<HTMLParagraphElement>) {
  return (
    <p className={cn("text-sm text-muted-foreground mt-1 max-w-2xl text-wrap-safe leading-relaxed text-pretty", className)} {...props} />
  );
}

export function PageHeaderActions({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("flex flex-wrap items-center gap-2 shrink-0 w-full sm:w-auto justify-stretch sm:justify-end", className)} {...props} />
  );
}
