/**
 * MOB4-9: Mobile Scroll-to-Top FAB
 * Floating "scroll to top" button that appears after scrolling down.
 * Auto-hides when at top. Smooth scroll animation.
 */
import { useState, useEffect, useCallback, memo } from "react";
import { useIsMobile } from "@/hooks/use-mobile";
import { ArrowUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { appScrollTo, getAppScrollTop } from "@/lib/appScrollContainer";

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
        const scrollY = scrollContainer?.current
          ? scrollContainer.current.scrollTop
          : getAppScrollTop();

        setVisible(scrollY > threshold);
        setIsScrollingUp(scrollY < lastScrollY);

        lastScrollY = scrollY;
        ticking = false;
      });
    };

    const custom = scrollContainer?.current;
    if (custom) {
      custom.addEventListener("scroll", handleScroll, { passive: true });
      handleScroll();
      return () => custom.removeEventListener("scroll", handleScroll);
    }

    const main = document.getElementById("main-content");
    main?.addEventListener("scroll", handleScroll, { passive: true });
    window.addEventListener("scroll", handleScroll, { passive: true });
    handleScroll();
    return () => {
      main?.removeEventListener("scroll", handleScroll);
      window.removeEventListener("scroll", handleScroll);
    };
  }, [threshold, scrollContainer]);

  const scrollToTop = useCallback(() => {
    if (scrollContainer?.current) {
      scrollContainer.current.scrollTo({ top: 0, behavior: "smooth" });
    } else {
      appScrollTo(0, "smooth");
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
