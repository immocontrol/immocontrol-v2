import { ReactNode, useState, useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";

/* Smooth cross-fade transition: no flicker, no layout shift */
interface PageTransitionProps {
  children: ReactNode;
}

const PageTransition = ({ children }: PageTransitionProps) => {
  const location = useLocation();
  const [displayChildren, setDisplayChildren] = useState(children);
  const [opacity, setOpacity] = useState(1);
  const prevPath = useRef(location.pathname);
  const isTransitioning = useRef(false);
  const latestChildrenRef = useRef(children);
  latestChildrenRef.current = children;

  useEffect(() => {
    if (location.pathname === prevPath.current || isTransitioning.current) return;
    isTransitioning.current = true;
    /* Fade out quickly */
    setOpacity(0);
    const timeout = setTimeout(() => {
      setDisplayChildren(latestChildrenRef.current);
      /* Fade in */
      requestAnimationFrame(() => {
        setOpacity(1);
        prevPath.current = location.pathname;
        isTransitioning.current = false;
      });
    }, 120);
    return () => { clearTimeout(timeout); isTransitioning.current = false; };
  }, [location.pathname]);

  return (
    <div
      style={{
        opacity,
        transition: "opacity 150ms ease-in-out",
        willChange: "opacity",
      }}
    >
      {displayChildren}
    </div>
  );
};

export default PageTransition;
