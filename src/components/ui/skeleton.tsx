import { cn } from "@/lib/utils";

export type SkeletonProps = React.HTMLAttributes<HTMLDivElement> & {
  /** Shimmer-Gradient statt einfachem Pulse (moderner, konsistent mit PageLoader). */
  shimmer?: boolean;
};

function Skeleton({ className, shimmer, ...props }: SkeletonProps) {
  return (
    <div
      className={cn(shimmer ? "rounded-md skeleton-shimmer" : "animate-pulse rounded-md bg-muted", className)}
      {...props}
    />
  );
}

export { Skeleton };
