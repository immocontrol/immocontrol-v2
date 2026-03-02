import { useState, useEffect, forwardRef } from "react";
import { ArrowUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { createThrottle } from "@/lib/formatters";

const BackToTop = forwardRef<HTMLButtonElement>((_, ref) => {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    /* OPT-44: createThrottle for scroll listener */
    const onScroll = createThrottle(() => setVisible(window.scrollY > 400), 150);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => { window.removeEventListener("scroll", onScroll); onScroll.cancel(); };
  }, []);

  if (!visible) return null;

  return (
    <Button
      ref={ref}
      variant="outline"
      size="icon"
      className="fixed bottom-24 md:bottom-8 right-4 z-40 h-10 w-10 rounded-full shadow-lg bg-card/90 backdrop-blur-sm border-border hover:bg-primary hover:text-primary-foreground transition-all scroll-top-animate touch-target"
      onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
      aria-label="Nach oben scrollen"
    >
      <ArrowUp className="h-4 w-4" />
    </Button>
  );
});

BackToTop.displayName = "BackToTop";

export default BackToTop;
