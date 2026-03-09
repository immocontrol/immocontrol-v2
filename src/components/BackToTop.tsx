import React from "react";
import { useState, useEffect, forwardRef } from "react";
import { ChevronUp } from "lucide-react";
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
        "h-12 w-12 md:h-11 md:w-11 rounded-2xl md:rounded-full",
        "flex items-center justify-center touch-target",
        "bg-primary text-primary-foreground",
        "backdrop-blur-xl shadow-lg shadow-primary/25 dark:shadow-primary/15",
        "border-0 md:border md:border-border",
        "md:bg-background/95 md:dark:bg-background/90 md:text-muted-foreground",
        "md:hover:text-primary md:hover:bg-primary/10 md:hover:border-primary/30",
        "transition-all duration-300 ease-out",
        "active:scale-90 hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        visible
          ? "opacity-100 translate-y-0 scale-100 pointer-events-auto"
          : "opacity-0 translate-y-4 scale-95 pointer-events-none"
      )}
    >
      <ChevronUp className="h-6 w-6 md:h-5 md:w-5 shrink-0" strokeWidth={2.5} />
    </button>
  );
});

BackToTop.displayName = "BackToTop";

export default React.memo(BackToTop);
