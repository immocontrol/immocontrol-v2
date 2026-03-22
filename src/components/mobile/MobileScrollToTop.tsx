/**
 * MOB4-9: Mobile Scroll-to-Top FAB
 * Floating "scroll to top" button that appears after scrolling down.
 * Auto-hides when at top. Smooth scroll animation.
 */
import { useState, useEffect, useCallback, memo, useLayoutEffect } from "react";
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
  /** Gesetzter Scroll-Container, wenn Ref erst nach Mount gefüllt wird */
  const [resolvedScrollEl, setResolvedScrollEl] = useState<HTMLElement | null>(null);

  useLayoutEffect(() => {
    if (!scrollContainer) {
      setResolvedScrollEl(null);
      return;
    }
    const el = scrollContainer.current;
    if (el) {
      setResolvedScrollEl(el);
      return;
    }
    const id = window.setInterval(() => {
      const next = scrollContainer.current;
      if (next) {
        setResolvedScrollEl(next);
        window.clearInterval(id);
      }
    }, 48);
    const t = window.setTimeout(() => window.clearInterval(id), 4000);
    return () => {
      window.clearInterval(id);
      window.clearTimeout(t);
    };
  }, [scrollContainer]);

  useEffect(() => {
    let lastScrollY = 0;
    let ticking = false;

    const handleScroll = () => {
      if (ticking) return;
      ticking = true;

      requestAnimationFrame(() => {
        const scrollY = resolvedScrollEl
          ? resolvedScrollEl.scrollTop
          : getAppScrollTop();

        setVisible(scrollY > threshold);
        setIsScrollingUp(scrollY < lastScrollY);

        lastScrollY = scrollY;
        ticking = false;
      });
    };

    if (resolvedScrollEl) {
      resolvedScrollEl.addEventListener("scroll", handleScroll, { passive: true });
      handleScroll();
      return () => resolvedScrollEl.removeEventListener("scroll", handleScroll);
    }

    const main = document.getElementById("main-content");
    main?.addEventListener("scroll", handleScroll, { passive: true });
    window.addEventListener("scroll", handleScroll, { passive: true });
    handleScroll();
    return () => {
      main?.removeEventListener("scroll", handleScroll);
      window.removeEventListener("scroll", handleScroll);
    };
  }, [threshold, resolvedScrollEl]);

  const scrollToTop = useCallback(() => {
    const el = resolvedScrollEl ?? scrollContainer?.current;
    if (el) {
      el.scrollTo({ top: 0, behavior: "smooth" });
    } else {
      appScrollTo(0, "smooth");
    }
  }, [resolvedScrollEl, scrollContainer]);

  // Only show on mobile, and only when scrolled down + scrolling up
  if (!isMobile || !visible) return null;

  return (
    <button
      onClick={scrollToTop}
      className={cn(
        "fixed right-4 z-40 min-h-11 min-w-11 h-11 w-11 rounded-full touch-target",
        "bg-primary text-primary-foreground shadow-xl",
        "flex items-center justify-center",
        "transition-all duration-300",
        "active:scale-95 hover:shadow-xl",
        isScrollingUp
          ? "opacity-100 translate-y-0"
          : "opacity-60 translate-y-1",
        className
      )}
      style={{
        bottom: `calc(${bottomOffset}px + env(safe-area-inset-bottom, 0px))`,
      }}
      aria-label="Nach oben scrollen"
    >
      <ArrowUp className="w-5 h-5" />
    </button>
  );
});
