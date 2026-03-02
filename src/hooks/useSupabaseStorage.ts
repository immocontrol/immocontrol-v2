import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

/**
 * MIGRATE-1: localStorage → Supabase migration hook
 *
 * Stores user preferences/settings in Supabase `user_settings` table
 * with localStorage fallback for offline/unauthenticated users.
 * Automatically migrates existing localStorage data to Supabase on first use.
 */

interface SettingsRow {
  id: string;
  user_id: string;
  key: string;
  value: string;
  updated_at: string;
}

export function useSupabaseStorage<T>(
  key: string,
  initialValue: T,
): [T, (value: T | ((prev: T) => T)) => void, boolean] {
  const { user } = useAuth();
  const [storedValue, setStoredValue] = useState<T>(() => {
    try {
      const item = localStorage.getItem(key);
      return item ? (JSON.parse(item) as T) : initialValue;
    } catch {
      return initialValue;
    }
  });
  const [syncing, setSyncing] = useState(false);
  const initialLoadDone = useRef(false);

  /* Load from Supabase on mount (if authenticated) */
  useEffect(() => {
    if (!user || initialLoadDone.current) return;
    initialLoadDone.current = true;

    const loadFromSupabase = async () => {
      try {
        const { data } = await supabase
          .from("user_settings")
          .select("value")
          .eq("user_id", user.id)
          .eq("key", key)
          .maybeSingle();

        if (data) {
          const parsed = JSON.parse((data as SettingsRow).value) as T;
          setStoredValue(parsed);
          /* Keep localStorage in sync */
          try { localStorage.setItem(key, JSON.stringify(parsed)); } catch { /* */ }
        } else {
          /* Migrate existing localStorage data to Supabase */
          const local = localStorage.getItem(key);
          if (local) {
            await supabase.from("user_settings").upsert({
              user_id: user.id,
              key,
              value: local,
              updated_at: new Date().toISOString(),
            }, { onConflict: "user_id,key" });
          }
        }
      } catch {
        /* Offline — use localStorage value */
      }
    };

    loadFromSupabase();
  }, [user, key]);

  /* Save to both localStorage and Supabase */
  const setValue = useCallback(
    (value: T | ((prev: T) => T)) => {
      setStoredValue((prev) => {
        const newValue = value instanceof Function ? value(prev) : value;
        const serialized = JSON.stringify(newValue);

        /* Always write to localStorage (offline fallback) */
        try { localStorage.setItem(key, serialized); } catch { /* */ }

        /* Write to Supabase if authenticated */
        if (user) {
          setSyncing(true);
          supabase
            .from("user_settings")
            .upsert(
              {
                user_id: user.id,
                key,
                value: serialized,
                updated_at: new Date().toISOString(),
              },
              { onConflict: "user_id,key" },
            )
            .then(() => setSyncing(false))
            .catch(() => setSyncing(false));
        }

        return newValue;
      });
    },
    [key, user],
  );

  return [storedValue, setValue, syncing];
}

/**
 * MIGRATE-2: One-time migration of all known localStorage keys to Supabase
 * Call once on app load (e.g. in AppLayout).
 */
export async function migrateLocalStorageToSupabase(userId: string): Promise<number> {
  const KEYS_TO_MIGRATE = [
    "immo-scenarios",
    "immoai_chat",
    "immocontrol_shortcuts",
    "immo-telegram-bot-token",
    "immo-telegram-bot-name",
    "immocontrol_passkeys",
    "immo_chart_order",
    "immo_error_scanner",
    "immo-expose-history",
    "immo_portfolio_history",
    "immo_portfolio_plan",
    "immo_hockey_profiles",
    "immo_ai_bubble_messages",
    "theme",
  ];

  let migrated = 0;

  for (const key of KEYS_TO_MIGRATE) {
    try {
      const value = localStorage.getItem(key);
      if (!value) continue;

      /* Check if already exists in Supabase */
      const { data: existing } = await supabase
        .from("user_settings")
        .select("id")
        .eq("user_id", userId)
        .eq("key", key)
        .maybeSingle();

      if (!existing) {
        await supabase.from("user_settings").insert({
          user_id: userId,
          key,
          value,
          updated_at: new Date().toISOString(),
        });
        migrated++;
      }
    } catch {
      /* Skip failed keys */
    }
  }

  return migrated;
}
