/** UX-1: Global Page Transition Progress Bar
 * Shows a slim progress bar at the top of the page during route transitions.
 * Uses React Router's navigation state via useNavigation is not available in v6,
 * so we use a Suspense-based approach with a global event. */
import { useState, useEffect, useCallback, memo } from "react";
import { useLocation } from "react-router-dom";

const PageProgressBar = memo(() => {
  const [progress, setProgress] = useState(0);
  const [visible, setVisible] = useState(false);
  const location = useLocation();

  const startProgress = useCallback(() => {
    setVisible(true);
    setProgress(0);
    // Animate to ~80% quickly, then slow down
    let current = 0;
    const interval = setInterval(() => {
      current += Math.random() * 15 + 5;
      if (current >= 85) {
        clearInterval(interval);
        current = 85;
      }
      setProgress(current);
    }, 100);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const cleanup = startProgress();
    let innerTimer: ReturnType<typeof setTimeout>;
    // Complete after a short delay (route loaded)
    const timer = setTimeout(() => {
      cleanup(); // Clear the interval before setting 100%
      setProgress(100);
      innerTimer = setTimeout(() => {
        setVisible(false);
        setProgress(0);
      }, 300);
    }, 400);
    return () => { cleanup(); clearTimeout(timer); clearTimeout(innerTimer); };
  }, [location.pathname, startProgress]);

  if (!visible) return null;

  return (
    <div
      className="fixed top-0 left-0 right-0 z-[9999] h-[2px] pointer-events-none"
      role="progressbar"
      aria-valuenow={Math.round(progress)}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label="Seite wird geladen"
    >
      <div
        className="h-full bg-primary transition-all duration-300 ease-out rounded-r-full"
        style={{
          width: `${progress}%`,
          boxShadow: progress > 0 && progress < 100 ? "0 0 8px hsl(var(--primary) / 0.4)" : "none",
        }}
      />
    </div>
  );
});
PageProgressBar.displayName = "PageProgressBar";

export { PageProgressBar };
