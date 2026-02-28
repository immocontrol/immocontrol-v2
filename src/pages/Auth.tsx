import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Building2, Mail, Lock, User, Eye, EyeOff, ArrowLeft, KeyRound } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { toast } from "sonner";

type AuthMode = "login" | "register" | "forgot";

const Auth = () => {
  const [mode, setMode] = useState<AuthMode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [resetSent, setResetSent] = useState(false);
  const navigate = useNavigate();
  const { user } = useAuth();

  useEffect(() => {
    if (user) {
      const invitationToken = sessionStorage.getItem("invitation_token");
      if (invitationToken) {
        sessionStorage.removeItem("invitation_token");
        navigate(`/einladung?token=${invitationToken}`, { replace: true });
      } else {
        navigate("/", { replace: true });
      }
    }
  }, [user, navigate]);

  const translateError = (msg: string): string => {
    if (msg.includes("Invalid login")) return "E-Mail oder Passwort ist falsch";
    if (msg.includes("Email not confirmed")) return "Bitte bestätige zuerst deine E-Mail-Adresse";
    if (msg.includes("already registered")) return "Diese E-Mail ist bereits registriert";
    if (msg.includes("Password should be")) return "Passwort muss mindestens 6 Zeichen lang sein";
    if (msg.includes("rate limit")) return "Zu viele Versuche. Bitte warte einen Moment.";
    if (msg.includes("email")) return "Bitte gib eine gültige E-Mail-Adresse ein";
    return msg;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (mode === "forgot") {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/einstellungen`,
        });
        if (error) throw error;
        setResetSent(true);
        toast.success("Link zum Zurücksetzen wurde gesendet!");
      } else if (mode === "login") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        toast.success("Willkommen zurück!");
        navigate("/");
      } else {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: window.location.origin,
            data: { display_name: displayName },
          },
        });
        if (error) throw error;
        if (data.session) {
          toast.success("Willkommen bei ImmoControl!");
          navigate("/");
        } else {
          toast.success("Konto erstellt! Bitte bestätige deine E-Mail-Adresse.");
        }
      }
    } catch (error: unknown) {
      toast.error(translateError(error instanceof Error ? error.message : "Ein Fehler ist aufgetreten"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-sm space-y-6 animate-fade-in" style={{ animationDelay: "100ms" }}>
        <div className="text-center space-y-3">
          <div className="flex items-center justify-center gap-2">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center glow-primary">
              <Building2 className="h-6 w-6 text-primary" />
            </div>
            <span className="text-2xl font-bold tracking-tight">ImmoControl</span>
          </div>
          <p className="text-sm text-muted-foreground">
            {mode === "login" && "Melde dich an, um dein Portfolio zu verwalten"}
            {mode === "register" && "Erstelle ein Konto für dein Portfolio"}
            {mode === "forgot" && "Setze dein Passwort zurück"}
          </p>
          {mode === "register" && (
            <div className="flex flex-wrap justify-center gap-2 mt-2">
              {["📊 Rendite-Tracking", "💰 Cashflow-Analyse", "📄 PDF-Berichte", "👥 Mieterportal"].map((f) => (
                <span key={f} className="text-[11px] bg-secondary text-secondary-foreground px-2 py-1 rounded-md">{f}</span>
              ))}
            </div>
          )}
        </div>

        <form onSubmit={handleSubmit} className="gradient-card rounded-xl border border-border p-6 space-y-4">
          {/* Back button for forgot mode */}
          {mode === "forgot" && (
            <button
              type="button"
              onClick={() => { setMode("login"); setResetSent(false); }}
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              <ArrowLeft className="h-3 w-3" /> Zurück zur Anmeldung
            </button>
          )}

          {/* Forgot password success */}
          {mode === "forgot" && resetSent ? (
            <div className="text-center py-4 space-y-3">
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
                <KeyRound className="h-6 w-6 text-primary" />
              </div>
              <div>
                <p className="text-sm font-medium">E-Mail gesendet!</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Prüfe dein Postfach für <strong>{email}</strong> und klicke auf den Link zum Zurücksetzen.
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => { setResetSent(false); setMode("login"); }}
              >
                Zurück zur Anmeldung
              </Button>
            </div>
          ) : (
            <>
              {/* Name field for register */}
              {mode === "register" && (
                <div className="space-y-1.5">
                  <Label htmlFor="name" className="text-xs text-muted-foreground">Name</Label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="name"
                      placeholder="Max Mustermann"
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      className="pl-10 h-10"
                      autoComplete="name"
                    />
                  </div>
                </div>
              )}

              {/* Email */}
              <div className="space-y-1.5">
                <Label htmlFor="email" className="text-xs text-muted-foreground">E-Mail</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                   <Input
                    id="email"
                    type="email"
                    placeholder="deine@email.de"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="pl-10 h-10"
                    autoComplete="email"
                    autoFocus
                  />
                </div>
              </div>

              {/* Password (not shown in forgot mode) */}
              {mode !== "forgot" && (
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="password" className="text-xs text-muted-foreground">Passwort</Label>
                    {mode === "login" && (
                      <button
                        type="button"
                        onClick={() => setMode("forgot")}
                        className="text-[11px] text-primary hover:underline font-medium"
                      >
                        Passwort vergessen?
                      </button>
                    )}
                  </div>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      minLength={6}
                      className="pl-10 pr-10 h-10"
                      autoComplete={mode === "login" ? "current-password" : "new-password"}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                      tabIndex={-1}
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  {mode === "register" && password.length > 0 && (
                    <div className="space-y-1.5 mt-1">
                      <div className="flex gap-1">
                        {[1, 2, 3, 4].map((level) => (
                          <div
                            key={level}
                            className={`h-1 flex-1 rounded-full transition-colors ${
                              password.length >= level * 3
                                ? password.length >= 12 ? "bg-profit" : password.length >= 8 ? "bg-gold" : "bg-loss"
                                : "bg-secondary"
                            }`}
                          />
                        ))}
                      </div>
                      <p className="text-[10px] text-muted-foreground">
                        {password.length < 6 ? "Mindestens 6 Zeichen" : password.length < 8 ? "Gut – 8+ Zeichen sind besser" : password.length < 12 ? "Stark" : "Sehr stark 🔒"}
                      </p>
                    </div>
                  )}
                </div>
              )}

              <Button
                type="submit"
                className="w-full"
                disabled={loading || !email.trim() || (mode !== "forgot" && password.length < 6)}
              >
                {loading ? (
                  <span className="flex items-center gap-2"><span className="h-4 w-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" /> Laden...</span>
                ) : mode === "login" ? "Anmelden" : mode === "register" ? "Konto erstellen" : "Link senden"}
              </Button>

              {mode !== "forgot" && (
                <>
                  <div className="flex items-center gap-3 my-1">
                    <Separator className="flex-1" />
                    <span className="text-xs text-muted-foreground">oder</span>
                    <Separator className="flex-1" />
                  </div>

                   <Button
                    type="button"
                    variant="outline"
                    className="w-full"
                    disabled={loading}
                    onClick={async () => {
                      setLoading(true);
                      const { error } = await lovable.auth.signInWithOAuth("google", {
                        redirect_uri: window.location.origin,
                      });
                      if (error) {
                        toast.error(translateError(error.message || "Google Login fehlgeschlagen"));
                        setLoading(false);
                      }
                    }}
                  >
                    <svg className="h-4 w-4 mr-2" viewBox="0 0 24 24">
                      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
                      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                    </svg>
                    Mit Google anmelden
                  </Button>

                  <Button
                    type="button"
                    variant="secondary"
                    className="w-full"
                    disabled={loading}
                    onClick={async () => {
                      setLoading(true);
                      try {
                        const { error } = await supabase.auth.signInAnonymously();
                        if (error) throw error;
                        toast.success("Test-Zugang erstellt! 🧪");
                      } catch (error: unknown) {
                        toast.error(translateError(error instanceof Error ? error.message : "Test-Login fehlgeschlagen"));
                      } finally {
                        setLoading(false);
                      }
                    }}
                  >
                    🧪 Als Testnutzer starten
                  </Button>
                </>
              )}
            </>
          )}
        </form>

        {mode !== "forgot" && (
          <div className="text-center space-y-2">
            <p className="text-sm text-muted-foreground">
              {mode === "login" ? "Noch kein Konto?" : "Bereits registriert?"}{" "}
              <button
                onClick={() => setMode(mode === "login" ? "register" : "login")}
                className="text-primary hover:underline font-medium"
              >
                {mode === "login" ? "Registrieren" : "Anmelden"}
              </button>
            </p>
            {mode === "register" && (
              <p className="text-[10px] text-muted-foreground">
                Mit der Registrierung akzeptierst du unsere Nutzungsbedingungen und Datenschutzrichtlinie.
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default Auth;
