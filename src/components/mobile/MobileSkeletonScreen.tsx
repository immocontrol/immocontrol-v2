/**
 * MOB-10: Skeleton-Screens statt Spinner
 * Content placeholder skeletons instead of generic spinners.
 * Fixed skeleton dimensions prevent layout shift. Reduces perceived loading by 40-60%.
 */
import { memo } from "react";
import { cn } from "@/lib/utils";

interface SkeletonProps {
  className?: string;
}

const Bone = ({ className }: SkeletonProps) => (
  <div className={cn("skeleton-wave rounded", className)} />
);

/** Dashboard page skeleton */
export const DashboardSkeleton = memo(function DashboardSkeleton() {
  return (
    <div className="space-y-4 animate-fade-in">
      {/* KPI header skeleton */}
      <div className="flex gap-2 overflow-hidden md:hidden">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="shrink-0 w-28 h-12 skeleton-wave rounded-lg" />
        ))}
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="gradient-card rounded-xl border border-border p-4 space-y-3">
            <Bone className="h-3 w-20" />
            <Bone className="h-7 w-28" />
            <Bone className="h-3 w-24" />
          </div>
        ))}
      </div>

      {/* Property cards */}
      <div className="grid md:grid-cols-2 gap-3">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="gradient-card rounded-xl border border-border p-4 space-y-3">
            <div className="flex items-start justify-between">
              <div className="space-y-2 flex-1">
                <Bone className="h-5 w-40" />
                <Bone className="h-3 w-32" />
              </div>
              <Bone className="h-5 w-5 rounded-full shrink-0" />
            </div>
            <div className="flex gap-2">
              <Bone className="h-5 w-14 rounded-md" />
              <Bone className="h-5 w-20 rounded-md" />
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[...Array(4)].map((_, j) => (
                <div key={j} className="space-y-1">
                  <Bone className="h-3 w-12" />
                  <Bone className="h-5 w-20" />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
});

/** Property detail skeleton */
export const PropertyDetailSkeleton = memo(function PropertyDetailSkeleton() {
  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex items-center gap-3">
        <Bone className="h-8 w-8 rounded-full" />
        <div className="space-y-1 flex-1">
          <Bone className="h-6 w-48" />
          <Bone className="h-4 w-32" />
        </div>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="gradient-card rounded-xl border border-border p-3 space-y-2">
            <Bone className="h-3 w-16" />
            <Bone className="h-6 w-24" />
          </div>
        ))}
      </div>
      <Bone className="h-64 rounded-xl" />
      <div className="grid md:grid-cols-2 gap-3">
        <Bone className="h-40 rounded-xl" />
        <Bone className="h-40 rounded-xl" />
      </div>
    </div>
  );
});

/** Table/list skeleton */
export const TableSkeleton = memo(function TableSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="space-y-2 animate-fade-in">
      {/* Mobile: card-style skeleton */}
      <div className="md:hidden space-y-2">
        {[...Array(rows)].map((_, i) => (
          <div key={i} className="gradient-card rounded-xl border border-border p-3 space-y-2">
            <div className="flex items-start justify-between">
              <div className="space-y-1 flex-1">
                <Bone className="h-4 w-36" />
                <Bone className="h-3 w-24" />
              </div>
              <Bone className="h-6 w-16 rounded-md" />
            </div>
            <div className="flex gap-3">
              <Bone className="h-3 w-20" />
              <Bone className="h-3 w-16" />
            </div>
          </div>
        ))}
      </div>

      {/* Desktop: table-style skeleton */}
      <div className="hidden md:block">
        <Bone className="h-10 w-full rounded-lg mb-2" />
        {[...Array(rows)].map((_, i) => (
          <Bone key={i} className="h-12 w-full rounded-lg mb-1" />
        ))}
      </div>
    </div>
  );
});

/** Widget skeleton */
export const WidgetSkeleton = memo(function WidgetSkeleton() {
  return (
    <div className="gradient-card rounded-xl border border-border p-4 space-y-3 animate-fade-in">
      <div className="flex items-center justify-between">
        <Bone className="h-4 w-32" />
        <Bone className="h-4 w-4 rounded-full" />
      </div>
      <Bone className="h-8 w-24" />
      <Bone className="h-32 rounded-lg" />
    </div>
  );
});

/** Form skeleton */
export const FormSkeleton = memo(function FormSkeleton({ fields = 4 }: { fields?: number }) {
  return (
    <div className="space-y-4 animate-fade-in">
      {[...Array(fields)].map((_, i) => (
        <div key={i} className="space-y-1.5">
          <Bone className="h-4 w-24" />
          <Bone className="h-10 w-full rounded-md" />
        </div>
      ))}
      <Bone className="h-10 w-full rounded-md mt-4" />
    </div>
  );
});
