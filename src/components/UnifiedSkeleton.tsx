/** UX-5: Unified Skeleton Loading for all pages
 * Provides consistent skeleton patterns across the entire app. */
import { memo } from "react";

interface SkeletonProps {
  className?: string;
}

const Skeleton = memo(({ className = "" }: SkeletonProps) => (
  <div className={`skeleton-wave rounded ${className}`} />
));
Skeleton.displayName = "Skeleton";

/** Standard page skeleton with header + cards */
const PageSkeleton = memo(({ cards = 4, title = true }: { cards?: number; title?: boolean }) => (
  <div className="space-y-6 animate-fade-in">
    {title && (
      <div className="flex items-center justify-between">
        <div>
          <Skeleton className="h-7 w-48" />
          <Skeleton className="h-4 w-32 mt-2" />
        </div>
        <Skeleton className="h-9 w-32" />
      </div>
    )}
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
      {Array.from({ length: cards }).map((_, i) => (
        <div key={i} className="gradient-card rounded-xl border border-border p-4 space-y-3">
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-7 w-28" />
          <Skeleton className="h-3 w-24" />
        </div>
      ))}
    </div>
    <Skeleton className="h-48 w-full rounded-xl" />
  </div>
));
PageSkeleton.displayName = "PageSkeleton";

/** Table skeleton */
const TableSkeleton = memo(({ rows = 5 }: { rows?: number }) => (
  <div className="space-y-2">
    <div className="flex gap-4 px-3 py-2">
      <Skeleton className="h-4 w-1/4" />
      <Skeleton className="h-4 w-1/4" />
      <Skeleton className="h-4 w-1/4" />
      <Skeleton className="h-4 w-1/4" />
    </div>
    {Array.from({ length: rows }).map((_, i) => (
      <div key={i} className="flex gap-4 px-3 py-3 border-b border-border/50">
        <Skeleton className="h-4 w-1/4" />
        <Skeleton className="h-4 w-1/4" />
        <Skeleton className="h-4 w-1/4" />
        <Skeleton className="h-4 w-1/4" />
      </div>
    ))}
  </div>
));
TableSkeleton.displayName = "TableSkeleton";

/** Kanban board skeleton */
const KanbanSkeleton = memo(({ columns = 4 }: { columns?: number }) => (
  <div className="flex gap-4 overflow-x-auto pb-4">
    {Array.from({ length: columns }).map((_, i) => (
      <div key={i} className="min-w-[250px] space-y-3">
        <Skeleton className="h-6 w-24" />
        <div className="space-y-2">
          <Skeleton className="h-24 w-full rounded-lg" />
          <Skeleton className="h-24 w-full rounded-lg" />
          <Skeleton className="h-16 w-full rounded-lg" />
        </div>
      </div>
    ))}
  </div>
));
KanbanSkeleton.displayName = "KanbanSkeleton";

export { Skeleton, PageSkeleton, TableSkeleton, KanbanSkeleton };
