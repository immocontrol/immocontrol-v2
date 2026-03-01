import { useState, useEffect, useCallback, useMemo } from "react";
import { Settings as SettingsIcon, User, Lock, LogOut, Sun, Moon, Monitor, Trash2, AlertTriangle, Users, Download, Database, Upload, Keyboard } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { useTheme } from "@/hooks/useTheme";
import { TeamManagement } from "@/components/TeamManagement2";
import { PasswordStrength } from "@/components/PasswordStrength";

const Settings = () => {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const { theme, setTheme } = useTheme();
  const [displayName, setDisplayName] = useState("");
  const [loading, setLoading] = useState(false);
  const [profileLoading, setProfileLoading] = useState(true);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [deleteConfirm, setDeleteConfirm] = useState("");

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

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      toast.error("Passwörter stimmen nicht überein");
      return;
    }
    if (newPassword.length < 6) {
      toast.error("Passwort muss mindestens 6 Zeichen lang sein");
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    setLoading(false);
    if (error) {
      toast.error(error.message);
    } else {
      toast.success("Passwort geändert!");
      setNewPassword("");
      setConfirmPassword("");
    }
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

      {/* Password */}
      <form onSubmit={handleChangePassword} className="gradient-card rounded-xl border border-border p-5 space-y-4 animate-fade-in" style={{ animationDelay: "100ms" }}>
        <h2 className="text-sm font-semibold flex items-center gap-2">
          <Lock className="h-4 w-4 text-muted-foreground" /> Passwort ändern
        </h2>
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Neues Passwort</Label>
          <Input
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            placeholder="••••••••"
            className="h-9 text-sm"
            minLength={6}
            autoComplete="new-password"
          />
          <PasswordStrength password={newPassword} />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Passwort bestätigen</Label>
          <Input
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="••••••••"
            className="h-9 text-sm"
          />
        </div>
        <Button type="submit" size="sm" disabled={loading}>
          Passwort ändern
        </Button>
      </form>

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
              /* IMP-22: Replace Record<string, any> with proper type */
              const backup: Record<string, unknown> = { exportedAt: new Date().toISOString(), version: "1.0" };
              for (const table of tables) {
                /* IMP-23: Replace `as any` with proper table name type */
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

      {/* Keyboard Shortcuts */}
      <div className="gradient-card rounded-xl border border-border p-5 space-y-4 animate-fade-in" style={{ animationDelay: "130ms" }}>
        <h2 className="text-sm font-semibold flex items-center gap-2">
          <Keyboard className="h-4 w-4 text-muted-foreground" /> Tastenkombinationen
        </h2>
        <div className="grid grid-cols-2 gap-2 text-xs">
          {[
            { keys: "Alt+1-9", desc: "Navigation" },
            { keys: "Ctrl+K", desc: "Suche öffnen" },
            { keys: "Ctrl+N", desc: "Neues Objekt" },
            { keys: "Enter", desc: "Schnell-Aufgabe" },
          ].map(s => (
            <div key={s.keys} className="flex items-center justify-between p-2 rounded-lg bg-secondary/30">
              <span className="text-muted-foreground">{s.desc}</span>
              <kbd className="px-1.5 py-0.5 rounded bg-muted text-[10px] font-mono">{s.keys}</kbd>
            </div>
          ))}
        </div>
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
