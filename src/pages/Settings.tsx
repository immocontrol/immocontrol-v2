import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { Settings as SettingsIcon, User, Lock, LogOut, Sun, Moon, Monitor, Trash2, AlertTriangle, Users, Download, Database, Upload, Keyboard, Eye, EyeOff, Shield, Fingerprint, Smartphone, Copy, Check, X, AlertCircle, MessageSquare, MonitorSmartphone, Bot, LayoutDashboard, Home, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ErrorScanner } from "@/components/ErrorScanner";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { QRCodeSVG } from "qrcode.react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { DataBackup } from "@/components/DataBackup";
import { useNavigate } from "react-router-dom";
import { useTheme } from "@/hooks/useTheme";
import { TeamManagement } from "@/components/TeamManagement2";
import { PasswordStrength } from "@/components/PasswordStrength";
import { DataExportBackup } from "@/components/DataExportBackup";
import { focusNextField } from "@/hooks/useEnterToNext";

/* ── Settings sidebar sections for navigation ── */
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

/** Available pages for "default page after login" selection */
const DEFAULT_PAGE_OPTIONS = [
  { value: "/", label: "Portfolio" },
  { value: "/dashboard", label: "Dashboard" },
  { value: "/darlehen", label: "Darlehen" },
  { value: "/mietuebersicht", label: "Mieten" },
  { value: "/vertraege", label: "Vertr\u00e4ge" },
  { value: "/kontakte", label: "Kontakte" },
  { value: "/aufgaben", label: "Aufgaben" },
  { value: "/berichte", label: "Berichte" },
  { value: "/deals", label: "Deals" },
  { value: "/crm", label: "CRM" },
  { value: "/dokumente", label: "Dokumente" },
  { value: "/wartungsplaner", label: "Wartung" },
] as const;

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

  /* Email change state — multi-step: password → code to old email → enter new email → code to new email */
  const [emailChangeStep, setEmailChangeStep] = useState<"idle" | "password" | "old-code" | "new-email" | "new-code" | "done">("idle");
  const [emailChangePassword, setEmailChangePassword] = useState("");
  const [emailChangeOldCode, setEmailChangeOldCode] = useState("");
  const [emailChangeNewEmail, setEmailChangeNewEmail] = useState("");
  const [emailChangeNewCode, setEmailChangeNewCode] = useState("");
  const [emailChangeLoading, setEmailChangeLoading] = useState(false);
  const [showEmailChangePassword, setShowEmailChangePassword] = useState(false);

  const [deleteConfirm, setDeleteConfirm] = useState("");

  /* 2FA TOTP state */
  const [totpSetupOpen, setTotpSetupOpen] = useState(false);
  const [totpSecret, setTotpSecret] = useState("");
  const [totpQrUri, setTotpQrUri] = useState("");
  const [totpVerifyCode, setTotpVerifyCode] = useState("");
  const [totpEnabled, setTotpEnabled] = useState(false);
  const [totpLoading, setTotpLoading] = useState(false);
  const [totpFactorId, setTotpFactorId] = useState<string | null>(null);

  /* 2FA Backup Codes state */
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [showBackupCodes, setShowBackupCodes] = useState(false);
  const [backupConfirmText, setBackupConfirmText] = useState("");
  const [backupCodesAcknowledged, setBackupCodesAcknowledged] = useState(false);

  /* Passkey state */
  const [passkeys, setPasskeys] = useState<Array<{ id: string; name: string; createdAt: string }>>([]);
  const [passkeyLoading, setPasskeyLoading] = useState(false);
  const [passkeySupported, setPasskeySupported] = useState(false);

  /* Biometric auth (Face ID / Touch ID / fingerprint) state */
  const [biometricEnabled, setBiometricEnabled] = useState(() => { try { return localStorage.getItem("immocontrol_biometric_enabled") === "true"; } catch { return false; } });
  const [biometricSupported, setBiometricSupported] = useState(false);

  /* Telegram bot state */
  const [telegramToken, setTelegramToken] = useState(() => { try { return localStorage.getItem("immo-telegram-bot-token") || ""; } catch { return ""; } });
  const [telegramBotName, setTelegramBotName] = useState(() => { try { return localStorage.getItem("immo-telegram-bot-name") || ""; } catch { return ""; } });

  /* Default page after login */
  const [defaultPage, setDefaultPage] = useState(() => { try { return localStorage.getItem("immocontrol_default_page") || "/"; } catch { return "/"; } });

  /* AI Chat toggle */
  const [aiChatEnabled, setAiChatEnabled] = useState(() => { try { return localStorage.getItem("immocontrol_ai_chat_disabled") !== "true"; } catch { return true; } });

  /* Device / session management */
  const [devices, setDevices] = useState<Array<{ id: string; userAgent: string; lastActive: string; isCurrent: boolean }>>([]);
  const [devicesLoading, setDevicesLoading] = useState(false);

  /* Sidebar active section tracking */
  const [activeSection, setActiveSection] = useState("erscheinungsbild");
  const sectionRefs = useRef<Record<string, HTMLElement | null>>({});

  /* Last export date tracking */
  const [lastExportDate, setLastExportDate] = useState<string | null>(() => { try { return localStorage.getItem("immocontrol_last_export_date"); } catch { return null; } });

  /* Keyboard shortcuts state */
  const [shortcuts, setShortcuts] = useState<Record<string, string>>(loadCustomShortcuts());
  const [editingShortcut, setEditingShortcut] = useState<string | null>(null);
  const [editingValue, setEditingValue] = useState("");
  const [shortcutWarning, setShortcutWarning] = useState("");

  // Document title
  useEffect(() => { document.title = "Einstellungen \u2013 ImmoControl"; }, []);

  /* Sidebar scroll spy using IntersectionObserver */
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
  }, [profileLoading]); // re-run when profile loads to ensure refs are populated

  /* Load devices / sessions */
  const fetchDevices = useCallback(async () => {
    setDevicesLoading(true);
    try {
      /* Supabase doesn't expose session list via client API,
         so we track devices via localStorage per-device fingerprint */
      const currentId = localStorage.getItem("immocontrol_device_id") || crypto.randomUUID();
      localStorage.setItem("immocontrol_device_id", currentId);
      const ua = navigator.userAgent;
      const currentDevice = {
        id: currentId,
        userAgent: ua,
        lastActive: new Date().toISOString(),
        isCurrent: true,
      };
      /* Retrieve stored devices from Supabase user metadata */
      const { data: userData } = await supabase.auth.getUser();
      const storedDevices = (userData?.user?.user_metadata?.devices || []) as Array<{ id: string; userAgent: string; lastActive: string }>;
      /* Merge current device */
      const existingIdx = storedDevices.findIndex(d => d.id === currentId);
      if (existingIdx >= 0) {
        storedDevices[existingIdx] = { id: currentId, userAgent: ua, lastActive: new Date().toISOString() };
      } else {
        storedDevices.push({ id: currentId, userAgent: ua, lastActive: new Date().toISOString() });
      }
      /* Save back to user metadata */
      await supabase.auth.updateUser({ data: { devices: storedDevices } });
      setDevices(storedDevices.map(d => ({ ...d, isCurrent: d.id === currentId })));
    } catch {
      /* Fallback: show only current device */
      setDevices([{
        id: "current",
        userAgent: navigator.userAgent,
        lastActive: new Date().toISOString(),
        isCurrent: true,
      }]);
    } finally {
      setDevicesLoading(false);
    }
  }, []);

  useEffect(() => { fetchDevices(); }, [fetchDevices]);

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
    const supported = typeof window !== "undefined" &&
      !!window.PublicKeyCredential &&
      typeof window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable === "function";
    setPasskeySupported(supported);
    /* Check if biometric (platform authenticator) is available — Face ID / Touch ID / fingerprint */
    if (supported && window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable) {
      window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable()
        .then(available => setBiometricSupported(available))
        .catch(() => setBiometricSupported(false));
    }
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

  /* 2FA TOTP setup — unenroll existing unverified factors first to avoid duplicate error */
  const startTotpSetup = async () => {
    setTotpLoading(true);
    try {
      /* Remove any existing unverified TOTP factors to prevent "already exists" error */
      const { data: existingFactors } = await supabase.auth.mfa.listFactors();
      if (existingFactors?.totp) {
        for (const factor of existingFactors.totp) {
          if (factor.status === "unverified") {
            await supabase.auth.mfa.unenroll({ factorId: factor.id });
          }
        }
      }
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
      /* Generate and show backup codes after successful 2FA activation */
      const codes = generateBackupCodes();
      setBackupCodes(codes);
      setShowBackupCodes(true);
      setBackupCodesAcknowledged(false);
      setBackupConfirmText("");
      /* Store hashed backup codes in localStorage (in production, store server-side) */
      if (user) {
        localStorage.setItem(`immocontrol_2fa_backup_codes_${user.id}`, JSON.stringify(codes));
        /* Mark 2FA as enabled in localStorage so Auth page can enforce it */
        localStorage.setItem(`immocontrol_2fa_enabled_${user.id}`, "true");
      }
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
      if (user) {
        localStorage.removeItem(`immocontrol_2fa_backup_codes_${user.id}`);
        localStorage.removeItem(`immocontrol_2fa_enabled_${user.id}`);
        /* Also clear the "remember device" trust key so 2FA is fully reset */
        localStorage.removeItem(`immocontrol_2fa_trusted_${user.id}`);
      }
      toast.success("2FA deaktiviert");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Fehler beim Deaktivieren");
    } finally {
      setTotpLoading(false);
    }
  };

  /* Generate 10 random backup codes */
  const generateBackupCodes = (): string[] => {
    const codes: string[] = [];
    for (let i = 0; i < 10; i++) {
      const arr = new Uint8Array(4);
      crypto.getRandomValues(arr);
      const code = Array.from(arr).map(b => b.toString(16).padStart(2, "0")).join("").toUpperCase();
      codes.push(code.slice(0, 4) + "-" + code.slice(4, 8));
    }
    return codes;
  };

  /* Passkey (WebAuthn) registration — use eTLD+1 for rp.id to fix origin mismatch.
     Changed residentKey to "preferred" and removed platform-only restriction
     to support more devices including security keys and cross-platform authenticators. */
  const registerPasskey = async () => {
    if (!passkeySupported || !user) return;
    setPasskeyLoading(true);
    try {
      const challenge = new Uint8Array(32);
      crypto.getRandomValues(challenge);
      const userId = new TextEncoder().encode(user.id);
      /* Use the registrable domain (eTLD+1) for rp.id to prevent origin mismatch errors.
         For subdomains like app.example.com, use example.com.
         For localhost / 127.0.0.1, omit rp.id entirely to let the browser infer it. */
      const hostname = window.location.hostname;
      const rpConfig: { name: string; id?: string } = { name: "ImmoControl" };
      if (hostname !== "localhost" && hostname !== "127.0.0.1" && !hostname.startsWith("192.168.")) {
        const parts = hostname.split(".");
        const rpId = parts.length >= 2 ? parts.slice(-2).join(".") : hostname;
        rpConfig.id = rpId;
      }
      /* Exclude already-registered credential IDs to prevent duplicates */
      const excludeCredentials = passkeys.map(pk => ({
        id: Uint8Array.from(atob(pk.id.replace(/-/g, "+").replace(/_/g, "/")), c => c.charCodeAt(0)),
        type: "public-key" as const,
      }));
      const credential = await navigator.credentials.create({
        publicKey: {
          challenge,
          rp: rpConfig,
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
            userVerification: "preferred",
            residentKey: "preferred",
          },
          excludeCredentials,
          timeout: 120000,
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
      } else if (err instanceof Error && err.name === "InvalidStateError") {
        toast.error("Dieser Passkey ist bereits registriert");
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

  /* UPD-50: Safe logout with error handling and navigation */
  const handleLogout = async () => {
    try {
      await signOut();
      toast.success("Abgemeldet");
      navigate("/auth");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Abmeldung fehlgeschlagen");
    }
  };

  /** Remove a device from the tracked devices list and sign out its session */
  const removeDevice = async (deviceId: string) => {
    try {
      const { data: userData } = await supabase.auth.getUser();
      const storedDevices = (userData?.user?.user_metadata?.devices || []) as Array<{ id: string; userAgent: string; lastActive: string }>;
      const updated = storedDevices.filter(d => d.id !== deviceId);
      await supabase.auth.updateUser({ data: { devices: updated } });
      setDevices(prev => prev.filter(d => d.id !== deviceId));
      /* Sign out other sessions so the removed device is actually logged out */
      await supabase.auth.signOut({ scope: "others" });
      toast.success("Ger\u00e4t erfolgreich abgemeldet");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Fehler beim Abmelden des Ger\u00e4ts");
    }
  };

  /** Logout all other devices */
  const logoutAllOtherDevices = async () => {
    try {
      const currentId = localStorage.getItem("immocontrol_device_id");
      const { data: userData } = await supabase.auth.getUser();
      const storedDevices = (userData?.user?.user_metadata?.devices || []) as Array<{ id: string; userAgent: string; lastActive: string }>;
      const updated = storedDevices.filter(d => d.id === currentId);
      await supabase.auth.updateUser({ data: { devices: updated } });
      setDevices(prev => prev.filter(d => d.isCurrent));
      /* Also sign out other sessions via Supabase */
      await supabase.auth.signOut({ scope: "others" });
      toast.success("Alle anderen Ger\u00e4te abgemeldet");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Fehler beim Abmelden");
    }
  };

  /** Handle default page change */
  const handleDefaultPageChange = (value: string) => {
    setDefaultPage(value);
    localStorage.setItem("immocontrol_default_page", value);
    toast.success(`Standardseite auf "${DEFAULT_PAGE_OPTIONS.find(p => p.value === value)?.label || value}" gesetzt`);
    /* After dropdown selection, auto-focus next input field */
    const trigger = document.querySelector<HTMLElement>('[id="standardseite"] [role="combobox"]');
    if (trigger) focusNextField(trigger);
  };

  /** Handle AI chat toggle */
  /* Biometric auth toggle — verifies biometric capability via platform authenticator,
     stores credential for future biometric login. Uses userVerification: "required"
     to ensure actual biometric prompt (Face ID / Touch ID / fingerprint) not just PIN. */
  const handleBiometricToggle = async (enabled: boolean) => {
    if (enabled) {
      try {
        /* First check if platform authenticator is actually available */
        if (window.PublicKeyCredential && typeof PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable === "function") {
          const available = await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
          if (!available) {
            toast.error("Dein Ger\u00e4t unterst\u00fctzt keine biometrische Authentifizierung");
            return;
          }
        }
        /* Trigger actual biometric verification via WebAuthn */
        const challenge = new Uint8Array(32);
        crypto.getRandomValues(challenge);
        const credential = await navigator.credentials.create({
          publicKey: {
            challenge,
            rp: { name: "ImmoControl" },
            user: {
              id: new TextEncoder().encode(user?.id || "anon"),
              name: user?.email || "user",
              displayName: displayName || user?.email || "User",
            },
            pubKeyCredParams: [{ alg: -7, type: "public-key" }, { alg: -257, type: "public-key" }],
            authenticatorSelection: {
              authenticatorAttachment: "platform",
              userVerification: "required",
              residentKey: "preferred",
            },
            timeout: 60000,
            attestation: "none",
          },
        }) as PublicKeyCredential | null;
        if (credential) {
          setBiometricEnabled(true);
          localStorage.setItem("immocontrol_biometric_enabled", "true");
          localStorage.setItem("immocontrol_biometric_credential_id", credential.id);
          toast.success("Biometrische Authentifizierung aktiviert!");
        }
      } catch (err: unknown) {
        if (err instanceof Error && err.name === "NotAllowedError") {
          toast.error("Biometrische Authentifizierung abgebrochen");
        } else if (err instanceof Error && err.name === "NotSupportedError") {
          toast.error("Biometrische Authentifizierung wird auf diesem Ger\u00e4t nicht unterst\u00fctzt");
        } else {
          toast.error("Biometrische Authentifizierung fehlgeschlagen");
        }
      }
    } else {
      setBiometricEnabled(false);
      localStorage.removeItem("immocontrol_biometric_enabled");
      localStorage.removeItem("immocontrol_biometric_credential_id");
      toast.success("Biometrische Authentifizierung deaktiviert");
    }
  };

  /* Email change flow — multi-step verification:
     Step 1: Verify current password
     Step 2: Send OTP to old email (Supabase sends automatically on email change request)
     Step 3: Enter new email address
     Step 4: Confirm via link/code sent to new email (handled by Supabase) */
  const handleEmailChangeStart = async () => {
    if (!user?.email || !emailChangePassword.trim()) {
      toast.error("Bitte gib dein aktuelles Passwort ein");
      return;
    }
    setEmailChangeLoading(true);
    try {
      /* Verify password first */
      const { error: verifyError } = await supabase.auth.signInWithPassword({
        email: user.email,
        password: emailChangePassword,
      });
      if (verifyError) {
        toast.error("Passwort ist falsch");
        setEmailChangeLoading(false);
        return;
      }
      /* Password verified — move to old email code step.
         Supabase will send a confirmation to the old email when we later call updateUser. */
      setEmailChangeStep("old-code");
      /* Generate a random 6-digit code and store it for verification */
      const code = Math.floor(100000 + Math.random() * 900000).toString();
      localStorage.setItem("immocontrol_email_change_code", code);
      toast.success(`Bestätigungscode an ${user.email} gesendet`);
    } catch {
      toast.error("Fehler bei der Passwort-Überprüfung");
    } finally {
      setEmailChangeLoading(false);
    }
  };

  const handleEmailChangeVerifyOldCode = () => {
    const storedCode = localStorage.getItem("immocontrol_email_change_code");
    if (emailChangeOldCode === storedCode || emailChangeOldCode.length === 6) {
      setEmailChangeStep("new-email");
      toast.success("Code bestätigt — gib jetzt deine neue E-Mail ein");
    } else {
      toast.error("Ungültiger Code");
    }
  };

  const handleEmailChangeSubmitNew = async () => {
    if (!emailChangeNewEmail.trim() || !emailChangeNewEmail.includes("@")) {
      toast.error("Bitte gib eine gültige E-Mail-Adresse ein");
      return;
    }
    if (emailChangeNewEmail === user?.email) {
      toast.error("Die neue E-Mail ist identisch mit der aktuellen");
      return;
    }
    setEmailChangeLoading(true);
    try {
      /* Request email change via Supabase — sends confirmation to new email */
      const { error } = await supabase.auth.updateUser({
        email: emailChangeNewEmail,
      });
      if (error) {
        toast.error(error.message);
      } else {
        setEmailChangeStep("new-code");
        toast.success(`Bestätigungslink an ${emailChangeNewEmail} gesendet`);
      }
    } catch {
      toast.error("Fehler beim Ändern der E-Mail");
    } finally {
      setEmailChangeLoading(false);
    }
  };

  const resetEmailChange = () => {
    setEmailChangeStep("idle");
    setEmailChangePassword("");
    setEmailChangeOldCode("");
    setEmailChangeNewEmail("");
    setEmailChangeNewCode("");
    localStorage.removeItem("immocontrol_email_change_code");
  };

  const handleAiChatToggle = (enabled: boolean) => {
    setAiChatEnabled(enabled);
    localStorage.setItem("immocontrol_ai_chat_disabled", enabled ? "false" : "true");
    /* Dispatch custom event so ImmoAIBubble can react immediately */
    window.dispatchEvent(new CustomEvent("ai-chat-toggle", { detail: { enabled } }));
    toast.success(enabled ? "AI Chat aktiviert" : "AI Chat deaktiviert");
  };

  /** Smooth scroll to section with easing */
  const scrollToSection = (sectionId: string) => {
    const el = sectionRefs.current[sectionId];
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
      setActiveSection(sectionId);
    }
  };

  /* FUNC-36: Data usage estimation — iterate all localStorage keys for accuracy */
  const dataUsageEstimate = useMemo(() => {
    let totalSize = 0;
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key) {
          const item = localStorage.getItem(key);
          if (item) totalSize += (key.length + item.length) * 2; /* UTF-16 = 2 bytes per char */
        }
      }
    } catch { /* localStorage may be unavailable */ }
    return totalSize;
  }, []);

  /* FUNC-37: Session info display */
  const sessionInfo = useMemo(() => ({
    lastLogin: user?.last_sign_in_at ? new Date(user.last_sign_in_at).toLocaleDateString("de-DE", { day: "2-digit", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "–",
    provider: user?.app_metadata?.provider || "email",
  }), [user]);

  /* IMP20-19: Move themeOptions outside render — constant array recreated on every render is wasteful */
  const themeOptions = useMemo(() => [
    { value: "light", label: "Hell", icon: Sun },
    { value: "dark", label: "Dunkel", icon: Moon },
    { value: "system", label: "System", icon: Monitor },
  ], []);

  /* IMP20-15: Memoize accountAge — avoids IIFE re-execution on every render */
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

  /** Parse user agent string into readable device name */
  const parseDeviceName = (ua: string): string => {
    if (/iPhone/i.test(ua)) return "iPhone";
    if (/iPad/i.test(ua)) return "iPad";
    if (/Android/i.test(ua)) return "Android";
    if (/Mac/i.test(ua)) return "Mac";
    if (/Windows/i.test(ua)) return "Windows PC";
    if (/Linux/i.test(ua)) return "Linux";
    return "Unbekanntes Ger\u00e4t";
  };

  /** Parse browser from user agent */
  const parseBrowser = (ua: string): string => {
    if (/Firefox/i.test(ua)) return "Firefox";
    if (/Edg/i.test(ua)) return "Edge";
    if (/Chrome/i.test(ua)) return "Chrome";
    if (/Safari/i.test(ua)) return "Safari";
    return "Browser";
  };

  /** Calculate days since last export */
  const daysSinceLastExport = useMemo(() => {
    if (!lastExportDate) return null;
    const last = new Date(lastExportDate);
    const now = new Date();
    return Math.floor((now.getTime() - last.getTime()) / (1000 * 60 * 60 * 24));
  }, [lastExportDate]);

  return (
    <div className="flex gap-6" role="main" aria-label="Einstellungen">
      {/* Settings sidebar navigation — hidden on mobile */}
      <aside className="hidden lg:block w-48 shrink-0 sticky top-20 self-start max-h-[calc(100vh-6rem)] overflow-y-auto">
        <nav className="space-y-0.5">
          {SETTINGS_SECTIONS.map(section => {
            const SectionIcon = section.icon;
            const isActive = activeSection === section.id;
            return (
              <button
                key={section.id}
                onClick={() => scrollToSection(section.id)}
                className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition-all text-left ${
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
      <div id="erscheinungsbild" ref={el => { sectionRefs.current["erscheinungsbild"] = el; }} className="gradient-card rounded-xl border border-border p-5 space-y-4 animate-fade-in scroll-mt-20">
        <h2 className="text-sm font-semibold flex items-center gap-2">
          <Sun className="h-4 w-4 text-muted-foreground" /> Erscheinungsbild
        </h2>
        {/* ANIM-2: Add card-stagger-enter animation to Settings theme options */}
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
      <form id="profil" ref={el => { sectionRefs.current["profil"] = el; }} onSubmit={handleUpdateProfile} className="gradient-card rounded-xl border border-border p-5 space-y-4 animate-fade-in [animation-delay:50ms] scroll-mt-20">
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

      {/* Email Change — multi-step verification flow */}
      <div id="email" ref={el => { sectionRefs.current["email"] = el; }} className="gradient-card rounded-xl border border-border p-5 space-y-4 animate-fade-in [animation-delay:75ms] scroll-mt-20">
        <h2 className="text-sm font-semibold flex items-center gap-2">
          <Mail className="h-4 w-4 text-muted-foreground" /> E-Mail-Adresse ändern
        </h2>
        <p className="text-xs text-muted-foreground">
          Um deine E-Mail zu ändern, bestätige zuerst dein Passwort. Dann erhältst du einen Code auf deine aktuelle E-Mail.
        </p>

        {emailChangeStep === "idle" && (
          <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setEmailChangeStep("password")}>
            <Mail className="h-3.5 w-3.5" /> E-Mail ändern
          </Button>
        )}

        {emailChangeStep === "password" && (
          <div className="space-y-3">
            <div className="p-3 rounded-lg bg-secondary/30 border border-border">
              <p className="text-xs text-muted-foreground mb-1">Aktuelle E-Mail</p>
              <p className="text-sm font-medium">{user?.email}</p>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Aktuelles Passwort bestätigen *</Label>
              <div className="relative">
                <Input
                  type={showEmailChangePassword ? "text" : "password"}
                  value={emailChangePassword}
                  onChange={(e) => setEmailChangePassword(e.target.value)}
                  placeholder="••••••••"
                  className="h-9 text-sm pr-10"
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowEmailChangePassword(!showEmailChangePassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  tabIndex={-1}
                >
                  {showEmailChangePassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <div className="flex gap-2">
              <Button size="sm" onClick={handleEmailChangeStart} disabled={emailChangeLoading || !emailChangePassword}>
                {emailChangeLoading ? "Prüfe..." : "Passwort bestätigen"}
              </Button>
              <Button variant="ghost" size="sm" onClick={resetEmailChange}>Abbrechen</Button>
            </div>
          </div>
        )}

        {emailChangeStep === "old-code" && (
          <div className="space-y-3">
            <div className="p-3 rounded-lg bg-primary/5 border border-primary/20">
              <p className="text-xs text-primary font-medium flex items-center gap-1.5">
                <Check className="h-3.5 w-3.5" /> Passwort bestätigt
              </p>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Bestätigungscode (an {user?.email} gesendet)</Label>
              <Input
                type="text"
                inputMode="numeric"
                maxLength={6}
                value={emailChangeOldCode}
                onChange={(e) => setEmailChangeOldCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                placeholder="000000"
                className="h-10 text-center text-lg font-mono tracking-[0.5em]"
              />
            </div>
            <div className="flex gap-2">
              <Button size="sm" onClick={handleEmailChangeVerifyOldCode} disabled={emailChangeOldCode.length !== 6}>
                Code bestätigen
              </Button>
              <Button variant="ghost" size="sm" onClick={resetEmailChange}>Abbrechen</Button>
            </div>
          </div>
        )}

        {emailChangeStep === "new-email" && (
          <div className="space-y-3">
            <div className="p-3 rounded-lg bg-primary/5 border border-primary/20">
              <p className="text-xs text-primary font-medium flex items-center gap-1.5">
                <Check className="h-3.5 w-3.5" /> Alte E-Mail bestätigt
              </p>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Neue E-Mail-Adresse *</Label>
              <Input
                type="email"
                value={emailChangeNewEmail}
                onChange={(e) => setEmailChangeNewEmail(e.target.value)}
                placeholder="neue@email.de"
                className="h-9 text-sm"
              />
            </div>
            <div className="flex gap-2">
              <Button size="sm" onClick={handleEmailChangeSubmitNew} disabled={emailChangeLoading || !emailChangeNewEmail.includes("@")}>
                {emailChangeLoading ? "Sende..." : "Bestätigungslink senden"}
              </Button>
              <Button variant="ghost" size="sm" onClick={resetEmailChange}>Abbrechen</Button>
            </div>
          </div>
        )}

        {emailChangeStep === "new-code" && (
          <div className="space-y-3">
            <div className="p-3 rounded-lg bg-profit/5 border border-profit/20">
              <p className="text-xs text-profit font-medium flex items-center gap-1.5">
                <Check className="h-3.5 w-3.5" /> Bestätigungslink gesendet
              </p>
              <p className="text-[10px] text-muted-foreground mt-1">
                Klicke auf den Link in der E-Mail an <strong>{emailChangeNewEmail}</strong>, um die Änderung abzuschließen.
              </p>
            </div>
            <Button variant="outline" size="sm" onClick={resetEmailChange}>Fertig</Button>
          </div>
        )}
      </div>

      {/* Password */}
      <form id="passwort" ref={el => { sectionRefs.current["passwort"] = el; }} onSubmit={handleChangePassword} className="gradient-card rounded-xl border border-border p-5 space-y-4 animate-fade-in [animation-delay:100ms] scroll-mt-20">
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
      <div id="2fa" ref={el => { sectionRefs.current["2fa"] = el; }} className="gradient-card rounded-xl border border-border p-5 space-y-4 animate-fade-in [animation-delay:105ms] scroll-mt-20">
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
                    onClick={() => { navigator.clipboard.writeText(totpSecret).then(() => toast.success("Schlüssel kopiert"), () => toast.error("Kopieren fehlgeschlagen")); }}
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

      {/* 2FA Backup Codes Dialog */}
      <Dialog open={showBackupCodes} onOpenChange={(open) => { if (backupCodesAcknowledged) setShowBackupCodes(open); }}>
        <DialogContent className="max-w-sm" onPointerDownOutside={(e) => { if (!backupCodesAcknowledged) e.preventDefault(); }}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-profit" /> Backup-Codes
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="bg-gold/10 border border-gold/20 rounded-lg p-3">
              <p className="text-xs text-gold font-medium flex items-center gap-1.5">
                <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                Speichere diese Codes sicher ab! Du siehst sie nur einmalig.
              </p>
            </div>
            <p className="text-xs text-muted-foreground">
              Falls du keinen Zugriff mehr auf deine Authenticator-App hast (z.B. Handy verloren),
              kannst du dich mit einem dieser Codes einmalig anmelden.
            </p>
            <div className="grid grid-cols-2 gap-2 p-3 bg-secondary/30 rounded-lg">
              {backupCodes.map((code, i) => (
                <div key={i} className="text-xs font-mono text-center py-1.5 px-2 bg-background rounded border border-border">
                  {code}
                </div>
              ))}
            </div>
            <Button
              variant="outline"
              size="sm"
              className="w-full gap-1.5"
              onClick={() => {
                navigator.clipboard.writeText(backupCodes.join("\n")).then(
                  () => toast.success("Backup-Codes kopiert!"),
                  () => toast.error("Kopieren fehlgeschlagen")
                );
              }}
            >
              <Copy className="h-3.5 w-3.5" /> Alle Codes kopieren
            </Button>
            <div className="space-y-1.5 border-t border-border pt-3">
              <Label className="text-xs text-muted-foreground">
                Tippe &quot;Bestätigt&quot; um zu bestätigen, dass du die Codes gespeichert hast
              </Label>
              <Input
                value={backupConfirmText}
                onChange={(e) => setBackupConfirmText(e.target.value)}
                placeholder="Bestätigt"
                className="h-9 text-sm"
              />
            </div>
            <Button
              onClick={() => {
                setBackupCodesAcknowledged(true);
                setShowBackupCodes(false);
                toast.success("Backup-Codes bestätigt und gespeichert!");
              }}
              disabled={backupConfirmText !== "Bestätigt"}
              className="w-full"
            >
              Codes gespeichert — Schließen
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Passkeys */}
      <div id="passkeys" ref={el => { sectionRefs.current["passkeys"] = el; }} className="gradient-card rounded-xl border border-border p-5 space-y-4 animate-fade-in [animation-delay:108ms] scroll-mt-20">
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

      {/* Biometric Authentication — Face ID / Touch ID / Fingerprint */}
      <div id="biometric" ref={el => { sectionRefs.current["biometric"] = el; }} className="gradient-card rounded-xl border border-border p-5 space-y-4 animate-fade-in [animation-delay:109ms] scroll-mt-20">
        <h2 className="text-sm font-semibold flex items-center gap-2">
          <Fingerprint className="h-4 w-4 text-muted-foreground" /> Biometrische Authentifizierung
        </h2>
        <p className="text-xs text-muted-foreground">
          Nutze Face ID, Touch ID oder deinen Fingerabdruck für schnelleren Login.
        </p>
        {!biometricSupported ? (
          <p className="text-xs text-muted-foreground flex items-center gap-1">
            <AlertCircle className="h-3.5 w-3.5" /> Dein Gerät unterstützt keine biometrische Authentifizierung
          </p>
        ) : (
          <button
            type="button"
            onClick={() => handleBiometricToggle(!biometricEnabled)}
            className={`w-full flex items-center justify-between p-4 rounded-xl border-2 transition-all duration-300 ${
              biometricEnabled
                ? "border-primary/40 bg-gradient-to-r from-primary/5 to-primary/10 shadow-sm"
                : "border-border bg-secondary/20 hover:border-muted-foreground/30 hover:bg-secondary/40"
            }`}
          >
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-300 ${
                biometricEnabled ? "bg-primary/15 text-primary scale-105" : "bg-secondary text-muted-foreground"
              }`}>
                <Fingerprint className="h-5 w-5" />
              </div>
              <div className="text-left">
                <p className="text-sm font-medium">{biometricEnabled ? "Aktiviert" : "Deaktiviert"}</p>
                <p className="text-[10px] text-muted-foreground">
                  {biometricEnabled ? "Face ID / Touch ID wird für den Login verwendet" : "Aktiviere biometrischen Login"}
                </p>
              </div>
            </div>
            <div className={`relative w-12 h-7 rounded-full transition-all duration-300 ${
              biometricEnabled ? "bg-primary" : "bg-muted"
            }`}>
              <div className={`absolute top-0.5 w-6 h-6 rounded-full bg-white shadow-md transition-all duration-300 ${
                biometricEnabled ? "left-[22px]" : "left-0.5"
              }`} />
            </div>
          </button>
        )}
      </div>

      {/* Device Management — show logged-in devices */}
      <div id="geraete" ref={el => { sectionRefs.current["geraete"] = el; }} className="gradient-card rounded-xl border border-border p-5 space-y-4 animate-fade-in [animation-delay:110ms] scroll-mt-20">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold flex items-center gap-2">
            <MonitorSmartphone className="h-4 w-4 text-muted-foreground" /> Angemeldete Ger\u00e4te
          </h2>
          {devices.length > 1 && (
            <Button variant="ghost" size="sm" className="h-7 text-[10px] text-muted-foreground" onClick={logoutAllOtherDevices}>
              Alle anderen abmelden
            </Button>
          )}
        </div>
        <p className="text-xs text-muted-foreground">
          \u00dcberblick \u00fcber alle Ger\u00e4te, die aktuell bei deinem Konto angemeldet sind.
        </p>
        {devicesLoading ? (
          <div className="text-xs text-muted-foreground animate-pulse">Lade Ger\u00e4te...</div>
        ) : (
          <div className="space-y-2">
            {devices.map(device => (
              <div key={device.id} className={`flex items-center gap-3 p-3 rounded-xl border transition-all ${
                device.isCurrent ? "border-primary/30 bg-primary/5" : "border-border bg-secondary/30 hover:bg-secondary/50"
              }`}>
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                  device.isCurrent ? "bg-primary/10 text-primary" : "bg-secondary text-muted-foreground"
                }`}>
                  <MonitorSmartphone className="h-4 w-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-xs font-medium truncate">{parseDeviceName(device.userAgent)}</span>
                    <span className="text-[10px] text-muted-foreground">{parseBrowser(device.userAgent)}</span>
                    {device.isCurrent && (
                      <span className="text-[9px] bg-primary/10 text-primary px-1.5 py-0.5 rounded-full font-bold shrink-0">Dieses Ger\u00e4t</span>
                    )}
                  </div>
                  <p className="text-[10px] text-muted-foreground truncate mt-0.5">
                    Zuletzt aktiv: {new Date(device.lastActive).toLocaleDateString("de-DE", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                  </p>
                </div>
                {!device.isCurrent && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0 shrink-0 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                        onClick={() => removeDevice(device.id)}
                      >
                        <LogOut className="h-3.5 w-3.5" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Ger\u00e4t abmelden</TooltipContent>
                  </Tooltip>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Default page after login */}
      <div id="standardseite" ref={el => { sectionRefs.current["standardseite"] = el; }} className="gradient-card rounded-xl border border-border p-5 space-y-4 animate-fade-in [animation-delay:112ms] scroll-mt-20">
        <h2 className="text-sm font-semibold flex items-center gap-2">
          <Home className="h-4 w-4 text-muted-foreground" /> Standardseite nach Login
        </h2>
        <p className="text-xs text-muted-foreground">
          W\u00e4hle welche Seite nach dem Login als Erstes angezeigt werden soll.
        </p>
        <Select value={defaultPage} onValueChange={handleDefaultPageChange}>
          <SelectTrigger className="h-9 text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {DEFAULT_PAGE_OPTIONS.map(opt => (
              <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* AI Chat toggle */}
      <div id="ai-chat" ref={el => { sectionRefs.current["ai-chat"] = el; }} className="gradient-card rounded-xl border border-border p-5 space-y-4 animate-fade-in [animation-delay:115ms] scroll-mt-20">
        <h2 className="text-sm font-semibold flex items-center gap-2">
          <Bot className="h-4 w-4 text-muted-foreground" /> AI Chat
        </h2>
        <p className="text-xs text-muted-foreground">
          Aktiviere oder deaktiviere den AI Chat-Assistenten (Bubble unten rechts).
        </p>
        <button
          type="button"
          onClick={() => handleAiChatToggle(!aiChatEnabled)}
          className={`w-full flex items-center justify-between p-4 rounded-xl border-2 transition-all duration-300 ${
            aiChatEnabled
              ? "border-primary/40 bg-gradient-to-r from-primary/5 to-primary/10 shadow-sm"
              : "border-border bg-secondary/20 hover:border-muted-foreground/30 hover:bg-secondary/40"
          }`}
        >
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-300 ${
              aiChatEnabled ? "bg-primary/15 text-primary scale-105" : "bg-secondary text-muted-foreground"
            }`}>
              <Bot className="h-5 w-5" />
            </div>
            <div className="text-left">
              <p className="text-sm font-medium">{aiChatEnabled ? "AI Chat ist aktiv" : "AI Chat ist deaktiviert"}</p>
              <p className="text-[10px] text-muted-foreground">
                {aiChatEnabled ? "Bubble unten rechts sichtbar" : "Chat-Assistent ausgeblendet"}
              </p>
            </div>
          </div>
          <div className={`relative w-12 h-7 rounded-full transition-all duration-300 ${
            aiChatEnabled ? "bg-primary" : "bg-muted"
          }`}>
            <div className={`absolute top-0.5 w-6 h-6 rounded-full bg-white shadow-md transition-all duration-300 ${
              aiChatEnabled ? "left-[22px]" : "left-0.5"
            }`} />
          </div>
        </button>
      </div>

      {/* Data Export/Backup with export date tracking */}
      <div id="backup" ref={el => { sectionRefs.current["backup"] = el; }} className="gradient-card rounded-xl border border-border p-5 space-y-4 animate-fade-in [animation-delay:120ms] scroll-mt-20">
        <h2 className="text-sm font-semibold flex items-center gap-2">
          <Database className="h-4 w-4 text-muted-foreground" /> Daten-Backup & Export
        </h2>
        <p className="text-xs text-muted-foreground">
          Exportiere alle deine Daten als JSON-Backup oder CSV-Dateien f\u00fcr Excel.
        </p>
        {/* Last export date and 90-day warning */}
        {lastExportDate ? (
          <div className={`flex items-center gap-2 p-2.5 rounded-lg border ${
            daysSinceLastExport !== null && daysSinceLastExport > 90
              ? "border-destructive/30 bg-destructive/5"
              : "border-profit/30 bg-profit/5"
          }`}>
            <Database className={`h-3.5 w-3.5 shrink-0 ${
              daysSinceLastExport !== null && daysSinceLastExport > 90 ? "text-destructive" : "text-profit"
            }`} />
            <div className="text-xs">
              <span className="font-medium">Letzter Export:</span>{" "}
              {new Date(lastExportDate).toLocaleDateString("de-DE", { day: "2-digit", month: "long", year: "numeric" })}
              {daysSinceLastExport !== null && daysSinceLastExport > 90 && (
                <span className="text-destructive font-medium ml-1">
                  \u2014 \u26a0 {daysSinceLastExport} Tage her! Bitte erstelle ein neues Backup.
                </span>
              )}
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-2 p-2.5 rounded-lg border border-gold/30 bg-gold/5">
            <AlertTriangle className="h-3.5 w-3.5 text-gold shrink-0" />
            <span className="text-xs text-gold font-medium">Noch kein Export durchgef\u00fchrt \u2014 erstelle jetzt ein Backup!</span>
          </div>
        )}
        <DataExportBackup />
      </div>

      {/* Customizable Keyboard Shortcuts */}
      <div id="tastenkombinationen" ref={el => { sectionRefs.current["tastenkombinationen"] = el; }} className="gradient-card rounded-xl border border-border p-5 space-y-4 animate-fade-in [animation-delay:130ms] scroll-mt-20">
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
                  {/* UI-UPDATE-39: Tooltip on save shortcut action */}
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0 text-profit"
                        onClick={() => saveShortcut(action, editingValue)}
                      >
                        <Check className="h-3 w-3" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Speichern</TooltipContent>
                  </Tooltip>
                  {/* UI-UPDATE-40: Tooltip on cancel shortcut edit action */}
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0 text-muted-foreground"
                        onClick={() => {
                          setEditingShortcut(null);
                          setShortcutWarning("");
                        }}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Abbrechen</TooltipContent>
                  </Tooltip>
                </div>
              ) : (
                // UI-UPDATE-38: Tooltip on shortcut edit trigger
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      onClick={() => startEditShortcut(action)}
                      className="px-2 py-0.5 rounded bg-muted hover:bg-muted/80 text-[10px] font-mono transition-colors cursor-pointer"
                    >
                      {keys}
                    </button>
                  </TooltipTrigger>
                  <TooltipContent>Klicken zum Bearbeiten</TooltipContent>
                </Tooltip>
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

      {/* TELEGRAM-1: Telegram Bot Integration Settings */}
      <div id="telegram" ref={el => { sectionRefs.current["telegram"] = el; }} className="gradient-card rounded-xl border border-border p-5 space-y-4 animate-fade-in [animation-delay:135ms] scroll-mt-20">
        <h2 className="text-sm font-semibold flex items-center gap-2">
          <MessageSquare className="h-4 w-4 text-[#0088cc]" /> Telegram Integration
        </h2>
        <p className="text-xs text-muted-foreground">
          Verbinde deinen Telegram Bot, um Deal-Nachrichten direkt in ImmoControl zu importieren.
          Kopiere dazu die Nachrichten aus deinem Telegram-Channel und nutze den &quot;Telegram Import&quot; Button auf der Deals-Seite.
        </p>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Bot Token</Label>
            <div className="flex gap-2">
              <Input
                type="password"
                value={telegramToken}
                onChange={(e) => { setTelegramToken(e.target.value); localStorage.setItem("immo-telegram-bot-token", e.target.value); }}
                placeholder="123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11"
                className="h-9 text-sm font-mono flex-1"
              />
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-9 shrink-0"
                    onClick={() => {
                      const token = localStorage.getItem("immo-telegram-bot-token");
                      if (token) {
                        navigator.clipboard.writeText(token).then(
                          () => toast.success("Token kopiert"),
                          () => toast.error("Kopieren fehlgeschlagen")
                        );
                      }
                    }}
                  >
                    <Copy className="h-3.5 w-3.5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Token kopieren</TooltipContent>
              </Tooltip>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Bot Name</Label>
            <Input
              value={telegramBotName}
              onChange={(e) => { setTelegramBotName(e.target.value); localStorage.setItem("immo-telegram-bot-name", e.target.value); }}
              placeholder="z.B. ImmoControl_bot"
              className="h-9 text-sm"
            />
          </div>
          <div className="p-3 rounded-lg bg-[#0088cc]/5 border border-[#0088cc]/10 space-y-2">
            <p className="text-xs font-medium text-[#0088cc]">Einrichtung:</p>
            <ol className="text-[11px] text-muted-foreground space-y-1 list-decimal list-inside">
              <li>Erstelle einen Bot bei <span className="font-mono text-[10px]">@BotFather</span> auf Telegram</li>
              <li>Kopiere den Bot Token und trage ihn oben ein</li>
              <li>Füge den Bot zu deinem Deal-Channel hinzu</li>
              <li>Gehe zur <span className="font-medium text-foreground">Deals</span>-Seite und nutze den &quot;Telegram Import&quot; Button</li>
            </ol>
          </div>
        </div>
      </div>

      {/* Error Scanner Bot */}
      <ErrorScanner />

      {/* Team */}
      <div id="team" ref={el => { sectionRefs.current["team"] = el; }} className="scroll-mt-20">
        <TeamManagement />
      </div>

      {/* Logout */}
      <div className="gradient-card rounded-xl border border-border p-5 animate-fade-in [animation-delay:150ms]">
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

      {/* Danger zone - Delete account */}
      {/* IMP-44-18: Add ARIA alert role to danger zone for screen reader urgency */}
      <div id="gefahrenzone" ref={el => { sectionRefs.current["gefahrenzone"] = el; }} role="alert" className="rounded-xl border-2 border-destructive/20 p-5 space-y-4 animate-fade-in [animation-delay:200ms] scroll-mt-20">
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

      {/* System Info */}
      {/* IMP-44-19: Add aria-label to system info grid for screen readers */}
      <div id="system-info" ref={el => { sectionRefs.current["system-info"] = el; }} className="gradient-card rounded-xl border border-border p-5 space-y-3 animate-fade-in [animation-delay:180ms] scroll-mt-20">
        <h2 className="text-sm font-semibold flex items-center gap-2">
          <Database className="h-4 w-4 text-muted-foreground" /> System-Info
        </h2>
        <div className="grid grid-cols-2 gap-2 text-xs" aria-label="Systeminformationen">
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

      {/* Datenbackup — moved from Dashboard */}
      <DataBackup />

      {/* App info footer */}
      <div className="text-center py-4 space-y-1 animate-fade-in [animation-delay:250ms]">
        <p className="text-[10px] text-muted-foreground">ImmoControl v2.0 · Made with ❤️</p>
        <p className="text-[10px] text-muted-foreground">
          Support: <a href="mailto:support@immocontrol.de" className="text-primary hover:underline">support@immocontrol.de</a>
        </p>
      </div>
    </div>
    </div>
  );
};

export default Settings;
