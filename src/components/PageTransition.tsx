import { ReactNode } from "react";

interface PageTransitionProps {
  children: ReactNode;
}

const PageTransition = ({ children }: PageTransitionProps) => {
  return (
    <div className="animate-in fade-in duration-150">
      {children}
    </div>
  );
};

export default PageTransition;
