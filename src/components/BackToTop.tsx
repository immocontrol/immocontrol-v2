import { useState, useEffect, forwardRef } from "react";
import { ArrowUp } from "lucide-react";
import { Button } from "@/components/ui/button";

const BackToTop = forwardRef<HTMLButtonElement>((_, ref) => {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const onScroll = () => setVisible(window.scrollY > 400);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  if (!visible) return null;

  return (
    <Button
      ref={ref}
      variant="outline"
      size="icon"
      className="fixed bottom-20 md:bottom-8 right-4 z-40 h-10 w-10 rounded-full shadow-lg bg-card/90 backdrop-blur-sm border-border hover:bg-primary hover:text-primary-foreground transition-all animate-fade-in"
      onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
      aria-label="Nach oben scrollen"
    >
      <ArrowUp className="h-4 w-4" />
    </Button>
  );
});

BackToTop.displayName = "BackToTop";

export default BackToTop;
