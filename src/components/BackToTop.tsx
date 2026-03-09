import React from "react";
import { useState, useEffect, forwardRef } from "react";
import { ArrowUp } from "lucide-react";
import { createThrottle } from "@/lib/formatters";
import { cn } from "@/lib/utils";

/** Pixel ab dem der Button erscheint (erst bei ausreichend Scroll nach unten) */
const SCROLL_THRESHOLD = 380;

const BackToTop = forwardRef<HTMLButtonElement>((_, ref) => {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const onScroll = createThrottle(() => setVisible(window.scrollY > SCROLL_THRESHOLD), 120);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => { window.removeEventListener("scroll", onScroll); onScroll.cancel(); };
  }, []);

  return (
    <button
      ref={ref}
      type="button"
      onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
      aria-label="Nach oben scrollen"
      className={cn(
        "fixed z-40",
        "bottom-28 left-4 md:bottom-8 md:left-auto md:right-6",
        "h-12 w-12 md:h-11 md:w-11 rounded-full",
        "flex items-center justify-center touch-target",
        "bg-background/95 dark:bg-background/90 text-foreground backdrop-blur-xl",
        "border border-border/80 shadow-lg shadow-black/5 dark:shadow-black/20",
        "hover:bg-primary/10 hover:text-primary hover:border-primary/30 hover:shadow-xl hover:shadow-primary/5",
        "active:scale-[0.96]",
        "transition-all duration-300 ease-out",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        visible
          ? "opacity-100 translate-y-0 pointer-events-auto"
          : "opacity-0 translate-y-3 pointer-events-none"
      )}
    >
      <ArrowUp className="h-5 w-5 md:h-4 md:w-4 shrink-0" strokeWidth={2.5} />
    </button>
  );
});

BackToTop.displayName = "BackToTop";

export default React.memo(BackToTop);
