import { useState, useEffect } from "react";

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

/** Convenience: check if mobile viewport */
export const useIsMobile = () => useMediaQuery("(max-width: 639px)");

/** Convenience: check if tablet viewport */
export const useIsTablet = () => useMediaQuery("(min-width: 640px) and (max-width: 1023px)");

/** Convenience: check if desktop viewport */
export const useIsDesktop = () => useMediaQuery("(min-width: 1024px)");
