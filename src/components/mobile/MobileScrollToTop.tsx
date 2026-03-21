/**
 * MOB4-9: Mobile Scroll-to-Top FAB
 * Floating "scroll to top" button that appears after scrolling down.
 * Auto-hides when at top. Smooth scroll animation.
 */
import { useState, useEffect, useCallback, memo } from "react";
import { useIsMobile } from "@/hooks/use-mobile";
import { ArrowUp } from "lucide-react";
import { cn } from "@/lib/utils";

interface MobileScrollToTopProps {
  /** Scroll threshold in pixels before showing button */
  threshold?: number;
  /** Bottom offset (for bottom nav) */
  bottomOffset?: number;
  /** Additional class */
  className?: string;
  /** Scroll container ref (defaults to window) */
  scrollContainer?: React.RefObject<HTMLElement>;
}

export const MobileScrollToTop = memo(function MobileScrollToTop({
  threshold = 400,
  bottomOffset = 80,
  className,
  scrollContainer,
}: MobileScrollToTopProps) {
  const isMobile = useIsMobile();
  const [visible, setVisible] = useState(false);
  const [isScrollingUp, setIsScrollingUp] = useState(false);

  useEffect(() => {
    let lastScrollY = 0;
    let ticking = false;

    const handleScroll = () => {
      if (ticking) return;
      ticking = true;

      requestAnimationFrame(() => {
        const container = scrollContainer?.current;
        const scrollY = container ? container.scrollTop : window.scrollY;

        setVisible(scrollY > threshold);
        setIsScrollingUp(scrollY < lastScrollY);

        lastScrollY = scrollY;
        ticking = false;
      });
    };

    const target = scrollContainer?.current ?? window;
    target.addEventListener("scroll", handleScroll, { passive: true });

    return () => {
      target.removeEventListener("scroll", handleScroll);
    };
  }, [threshold, scrollContainer]);

  const scrollToTop = useCallback(() => {
    const container = scrollContainer?.current;
    if (container) {
      container.scrollTo({ top: 0, behavior: "smooth" });
    } else {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }, [scrollContainer]);

  // Only show on mobile, and only when scrolled down + scrolling up
  if (!isMobile || !visible) return null;

  return (
    <button
      onClick={scrollToTop}
      className={cn(
        "fixed right-4 z-40 w-10 h-10 rounded-full",
        "bg-primary text-primary-foreground shadow-xl",
        "flex items-center justify-center",
        "transition-all duration-300",
        "active:scale-95 hover:shadow-xl",
        isScrollingUp
          ? "opacity-100 translate-y-0"
          : "opacity-60 translate-y-1",
        className
      )}
      style={{ bottom: `${bottomOffset}px` }}
      aria-label="Nach oben scrollen"
    >
      <ArrowUp className="w-5 h-5" />
    </button>
  );
});
