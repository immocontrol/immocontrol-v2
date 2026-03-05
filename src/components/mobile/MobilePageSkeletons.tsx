/**
 * MOB2-10: Seiten-Skeleton-Screens
 * Page-specific skeleton screens for every major page.
 * Each skeleton matches the actual page layout for seamless loading.
 */
import { memo } from "react";
import { cn } from "@/lib/utils";

const Bone = ({ className }: { className?: string }) => (
  <div className={cn("skeleton-wave rounded", className)} />
);

/** Deals/Kanban page skeleton */
export const DealsSkeleton = memo(function DealsSkeleton() {
  return (
    <div className="space-y-3 animate-fade-in">
      {/* Pipeline tabs */}
      <div className="flex gap-2 overflow-hidden">
        {[...Array(5)].map((_, i) => (
          <Bone key={i} className="shrink-0 h-8 w-24 rounded-full" />
        ))}
      </div>
      {/* Deal cards */}
      {[...Array(4)].map((_, i) => (
        <div key={i} className="gradient-card rounded-xl border border-border p-3 space-y-2">
          <div className="flex items-center justify-between">
            <Bone className="h-4 w-32" />
            <Bone className="h-5 w-16 rounded-md" />
          </div>
          <Bone className="h-3 w-24" />
          <div className="flex gap-2">
            <Bone className="h-3 w-20" />
            <Bone className="h-3 w-16" />
          </div>
        </div>
      ))}
    </div>
  );
});

/** Contacts page skeleton */
export const ContactsSkeleton = memo(function ContactsSkeleton() {
  return (
    <div className="space-y-2 animate-fade-in">
      <Bone className="h-10 w-full rounded-lg" />
      {[...Array(6)].map((_, i) => (
        <div key={i} className="flex items-center gap-3 p-3 gradient-card rounded-xl border border-border">
          <Bone className="h-10 w-10 rounded-full shrink-0" />
          <div className="flex-1 space-y-1">
            <Bone className="h-4 w-32" />
            <Bone className="h-3 w-24" />
          </div>
          <Bone className="h-5 w-14 rounded-md" />
        </div>
      ))}
    </div>
  );
});

/** Documents page skeleton */
export const DocumentsSkeleton = memo(function DocumentsSkeleton() {
  return (
    <div className="space-y-3 animate-fade-in">
      <div className="flex gap-2">
        <Bone className="h-10 flex-1 rounded-lg" />
        <Bone className="h-10 w-10 rounded-lg" />
      </div>
      <div className="grid grid-cols-2 gap-2">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="gradient-card rounded-xl border border-border p-3 space-y-2">
            <Bone className="h-20 rounded-lg" />
            <Bone className="h-3 w-24" />
            <Bone className="h-3 w-16" />
          </div>
        ))}
      </div>
    </div>
  );
});

/** Messages/Communication page skeleton */
export const MessagesSkeleton = memo(function MessagesSkeleton() {
  return (
    <div className="space-y-2 animate-fade-in">
      {[...Array(5)].map((_, i) => (
        <div key={i} className="flex items-start gap-3 p-3 gradient-card rounded-xl border border-border">
          <Bone className="h-10 w-10 rounded-full shrink-0" />
          <div className="flex-1 space-y-1">
            <div className="flex items-center justify-between">
              <Bone className="h-4 w-28" />
              <Bone className="h-3 w-12" />
            </div>
            <Bone className="h-3 w-full" />
            <Bone className="h-3 w-3/4" />
          </div>
        </div>
      ))}
    </div>
  );
});

/** Cash forecast page skeleton */
export const CashForecastSkeleton = memo(function CashForecastSkeleton() {
  return (
    <div className="space-y-3 animate-fade-in">
      <div className="flex gap-2">
        {[...Array(3)].map((_, i) => (
          <Bone key={i} className="h-8 flex-1 rounded-full" />
        ))}
      </div>
      <Bone className="h-48 rounded-xl" />
      {[...Array(4)].map((_, i) => (
        <div key={i} className="flex items-center gap-3 p-3 gradient-card rounded-xl border border-border">
          <Bone className="h-8 w-8 rounded-full shrink-0" />
          <div className="flex-1 space-y-1">
            <Bone className="h-4 w-32" />
            <Bone className="h-3 w-20" />
          </div>
          <Bone className="h-5 w-20" />
        </div>
      ))}
    </div>
  );
});

/** Settings page skeleton */
export const SettingsSkeleton = memo(function SettingsSkeleton() {
  return (
    <div className="space-y-4 animate-fade-in">
      <Bone className="h-6 w-40" />
      {[...Array(5)].map((_, i) => (
        <div key={i} className="flex items-center justify-between p-3 gradient-card rounded-xl border border-border">
          <div className="flex items-center gap-3">
            <Bone className="h-8 w-8 rounded-lg" />
            <div className="space-y-1">
              <Bone className="h-4 w-28" />
              <Bone className="h-3 w-36" />
            </div>
          </div>
          <Bone className="h-6 w-10 rounded-full" />
        </div>
      ))}
    </div>
  );
});
