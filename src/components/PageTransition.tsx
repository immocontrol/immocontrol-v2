import { useLocation } from "react-router-dom";
import { ReactNode, useRef, useState, useEffect } from "react";

interface PageTransitionProps {
  children: ReactNode;
}

const PageTransition = ({ children }: PageTransitionProps) => {
  const location = useLocation();
  const [displayChildren, setDisplayChildren] = useState(children);
  const [visible, setVisible] = useState(true);
  const prevPathRef = useRef(location.pathname);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (prevPathRef.current === location.pathname) return;
    prevPathRef.current = location.pathname;

    if (timerRef.current) clearTimeout(timerRef.current);

    setVisible(false);
    timerRef.current = setTimeout(() => {
      setDisplayChildren(children);
      setVisible(true);
      timerRef.current = null;
    }, 100);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [location.pathname]);

  useEffect(() => {
    if (prevPathRef.current === location.pathname) {
      setDisplayChildren(children);
    }
  }, [children, location.pathname]);

  return (
    <div
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? "translateY(0)" : "translateY(4px)",
        transition: "opacity 150ms ease-in-out, transform 150ms ease-in-out",
      }}
    >
      {displayChildren}
    </div>
  );
};

export default PageTransition;
