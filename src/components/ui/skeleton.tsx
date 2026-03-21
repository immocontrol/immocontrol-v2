import { cn } from "@/lib/utils";

export type SkeletonProps = React.HTMLAttributes<HTMLDivElement> & {
  /** Shimmer-Gradient statt einfachem Pulse (moderner, konsistent mit PageLoader). */
  shimmer?: boolean;
};

function Skeleton({ className, shimmer, ...props }: SkeletonProps) {
  return (
    <div
      className={cn(shimmer ? "rounded-lg skeleton-shimmer" : "animate-pulse rounded-lg bg-muted", className)}
      {...props}
    />
  );
}

export { Skeleton };
