import { useEffect, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { CheckCircle, XCircle, Loader2 } from "lucide-react";

const Einladung = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const token = searchParams.get("token");
  const [status, setStatus] = useState<"loading" | "success" | "error" | "no-token" | "need-auth">("loading");
  const [message, setMessage] = useState("");
  const [redirectCount, setRedirectCount] = useState(5);

  useEffect(() => {
    if (!token) {
      setStatus("no-token");
      return;
    }

    if (authLoading) return;

    if (!user) {
      setStatus("need-auth");
      return;
    }

    const acceptInvitation = async () => {
      try {
        const { data, error } = await supabase.functions.invoke("accept-invitation", {
          body: { token },
        });

        if (error || !data?.success) {
          setStatus("error");
          setMessage(data?.error || error?.message || "Ein Fehler ist aufgetreten");
          return;
        }

        setStatus("success");
        setMessage(data.message);
      } catch (err: any) {
        setStatus("error");
        setMessage(err.message || "Unbekannter Fehler");
      }
    };

    acceptInvitation();
  }, [token, user, authLoading]);

  // Auto-redirect after success
  useEffect(() => {
    if (status !== "success") return;
    const timer = setInterval(() => {
      setRedirectCount((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          navigate("/");
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [status, navigate]);

  if (status === "loading" || authLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto" />
          <p className="text-muted-foreground">Einladung wird verarbeitet...</p>
        </div>
      </div>
    );
  }

  if (status === "no-token") {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-4 max-w-md">
          <XCircle className="h-12 w-12 text-destructive mx-auto" />
          <h1 className="text-xl font-bold">Ungültiger Link</h1>
          <p className="text-muted-foreground">Dieser Einladungslink ist ungültig oder unvollständig.</p>
          <Button onClick={() => navigate("/auth")}>Zur Anmeldung</Button>
        </div>
      </div>
    );
  }

  if (status === "need-auth") {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-4 max-w-md">
          <h1 className="text-xl font-bold">Bitte melde dich an</h1>
          <p className="text-muted-foreground">
            Du musst dich anmelden oder registrieren, um die Einladung anzunehmen.
          </p>
          <Button onClick={() => {
            sessionStorage.setItem("invitation_token", token || "");
            navigate("/auth");
          }}>
            Anmelden / Registrieren
          </Button>
        </div>
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-4 max-w-md">
          <XCircle className="h-12 w-12 text-destructive mx-auto" />
          <h1 className="text-xl font-bold">Fehler</h1>
          <p className="text-muted-foreground">{message}</p>
          <Button onClick={() => navigate("/")}>Zur Startseite</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="text-center space-y-4 max-w-md animate-fade-in">
        <CheckCircle className="h-12 w-12 text-profit mx-auto" />
        <h1 className="text-xl font-bold">Willkommen!</h1>
        <p className="text-muted-foreground">{message}</p>
        <p className="text-xs text-muted-foreground">Weiterleitung in {redirectCount}s…</p>
        <Button onClick={() => navigate("/")}>Zum Mieterportal</Button>
      </div>
    </div>
  );
};

export default Einladung;
