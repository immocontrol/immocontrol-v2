/**
 * Settings Page-Splitting — Password Change section extracted from Settings.tsx
 */
import { useState } from "react";
import { Lock, Eye, EyeOff, X, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { PasswordStrength } from "@/components/PasswordStrength";

interface PasswordSettingsProps {
  sectionRef: (el: HTMLElement | null) => void;
}

export function PasswordSettings({ sectionRef }: PasswordSettingsProps) {
  const { user } = useAuth();
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showOld, setShowOld] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.email) return;
    if (!oldPassword.trim()) { toast.error("Bitte gib dein aktuelles Passwort ein"); return; }
    if (newPassword !== confirmPassword) { toast.error("Passwörter stimmen nicht überein"); return; }
    if (newPassword.length < 6) { toast.error("Passwort muss mindestens 6 Zeichen lang sein"); return; }
    if (oldPassword === newPassword) { toast.error("Das neue Passwort muss sich vom alten unterscheiden"); return; }
    setLoading(true);
    const { error: verifyError } = await supabase.auth.signInWithPassword({ email: user.email, password: oldPassword });
    if (verifyError) { setLoading(false); toast.error("Aktuelles Passwort ist falsch"); return; }
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    setLoading(false);
    if (error) { toast.error(error.message); } else {
      toast.success("Passwort geändert!");
      setOldPassword(""); setNewPassword(""); setConfirmPassword("");
    }
  };

  return (
    <form id="passwort" ref={sectionRef} onSubmit={handleChangePassword} className="gradient-card rounded-xl border border-border p-5 space-y-4 animate-fade-in [animation-delay:100ms] scroll-mt-20">
      <h2 className="text-sm font-semibold flex items-center gap-2">
        <Lock className="h-4 w-4 text-muted-foreground" /> Passwort ändern
      </h2>
      <div className="space-y-1.5">
        <Label className="text-xs text-muted-foreground">Aktuelles Passwort *</Label>
        <div className="relative">
          <Input type={showOld ? "text" : "password"} value={oldPassword} onChange={(e) => setOldPassword(e.target.value)} placeholder="••••••••" className="h-9 text-sm pr-10" autoComplete="current-password" required />
          <button type="button" onClick={() => setShowOld(!showOld)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors" tabIndex={-1}>
            {showOld ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs text-muted-foreground">Neues Passwort *</Label>
        <div className="relative">
          <Input type={showNew ? "text" : "password"} value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="••••••••" className="h-9 text-sm pr-10" minLength={6} autoComplete="new-password" required />
          <button type="button" onClick={() => setShowNew(!showNew)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors" tabIndex={-1}>
            {showNew ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
        <PasswordStrength password={newPassword} />
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs text-muted-foreground">Passwort bestätigen *</Label>
        <div className="relative">
          <Input type={showConfirm ? "text" : "password"} value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="••••••••" className="h-9 text-sm pr-10" required />
          <button type="button" onClick={() => setShowConfirm(!showConfirm)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors" tabIndex={-1}>
            {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
        {confirmPassword && newPassword !== confirmPassword && (
          <p className="text-[10px] text-loss flex items-center gap-1"><X className="h-3 w-3" /> Passwörter stimmen nicht überein</p>
        )}
        {confirmPassword && newPassword === confirmPassword && confirmPassword.length >= 6 && (
          <p className="text-[10px] text-profit flex items-center gap-1"><Check className="h-3 w-3" /> Passwörter stimmen überein</p>
        )}
      </div>
      <Button type="submit" size="sm" disabled={loading || !oldPassword || !newPassword || newPassword !== confirmPassword}>
        Passwort ändern
      </Button>
    </form>
  );
}
