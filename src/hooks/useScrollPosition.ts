/**
 * UX-20: Remember scroll position on navigation
 * Saves and restores scroll position per route path.
 */
import { useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";

const scrollPositions = new Map<string, number>();

export function useScrollPosition() {
  const location = useLocation();
  const prevPath = useRef(location.pathname);

  /* Save scroll position when leaving a page */
  useEffect(() => {
    return () => {
      scrollPositions.set(prevPath.current, window.scrollY);
    };
  }, []);

  /* Update prevPath on navigation */
  useEffect(() => {
    /* Save old position */
    scrollPositions.set(prevPath.current, window.scrollY);
    prevPath.current = location.pathname;

    /* Restore saved position for new route, or scroll to top */
    const saved = scrollPositions.get(location.pathname);
    if (saved !== undefined && saved > 0) {
      requestAnimationFrame(() => {
        window.scrollTo({ top: saved, behavior: "instant" as ScrollBehavior });
      });
    } else {
      window.scrollTo({ top: 0, behavior: "instant" as ScrollBehavior });
    }
  }, [location.pathname]);
}
