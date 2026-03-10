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
        "bottom-24 left-4 md:bottom-8 md:left-auto md:right-6",
        "h-11 w-11 md:h-10 md:w-10 rounded-full",
        "flex items-center justify-center touch-target",
        // Modern floating FAB style
        "bg-primary text-primary-foreground shadow-lg shadow-primary/25",
        "border border-primary/70 backdrop-blur-xl",
        "hover:bg-primary/90 hover:shadow-xl hover:shadow-primary/35",
        "active:scale-[0.96]",
        "transition-all duration-300 ease-out",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        visible
          ? "opacity-100 translate-y-0 pointer-events-auto"
          : "opacity-0 translate-y-3 pointer-events-none"
      )}
    >
      <ArrowUp className="h-5 w-5 md:h-4 md:w-4 shrink-0" strokeWidth={2.4} />
    </button>
  );
});

BackToTop.displayName = "BackToTop";

export default React.memo(BackToTop);
