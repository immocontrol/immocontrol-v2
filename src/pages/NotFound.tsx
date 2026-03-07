import { useLocation, Link, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { ROUTES } from "@/lib/routes";
import { Building2, ArrowLeft } from "lucide-react";
import { logger } from "@/lib/logger";

const NotFound = () => {
  /* IMP-10: Document title */
  useEffect(() => { document.title = "Seite nicht gefunden – ImmoControl"; }, []);
  const location = useLocation();
  const navigate = useNavigate();
  const [countdown, setCountdown] = useState(10);

  useEffect(() => {
    logger.error(`404: User attempted to access non-existent route: ${location.pathname}`, "Router");
  }, [location.pathname]);

  useEffect(() => {
    if (countdown <= 0) return;
    const timer = setInterval(() => {
      setCountdown((prev) => (prev <= 1 ? 0 : prev - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [countdown]);

  useEffect(() => {
    if (countdown === 0) navigate(ROUTES.HOME);
  }, [countdown, navigate]);

  return (
    <div className="flex flex-col items-center justify-center py-20 text-center animate-fade-in" role="main" aria-label="Seite nicht gefunden">
      <div className="w-20 h-20 rounded-2xl bg-primary/10 flex items-center justify-center mb-6">
        <Building2 className="h-10 w-10 text-primary" />
      </div>
      <h1 className="text-6xl font-bold text-primary mb-2">404</h1>
      <p className="text-lg text-muted-foreground mb-2">Diese Seite wurde nicht gefunden</p>
      <p className="text-xs text-muted-foreground mb-6" role="status" aria-live="polite" aria-atomic="true">
        Automatische Weiterleitung in {countdown}s…
      </p>
      <Link
        to={ROUTES.HOME}
        className="inline-flex items-center gap-2 text-sm font-medium text-primary hover:text-primary/80 focus-visible:outline focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 rounded-md transition-colors"
      >
        <ArrowLeft className="h-4 w-4" /> Zurück zum Portfolio
      </Link>
    </div>
  );
};

export default NotFound;
