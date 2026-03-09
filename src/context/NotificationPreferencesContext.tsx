import { createContext, useContext, useState, useCallback, useMemo, ReactNode } from "react";

const STORAGE_KEY = "immocontrol_notify_prefs";

export type NotifyTopic = "overdue" | "contract_expiry" | "tickets" | "loan_milestone";

export interface NotificationPreferences {
  inApp: Record<NotifyTopic, boolean>;
  /** Browser-Notification-API (OS-Popups) ein-/ausschaltbar */
  browser: boolean;
  /** Web-Push (auch bei geschlossener App) — Abo in Supabase, konfigurierbar in Einstellungen */
  webPush: boolean;
}

const DEFAULTS: NotificationPreferences = {
  inApp: {
    overdue: true,
    contract_expiry: true,
    tickets: true,
    loan_milestone: true,
  },
  browser: false,
  webPush: false,
};

function load(): NotificationPreferences {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULTS;
    const parsed = JSON.parse(raw) as Partial<NotificationPreferences>;
    return {
      inApp: { ...DEFAULTS.inApp, ...parsed?.inApp },
      browser: parsed?.browser ?? DEFAULTS.browser,
      webPush: parsed?.webPush ?? DEFAULTS.webPush,
    };
  } catch {
    return DEFAULTS;
  }
}

function save(prefs: NotificationPreferences) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
  } catch {
    /* ignore */
  }
}

interface ContextValue {
  prefs: NotificationPreferences;
  setInApp: (topic: NotifyTopic, enabled: boolean) => void;
  setBrowser: (enabled: boolean) => void;
  setWebPush: (enabled: boolean) => void;
  isInAppEnabled: (topic: NotifyTopic) => boolean;
  isBrowserEnabled: () => boolean;
  isWebPushEnabled: () => boolean;
}

const Context = createContext<ContextValue | null>(null);

export function NotificationPreferencesProvider({ children }: { children: ReactNode }) {
  const [prefs, setPrefs] = useState<NotificationPreferences>(load);

  const setInApp = useCallback((topic: NotifyTopic, enabled: boolean) => {
    setPrefs((prev) => {
      const next: NotificationPreferences = {
        ...prev,
        inApp: { ...prev.inApp, [topic]: enabled },
      };
      save(next);
      return next;
    });
  }, []);

  const setBrowser = useCallback((enabled: boolean) => {
    setPrefs((prev) => {
      const next: NotificationPreferences = { ...prev, browser: enabled };
      save(next);
      return next;
    });
  }, []);

  const setWebPush = useCallback((enabled: boolean) => {
    setPrefs((prev) => {
      const next: NotificationPreferences = { ...prev, webPush: enabled };
      save(next);
      return next;
    });
  }, []);

  const isInAppEnabled = useCallback(
    (topic: NotifyTopic) => prefs.inApp[topic] ?? true,
    [prefs]
  );

  const isBrowserEnabled = useCallback(() => prefs.browser, [prefs]);
  const isWebPushEnabled = useCallback(() => prefs.webPush, [prefs]);

  const value = useMemo(
    () => ({ prefs, setInApp, setBrowser, setWebPush, isInAppEnabled, isBrowserEnabled, isWebPushEnabled }),
    [prefs, setInApp, setBrowser, setWebPush, isInAppEnabled, isBrowserEnabled, isWebPushEnabled]
  );

  return <Context.Provider value={value}>{children}</Context.Provider>;
}

export function useNotificationPreferences() {
  const ctx = useContext(Context);
  if (!ctx) {
    return {
      prefs: load(),
      setInApp: () => {},
      setBrowser: () => {},
      setWebPush: () => {},
      isInAppEnabled: () => true,
      isBrowserEnabled: () => false,
      isWebPushEnabled: () => false,
    };
  }
  return ctx;
}
