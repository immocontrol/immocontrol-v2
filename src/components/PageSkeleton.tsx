/**
 * IMP-4: Reusable skeleton loading states for major pages.
 * Replace plain spinners with content-shaped placeholders for better UX.
 */
import { Skeleton } from "@/components/ui/skeleton";

/** Dashboard / Portfolio skeleton — stat cards + property grid */
export function DashboardSkeleton() {
  return (
    <div className="space-y-6 animate-fade-in" role="status" aria-label="Dashboard wird geladen">
      {/* Stat cards row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-xl border border-border p-4 space-y-2">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-7 w-28" />
            <Skeleton className="h-3 w-16" />
          </div>
        ))}
      </div>
      {/* Filter bar */}
      <div className="flex gap-3">
        <Skeleton className="h-9 w-48" />
        <Skeleton className="h-9 w-32" />
        <Skeleton className="h-9 w-32" />
      </div>
      {/* Property cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="rounded-xl border border-border p-4 space-y-3">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-3 w-1/2" />
            <div className="flex gap-2">
              <Skeleton className="h-6 w-20" />
              <Skeleton className="h-6 w-20" />
            </div>
            <Skeleton className="h-3 w-full" />
          </div>
        ))}
      </div>
      <span className="sr-only">Laden...</span>
    </div>
  );
}

/** Table-based page skeleton (Deals, Contacts, Loans, Mietübersicht) */
export function TablePageSkeleton({ rows = 8 }: { rows?: number }) {
  return (
    <div className="space-y-4 animate-fade-in" role="status" aria-label="Tabelle wird geladen">
      {/* Header + search bar */}
      <div className="flex items-center justify-between">
        <Skeleton className="h-7 w-40" />
        <div className="flex gap-2">
          <Skeleton className="h-9 w-48" />
          <Skeleton className="h-9 w-24" />
        </div>
      </div>
      {/* Table header */}
      <div className="flex gap-4 px-4 py-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-3 flex-1" />
        ))}
      </div>
      {/* Table rows */}
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex gap-4 px-4 py-3 border-b border-border/50">
          {Array.from({ length: 5 }).map((_, j) => (
            <Skeleton key={j} className="h-4 flex-1" />
          ))}
        </div>
      ))}
      <span className="sr-only">Laden...</span>
    </div>
  );
}

/** Settings page skeleton */
export function SettingsSkeleton() {
  return (
    <div className="space-y-6 animate-fade-in" role="status" aria-label="Einstellungen werden geladen">
      <Skeleton className="h-7 w-48" />
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="rounded-xl border border-border p-5 space-y-3">
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-4 w-full max-w-md" />
          <Skeleton className="h-9 w-48" />
        </div>
      ))}
      <span className="sr-only">Laden...</span>
    </div>
  );
}

/** Detail page skeleton (PropertyDetail, etc.) */
export function DetailPageSkeleton() {
  return (
    <div className="space-y-6 animate-fade-in" role="status" aria-label="Details werden geladen">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Skeleton className="h-10 w-10 rounded-full" />
        <div className="space-y-2">
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-3 w-32" />
        </div>
      </div>
      {/* Tabs */}
      <div className="flex gap-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-9 w-24" />
        ))}
      </div>
      {/* Content area */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-xl border border-border p-4 space-y-3">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-6 w-32" />
            <Skeleton className="h-3 w-full" />
          </div>
        ))}
      </div>
      <span className="sr-only">Laden...</span>
    </div>
  );
}

/** CRM page skeleton */
export function CRMSkeleton() {
  return (
    <div className="space-y-4 animate-fade-in" role="status" aria-label="CRM wird geladen">
      <div className="flex items-center justify-between">
        <Skeleton className="h-7 w-32" />
        <Skeleton className="h-9 w-28" />
      </div>
      {/* Stats row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="surface-section p-3 space-y-1">
            <Skeleton className="h-3 w-16" />
            <Skeleton className="h-6 w-12" />
          </div>
        ))}
      </div>
      {/* Leads list */}
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="surface-section p-4 flex items-center gap-3">
          <Skeleton className="h-8 w-8 rounded-full" />
          <div className="flex-1 space-y-1">
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-3 w-24" />
          </div>
          <Skeleton className="h-6 w-16" />
        </div>
      ))}
      <span className="sr-only">Laden...</span>
    </div>
  );
}

/** IMP-131: Reusable loading spinner */
export const Spinner = ({ size = "md" }: { size?: "sm" | "md" | "lg" }) => {
  const sizeClasses = { sm: "h-4 w-4", md: "h-6 w-6", lg: "h-8 w-8" };
  return (
    <div className={`${sizeClasses[size]} animate-spin rounded-full border-2 border-muted-foreground/20 border-t-primary`} role="status" aria-label="Laden">
      <span className="sr-only">Laden...</span>
    </div>
  );
};
