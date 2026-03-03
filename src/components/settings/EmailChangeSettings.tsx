/**
 * Settings Page-Splitting — Email Change section extracted from Settings.tsx
 */
import { useState } from "react";
import { Mail, Eye, EyeOff, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface EmailChangeSettingsProps {
  sectionRef: (el: HTMLElement | null) => void;
}

export function EmailChangeSettings({ sectionRef }: EmailChangeSettingsProps) {
  const { user } = useAuth();
  const [step, setStep] = useState<"idle" | "password" | "new-email" | "new-code">("idle");
  const [password, setPassword] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleStart = async () => {
    if (!user?.email || !password.trim()) {
      toast.error("Bitte gib dein aktuelles Passwort ein");
      return;
    }
    setLoading(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const previousSession = sessionData?.session;

      const { error: verifyError } = await supabase.auth.signInWithPassword({
        email: user.email,
        password,
      });
      if (verifyError) {
        if (previousSession) {
          await supabase.auth.setSession({
            access_token: previousSession.access_token,
            refresh_token: previousSession.refresh_token,
          });
        }
        toast.error("Passwort ist falsch");
        setLoading(false);
        return;
      }
      if (previousSession) {
        await supabase.auth.setSession({
          access_token: previousSession.access_token,
          refresh_token: previousSession.refresh_token,
        });
      }
      setStep("new-email");
      toast.success("Passwort bestätigt — gib jetzt deine neue E-Mail ein");
    } catch {
      toast.error("Fehler bei der Passwort-Überprüfung");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitNew = async () => {
    if (!newEmail.trim() || !newEmail.includes("@")) {
      toast.error("Bitte gib eine gültige E-Mail-Adresse ein");
      return;
    }
    if (newEmail === user?.email) {
      toast.error("Die neue E-Mail ist identisch mit der aktuellen");
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ email: newEmail });
      if (error) {
        toast.error(error.message);
      } else {
        setStep("new-code");
        toast.success(`Bestätigungslink an ${newEmail} gesendet`);
      }
    } catch {
      toast.error("Fehler beim Ändern der E-Mail");
    } finally {
      setLoading(false);
    }
  };

  const reset = () => {
    setStep("idle");
    setPassword("");
    setNewEmail("");
  };

  return (
    <div id="email" ref={sectionRef} className="gradient-card rounded-xl border border-border p-5 space-y-4 animate-fade-in [animation-delay:75ms] scroll-mt-20">
      <h2 className="text-sm font-semibold flex items-center gap-2">
        <Mail className="h-4 w-4 text-muted-foreground" /> E-Mail-Adresse ändern
      </h2>
      <p className="text-xs text-muted-foreground">
        Zur Sicherheit bestätigst du zuerst dein aktuelles Passwort. Danach gibst du die neue E-Mail ein.
        Supabase sendet Bestätigungslinks an die alte und neue E-Mail-Adresse.
      </p>

      {step === "idle" && (
        <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setStep("password")}>
          <Mail className="h-3.5 w-3.5" /> E-Mail ändern
        </Button>
      )}

      {step === "password" && (
        <div className="space-y-3">
          <div className="p-3 rounded-lg bg-secondary/30 border border-border">
            <p className="text-xs text-muted-foreground mb-1">Aktuelle E-Mail</p>
            <p className="text-sm font-medium">{user?.email}</p>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Aktuelles Passwort bestätigen *</Label>
            <div className="relative">
              <Input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="h-9 text-sm pr-10"
                autoComplete="current-password"
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
          </div>
          <div className="flex gap-2">
            <Button size="sm" onClick={handleStart} disabled={loading || !password}>
              {loading ? "Prüfe..." : "Passwort bestätigen"}
            </Button>
            <Button variant="ghost" size="sm" onClick={reset}>Abbrechen</Button>
          </div>
        </div>
      )}

      {step === "new-email" && (
        <div className="space-y-3">
          <div className="p-3 rounded-lg bg-primary/5 border border-primary/20">
            <p className="text-xs text-primary font-medium flex items-center gap-1.5">
              <Check className="h-3.5 w-3.5" /> Passwort bestätigt
            </p>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Neue E-Mail-Adresse *</Label>
            <Input
              type="email"
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              placeholder="neue@email.de"
              className="h-9 text-sm"
            />
          </div>
          <div className="flex gap-2">
            <Button size="sm" onClick={handleSubmitNew} disabled={loading || !newEmail.includes("@")}>
              {loading ? "Sende..." : "Bestätigungslink senden"}
            </Button>
            <Button variant="ghost" size="sm" onClick={reset}>Abbrechen</Button>
          </div>
        </div>
      )}

      {step === "new-code" && (
        <div className="space-y-3">
          <div className="p-3 rounded-lg bg-profit/5 border border-profit/20">
            <p className="text-xs text-profit font-medium flex items-center gap-1.5">
              <Check className="h-3.5 w-3.5" /> Bestätigungslink gesendet
            </p>
            <p className="text-[10px] text-muted-foreground mt-1">
              Klicke auf den Link in der E-Mail an <strong>{newEmail}</strong>, um die Änderung abzuschließen.
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={reset}>Fertig</Button>
        </div>
      )}
    </div>
  );
}
