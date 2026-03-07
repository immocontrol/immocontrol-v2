import { useState, useEffect } from "react";
import { BREAKPOINTS } from "@/lib/breakpoints";

/** IMP-136: Responsive media query hook */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.matchMedia(query).matches;
  });

  useEffect(() => {
    const mql = window.matchMedia(query);
    const handler = (e: MediaQueryListEvent) => {
      /* FIX: Skip media query updates when input is focused to prevent
         mobile keyboard open/close from triggering re-renders that steal focus */
      const active = document.activeElement;
      if (active && (active.tagName === "INPUT" || active.tagName === "TEXTAREA" || active.tagName === "SELECT")) {
        return;
      }
      setMatches(e.matches);
    };
    mql.addEventListener("change", handler);
    setMatches(mql.matches);
    return () => mql.removeEventListener("change", handler);
  }, [query]);

  return matches;
}

/** Convenience: check if mobile viewport (below sm) */
export const useIsMobile = () => useMediaQuery(`(max-width: ${BREAKPOINTS.sm - 1}px)`);

/** Convenience: check if tablet viewport (sm to lg-1) */
export const useIsTablet = () => useMediaQuery(`(min-width: ${BREAKPOINTS.sm}px) and (max-width: ${BREAKPOINTS.lg - 1}px)`);

/** Convenience: check if desktop viewport (lg+) */
export const useIsDesktop = () => useMediaQuery(`(min-width: ${BREAKPOINTS.lg}px)`);
