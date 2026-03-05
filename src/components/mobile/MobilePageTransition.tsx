/**
 * MOB4-2: Mobile Page Transitions
 * Slide animations for page changes giving a native app feel.
 * Uses CSS transforms for GPU-accelerated transitions.
 */
import { useState, useEffect, useRef, memo, type ReactNode } from "react";
import { useLocation } from "react-router-dom";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";

interface MobilePageTransitionProps {
  children: ReactNode;
  /** Duration of the transition in ms */
  duration?: number;
  /** Type of animation */
  type?: "slide" | "fade" | "slide-up";
}

// Route order for determining slide direction
const ROUTE_ORDER = [
  "/", "/portfolio", "/dashboard", "/immobilien",
  "/deals", "/crm", "/kontakte", "/todos",
  "/dokumente", "/darlehen", "/nebenkosten", "/mietuebersicht",
  "/berichte", "/cashflow", "/wartung", "/newsticker",
  "/schnellbewertung", "/einstellungen",
];

function getRouteIndex(path: string): number {
  const idx = ROUTE_ORDER.indexOf(path);
  return idx >= 0 ? idx : ROUTE_ORDER.length;
}

export const MobilePageTransition = memo(function MobilePageTransition({
  children,
  duration = 250,
  type = "slide",
}: MobilePageTransitionProps) {
  const isMobile = useIsMobile();
  const location = useLocation();
  const [displayChildren, setDisplayChildren] = useState(children);
  const [animationClass, setAnimationClass] = useState("");
  const prevPath = useRef(location.pathname);
  const isAnimating = useRef(false);

  useEffect(() => {
    if (!isMobile || isAnimating.current) {
      setDisplayChildren(children);
      return;
    }

    const currentPath = location.pathname;
    const prevIndex = getRouteIndex(prevPath.current);
    const currentIndex = getRouteIndex(currentPath);

    if (prevPath.current === currentPath) {
      setDisplayChildren(children);
      return;
    }

    isAnimating.current = true;

    // Determine animation direction
    let exitClass = "";
    let enterClass = "";

    if (type === "slide") {
      const goingForward = currentIndex > prevIndex;
      exitClass = goingForward ? "mob4-slide-exit-left" : "mob4-slide-exit-right";
      enterClass = goingForward ? "mob4-slide-enter-right" : "mob4-slide-enter-left";
    } else if (type === "fade") {
      exitClass = "mob4-fade-exit";
      enterClass = "mob4-fade-enter";
    } else if (type === "slide-up") {
      exitClass = "mob4-slide-up-exit";
      enterClass = "mob4-slide-up-enter";
    }

    // Phase 1: Exit animation
    setAnimationClass(exitClass);

    const exitTimer = setTimeout(() => {
      // Phase 2: Swap content and enter animation
      setDisplayChildren(children);
      setAnimationClass(enterClass);

      const enterTimer = setTimeout(() => {
        setAnimationClass("");
        isAnimating.current = false;
      }, duration);

      return () => clearTimeout(enterTimer);
    }, duration);

    prevPath.current = currentPath;

    return () => clearTimeout(exitTimer);
  }, [children, location.pathname, isMobile, duration, type]);

  if (!isMobile) {
    return <>{children}</>;
  }

  return (
    <div
      className={cn("mob4-page-transition", animationClass)}
      style={{
        "--mob4-transition-duration": `${duration}ms`,
      } as React.CSSProperties}
    >
      {displayChildren}
    </div>
  );
});

/**
 * CSS to be added to global styles:
 *
 * .mob4-page-transition {
 *   will-change: transform, opacity;
 * }
 * .mob4-slide-exit-left { animation: mob4SlideExitLeft var(--mob4-transition-duration) ease-out forwards; }
 * .mob4-slide-exit-right { animation: mob4SlideExitRight var(--mob4-transition-duration) ease-out forwards; }
 * .mob4-slide-enter-right { animation: mob4SlideEnterRight var(--mob4-transition-duration) ease-out forwards; }
 * .mob4-slide-enter-left { animation: mob4SlideEnterLeft var(--mob4-transition-duration) ease-out forwards; }
 * .mob4-fade-exit { animation: mob4FadeOut var(--mob4-transition-duration) ease-out forwards; }
 * .mob4-fade-enter { animation: mob4FadeIn var(--mob4-transition-duration) ease-out forwards; }
 * .mob4-slide-up-exit { animation: mob4SlideUpExit var(--mob4-transition-duration) ease-out forwards; }
 * .mob4-slide-up-enter { animation: mob4SlideUpEnter var(--mob4-transition-duration) ease-out forwards; }
 *
 * @keyframes mob4SlideExitLeft { from { transform: translateX(0); opacity: 1; } to { transform: translateX(-30%); opacity: 0; } }
 * @keyframes mob4SlideExitRight { from { transform: translateX(0); opacity: 1; } to { transform: translateX(30%); opacity: 0; } }
 * @keyframes mob4SlideEnterRight { from { transform: translateX(30%); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
 * @keyframes mob4SlideEnterLeft { from { transform: translateX(-30%); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
 * @keyframes mob4FadeOut { from { opacity: 1; } to { opacity: 0; } }
 * @keyframes mob4FadeIn { from { opacity: 0; } to { opacity: 1; } }
 * @keyframes mob4SlideUpExit { from { transform: translateY(0); opacity: 1; } to { transform: translateY(-20px); opacity: 0; } }
 * @keyframes mob4SlideUpEnter { from { transform: translateY(20px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
 */
