import { useState, useEffect, useCallback, useMemo } from "react";
import { Settings as SettingsIcon, User, Lock, LogOut, Sun, Moon, Monitor, Trash2, AlertTriangle, Users, Download, Database, Upload, Keyboard, Eye, EyeOff, Shield, Fingerprint, Smartphone, Copy, Check, X, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { QRCodeSVG } from "qrcode.react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { useTheme } from "@/hooks/useTheme";
import { TeamManagement } from "@/components/TeamManagement2";
import { PasswordStrength } from "@/components/PasswordStrength";

/* ── Default keyboard shortcuts (stored in localStorage for customization) ── */
const DEFAULT_SHORTCUTS: Record<string, string> = {
  "Navigation: Portfolio": "Alt+1",
  "Navigation: Darlehen": "Alt+2",
  "Navigation: Mieten": "Alt+3",
  "Navigation: Verträge": "Alt+4",
  "Navigation: Kontakte": "Alt+5",
  "Navigation: Aufgaben": "Alt+6",
  "Navigation: Berichte": "Alt+7",
  "Navigation: CRM": "Alt+8",
  "Navigation: Deals": "Alt+0",
  "Navigation: Einstellungen": "Alt+9",
  "Suche öffnen": "Ctrl+K",
  "Neues Objekt": "Ctrl+N",
};

/* Critical key combos that should warn the user */
const CRITICAL_KEYS = ["Ctrl+S", "Ctrl+W", "Ctrl+Q", "Ctrl+T", "Ctrl+N", "Alt+F4", "Ctrl+Shift+I", "Ctrl+Shift+J"];

function loadCustomShortcuts(): Record<string, string> {
  try {
    const stored = localStorage.getItem("immocontrol_shortcuts");
    if (stored) return JSON.parse(stored) as Record<string, string>;
  } catch { /* ignore */ }
  return { ...DEFAULT_SHORTCUTS };
}

function saveCustomShortcuts(sc: Record<string, string>) {
  localStorage.setItem("immocontrol_shortcuts", JSON.stringify(sc));
  /* Notify AppLayout in same tab to rebuild shortcut map immediately */
  window.dispatchEvent(new Event("shortcuts-updated"));
}

const Settings = () => {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const { theme, setTheme } = useTheme();
  const [displayName, setDisplayName] = useState("");
  const [loading, setLoading] = useState(false);
  const [profileLoading, setProfileLoading] = useState(true);

  /* Password change state */
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showOldPassword, setShowOldPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [deleteConfirm, setDeleteConfirm] = useState("");

  /* 2FA TOTP state */
  const [totpSetupOpen, setTotpSetupOpen] = useState(false);
  const [totpSecret, setTotpSecret] = useState("");
  const [totpQrUri, setTotpQrUri] = useState("");
  const [totpVerifyCode, setTotpVerifyCode] = useState("");
  const [totpEnabled, setTotpEnabled] = useState(false);
  const [totpLoading, setTotpLoading] = useState(false);
  const [totpFactorId, setTotpFactorId] = useState<string | null>(null);

  /* Passkey state */
  const [passkeys, setPasskeys] = useState<Array<{ id: string; name: string; createdAt: string }>>([]);
  const [passkeyLoading, setPasskeyLoading] = useState(false);
  const [passkeySupported, setPasskeySupported] = useState(false);

  /* Keyboard shortcuts state */
  const [shortcuts, setShortcuts] = useState<Record<string, string>>(loadCustomShortcuts());
  const [editingShortcut, setEditingShortcut] = useState<string | null>(null);
  const [editingValue, setEditingValue] = useState("");
  const [shortcutWarning, setShortcutWarning] = useState("");

  // Document title
  useEffect(() => { document.title = "Einstellungen – ImmoControl"; }, []);

  useEffect(() => {
    const fetchProfile = async () => {
      if (!user) return;
      try {
        const { data } = await supabase
          .from("profiles")
          .select("display_name")
          .eq("user_id", user.id)
          .maybeSingle();
        if (data?.display_name) setDisplayName(data.display_name);
      } finally {
        setProfileLoading(false);
      }
    };
    fetchProfile();
  }, [user]);

  /* Check if WebAuthn/Passkey is supported */
  useEffect(() => {
    setPasskeySupported(
      typeof window !== "undefined" &&
      !!window.PublicKeyCredential &&
      typeof window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable === "function"
    );
  }, []);

  /* Check existing TOTP factors */
  useEffect(() => {
    const checkTotp = async () => {
      try {
        const { data } = await supabase.auth.mfa.listFactors();
        if (data?.totp && data.totp.length > 0) {
          const activeFactor = data.totp.find(f => f.status === "verified");
          if (activeFactor) {
            setTotpEnabled(true);
            setTotpFactorId(activeFactor.id);
          }
        }
      } catch {
        /* MFA not available */
      }
    };
    checkTotp();
  }, []);

  /* Load passkeys from localStorage */
  useEffect(() => {
    try {
      const stored = localStorage.getItem("immocontrol_passkeys");
      if (stored) setPasskeys(JSON.parse(stored));
    } catch { /* ignore */ }
  }, []);

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setLoading(true);
    const { error } = await supabase
      .from("profiles")
      .update({ display_name: displayName })
      .eq("user_id", user.id);
    setLoading(false);
    if (error) {
      toast.error("Fehler beim Speichern");
    } else {
      toast.success("Profil aktualisiert!");
    }
  };

  /* Password change: verify old password first, then update */
  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.email) return;
    if (!oldPassword.trim()) {
      toast.error("Bitte gib dein aktuelles Passwort ein");
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error("Passwörter stimmen nicht überein");
      return;
    }
    if (newPassword.length < 6) {
      toast.error("Passwort muss mindestens 6 Zeichen lang sein");
      return;
    }
    if (oldPassword === newPassword) {
      toast.error("Das neue Passwort muss sich vom alten unterscheiden");
      return;
    }
    setLoading(true);
    /* Step 1: Verify old password */
    const { error: verifyError } = await supabase.auth.signInWithPassword({
      email: user.email,
      password: oldPassword,
    });
    if (verifyError) {
      setLoading(false);
      toast.error("Aktuelles Passwort ist falsch");
      return;
    }
    /* Step 2: Update to new password */
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    setLoading(false);
    if (error) {
      toast.error(error.message);
    } else {
      toast.success("Passwort geändert!");
      setOldPassword("");
      setNewPassword("");
      setConfirmPassword("");
    }
  };

  /* 2FA TOTP setup */
  const startTotpSetup = async () => {
    setTotpLoading(true);
    try {
      const { data, error } = await supabase.auth.mfa.enroll({
        factorType: "totp",
        friendlyName: "ImmoControl Authenticator",
      });
      if (error) throw error;
      if (data) {
        setTotpSecret(data.totp.secret);
        setTotpQrUri(data.totp.uri);
        setTotpFactorId(data.id);
        setTotpSetupOpen(true);
      }
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "2FA-Einrichtung fehlgeschlagen");
    } finally {
      setTotpLoading(false);
    }
  };

  const verifyTotpSetup = async () => {
    if (!totpFactorId || totpVerifyCode.length !== 6) return;
    setTotpLoading(true);
    try {
      const challenge = await supabase.auth.mfa.challenge({ factorId: totpFactorId });
      if (challenge.error) throw challenge.error;
      const verify = await supabase.auth.mfa.verify({
        factorId: totpFactorId,
        challengeId: challenge.data.id,
        code: totpVerifyCode,
      });
      if (verify.error) throw verify.error;
      setTotpEnabled(true);
      setTotpSetupOpen(false);
      setTotpVerifyCode("");
      toast.success("2FA erfolgreich aktiviert!");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Ungültiger Code");
    } finally {
      setTotpLoading(false);
    }
  };

  const disableTotp = async () => {
    if (!totpFactorId) return;
    setTotpLoading(true);
    try {
      const { error } = await supabase.auth.mfa.unenroll({ factorId: totpFactorId });
      if (error) throw error;
      setTotpEnabled(false);
      setTotpFactorId(null);
      toast.success("2FA deaktiviert");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Fehler beim Deaktivieren");
    } finally {
      setTotpLoading(false);
    }
  };

  /* Passkey (WebAuthn) registration */
  const registerPasskey = async () => {
    if (!passkeySupported || !user) return;
    setPasskeyLoading(true);
    try {
      const challenge = new Uint8Array(32);
      crypto.getRandomValues(challenge);
      const userId = new TextEncoder().encode(user.id);
      const credential = await navigator.credentials.create({
        publicKey: {
          challenge,
          rp: { name: "ImmoControl", id: window.location.hostname },
          user: {
            id: userId,
            name: user.email || "user",
            displayName: displayName || user.email || "User",
          },
          pubKeyCredParams: [
            { alg: -7, type: "public-key" },
            { alg: -257, type: "public-key" },
          ],
          authenticatorSelection: {
            authenticatorAttachment: "platform",
            userVerification: "required",
            residentKey: "required",
          },
          timeout: 60000,
          attestation: "none",
        },
      }) as PublicKeyCredential | null;
      if (credential) {
        const newPasskey = {
          id: credential.id,
          name: `Passkey ${passkeys.length + 1}`,
          createdAt: new Date().toISOString(),
        };
        const updated = [...passkeys, newPasskey];
        setPasskeys(updated);
        localStorage.setItem("immocontrol_passkeys", JSON.stringify(updated));
        toast.success("Passkey erfolgreich registriert!");
      }
    } catch (err: unknown) {
      if (err instanceof Error && err.name === "NotAllowedError") {
        toast.error("Passkey-Registrierung abgebrochen");
      } else {
        toast.error(err instanceof Error ? err.message : "Passkey-Registrierung fehlgeschlagen");
      }
    } finally {
      setPasskeyLoading(false);
    }
  };

  const removePasskey = (id: string) => {
    const updated = passkeys.filter(p => p.id !== id);
    setPasskeys(updated);
    localStorage.setItem("immocontrol_passkeys", JSON.stringify(updated));
    toast.success("Passkey entfernt");
  };

  /* Keyboard shortcuts customization */
  const startEditShortcut = (action: string) => {
    setEditingShortcut(action);
    setEditingValue(shortcuts[action] || "");
    setShortcutWarning("");
  };

  const saveShortcut = (action: string, value: string) => {
    const trimmed = value.trim();
    if (!trimmed) {
      toast.error("Tastenkombination darf nicht leer sein");
      return;
    }
    const duplicate = Object.entries(shortcuts).find(
      ([key, val]) => key !== action && val.toLowerCase() === trimmed.toLowerCase()
    );
    if (duplicate) {
      toast.error(`Diese Kombination wird bereits für: ${duplicate[0]} verwendet`);
      return;
    }
    const updated = { ...shortcuts, [action]: trimmed };
    setShortcuts(updated);
    saveCustomShortcuts(updated);
    setEditingShortcut(null);
    setEditingValue("");
    setShortcutWarning("");
    toast.success("Tastenkombination gespeichert");
  };

  const validateShortcutInput = (value: string) => {
    setEditingValue(value);
    const upper = value.toUpperCase().replace(/\s/g, "");
    if (CRITICAL_KEYS.some(k => k.toUpperCase().replace(/\s/g, "") === upper)) {
      setShortcutWarning("Achtung: Diese Tastenkombination wird vom Browser verwendet und könnte Konflikte verursachen!");
    } else {
      const dup = Object.entries(shortcuts).find(
        ([key, val]) => key !== editingShortcut && val.toLowerCase().replace(/\s/g, "") === upper.toLowerCase()
      );
      if (dup) {
        setShortcutWarning(`Duplikat: Wird bereits für "${dup[0]}" verwendet`);
      } else {
        setShortcutWarning("");
      }
    }
  };

  const resetShortcuts = () => {
    setShortcuts({ ...DEFAULT_SHORTCUTS });
    saveCustomShortcuts({ ...DEFAULT_SHORTCUTS });
    toast.success("Tastenkombinationen zurückgesetzt");
  };

  const handleLogout = async () => {
    await signOut();
    toast.success("Abgemeldet");
    navigate("/auth");
  };

  /* FUNC-36: Data usage estimation */
  const dataUsageEstimate = useMemo(() => {
    const storedKeys = ["immoai_chat", "theme", "onboarding_complete"];
    let totalSize = 0;
    storedKeys.forEach(key => {
      const item = localStorage.getItem(key);
      if (item) totalSize += item.length * 2;
    });
    return totalSize;
  }, []);

  /* FUNC-37: Session info display */
  const sessionInfo = useMemo(() => ({
    lastLogin: user?.last_sign_in_at ? new Date(user.last_sign_in_at).toLocaleDateString("de-DE", { day: "2-digit", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "–",
    provider: user?.app_metadata?.provider || "email",
  }), [user]);

  /* OPT-21: Theme options as constant */

  const themeOptions = [
    { value: "light", label: "Hell", icon: Sun },
    { value: "dark", label: "Dunkel", icon: Moon },
    { value: "system", label: "System", icon: Monitor },
  ];

  // Improvement 18: Formatted account age
  const accountAge = user?.created_at ? (() => {
    const created = new Date(user.created_at);
    const diffMs = Date.now() - created.getTime();
    const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    if (days < 1) return "Heute erstellt";
    if (days === 1) return "Seit gestern";
    if (days < 30) return `Seit ${days} Tagen`;
    const months = Math.floor(days / 30);
    if (months < 12) return `Seit ${months} Monat${months > 1 ? "en" : ""}`;
    const years = Math.floor(months / 12);
    return `Seit ${years} Jahr${years > 1 ? "en" : ""}`;
  })() : "";

  return (
    <div className="space-y-6 max-w-lg mx-auto" role="main" aria-label="Einstellungen">
      <div className="flex items-center gap-2">
        <SettingsIcon className="h-6 w-6 text-primary" />
        <h1 className="text-2xl font-bold tracking-tight">Einstellungen</h1>
      </div>

      {/* IMPROVE-34: Settings section headers with icon + consistent styling for visual grouping */}
      {/* Theme */}
      <div className="gradient-card rounded-xl border border-border p-5 space-y-4 animate-fade-in">
        <h2 className="text-sm font-semibold flex items-center gap-2">
          <Sun className="h-4 w-4 text-muted-foreground" /> Erscheinungsbild
        </h2>
        <div className="grid grid-cols-3 gap-2">
          {themeOptions.map((opt) => {
            const isActive = theme === opt.value;
            return (
              <button
                key={opt.value}
                onClick={() => setTheme(opt.value as "light" | "dark" | "system")}
                className={`flex flex-col items-center gap-2 p-3 rounded-lg border-2 transition-all ${
                  isActive
                    ? "border-primary bg-primary/10"
                    : "border-border hover:border-muted-foreground/30 hover:bg-secondary/50"
                }`}
              >
                <opt.icon className={`h-5 w-5 ${isActive ? "text-primary" : "text-muted-foreground"}`} />
                <span className={`text-xs font-medium ${isActive ? "text-primary" : "text-muted-foreground"}`}>
                  {opt.label}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Profile */}
      <form onSubmit={handleUpdateProfile} className="gradient-card rounded-xl border border-border p-5 space-y-4 animate-fade-in" style={{ animationDelay: "50ms" }}>
        <h2 className="text-sm font-semibold flex items-center gap-2">
          <User className="h-4 w-4 text-muted-foreground" /> Profil
        </h2>
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">E-Mail</Label>
          <Input value={user?.email || ""} disabled className="h-9 text-sm opacity-60" />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Mitglied</Label>
          <div className="flex items-center gap-2">
            <Input
              value={user?.created_at ? new Date(user.created_at).toLocaleDateString("de-DE", { day: "2-digit", month: "long", year: "numeric" }) : "–"}
              disabled
              className="h-9 text-sm opacity-60"
            />
            {accountAge && (
              <span className="text-[10px] bg-primary/10 text-primary px-2 py-1 rounded-md whitespace-nowrap font-medium">
                {accountAge}
              </span>
            )}
          </div>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Anzeigename</Label>
          <Input
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="Dein Name"
            className="h-9 text-sm"
          />
        </div>
        <Button type="submit" size="sm" disabled={loading}>
          Speichern
        </Button>
      </form>

      {/* Password — requires old password + eye icons */}
      <form onSubmit={handleChangePassword} className="gradient-card rounded-xl border border-border p-5 space-y-4 animate-fade-in" style={{ animationDelay: "100ms" }}>
        <h2 className="text-sm font-semibold flex items-center gap-2">
          <Lock className="h-4 w-4 text-muted-foreground" /> Passwort ändern
        </h2>
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Aktuelles Passwort *</Label>
          <div className="relative">
            <Input
              type={showOldPassword ? "text" : "password"}
              value={oldPassword}
              onChange={(e) => setOldPassword(e.target.value)}
              placeholder="••••••••"
              className="h-9 text-sm pr-10"
              autoComplete="current-password"
              required
            />
            <button
              type="button"
              onClick={() => setShowOldPassword(!showOldPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
              tabIndex={-1}
            >
              {showOldPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Neues Passwort *</Label>
          <div className="relative">
            <Input
              type={showNewPassword ? "text" : "password"}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="••••••••"
              className="h-9 text-sm pr-10"
              minLength={6}
              autoComplete="new-password"
              required
            />
            <button
              type="button"
              onClick={() => setShowNewPassword(!showNewPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
              tabIndex={-1}
            >
              {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
          <PasswordStrength password={newPassword} />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Passwort bestätigen *</Label>
          <div className="relative">
            <Input
              type={showConfirmPassword ? "text" : "password"}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="••••••••"
              className="h-9 text-sm pr-10"
              required
            />
            <button
              type="button"
              onClick={() => setShowConfirmPassword(!showConfirmPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
              tabIndex={-1}
            >
              {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
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
        <Button type="submit" size="sm" disabled={loading || !oldPassword || !newPassword || newPassword !== confirmPassword}>
          Passwort ändern
        </Button>
      </form>

      {/* 2FA / TOTP */}
      <div className="gradient-card rounded-xl border border-border p-5 space-y-4 animate-fade-in" style={{ animationDelay: "105ms" }}>
        <h2 className="text-sm font-semibold flex items-center gap-2">
          <Shield className="h-4 w-4 text-muted-foreground" /> Zwei-Faktor-Authentifizierung (2FA)
        </h2>
        <p className="text-xs text-muted-foreground">
          Schütze dein Konto mit einer Authenticator-App (Google Authenticator, Authy, 1Password etc.)
        </p>
        {totpEnabled ? (
          <div className="flex items-center justify-between p-3 bg-profit/10 rounded-lg border border-profit/20">
            <div className="flex items-center gap-2">
              <Smartphone className="h-4 w-4 text-profit" />
              <div>
                <p className="text-sm font-medium text-profit">2FA ist aktiv</p>
                <p className="text-[10px] text-muted-foreground">Authenticator-App verifiziert</p>
              </div>
            </div>
            <Button variant="outline" size="sm" className="text-xs" onClick={disableTotp} disabled={totpLoading}>
              Deaktivieren
            </Button>
          </div>
        ) : (
          <Button variant="outline" size="sm" className="gap-1.5" onClick={startTotpSetup} disabled={totpLoading}>
            <Smartphone className="h-3.5 w-3.5" /> 2FA einrichten
          </Button>
        )}
      </div>

      {/* TOTP Setup Dialog */}
      <Dialog open={totpSetupOpen} onOpenChange={setTotpSetupOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-primary" /> 2FA einrichten
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-xs text-muted-foreground">
              Scanne den QR-Code mit deiner Authenticator-App oder gib den Schlüssel manuell ein.
            </p>
            {totpQrUri && (
              <div className="flex flex-col items-center gap-3 p-4 bg-white rounded-lg">
                <QRCodeSVG
                  value={totpQrUri}
                  size={192}
                  level="M"
                  includeMargin
                />
              </div>
            )}
            {totpSecret && (
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Manueller Schlüssel</Label>
                <div className="flex items-center gap-2">
                  <code className="flex-1 text-xs bg-secondary p-2 rounded font-mono break-all select-all">
                    {totpSecret}
                  </code>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0 shrink-0"
                    onClick={() => { navigator.clipboard.writeText(totpSecret); toast.success("Schlüssel kopiert"); }}
                  >
                    <Copy className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            )}
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Bestätigungscode (6 Ziffern)</Label>
              <Input
                type="text"
                inputMode="numeric"
                maxLength={6}
                value={totpVerifyCode}
                onChange={(e) => setTotpVerifyCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                placeholder="000000"
                className="h-10 text-center text-lg font-mono tracking-[0.5em]"
              />
            </div>
            <Button onClick={verifyTotpSetup} disabled={totpLoading || totpVerifyCode.length !== 6} className="w-full">
              {totpLoading ? "Verifiziere..." : "2FA aktivieren"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Passkeys */}
      <div className="gradient-card rounded-xl border border-border p-5 space-y-4 animate-fade-in" style={{ animationDelay: "108ms" }}>
        <h2 className="text-sm font-semibold flex items-center gap-2">
          <Fingerprint className="h-4 w-4 text-muted-foreground" /> Passkeys
        </h2>
        <p className="text-xs text-muted-foreground">
          Melde dich mit Fingerabdruck, Gesichtserkennung oder deinem Geräte-PIN an.
        </p>
        {!passkeySupported ? (
          <p className="text-xs text-loss flex items-center gap-1">
            <AlertCircle className="h-3.5 w-3.5" /> Dein Browser unterstützt keine Passkeys
          </p>
        ) : (
          <>
            {passkeys.length > 0 && (
              <div className="space-y-1.5">
                {passkeys.map((pk) => (
                  <div key={pk.id} className="flex items-center justify-between p-2.5 bg-secondary/30 rounded-lg">
                    <div className="flex items-center gap-2">
                      <Fingerprint className="h-3.5 w-3.5 text-primary" />
                      <div>
                        <p className="text-xs font-medium">{pk.name}</p>
                        <p className="text-[10px] text-muted-foreground">
                          Erstellt: {new Date(pk.createdAt).toLocaleDateString("de-DE")}
                        </p>
                      </div>
                    </div>
                    <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive" onClick={() => removePasskey(pk.id)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
            <Button variant="outline" size="sm" className="gap-1.5" onClick={registerPasskey} disabled={passkeyLoading}>
              <Fingerprint className="h-3.5 w-3.5" />
              {passkeyLoading ? "Registriere..." : "Passkey hinzufügen"}
            </Button>
          </>
        )}
      </div>

      {/* Feature: JSON Data Export */}
      <div className="gradient-card rounded-xl border border-border p-5 space-y-4 animate-fade-in" style={{ animationDelay: "120ms" }}>
        <h2 className="text-sm font-semibold flex items-center gap-2">
          <Database className="h-4 w-4 text-muted-foreground" /> Daten-Backup
        </h2>
        <p className="text-xs text-muted-foreground">
          Exportiere alle deine Daten als JSON-Datei. Du kannst diesen Export als Backup verwenden.
        </p>
        <Button
          variant="outline"
          size="sm"
          className="gap-1.5"
          onClick={async () => {
            try {
              const tables = ["properties", "contacts", "loans", "todos", "tenants", "tickets", "rent_payments", "portfolio_goals"];
              /* FIX-39 / IMP-22: Replace `Record<string, any>` with proper type */
              const backup: Record<string, unknown> = { exportedAt: new Date().toISOString(), version: "1.0" };
              for (const table of tables) {
                /* FIX-40 / IMP-23: Replace `as any` with typed table name cast */
                const { data } = await supabase.from(table as never).select("*");
                backup[table] = data || [];
              }
              const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
              const url = URL.createObjectURL(blob);
              const a = document.createElement("a");
              a.href = url;
              a.download = `immocontrol-backup-${new Date().toISOString().split("T")[0]}.json`;
              a.click();
              URL.revokeObjectURL(url);
              toast.success("Backup exportiert!");
            } catch {
              toast.error("Export fehlgeschlagen");
            }
          }}
        >
          <Download className="h-3.5 w-3.5" /> JSON exportieren
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="gap-1.5"
          onClick={() => {
            const input = document.createElement("input");
            input.type = "file";
            input.accept = ".json";
            input.onchange = async (e) => {
              const file = (e.target as HTMLInputElement).files?.[0];
              if (!file) return;
              try {
                const text = await file.text();
                const data = JSON.parse(text);
                toast.success(`Backup gelesen: ${Object.keys(data).filter(k => k !== "exportedAt" && k !== "version").length} Tabellen gefunden. Import-Funktion kommt bald!`);
              } catch {
                toast.error("Ungültige JSON-Datei");
              }
            };
            input.click();
          }}
        >
          <Upload className="h-3.5 w-3.5" /> JSON prüfen
        </Button>
      </div>

      {/* Customizable Keyboard Shortcuts */}
      <div className="gradient-card rounded-xl border border-border p-5 space-y-4 animate-fade-in" style={{ animationDelay: "130ms" }}>
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold flex items-center gap-2">
            <Keyboard className="h-4 w-4 text-muted-foreground" /> Tastenkombinationen
          </h2>
          <Button variant="ghost" size="sm" className="h-7 text-[10px] text-muted-foreground" onClick={resetShortcuts}>
            Zurücksetzen
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          Klicke auf eine Tastenkombination, um sie anzupassen.
        </p>
        <div className="space-y-1.5">
          {Object.entries(shortcuts).map(([action, keys]) => (
            <div key={action} className="flex items-center justify-between p-2 rounded-lg bg-secondary/30 hover:bg-secondary/50 transition-colors">
              <span className="text-xs text-muted-foreground flex-1 truncate mr-2">{action}</span>
              {editingShortcut === action ? (
                <div className="flex items-center gap-1.5">
                  <Input
                    value={editingValue}
                    onChange={(e) => validateShortcutInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") { e.preventDefault(); saveShortcut(action, editingValue); }
                      if (e.key === "Escape") { setEditingShortcut(null); setShortcutWarning(""); }
                    }}
                    className="h-7 w-28 text-[10px] font-mono text-center"
                    autoFocus
                    placeholder="z.B. Alt+1"
                  />
                  <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-profit" onClick={() => saveShortcut(action, editingValue)}>
                    <Check className="h-3 w-3" />
                  </Button>
                  <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-muted-foreground" onClick={() => { setEditingShortcut(null); setShortcutWarning(""); }}>
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              ) : (
                <button
                  onClick={() => startEditShortcut(action)}
                  className="px-2 py-0.5 rounded bg-muted hover:bg-muted/80 text-[10px] font-mono transition-colors cursor-pointer"
                  title="Klicken zum Bearbeiten"
                >
                  {keys}
                </button>
              )}
            </div>
          ))}
        </div>
        {shortcutWarning && (
          <div className="flex items-start gap-2 p-2.5 rounded-lg bg-gold/10 border border-gold/20">
            <AlertTriangle className="h-3.5 w-3.5 text-gold shrink-0 mt-0.5" />
            <p className="text-[10px] text-gold">{shortcutWarning}</p>
          </div>
        )}
      </div>

      {/* Team */}
      <TeamManagement />

      {/* Logout */}
      <div className="gradient-card rounded-xl border border-border p-5 animate-fade-in" style={{ animationDelay: "150ms" }}>
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold">Abmelden</h2>
            <p className="text-xs text-muted-foreground mt-0.5">Von allen Geräten abmelden</p>
          </div>
          <Button variant="destructive" size="sm" onClick={handleLogout}>
            <LogOut className="h-4 w-4 mr-1.5" /> Abmelden
          </Button>
        </div>
      </div>

      {/* Improvement 9: Danger zone - Delete account */}
      <div className="rounded-xl border-2 border-destructive/20 p-5 space-y-4 animate-fade-in" style={{ animationDelay: "200ms" }}>
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-destructive" />
          <h2 className="text-sm font-semibold text-destructive">Gefahrenzone</h2>
        </div>
        <p className="text-xs text-muted-foreground">
          Wenn du dein Konto löschst, werden alle deine Daten, Objekte, Mieter, Dokumente und Nachrichten unwiderruflich gelöscht.
        </p>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="outline" size="sm" className="border-destructive/30 text-destructive hover:bg-destructive/10">
              <Trash2 className="h-3.5 w-3.5 mr-1.5" /> Konto löschen
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle className="text-destructive">Konto unwiderruflich löschen?</AlertDialogTitle>
              <AlertDialogDescription>
                Alle deine Daten (Objekte, Mieter, Dokumente, Nachrichten) werden dauerhaft gelöscht. Diese Aktion kann nicht rückgängig gemacht werden.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <div className="space-y-1.5 my-2">
              <Label className="text-xs text-muted-foreground">Tippe „LÖSCHEN" zur Bestätigung</Label>
              <Input
                value={deleteConfirm}
                onChange={(e) => setDeleteConfirm(e.target.value)}
                placeholder="LÖSCHEN"
                className="h-9 text-sm"
              />
            </div>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => setDeleteConfirm("")}>Abbrechen</AlertDialogCancel>
              <AlertDialogAction
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                disabled={deleteConfirm !== "LÖSCHEN"}
                onClick={async () => {
                  toast.info("Bitte kontaktiere den Support, um dein Konto zu löschen.");
                  setDeleteConfirm("");
                }}
              >
                Konto löschen
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>

      {/* FUNC-36/37: Data usage & session info */}
      <div className="gradient-card rounded-xl border border-border p-5 space-y-3 animate-fade-in" style={{ animationDelay: "180ms" }}>
        <h2 className="text-sm font-semibold flex items-center gap-2">
          <Database className="h-4 w-4 text-muted-foreground" /> System-Info
        </h2>
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="p-2 rounded-lg bg-secondary/30">
            <span className="text-muted-foreground">Lokaler Speicher</span>
            <p className="font-medium">{(dataUsageEstimate / 1024).toFixed(1)} KB</p>
          </div>
          <div className="p-2 rounded-lg bg-secondary/30">
            <span className="text-muted-foreground">Letzter Login</span>
            <p className="font-medium">{sessionInfo.lastLogin}</p>
          </div>
          <div className="p-2 rounded-lg bg-secondary/30">
            <span className="text-muted-foreground">Auth-Methode</span>
            <p className="font-medium capitalize">{sessionInfo.provider}</p>
          </div>
          <div className="p-2 rounded-lg bg-secondary/30">
            <span className="text-muted-foreground">2FA</span>
            <p className="font-medium">{totpEnabled ? "Aktiv" : "Nicht aktiv"}</p>
          </div>
        </div>
      </div>

      {/* App info footer */}
      <div className="text-center py-4 space-y-1 animate-fade-in" style={{ animationDelay: "250ms" }}>
        <p className="text-[10px] text-muted-foreground">ImmoControl v2.0 · Made with ❤️</p>
        <p className="text-[10px] text-muted-foreground">
          Support: <a href="mailto:support@immocontrol.de" className="text-primary hover:underline">support@immocontrol.de</a>
        </p>
      </div>
    </div>
  );
};

export default Settings;
