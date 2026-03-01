import { useState, useEffect } from "react";
import { createThrottle, safeDivide } from "@/lib/formatters";

const ScrollProgress = () => {
  const [progress, setProgress] = useState(0);
  const [isPastHeader, setIsPastHeader] = useState(false);

  useEffect(() => {
    /* OPT-44: createThrottle for scroll listener */
    const onScroll = createThrottle(() => {
      const scrollTop = window.scrollY;
      const docHeight = document.documentElement.scrollHeight - window.innerHeight;
      setIsPastHeader(scrollTop > 72);
      setProgress(docHeight > 0 ? safeDivide(scrollTop * 100, docHeight, 0) : 0);
    }, 100);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => { window.removeEventListener("scroll", onScroll); onScroll.cancel(); };
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

export default ScrollProgress;
