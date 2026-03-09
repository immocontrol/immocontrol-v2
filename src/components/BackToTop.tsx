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
        "bg-primary/95 text-primary-foreground backdrop-blur-md",
        "shadow-[0_4px_20px_-4px_rgba(0,0,0,0.15),0_0_0_1px_rgba(255,255,255,0.06)_inset]",
        "dark:shadow-[0_4px_24px_-4px_rgba(0,0,0,0.4),0_0_0_1px_rgba(255,255,255,0.04)_inset]",
        "border border-white/15 dark:border-white/10",
        "md:bg-background/90 md:dark:bg-background/85 md:text-foreground md:border-border",
        "md:hover:bg-primary/10 md:hover:text-primary md:hover:border-primary/25 md:hover:shadow-md",
        "transition-[transform,opacity,box-shadow] duration-300 ease-out",
        "hover:scale-105 active:scale-[0.97]",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        visible
          ? "opacity-100 translate-y-0 pointer-events-auto"
          : "opacity-0 translate-y-3 pointer-events-none"
      )}
    >
      <ArrowUp className="h-5 w-5 md:h-4 md:w-4 shrink-0" strokeWidth={2.25} />
    </button>
  );
});

BackToTop.displayName = "BackToTop";

export default React.memo(BackToTop);
