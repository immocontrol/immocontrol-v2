import { useLocation } from "react-router-dom";
import { ReactNode, useRef, useState, useEffect } from "react";

interface PageTransitionProps {
  children: ReactNode;
}

const PageTransition = ({ children }: PageTransitionProps) => {
  const location = useLocation();
  const [displayChildren, setDisplayChildren] = useState(children);
  const [phase, setPhase] = useState<"visible" | "exit" | "enter">("visible");
  const prevPathRef = useRef(location.pathname);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (prevPathRef.current === location.pathname) return;
    prevPathRef.current = location.pathname;

    if (timerRef.current) clearTimeout(timerRef.current);

    setPhase("exit");
    timerRef.current = setTimeout(() => {
      setDisplayChildren(children);
      setPhase("enter");
      timerRef.current = setTimeout(() => {
        setPhase("visible");
        timerRef.current = null;
      }, 200);
    }, 120);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [location.pathname]);

  useEffect(() => {
    if (prevPathRef.current === location.pathname) {
      setDisplayChildren(children);
    }
  }, [children, location.pathname]);

  const style: React.CSSProperties = phase === "exit"
    ? { opacity: 0, transform: "translateX(-12px) scale(0.99)", transition: "opacity 120ms ease-out, transform 120ms ease-out" }
    : phase === "enter"
    ? { opacity: 1, transform: "translateX(0) scale(1)", transition: "opacity 200ms cubic-bezier(0.22,1,0.36,1), transform 200ms cubic-bezier(0.22,1,0.36,1)" }
    : { opacity: 1, transform: "none" };

  return (
    <div style={style}>
      {displayChildren}
    </div>
  );
};

export default PageTransition;
