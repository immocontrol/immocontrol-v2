/**
 * Dedizierte Seite für Passwort zurücksetzen nach Klick auf E-Mail-Link.
 * Zeigt nur das Formular zum Setzen eines neuen Passworts; nach Erfolg Abmeldung
 * und Weiterleitung zur Anmeldung, damit sich der Nutzer mit dem neuen Passwort einloggen kann.
 */
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Building2, Lock, Eye, EyeOff, Check, X } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ROUTES } from "@/lib/routes";
import { PasswordStrength } from "@/components/PasswordStrength";

const PasswordReset = () => {
  const { user, loading: authLoading, isRecoverySession, clearRecoverySession } = useAuth();
  const navigate = useNavigate();
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    document.title = "Neues Passwort setzen – ImmoControl";
  }, []);

  /* Kein Nutzer nach Laden → Link abgelaufen oder ungültig; zur Anmeldung */
  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      navigate(ROUTES.AUTH, { replace: true });
      return;
    }
    /* Eingeloggt, aber keine Recovery-Session → bereits normal angemeldet; zur Startseite */
    if (!isRecoverySession) {
      navigate(ROUTES.HOME, { replace: true });
    }
  }, [authLoading, user, isRecoverySession, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      toast.error("Passwörter stimmen nicht überein");
      return;
    }
    if (newPassword.length < 6) {
      toast.error("Passwort muss mindestens 6 Zeichen lang sein");
      return;
    }
    setSubmitting(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      toast.success("Neues Passwort gesetzt. Bitte melde dich mit dem neuen Passwort an.");
      clearRecoverySession();
      await supabase.auth.signOut();
      navigate(ROUTES.AUTH, { replace: true });
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Fehler beim Setzen des Passworts");
    } finally {
      setSubmitting(false);
    }
  };

  if (authLoading || !user || !isRecoverySession) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5 flex items-center justify-center p-4" role="main" aria-label="Laden">
        <div className="animate-pulse text-muted-foreground">Laden...</div>
      </div>
    );
  }

  return (
    <div
      className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5 flex items-center justify-center p-4 pb-[max(1rem,env(safe-area-inset-bottom))]"
      role="main"
      aria-label="Neues Passwort setzen"
    >
      <div className="w-full max-w-sm space-y-6 animate-fade-in">
        <div className="text-center space-y-3">
          <div className="flex items-center justify-center gap-2">
            <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
              <Building2 className="h-7 w-7 text-primary" />
            </div>
            <span className="text-2xl font-bold tracking-tight">ImmoControl</span>
          </div>
          <p className="text-sm text-muted-foreground">Setze ein neues Passwort für dein Konto</p>
        </div>

        <form onSubmit={handleSubmit} className="gradient-card rounded-xl border border-border p-6 space-y-4">
          <div className="flex items-center gap-2 text-primary bg-primary/10 rounded-lg px-3 py-2">
            <Lock className="h-4 w-4 shrink-0" />
            <p className="text-xs">
              Du bist über den Link aus der E-Mail hier. Setze jetzt ein neues Passwort; danach kannst du dich damit anmelden.
            </p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="new-password" className="text-xs text-muted-foreground">Neues Passwort *</Label>
            <div className="relative">
              <Input
                id="new-password"
                type={showNew ? "text" : "password"}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="••••••••"
                className="pl-3 pr-10 h-10"
                minLength={6}
                autoComplete="new-password"
                required
              />
              <button
                type="button"
                onClick={() => setShowNew(!showNew)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                tabIndex={-1}
                aria-label={showNew ? "Passwort verbergen" : "Passwort anzeigen"}
              >
                {showNew ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            <PasswordStrength password={newPassword} />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="confirm-password" className="text-xs text-muted-foreground">Passwort bestätigen *</Label>
            <div className="relative">
              <Input
                id="confirm-password"
                type={showConfirm ? "text" : "password"}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="••••••••"
                className="pl-3 pr-10 h-10"
                autoComplete="new-password"
                required
              />
              <button
                type="button"
                onClick={() => setShowConfirm(!showConfirm)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                tabIndex={-1}
                aria-label={showConfirm ? "Passwort verbergen" : "Passwort anzeigen"}
              >
                {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            {confirmPassword && newPassword !== confirmPassword && (
              <p className="text-[10px] text-loss flex items-center gap-1">
                <X className="h-3 w-3" /> Passwörter stimmen nicht überein
              </p>
            )}
            {confirmPassword && newPassword === confirmPassword && confirmPassword.length >= 6 && (
              <p className="text-[10px] text-profit flex items-center gap-1">
                <Check className="h-3 w-3" /> Passwörter stimmen überein
              </p>
            )}
          </div>

          <Button
            type="submit"
            className="w-full"
            disabled={submitting || !newPassword || newPassword !== confirmPassword || newPassword.length < 6}
          >
            {submitting ? "Wird gesetzt…" : "Neues Passwort setzen"}
          </Button>
        </form>
      </div>
    </div>
  );
};

export default PasswordReset;
