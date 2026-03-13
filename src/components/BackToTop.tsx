import React from "react";
import { useState, useEffect, forwardRef } from "react";
import { ArrowUp } from "lucide-react";
import { createThrottle } from "@/lib/formatters";
import { cn } from "@/lib/utils";

/** Pixel ab dem der Button erscheint (erst bei ausreichend Scroll nach unten) */
const SCROLL_THRESHOLD = 380;

/** Scroll-Container: main (#main-content) wenn vorhanden und scrollbar, sonst window */
function getScrollContainer(): HTMLElement | typeof window {
  const main = document.getElementById("main-content");
  if (main && main.scrollHeight > main.clientHeight) return main;
  return window;
}

const BackToTop = forwardRef<HTMLButtonElement>((_, ref) => {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const container = getScrollContainer();
    const getScrollTop = () =>
      container === window ? window.scrollY : (container as HTMLElement).scrollTop;
    const onScroll = createThrottle(() => setVisible(getScrollTop() > SCROLL_THRESHOLD), 120);
    onScroll();
    container.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      container.removeEventListener("scroll", onScroll as EventListener);
      onScroll.cancel();
    };
  }, []);

  const scrollToTop = () => {
    const container = getScrollContainer();
    if (container === window) {
      window.scrollTo({ top: 0, behavior: "smooth" });
    } else {
      (container as HTMLElement).scrollTo({ top: 0, behavior: "smooth" });
    }
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
