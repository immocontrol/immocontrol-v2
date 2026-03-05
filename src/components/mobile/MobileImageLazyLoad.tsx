/**
 * MOB5-19: Mobile Image Lazy Load
 * Progressive image loading with blur-up placeholder effect.
 * Uses IntersectionObserver for lazy loading and smooth transitions.
 */
import { useState, useRef, useEffect, memo, useCallback } from "react";
import { useIsMobile } from "@/hooks/use-mobile";
import { ImageIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface MobileImageLazyLoadProps {
  /** Image source URL */
  src: string;
  /** Alt text */
  alt: string;
  /** Optional low-res placeholder (data URL or tiny image) */
  placeholder?: string;
  /** Aspect ratio (e.g., "16/9", "4/3", "1/1") */
  aspectRatio?: string;
  /** Width */
  width?: number | string;
  /** Height */
  height?: number | string;
  /** Object fit */
  objectFit?: "cover" | "contain" | "fill";
  /** Rounded corners */
  rounded?: boolean;
  /** Show loading skeleton */
  showSkeleton?: boolean;
  /** Root margin for intersection observer */
  rootMargin?: string;
  /** Click handler */
  onClick?: () => void;
  /** Additional class */
  className?: string;
}

export const MobileImageLazyLoad = memo(function MobileImageLazyLoad({
  src,
  alt,
  placeholder,
  aspectRatio,
  width,
  height,
  objectFit = "cover",
  rounded = true,
  showSkeleton = true,
  rootMargin = "200px 0px",
  onClick,
  className,
}: MobileImageLazyLoadProps) {
  const isMobile = useIsMobile();
  const [isInView, setIsInView] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);
  const [hasError, setHasError] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Intersection observer for lazy loading
  useEffect(() => {
    const element = containerRef.current;
    if (!element) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          setIsInView(true);
          observer.disconnect();
        }
      },
      { rootMargin }
    );

    observer.observe(element);
    return () => observer.disconnect();
  }, [rootMargin]);

  const handleLoad = useCallback(() => {
    setIsLoaded(true);
  }, []);

  const handleError = useCallback(() => {
    setHasError(true);
  }, []);

  return (
    <div
      ref={containerRef}
      className={cn(
        "relative overflow-hidden bg-muted",
        rounded && "rounded-lg",
        onClick && "cursor-pointer",
        className
      )}
      style={{
        width,
        height,
        aspectRatio,
      }}
      onClick={onClick}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={onClick ? (e) => {
        if (e.key === "Enter" || e.key === " ") onClick();
      } : undefined}
    >
      {/* Skeleton / placeholder */}
      {!isLoaded && !hasError && (
        <div className="absolute inset-0">
          {placeholder ? (
            /* Blur-up placeholder */
            <img
              src={placeholder}
              alt=""
              className={cn(
                "w-full h-full",
                objectFit === "cover" ? "object-cover" : objectFit === "contain" ? "object-contain" : "object-fill",
                "filter blur-xl scale-110"
              )}
              aria-hidden="true"
            />
          ) : showSkeleton ? (
            /* Skeleton loading */
            <div className="absolute inset-0 bg-muted animate-pulse flex items-center justify-center">
              <ImageIcon className="w-8 h-8 text-muted-foreground/30" />
            </div>
          ) : null}
        </div>
      )}

      {/* Error state */}
      {hasError && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-muted">
          <ImageIcon className="w-8 h-8 text-muted-foreground/50 mb-1" />
          <span className="text-[10px] text-muted-foreground">Bild nicht verfügbar</span>
        </div>
      )}

      {/* Actual image (only load when in viewport) */}
      {isInView && !hasError && (
        <img
          src={src}
          alt={alt}
          className={cn(
            "w-full h-full transition-opacity duration-500",
            objectFit === "cover" ? "object-cover" : objectFit === "contain" ? "object-contain" : "object-fill",
            isLoaded ? "opacity-100" : "opacity-0"
          )}
          onLoad={handleLoad}
          onError={handleError}
          loading="lazy"
          decoding="async"
        />
      )}
    </div>
  );
});

/**
 * Helper: Generate a tiny placeholder from a color.
 * Use this when you don't have a low-res thumbnail.
 */
export function generateColorPlaceholder(color: string = "#e5e7eb"): string {
  return `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='1' height='1'%3E%3Crect fill='${encodeURIComponent(color)}' width='1' height='1'/%3E%3C/svg%3E`;
}
