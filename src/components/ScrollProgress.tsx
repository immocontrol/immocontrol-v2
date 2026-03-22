import React from "react";
import { useState, useEffect } from "react";
import { createThrottle, safeDivide } from "@/lib/formatters";
import { getAppScrollRange, getAppScrollTop } from "@/lib/appScrollContainer";

const ScrollProgress = () => {
  const [progress, setProgress] = useState(0);
  const [isPastHeader, setIsPastHeader] = useState(false);

  useEffect(() => {
    /* Gleicher Scroll-Container wie #main-content (overflow) — nicht nur window */
    const onScroll = createThrottle(() => {
      const scrollTop = getAppScrollTop();
      const range = getAppScrollRange();
      setIsPastHeader(scrollTop > 72);
      setProgress(range > 0 ? safeDivide(scrollTop * 100, range, 0) : 0);
    }, 100);
    onScroll();
    const main = document.getElementById("main-content");
    main?.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      main?.removeEventListener("scroll", onScroll);
      window.removeEventListener("scroll", onScroll);
      onScroll.cancel();
    };
  }, []);

  // Hide while the header/menu is still visible near the top
  if (!isPastHeader || progress < 2) return null;

  return (
    <div className="fixed top-0 left-0 right-0 z-[200] h-0.5">
      <div
        className="h-full bg-primary/60 transition-[width] duration-150 ease-out"
        style={{ width: `${progress}%` }}
      />
    </div>
  );
};

/* IMP-56: Memoize ScrollProgress */
export default React.memo(ScrollProgress);
