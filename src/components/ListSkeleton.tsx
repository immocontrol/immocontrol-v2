/**
 * #10: Skeleton Loading for all data lists.
 * Reusable skeleton component that mimics the shape of list items.
 */

interface ListSkeletonProps {
  /** Number of skeleton rows to show */
  rows?: number;
  /** Layout variant */
  variant?: "card" | "row" | "stat";
  /** Show avatar/icon placeholder */
  showAvatar?: boolean;
}

export function ListSkeleton({ rows = 5, variant = "row", showAvatar = false }: ListSkeletonProps) {
  if (variant === "card") {
    return (
      <div className="grid gap-3 md:grid-cols-2">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="gradient-card rounded-xl border border-border p-4 space-y-3 animate-pulse" style={{ animationDelay: `${i * 100}ms` }}>
            <div className="flex items-center gap-3">
              {showAvatar && <div className="w-10 h-10 rounded-lg bg-secondary" />}
              <div className="flex-1 space-y-2">
                <div className="h-4 w-3/4 bg-secondary rounded" />
                <div className="h-3 w-1/2 bg-secondary/60 rounded" />
              </div>
            </div>
            <div className="flex gap-2">
              <div className="h-6 w-20 bg-secondary/50 rounded-md" />
              <div className="h-6 w-16 bg-secondary/50 rounded-md" />
              <div className="h-6 w-24 bg-secondary/50 rounded-md" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (variant === "stat") {
    return (
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="gradient-card rounded-xl border border-border p-4 space-y-2 animate-pulse" style={{ animationDelay: `${i * 80}ms` }}>
            <div className="h-3 w-16 bg-secondary rounded" />
            <div className="h-7 w-24 bg-secondary rounded" />
            <div className="h-3 w-20 bg-secondary/60 rounded" />
          </div>
        ))}
      </div>
    );
  }

  // Default: row variant
  return (
    <div className="space-y-2">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 p-3 rounded-lg animate-pulse" style={{ animationDelay: `${i * 60}ms` }}>
          {showAvatar && <div className="w-9 h-9 rounded-full bg-secondary shrink-0" />}
          <div className="flex-1 space-y-1.5">
            <div className="h-4 w-2/3 bg-secondary rounded" />
            <div className="h-3 w-1/3 bg-secondary/60 rounded" />
          </div>
          <div className="h-6 w-16 bg-secondary/50 rounded-md shrink-0" />
        </div>
      ))}
    </div>
  );
}

export default ListSkeleton;
