/**
 * UX-20: Remember scroll position on navigation
 * Saves and restores scroll position per route path.
 *
 * Uses a passive scroll listener to continuously track the current scroll position,
 * so when navigation occurs the saved value reflects the user's actual position
 * (not the post-render position of the new page).
 */
import { useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";
import { appScrollTo, getAppScrollTop } from "@/lib/appScrollContainer";

const scrollPositions = new Map<string, number>();

export function useScrollPosition() {
  const location = useLocation();
  const prevPath = useRef(location.pathname);

  /* Continuously save scroll position via scroll event listener.
     This ensures the map always has the user's *actual* scroll position
     for the current route, even before a navigation triggers a re-render. */
  useEffect(() => {
    const onScroll = () => {
      scrollPositions.set(location.pathname, getAppScrollTop());
    };
    const main = document.getElementById("main-content");
    main?.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      main?.removeEventListener("scroll", onScroll);
      window.removeEventListener("scroll", onScroll);
    };
  }, [location.pathname]);

  /* On navigation: restore saved position for the new route, or scroll to top */
  useEffect(() => {
    if (prevPath.current === location.pathname) return;
    prevPath.current = location.pathname;

    const saved = scrollPositions.get(location.pathname);
    if (saved !== undefined && saved > 0) {
      requestAnimationFrame(() => {
        appScrollTo(saved, "instant");
      });
    } else {
      appScrollTo(0, "instant");
    }
  }, [location.pathname]);
}
