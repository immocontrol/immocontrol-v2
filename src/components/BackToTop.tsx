import React from "react";
import { useState, useEffect, forwardRef } from "react";
import { ArrowUp } from "lucide-react";
import { createThrottle } from "@/lib/formatters";
import { cn } from "@/lib/utils";
import { appScrollTo, getAppScrollTop } from "@/lib/appScrollContainer";

/** Pixel ab dem der Button erscheint (erst bei ausreichend Scroll nach unten) */
const SCROLL_THRESHOLD = 380;

const BackToTop = forwardRef<HTMLButtonElement>((_, ref) => {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const onScroll = createThrottle(() => setVisible(getAppScrollTop() > SCROLL_THRESHOLD), 120);
    onScroll();
    const main = document.getElementById("main-content");
    main?.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      main?.removeEventListener("scroll", onScroll as EventListener);
      window.removeEventListener("scroll", onScroll as EventListener);
      onScroll.cancel();
    };
  }, []);

  const scrollToTop = () => {
    appScrollTo(0, "smooth");
  };

  return (
    <button
      ref={ref}
      type="button"
      onClick={scrollToTop}
      aria-label="Nach oben scrollen"
      className={cn(
        "btn-back-to-top touch-target",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#34c759] focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        visible
          ? "opacity-100 translate-y-0 pointer-events-auto"
          : "opacity-0 translate-y-3 pointer-events-none"
      )}
    >
      <ArrowUp className="h-6 w-6 md:h-5 md:w-5 shrink-0 text-white" strokeWidth={2.25} />
    </button>
  );
});

BackToTop.displayName = "BackToTop";

export default React.memo(BackToTop);
