import React from "react";
import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { appScrollTo } from "@/lib/appScrollContainer";

const ScrollToTop = () => {
  const { pathname } = useLocation();
  useEffect(() => {
    appScrollTo(0, "instant");
  }, [pathname]);
  return null;
};

/* IMP-53: Memoize ScrollToTop */
export default React.memo(ScrollToTop);
