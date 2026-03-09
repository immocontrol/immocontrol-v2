import { useState, useEffect, useMemo, useRef, lazy, Suspense } from "react";
import { Settings as SettingsIcon, User, Lock, LogOut, Sun, Moon, Monitor, Trash2, AlertTriangle, Users, Database, Keyboard, Shield, Fingerprint, MessageSquare, MonitorSmartphone, Bot, Home, Mail, Bell, Type, Search, Eye, EyeOff, Check, Bug } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useAuth } from "@/hooks/useAuth";
import { useIsMobile } from "@/hooks/use-mobile";
import { useKeyboardAwareScroll } from "@/components/mobile/MobileKeyboardAwareScroll";
import { supabase } from "@/integrations/supabase/client";
import { toastSuccess, toastError, toastInfo } from "@/lib/toastMessages";
import { useNavigate, Link } from "react-router-dom";
import { ROUTES } from "@/lib/routes";
import { useTheme } from "@/hooks/useTheme";

/* Lazy-load sub-components that have complex import chains to avoid TDZ/circular init in production */
const ErrorScanner = lazy(() => import("@/components/ErrorScanner").then((m) => ({ default: m.ErrorScanner })));
const DataBackup = lazy(() => import("@/components/DataBackup").then((m) => ({ default: m.DataBackup })));
const TeamManagement = lazy(() => import("@/components/TeamManagement2").then((m) => ({ default: m.TeamManagement })));
const BackupSettings = lazy(() => import("@/components/settings/BackupSettings").then((m) => ({ default: m.BackupSettings })));
const TelegramSettings = lazy(() => import("@/components/settings/TelegramSettings").then((m) => ({ default: m.TelegramSettings })));
const ManusSettings = lazy(() => import("@/components/settings/ManusSettings").then((m) => ({ default: m.ManusSettings })));

/* Extracted sub-components (Page-Splitting) */
import { PasswordSettings } from "@/components/settings/PasswordSettings";
import { TwoFactorSettings } from "@/components/settings/TwoFactorSettings";
import { PasskeySettings } from "@/components/settings/PasskeySettings";
import { BiometricSettings } from "@/components/settings/BiometricSettings";
import { DeviceSettings } from "@/components/settings/DeviceSettings";
import { DefaultPageSettings } from "@/components/settings/DefaultPageSettings";
import { AIChatSettings } from "@/components/settings/AIChatSettings";
import { SystemInfoSettings } from "@/components/settings/SystemInfoSettings";
import { ShortcutSettings } from "@/components/settings/ShortcutSettings";
import { BenachrichtigungenSettings } from "@/components/settings/BenachrichtigungenSettings";

/* Settings sidebar sections for navigation. Gefahrenzone bewusst getrennt, damit sie im Menü immer ganz unten steht. */
const SETTINGS_SECTIONS_MAIN = [
  { id: "erscheinungsbild", label: "Erscheinungsbild", icon: Sun },
  { id: "profil", label: "Profil", icon: User },
  { id: "passwort", label: "Passwort", icon: Lock },
  { id: "2fa", label: "2FA", icon: Shield },
  { id: "passkeys", label: "Passkeys", icon: Fingerprint },
  { id: "biometric", label: "Biometrie", icon: Fingerprint },
  { id: "geraete", label: "Ger\u00e4te", icon: MonitorSmartphone },
  { id: "standardseite", label: "Standardseite", icon: Home },
  { id: "ai-chat", label: "AI Chat", icon: Bot },
  { id: "backup", label: "Daten-Backup", icon: Database },
  { id: "benachrichtigungen", label: "Benachrichtigungen", icon: Bell },
  { id: "tastenkombinationen", label: "Tasten", icon: Keyboard },
  { id: "telegram", label: "Telegram", icon: MessageSquare },
  { id: "manus-ai", label: "Manus AI", icon: Bot },
  { id: "error-scanner", label: "Error Scanner", icon: Bug },
  { id: "team", label: "Team", icon: Users },
  { id: "system-info", label: "System-Info", icon: Database },
] as const;

const GEFAHRENZONE_SECTION = { id: "gefahrenzone", label: "Gefahrenzone", icon: AlertTriangle } as const;
const SETTINGS_SECTIONS = [...SETTINGS_SECTIONS_MAIN, GEFAHRENZONE_SECTION];

const Settings = () => {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const { theme, setTheme } = useTheme();
  const isMobile = useIsMobile();
  /* Suchfeld und andere Inputs auf Mobile über der Tastatur sichtbar halten */
  useKeyboardAwareScroll({ offset: 80, enabled: isMobile });
  const [displayName, setDisplayName] = useState("");
  const [loading, setLoading] = useState(false);
  const [profileLoading, setProfileLoading] = useState(true);
  const [deleteConfirm, setDeleteConfirm] = useState("");
  const [totpEnabled, setTotpEnabled] = useState(false);
  const [activeSection, setActiveSection] = useState("erscheinungsbild");
  const sectionRefs = useRef<Record<string, HTMLElement | null>>({});
  const mobileTabBarRef = useRef<HTMLDivElement>(null);
  const [uiZoom, setUIZoom] = useState<string>(() => (typeof window !== "undefined" ? localStorage.getItem("immocontrol_ui_zoom") || "100" : "100"));
  const [settingsSearchQuery, setSettingsSearchQuery] = useState("");
  /* E-Mail ändern: direkt bei Profil, kein eigenes Sektion */
  const [emailStep, setEmailStep] = useState<"idle" | "password" | "new-email" | "new-code">("idle");
  const [emailPassword, setEmailPassword] = useState("");
  const [emailNew, setEmailNew] = useState("");
  const [emailChangeLoading, setEmailChangeLoading] = useState(false);
  const [showEmailPassword, setShowEmailPassword] = useState(false);

  const filteredSettingsSections = useMemo(() => {
    const q = settingsSearchQuery.trim().toLowerCase();
    const main = !q ? [...SETTINGS_SECTIONS_MAIN] : SETTINGS_SECTIONS_MAIN.filter((s) => s.label.toLowerCase().includes(q));
    const withDanger = q ? (GEFAHRENZONE_SECTION.label.toLowerCase().includes(q) ? [GEFAHRENZONE_SECTION] : []) : [GEFAHRENZONE_SECTION];
    let list = [...main, ...withDanger];
    if (isMobile) list = list.filter((s) => s.id !== "tastenkombinationen");
    return list;
  }, [settingsSearchQuery, isMobile]);

  useEffect(() => { document.title = "Einstellungen \u2013 ImmoControl"; }, []);

  /* Sidebar scroll spy: aktive Sektion aus vertikalem Scroll ableiten (größerer sichtbarer Bereich = reaktiver) */
  useEffect(() => {
    const observers: IntersectionObserver[] = [];
    const handleIntersection = (entries: IntersectionObserverEntry[]) => {
      for (const entry of entries) {
        if (entry.isIntersecting && entry.intersectionRatio > 0.2) {
          setActiveSection(entry.target.id);
        }
      }
    };
    SETTINGS_SECTIONS.forEach(section => {
      const el = sectionRefs.current[section.id];
      if (el) {
        const observer = new IntersectionObserver(handleIntersection, {
          rootMargin: "-5% 0px -55% 0px",
          threshold: [0.2, 0.4, 0.6],
        });
        observer.observe(el);
        observers.push(observer);
      }
    });
    return () => observers.forEach(o => o.disconnect());
  }, [profileLoading]);

  /* Mobile: Tab-Leiste horizontal mitscrollen – aktiver Menüpunkt zentriert, parallel zum vertikalen Scrollen */
  useEffect(() => {
    const container = mobileTabBarRef.current;
    if (!container) return;
    const activeBtn = container.querySelector<HTMLElement>(`[data-settings-tab="${activeSection}"]`);
    if (!activeBtn) return;
    const centerTab = () => {
      const cw = container.clientWidth;
      const btnLeft = activeBtn.offsetLeft;
      const btnWidth = activeBtn.offsetWidth;
      const targetScroll = btnLeft - cw / 2 + btnWidth / 2;
      const maxScroll = Math.max(0, container.scrollWidth - cw);
      container.scrollTo({ left: Math.max(0, Math.min(targetScroll, maxScroll)), behavior: "smooth" });
    };
    const raf = requestAnimationFrame(centerTab);
    return () => cancelAnimationFrame(raf);
  }, [activeSection, filteredSettingsSections]);

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

  /* FUND-10: Mounted guard prevents state update after unmount during async profile fetch */
  useEffect(() => {
    let mounted = true;
    const fetchProfile = async () => {
      if (!user) { if (mounted) setProfileLoading(false); return; }
      try {
        const { data } = await supabase
          .from("profiles")
          .select("display_name")
          .eq("user_id", user.id)
          .maybeSingle();
        if (mounted && data?.display_name) setDisplayName(data.display_name);
      } finally {
        if (mounted) setProfileLoading(false);
      }
    };
    fetchProfile();
    return () => { mounted = false; };
  }, [user]);

  /* STRONG-11: Add error logging to handleUpdateProfile — previously errors were shown to user but not tracked */
  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setLoading(true);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({ display_name: displayName })
        .eq("user_id", user.id);
      if (error) {
        toastError("Fehler beim Speichern");
        /* FIX-11: Removed console.error — errors are shown to user via toast */
      } else {
        toastSuccess("Profil aktualisiert!");
      }
    } catch {
      toastError("Unerwarteter Fehler beim Speichern");
      /* FIX-11: Removed console.error — errors are shown to user via toast */
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      await signOut();
      toastSuccess("Abgemeldet");
      navigate(ROUTES.AUTH);
    } catch (err: unknown) {
      toastError(err instanceof Error ? err.message : "Abmeldung fehlgeschlagen");
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

  const handleEmailChangeStart = async () => {
    if (!user?.email || !emailPassword.trim()) {
      toastError("Bitte gib dein aktuelles Passwort ein");
      return;
    }
    setEmailChangeLoading(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const previousSession = sessionData?.session;
      const { error: verifyError } = await supabase.auth.signInWithPassword({ email: user.email, password: emailPassword });
      if (verifyError) {
        if (previousSession) await supabase.auth.setSession({ access_token: previousSession.access_token, refresh_token: previousSession.refresh_token });
        toastError("Passwort ist falsch");
        setEmailChangeLoading(false);
        return;
      }
      if (previousSession) await supabase.auth.setSession({ access_token: previousSession.access_token, refresh_token: previousSession.refresh_token });
      setEmailStep("new-email");
      toastSuccess("Passwort bestätigt — gib jetzt deine neue E-Mail ein");
    } catch {
      toastError("Fehler bei der Passwort-Überprüfung");
    } finally {
      setEmailChangeLoading(false);
    }
  };

  const handleEmailChangeSubmitNew = async () => {
    if (!emailNew.trim() || !emailNew.includes("@")) {
      toastError("Bitte gib eine gültige E-Mail-Adresse ein");
      return;
    }
    if (emailNew === user?.email) {
      toastError("Die neue E-Mail ist identisch mit der aktuellen");
      return;
    }
    setEmailChangeLoading(true);
    try {
      const { error } = await supabase.auth.updateUser(
        { email: emailNew },
        { emailRedirectTo: `${window.location.origin}/auth?email_changed=true` }
      );
      if (error) {
        if (error.message.includes("email_exists") || error.message.includes("already registered")) toastError("Diese E-Mail-Adresse ist bereits registriert");
        else if (error.message.includes("rate limit")) toastError("Zu viele Versuche. Bitte warte einen Moment.");
        else if (error.message.includes("same_email") || error.message.includes("same as")) toastError("Die neue E-Mail ist identisch mit der aktuellen");
        else toastError(error.message);
      } else {
        setEmailStep("new-code");
        toastSuccess(`Bestätigungslink an ${emailNew} gesendet`);
      }
    } catch {
      toastError("Fehler beim Ändern der E-Mail");
    } finally {
      setEmailChangeLoading(false);
    }
  };

  const resetEmailChange = () => {
    setEmailStep("idle");
    setEmailPassword("");
    setEmailNew("");
  };

  /* Layout: Mobile = Tab-Leiste fixed unter Header + Inhalt; Desktop = Sidebar + Inhalt. */
  const mobileTabBarHeight = "3rem"; /* h-12, muss mit Spacer übereinstimmen */
  return (
    <div
      className="w-full min-w-0 max-w-full max-w-[100vw] flex flex-col lg:flex-row lg:gap-6"
      role="main"
      aria-label="Einstellungen"
    >
      {/* Mobile: Tab-Leiste fixed unter der obersten Menüleiste (Header), immer sichtbar beim Scrollen */}
      <div
        className="lg:hidden fixed left-0 right-0 z-[140] w-full bg-background/95 backdrop-blur-sm border-b border-border shadow-[0_1px_0_0_hsl(var(--border))]"
        style={{ top: "calc(3.5rem + env(safe-area-inset-top, 0px))", height: mobileTabBarHeight }}
      >
        <div
          ref={mobileTabBarRef}
          className="w-full h-full max-w-full overflow-x-auto scrollbar-hide overscroll-x-contain relative"
        >
          <div className="absolute top-0 right-0 bottom-0 w-6 bg-gradient-to-l from-background to-transparent pointer-events-none z-10" aria-hidden />
          <div className="flex gap-1 min-w-max justify-start pl-1 pr-6 py-2 items-center h-full">
            {filteredSettingsSections.map((section) => {
              const SectionIcon = section.icon;
              const isActive = activeSection === section.id;
              return (
                <button
                  key={section.id}
                  data-settings-tab={section.id}
                  onClick={() => scrollToSection(section.id)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
                    isActive ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-secondary/50"
                  }`}
                >
                  <SectionIcon className="h-3 w-3" />
                  {section.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Mobile: Spacer damit der Inhalt nicht unter der fixierten Tab-Leiste beginnt */}
      <div className="lg:hidden shrink-0 w-full" style={{ height: mobileTabBarHeight }} aria-hidden />

      {/* Desktop: Sidebar (nur ab lg) — sticky; Gefahrenzone immer ganz unten */}
      <aside className="hidden lg:flex flex-col w-48 shrink-0 self-start sticky top-0 max-h-[calc(100vh-2rem)] z-10 bg-background border-r border-border pr-2 -mr-2">
          <nav className="w-full flex flex-col min-h-0 flex-1" aria-label="Einstellungen-Navigation">
          {/* Scrollbarer Bereich: restliche Sektionen */}
          <div className="flex-1 min-h-0 overflow-y-auto py-1">
            {(() => {
              const activeIdx = filteredSettingsSections.findIndex(s => s.id === activeSection);
              const sectionsWithoutDanger = filteredSettingsSections.filter(s => s.id !== "gefahrenzone");
              return sectionsWithoutDanger.map((section, idx) => {
                const SectionIcon = section.icon;
                const isPast = idx < activeIdx;
                const isActive = idx === activeIdx;
                return (
                  <div key={section.id} className="relative">
                    <button
                      data-settings-nav={section.id}
                      onClick={() => scrollToSection(section.id)}
                      className={`relative z-10 w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium text-left transition-[color,background-color,transform] duration-500 ease-out ${
                        isActive
                          ? "bg-primary/10 text-primary"
                          : isPast
                            ? "text-primary/70 hover:bg-primary/5"
                            : "text-muted-foreground hover:bg-secondary/50 hover:text-foreground"
                      }`}
                    >
                      <div
                        className={`relative flex items-center justify-center h-[18px] w-[18px] shrink-0 rounded-full transition-[background-color,color,box-shadow,transform] duration-500 ease-out ${
                          isActive
                            ? "bg-primary text-primary-foreground shadow-[0_0_0_3px_hsl(var(--primary)/0.2)] scale-110"
                            : isPast
                              ? "bg-primary/20 text-primary scale-100"
                              : "bg-secondary text-muted-foreground scale-100"
                        }`}
                      >
                        <SectionIcon className="h-2.5 w-2.5" />
                      </div>
                      <span className="truncate">{section.label}</span>
                      <div
                        className="ml-auto h-1.5 w-1.5 rounded-full bg-primary transition-opacity duration-500 ease-out"
                        style={{ opacity: isActive ? 1 : 0 }}
                      />
                    </button>
                  </div>
                );
              });
            })()}
          </div>
          {/* Gefahrenzone immer am unteren Rand der Sidebar */}
          <div className="shrink-0 pt-2 mt-auto border-t border-border">
            <div className="relative">
              <button
                data-settings-nav="gefahrenzone"
                onClick={() => scrollToSection("gefahrenzone")}
                className={`relative z-10 w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium text-left transition-[color,background-color] duration-200 ${
                  activeSection === "gefahrenzone"
                    ? "bg-destructive/10 text-destructive"
                    : "text-muted-foreground hover:bg-destructive/5 hover:text-destructive/90"
                }`}
              >
                <div
                  className={`relative flex items-center justify-center h-[18px] w-[18px] shrink-0 rounded-full ${
                    activeSection === "gefahrenzone"
                      ? "bg-destructive/20 text-destructive"
                      : "bg-secondary text-muted-foreground"
                  }`}
                >
                  <AlertTriangle className="h-2.5 w-2.5" />
                </div>
                <span className="truncate">{GEFAHRENZONE_SECTION.label}</span>
                <div
                  className="ml-auto h-1.5 w-1.5 rounded-full bg-destructive transition-opacity duration-200"
                  style={{ opacity: activeSection === "gefahrenzone" ? 1 : 0 }}
                />
              </button>
            </div>
          </div>
          </nav>
      </aside>

      {/* Main settings content — auf Mobile unter Tabs, auf Desktop neben Sidebar; overflow-x nur hier, damit sticky Tab-Leiste nicht bricht */}
      <div className="w-full min-w-0 box-border space-y-6 max-w-lg mx-auto flex-1 px-2 sm:px-0 overflow-x-hidden">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <SettingsIcon className="h-6 w-6 text-primary" />
            <h1 className="text-2xl font-bold tracking-tight">Einstellungen</h1>
          </div>
          {/* C8: Suchfeld „Einstellung finden“ — filtert Tabs/Sidebar */}
          <div className="w-full sm:w-56 shrink-0">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
              <Input
                type="search"
                placeholder="Einstellung finden…"
                value={settingsSearchQuery}
                onChange={(e) => setSettingsSearchQuery(e.target.value)}
                className="pl-9 h-9 text-sm"
                aria-label="Einstellung suchen"
              />
            </div>
            {settingsSearchQuery.trim() && filteredSettingsSections.length === 0 && (
              <p className="text-xs text-muted-foreground mt-1.5">Keine Einstellung für „{settingsSearchQuery.trim()}“ gefunden.</p>
            )}
          </div>
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

          <div className="pt-4 border-t border-border">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2 mb-2">
              <Type className="h-3.5 w-3.5" /> Schrift & Ansicht
            </h3>
            <p className="text-xs text-muted-foreground mb-2">
              Text, Buttons und Abstände vergrößern oder verkleinern (wirkt wie Rein-/Rauszoomen).
            </p>
            <div className="flex flex-wrap gap-2">
              {([
                { value: "90", label: "Kleiner" },
                { value: "100", label: "Standard" },
                { value: "110", label: "Größer" },
                { value: "120", label: "Sehr groß" },
              ] as const).map(({ value, label }) => {
                const isActive = uiZoom === value;
                return (
                  <button
                    key={value}
                    type="button"
                    onClick={() => {
                      localStorage.setItem("immocontrol_ui_zoom", value);
                      document.documentElement.dataset.uiZoom = value;
                      setUIZoom(value);
                    }}
                    className={`px-3 py-1.5 rounded-lg border text-xs font-medium transition-all touch-target min-h-[44px] ${
                      isActive ? "border-primary bg-primary/10 text-primary" : "border-border hover:bg-secondary/50"
                    }`}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Profile */}
        <form id="profil" ref={refFor("profil")} onSubmit={handleUpdateProfile} className="gradient-card rounded-xl border border-border p-5 space-y-4 animate-fade-in [animation-delay:50ms] scroll-mt-20">
          <h2 className="text-sm font-semibold flex items-center gap-2">
            <User className="h-4 w-4 text-muted-foreground" /> Profil
          </h2>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">E-Mail</Label>
            <div className="flex flex-wrap items-center gap-2">
              <Input value={user?.email || ""} disabled className="h-9 text-sm opacity-60 flex-1 min-w-[180px]" />
              {emailStep === "idle" && (
                <Button type="button" variant="outline" size="sm" className="gap-1.5 shrink-0" onClick={() => setEmailStep("password")}>
                  <Mail className="h-3.5 w-3.5" /> E-Mail ändern
                </Button>
              )}
            </div>
            {emailStep === "password" && (
              <div className="mt-3 p-3 rounded-lg bg-secondary/30 border border-border space-y-3">
                <p className="text-[10px] text-muted-foreground">Passwort bestätigen, dann neue E-Mail eingeben. Bestätigungslink geht an alte und neue Adresse.</p>
                <div className="relative">
                  <Input
                    type={showEmailPassword ? "text" : "password"}
                    value={emailPassword}
                    onChange={(e) => setEmailPassword(e.target.value)}
                    placeholder="Aktuelles Passwort"
                    className="h-9 text-sm pr-10"
                    autoComplete="current-password"
                  />
                  <button type="button" onClick={() => setShowEmailPassword(!showEmailPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground" tabIndex={-1}>
                    {showEmailPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                <div className="flex gap-2">
                  <Button type="button" size="sm" onClick={handleEmailChangeStart} disabled={emailChangeLoading || !emailPassword}>
                    {emailChangeLoading ? "Prüfe..." : "Weiter"}
                  </Button>
                  <Button type="button" variant="ghost" size="sm" onClick={resetEmailChange}>Abbrechen</Button>
                </div>
              </div>
            )}
            {emailStep === "new-email" && (
              <div className="mt-3 p-3 rounded-lg bg-primary/5 border border-primary/20 space-y-3">
                <p className="text-[10px] text-primary font-medium flex items-center gap-1.5"><Check className="h-3.5 w-3.5" /> Passwort bestätigt</p>
                <Input
                  type="email"
                  value={emailNew}
                  onChange={(e) => setEmailNew(e.target.value)}
                  placeholder="neue@email.de"
                  className="h-9 text-sm"
                />
                <div className="flex gap-2">
                  <Button type="button" size="sm" onClick={handleEmailChangeSubmitNew} disabled={emailChangeLoading || !emailNew.includes("@")}>
                    {emailChangeLoading ? "Sende..." : "Bestätigungslink senden"}
                  </Button>
                  <Button type="button" variant="ghost" size="sm" onClick={resetEmailChange}>Abbrechen</Button>
                </div>
              </div>
            )}
            {emailStep === "new-code" && (
              <div className="mt-3 p-3 rounded-lg bg-profit/5 border border-profit/20">
                <p className="text-[10px] text-profit font-medium flex items-center gap-1.5"><Check className="h-3.5 w-3.5" /> Link gesendet</p>
                <p className="text-[10px] text-muted-foreground mt-1">Klicke auf den Link in der E-Mail an <strong>{emailNew}</strong>, um die Änderung abzuschließen.</p>
                <Button type="button" variant="outline" size="sm" className="mt-2" onClick={resetEmailChange}>Fertig</Button>
              </div>
            )}
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
          <div className="pt-2 border-t border-border">
            <Link
              to={ROUTES.ONBOARDING}
              className="text-xs text-muted-foreground hover:text-primary hover:underline inline-flex items-center gap-1.5 touch-target min-h-[44px]"
            >
              Ersteinrichtung (Investoren-Typ & Strategie) erneut durchlaufen →
            </Link>
          </div>
        </form>

        {/* Extracted sub-components */}
        <PasswordSettings sectionRef={refFor("passwort")} />
        <TwoFactorSettings sectionRef={refFor("2fa")} />
        <PasskeySettings sectionRef={refFor("passkeys")} displayName={displayName} />
        <BiometricSettings sectionRef={refFor("biometric")} displayName={displayName} />
        <DeviceSettings sectionRef={refFor("geraete")} />
        <DefaultPageSettings sectionRef={refFor("standardseite")} />
        <AIChatSettings sectionRef={refFor("ai-chat")} />
        <Suspense fallback={null}>
          <BackupSettings sectionRef={refFor("backup")} />
        </Suspense>
        <BenachrichtigungenSettings sectionRef={refFor("benachrichtigungen")} />
        {!isMobile && <ShortcutSettings sectionRef={refFor("tastenkombinationen")} />}
        <Suspense fallback={null}>
          <TelegramSettings sectionRef={refFor("telegram")} />
        </Suspense>
        <Suspense fallback={null}>
          <ManusSettings sectionRef={refFor("manus-ai")} />
        </Suspense>

        <Suspense fallback={null}>
          <ErrorScanner sectionRef={refFor("error-scanner")} />
        </Suspense>

        {/* Team */}
        <div id="team" ref={refFor("team")} className="scroll-mt-20">
          <Suspense fallback={null}>
            <TeamManagement />
          </Suspense>
        </div>

        <SystemInfoSettings sectionRef={refFor("system-info")} totpEnabled={totpEnabled} />
        <Suspense fallback={null}>
          <DataBackup />
        </Suspense>

        {/* Gefahrenzone immer ganz unten */}
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
                    toastInfo("Bitte kontaktiere den Support, um dein Konto zu löschen.");
                    setDeleteConfirm("");
                  }}
                >
                  Konto löschen
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>

        <div className="text-center py-4 space-y-1 animate-fade-in [animation-delay:250ms]">
          <p className="text-[10px] text-muted-foreground">ImmoControl v2.0</p>
        </div>
      </div>
    </div>
  );
};

export default Settings;
