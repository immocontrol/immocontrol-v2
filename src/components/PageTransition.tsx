import { ReactNode, useState, useEffect, useRef, useCallback } from "react";
import { useLocation } from "react-router-dom";

/* Smooth cross-fade transition — eliminates double-loading by:
   1. Immediately swapping children on route change (no stale content)
   2. Using a single short fade-in animation (no fade-out → fade-in cycle)
   3. Keeping willChange: opacity for GPU-accelerated transitions */
interface PageTransitionProps {
  children: ReactNode;
}

const PageTransition = ({ children }: PageTransitionProps) => {
  const location = useLocation();
  const prevPath = useRef(location.pathname);
  const [opacity, setOpacity] = useState(1);
  const timeoutRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    if (location.pathname === prevPath.current) return;
    prevPath.current = location.pathname;

    /* Single fade-in: briefly dim, then fade in new content.
       No fade-out phase = no "double loading" appearance */
    setOpacity(0.3);
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => {
      requestAnimationFrame(() => setOpacity(1));
    }, 30);

    return () => { if (timeoutRef.current) clearTimeout(timeoutRef.current); };
  }, [location.pathname]);

  return (
    <div
      style={{
        opacity,
        transition: "opacity 180ms ease-out",
        willChange: "opacity",
      }}
    >
      {children}
    </div>
  );
};

export default PageTransition;
