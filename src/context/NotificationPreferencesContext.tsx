import { createContext, useContext, useState, useCallback, useMemo, ReactNode } from "react";

const STORAGE_KEY = "immocontrol_notify_prefs";

export type NotifyTopic = "overdue" | "contract_expiry" | "tickets" | "loan_milestone";

export interface NotificationPreferences {
  inApp: Record<NotifyTopic, boolean>;
}

const DEFAULTS: NotificationPreferences = {
  inApp: {
    overdue: true,
    contract_expiry: true,
    tickets: true,
    loan_milestone: true,
  },
};

function load(): NotificationPreferences {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULTS;
    const parsed = JSON.parse(raw) as Partial<NotificationPreferences>;
    return {
      inApp: { ...DEFAULTS.inApp, ...parsed?.inApp },
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
  isInAppEnabled: (topic: NotifyTopic) => boolean;
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

  const isInAppEnabled = useCallback(
    (topic: NotifyTopic) => prefs.inApp[topic] ?? true,
    [prefs]
  );

  const value = useMemo(
    () => ({ prefs, setInApp, isInAppEnabled }),
    [prefs, setInApp, isInAppEnabled]
  );

  return <Context.Provider value={value}>{children}</Context.Provider>;
}

export function useNotificationPreferences() {
  const ctx = useContext(Context);
  if (!ctx) {
    return {
      prefs: load(),
      setInApp: () => {},
      isInAppEnabled: () => true,
    };
  }
  return ctx;
}
