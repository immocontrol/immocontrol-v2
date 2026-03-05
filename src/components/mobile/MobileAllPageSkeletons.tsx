/**
 * MOB3-13: Mobile Skeleton Screens for All Pages
 * Page-specific skeleton screens for CRM, Todos, Contacts, Berichte, Wartung.
 * Safari-safe: uses CSS animations instead of JS for smooth rendering.
 */
import { memo } from "react";
import { cn } from "@/lib/utils";

const Bone = ({ className }: { className?: string }) => (
  <div className={cn("bg-secondary animate-pulse rounded", className)} />
);

/** CRM page skeleton */
export const CRMSkeleton = memo(function CRMSkeleton() {
  return (
    <div className="space-y-4" role="status" aria-label="CRM wird geladen">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <Bone className="h-7 w-48" />
          <Bone className="h-4 w-64" />
        </div>
        <Bone className="h-9 w-24 rounded-lg" />
      </div>
      {/* Stats */}
      <div className="grid grid-cols-2 gap-3">
        {[1, 2, 3, 4].map(i => (
          <div key={i} className="rounded-xl border border-border p-3 space-y-2">
            <Bone className="h-3 w-16" />
            <Bone className="h-6 w-12" />
          </div>
        ))}
      </div>
      {/* Search */}
      <Bone className="h-10 w-full rounded-lg" />
      {/* Lead cards */}
      {[1, 2, 3, 4, 5].map(i => (
        <div key={i} className="rounded-xl border border-border p-4 space-y-2">
          <div className="flex items-center justify-between">
            <Bone className="h-5 w-36" />
            <Bone className="h-5 w-16 rounded-full" />
          </div>
          <Bone className="h-3 w-48" />
          <Bone className="h-3 w-32" />
        </div>
      ))}
    </div>
  );
});

/** Todos page skeleton */
export const TodosSkeleton = memo(function TodosSkeleton() {
  return (
    <div className="flex gap-4 min-h-[60vh]" role="status" aria-label="Aufgaben werden geladen">
      {/* Sidebar (hidden on mobile) */}
      <div className="hidden md:block w-56 shrink-0 space-y-2">
        {[1, 2, 3, 4].map(i => <Bone key={i} className="h-9 rounded-lg" />)}
        <div className="mt-4 space-y-1.5">
          {[1, 2, 3].map(i => <Bone key={i} className="h-7 rounded" />)}
        </div>
      </div>
      {/* Main content */}
      <div className="flex-1 space-y-3">
        <div className="flex items-center gap-2">
          <Bone className="h-6 w-32" />
          <Bone className="h-5 w-16 rounded-full" />
        </div>
        <Bone className="h-10 w-full rounded-lg" />
        {[1, 2, 3, 4, 5, 6].map(i => (
          <div key={i} className="flex items-center gap-3 py-2">
            <Bone className="h-5 w-5 rounded-full shrink-0" />
            <div className="flex-1 space-y-1">
              <Bone className="h-4 w-3/4" />
              <Bone className="h-3 w-1/3" />
            </div>
            <Bone className="h-4 w-12 rounded-full" />
          </div>
        ))}
      </div>
    </div>
  );
});

/** Berichte (Reports) page skeleton */
export const BerichteSkeleton = memo(function BerichteSkeleton() {
  return (
    <div className="space-y-4" role="status" aria-label="Berichte werden geladen">
      <Bone className="h-7 w-40" />
      <Bone className="h-4 w-56" />
      {/* Filter bar */}
      <div className="flex gap-2">
        {[1, 2, 3].map(i => <Bone key={i} className="h-9 w-28 rounded-lg" />)}
      </div>
      {/* Charts */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {[1, 2].map(i => (
          <div key={i} className="rounded-xl border border-border p-4 space-y-3">
            <Bone className="h-5 w-32" />
            <Bone className="h-40 w-full rounded-lg" />
          </div>
        ))}
      </div>
      {/* Table */}
      <div className="rounded-xl border border-border p-4 space-y-2">
        <Bone className="h-5 w-24" />
        {[1, 2, 3, 4].map(i => (
          <div key={i} className="flex items-center gap-3">
            <Bone className="h-4 w-1/4" />
            <Bone className="h-4 w-1/4" />
            <Bone className="h-4 w-1/4" />
            <Bone className="h-4 w-1/4" />
          </div>
        ))}
      </div>
    </div>
  );
});

/** Wartung (Maintenance) page skeleton */
export const WartungSkeleton = memo(function WartungSkeleton() {
  return (
    <div className="space-y-4" role="status" aria-label="Wartungsplaner wird geladen">
      <div className="flex items-center justify-between">
        <Bone className="h-7 w-44" />
        <Bone className="h-9 w-28 rounded-lg" />
      </div>
      {/* Calendar-like grid */}
      <div className="grid grid-cols-7 gap-1">
        {Array.from({ length: 7 }).map((_, i) => <Bone key={`h${i}`} className="h-6 rounded" />)}
        {Array.from({ length: 35 }).map((_, i) => <Bone key={i} className="h-12 rounded" />)}
      </div>
      {/* Upcoming tasks */}
      {[1, 2, 3].map(i => (
        <div key={i} className="rounded-xl border border-border p-3 flex items-center gap-3">
          <Bone className="h-10 w-10 rounded-lg shrink-0" />
          <div className="flex-1 space-y-1">
            <Bone className="h-4 w-40" />
            <Bone className="h-3 w-24" />
          </div>
          <Bone className="h-6 w-16 rounded-full" />
        </div>
      ))}
    </div>
  );
});

/** Newsticker page skeleton */
export const NewstickerSkeleton = memo(function NewstickerSkeleton() {
  return (
    <div className="space-y-4" role="status" aria-label="Newsticker wird geladen">
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <Bone className="h-7 w-56" />
          <Bone className="h-4 w-40" />
        </div>
        <div className="flex gap-2">
          <Bone className="h-9 w-24 rounded-lg" />
          <Bone className="h-9 w-24 rounded-lg" />
        </div>
      </div>
      {/* Stats cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {[1, 2, 3].map(i => <Bone key={i} className="h-20 rounded-xl" />)}
      </div>
      {/* Search */}
      <Bone className="h-10 w-full rounded-lg" />
      {/* News cards */}
      {[1, 2, 3, 4, 5].map(i => (
        <div key={i} className="rounded-xl border border-border p-4 space-y-2">
          <div className="flex gap-2">
            <Bone className="h-4 w-20 rounded-full" />
            <Bone className="h-4 w-16 rounded-full" />
          </div>
          <Bone className="h-5 w-full" />
          <Bone className="h-4 w-3/4" />
          <div className="flex gap-3">
            <Bone className="h-3 w-20" />
            <Bone className="h-3 w-16" />
          </div>
        </div>
      ))}
    </div>
  );
});
