import { ReactNode, useState, useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";

/* OPT-28: Transition duration constants */
const FADE_OUT_DURATION = 150;
const FADE_IN_CLASS = "animate-in fade-in slide-in-from-bottom-1 duration-200 ease-out";
const FADE_OUT_CLASS = "animate-out fade-out slide-out-to-top-1 duration-150 ease-in";

interface PageTransitionProps {
  children: ReactNode;
}

const PageTransition = ({ children }: PageTransitionProps) => {
  const location = useLocation();
  const [displayChildren, setDisplayChildren] = useState(children);
  const [transitionStage, setTransitionStage] = useState("fade-in");
  const prevPath = useRef(location.pathname);

  useEffect(() => {
    if (location.pathname !== prevPath.current) {
      setTransitionStage("fade-out");
      const timeout = setTimeout(() => {
        setDisplayChildren(children);
        setTransitionStage("fade-in");
        prevPath.current = location.pathname;
      }, FADE_OUT_DURATION);
      return () => clearTimeout(timeout);
    } else {
      setDisplayChildren(children);
    }
  }, [children, location.pathname]);

  return (
    <div
      /* OPT-29: Use constants for transition classes */
      className={transitionStage === "fade-in" ? FADE_IN_CLASS : FADE_OUT_CLASS}
    >
      {displayChildren}
    </div>
  );
};

export default PageTransition;
