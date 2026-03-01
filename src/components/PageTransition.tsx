import { ReactNode, useState, useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";

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
      }, 150);
      return () => clearTimeout(timeout);
    } else {
      setDisplayChildren(children);
    }
  }, [children, location.pathname]);

  return (
    <div
      className={transitionStage === "fade-in"
        ? "animate-in fade-in slide-in-from-bottom-1 duration-200 ease-out"
        : "animate-out fade-out slide-out-to-top-1 duration-150 ease-in"}
    >
      {displayChildren}
    </div>
  );
};

export default PageTransition;
