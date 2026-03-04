import { useState, useEffect, useMemo, useRef } from "react";
import { Settings as SettingsIcon, User, Lock, LogOut, Sun, Moon, Monitor, Trash2, AlertTriangle, Users, Database, Keyboard, Shield, Fingerprint, MessageSquare, MonitorSmartphone, Bot, Home, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ErrorScanner } from "@/components/ErrorScanner";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { DataBackup } from "@/components/DataBackup";
import { useNavigate } from "react-router-dom";
import { useTheme } from "@/hooks/useTheme";
import { TeamManagement } from "@/components/TeamManagement2";

/* Extracted sub-components (Page-Splitting) */
import { EmailChangeSettings } from "@/components/settings/EmailChangeSettings";
import { PasswordSettings } from "@/components/settings/PasswordSettings";
import { TwoFactorSettings } from "@/components/settings/TwoFactorSettings";
import { PasskeySettings } from "@/components/settings/PasskeySettings";
import { BiometricSettings } from "@/components/settings/BiometricSettings";
import { DeviceSettings } from "@/components/settings/DeviceSettings";
import { DefaultPageSettings } from "@/components/settings/DefaultPageSettings";
import { AIChatSettings } from "@/components/settings/AIChatSettings";
import { BackupSettings } from "@/components/settings/BackupSettings";
import { TelegramSettings } from "@/components/settings/TelegramSettings";
import { SystemInfoSettings } from "@/components/settings/SystemInfoSettings";
import { ShortcutSettings } from "@/components/settings/ShortcutSettings";

/* Settings sidebar sections for navigation */
const SETTINGS_SECTIONS = [
  { id: "erscheinungsbild", label: "Erscheinungsbild", icon: Sun },
  { id: "profil", label: "Profil", icon: User },
  { id: "email", label: "E-Mail \u00e4ndern", icon: Mail },
  { id: "passwort", label: "Passwort", icon: Lock },
  { id: "2fa", label: "2FA", icon: Shield },
  { id: "passkeys", label: "Passkeys", icon: Fingerprint },
  { id: "biometric", label: "Biometrie", icon: Fingerprint },
  { id: "geraete", label: "Ger\u00e4te", icon: MonitorSmartphone },
  { id: "standardseite", label: "Standardseite", icon: Home },
  { id: "ai-chat", label: "AI Chat", icon: Bot },
  { id: "backup", label: "Daten-Backup", icon: Database },
  { id: "tastenkombinationen", label: "Tasten", icon: Keyboard },
  { id: "telegram", label: "Telegram", icon: MessageSquare },
  { id: "team", label: "Team", icon: Users },
  { id: "gefahrenzone", label: "Gefahrenzone", icon: AlertTriangle },
  { id: "system-info", label: "System-Info", icon: Database },
] as const;

const Settings = () => {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const { theme, setTheme } = useTheme();
  const [displayName, setDisplayName] = useState("");
  const [loading, setLoading] = useState(false);
  const [profileLoading, setProfileLoading] = useState(true);
  const [deleteConfirm, setDeleteConfirm] = useState("");
  const [totpEnabled, setTotpEnabled] = useState(false);
  const [activeSection, setActiveSection] = useState("erscheinungsbild");
  const sectionRefs = useRef<Record<string, HTMLElement | null>>({});

  useEffect(() => { document.title = "Einstellungen \u2013 ImmoControl"; }, []);

  /* Sidebar scroll spy */
  useEffect(() => {
    const observers: IntersectionObserver[] = [];
    const handleIntersection = (entries: IntersectionObserverEntry[]) => {
      for (const entry of entries) {
        if (entry.isIntersecting && entry.intersectionRatio > 0.3) {
          setActiveSection(entry.target.id);
        }
      }
    };
    SETTINGS_SECTIONS.forEach(section => {
      const el = sectionRefs.current[section.id];
      if (el) {
        const observer = new IntersectionObserver(handleIntersection, {
          rootMargin: "-10% 0px -60% 0px",
          threshold: [0.3],
        });
        observer.observe(el);
        observers.push(observer);
      }
    });
    return () => observers.forEach(o => o.disconnect());
  }, [profileLoading]);

  /* Check existing TOTP factors for SystemInfo */
  useEffect(() => {
    const checkTotp = async () => {
      try {
        const { data } = await supabase.auth.mfa.listFactors();
        if (data?.totp && data.totp.length > 0) {
          const activeFactor = data.totp.find(f => f.status === "verified");
          if (activeFactor) setTotpEnabled(true);
        }
      } catch { /* MFA not available */ }
    };
    checkTotp();
  }, []);

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
    if (error) toast.error("Fehler beim Speichern");
    else toast.success("Profil aktualisiert!");
  };

  const handleLogout = async () => {
    try {
      await signOut();
      toast.success("Abgemeldet");
      navigate("/auth");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Abmeldung fehlgeschlagen");
    }
  };

  const scrollToSection = (sectionId: string) => {
    const el = sectionRefs.current[sectionId];
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
      setActiveSection(sectionId);
      /* Animate sidebar active indicator into view */
      const navBtn = document.querySelector(`[data-settings-nav="${sectionId}"]`);
      if (navBtn) navBtn.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  };

  const themeOptions = useMemo(() => [
    { value: "light", label: "Hell", icon: Sun },
    { value: "dark", label: "Dunkel", icon: Moon },
    { value: "system", label: "System", icon: Monitor },
  ], []);

  const accountAge = useMemo(() => {
    if (!user?.created_at) return "";
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
  }, [user?.created_at]);

  const refFor = (id: string) => (el: HTMLElement | null) => { sectionRefs.current[id] = el; };

  return (
    <div className="flex gap-6" role="main" aria-label="Einstellungen">
      {/* Settings sidebar navigation */}
      <aside className="hidden lg:flex lg:items-center w-48 shrink-0 sticky top-20 self-start max-h-[calc(100vh-6rem)] overflow-y-auto">
        <nav className="space-y-0.5 w-full">
          {SETTINGS_SECTIONS.map(section => {
            const SectionIcon = section.icon;
            const isActive = activeSection === section.id;
            return (
              <button
                key={section.id}
                data-settings-nav={section.id}
                onClick={() => scrollToSection(section.id)}
                className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition-all duration-300 text-left ${
                  isActive
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:bg-secondary/50 hover:text-foreground"
                }`}
              >
                <SectionIcon className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate">{section.label}</span>
              </button>
            );
          })}
        </nav>
      </aside>

      {/* Main settings content */}
      <div className="space-y-6 max-w-lg mx-auto flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <SettingsIcon className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-bold tracking-tight">Einstellungen</h1>
        </div>

        {/* Theme */}
        <div id="erscheinungsbild" ref={refFor("erscheinungsbild")} className="gradient-card rounded-xl border border-border p-5 space-y-4 animate-fade-in scroll-mt-20">
          <h2 className="text-sm font-semibold flex items-center gap-2">
            <Sun className="h-4 w-4 text-muted-foreground" /> Erscheinungsbild
          </h2>
          <div className="grid grid-cols-3 gap-2 card-stagger-enter">
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
        <form id="profil" ref={refFor("profil")} onSubmit={handleUpdateProfile} className="gradient-card rounded-xl border border-border p-5 space-y-4 animate-fade-in [animation-delay:50ms] scroll-mt-20">
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
                value={user?.created_at ? new Date(user.created_at).toLocaleDateString("de-DE", { day: "2-digit", month: "long", year: "numeric" }) : "\u2013"}
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

        {/* Extracted sub-components */}
        <EmailChangeSettings sectionRef={refFor("email")} />
        <PasswordSettings sectionRef={refFor("passwort")} />
        <TwoFactorSettings sectionRef={refFor("2fa")} />
        <PasskeySettings sectionRef={refFor("passkeys")} displayName={displayName} />
        <BiometricSettings sectionRef={refFor("biometric")} displayName={displayName} />
        <DeviceSettings sectionRef={refFor("geraete")} />
        <DefaultPageSettings sectionRef={refFor("standardseite")} />
        <AIChatSettings sectionRef={refFor("ai-chat")} />
        <BackupSettings sectionRef={refFor("backup")} />
        <ShortcutSettings sectionRef={refFor("tastenkombinationen")} />
        <TelegramSettings sectionRef={refFor("telegram")} />

        <ErrorScanner />

        {/* Team */}
        <div id="team" ref={refFor("team")} className="scroll-mt-20">
          <TeamManagement />
        </div>

        {/* FIX-13: Removed standalone "Von allen Geräten abmelden" section.
            The logout functionality is already in the Gefahrenzone section below,
            and DeviceSettings provides the "Alle anderen Geräte abmelden" feature.
            Having it here was duplicate and the subtitle was misleading (it only
            logged out the current session, not all devices). */}

        {/* Danger zone */}
        <div id="gefahrenzone" ref={refFor("gefahrenzone")} role="alert" className="rounded-xl border-2 border-destructive/20 p-5 space-y-4 animate-fade-in [animation-delay:200ms] scroll-mt-20">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-destructive" />
            <h2 className="text-sm font-semibold text-destructive">Gefahrenzone</h2>
          </div>
          <p className="text-xs text-muted-foreground">
            Wenn du dein Konto l\u00f6schst, werden alle deine Daten dauerhaft entfernt.
            Nach der L\u00f6schung hast du 30 Tage Zeit, dein Konto wiederherzustellen.
            Schreibe dazu an{" "}
            <a href="mailto:support@immocontrol.app" className="text-primary underline underline-offset-2 hover:text-primary/80">
              support@immocontrol.app
            </a>.
          </p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={handleLogout}>
              <LogOut className="h-4 w-4 mr-1.5" /> Abmelden
            </Button>
          </div>
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
                  Alle deine Daten werden dauerhaft gelöscht. Du hast 30 Tage Zeit, dein Konto per E-Mail an{" "}
                  <a href="mailto:support@immocontrol.app" className="text-primary underline underline-offset-2">support@immocontrol.app</a>{" "}
                  wiederherzustellen. Danach ist die Löschung endgültig.
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

        <SystemInfoSettings sectionRef={refFor("system-info")} totpEnabled={totpEnabled} />
        <DataBackup />

        <div className="text-center py-4 space-y-1 animate-fade-in [animation-delay:250ms]">
          <p className="text-[10px] text-muted-foreground">ImmoControl v2.0</p>
        </div>
      </div>
    </div>
  );
};

export default Settings;
