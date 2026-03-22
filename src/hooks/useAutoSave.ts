import { useEffect, useRef, useCallback } from "react";
import { getAppScrollTop } from "@/lib/appScrollContainer";

const AUTO_SAVE_KEY = "immocontrol_autosave";
const AUTO_SAVE_INTERVAL = 10_000; // 10 seconds

interface AutoSaveData {
  timestamp: number;
  path: string;
  data: Record<string, unknown>;
}

/**
 * Auto-save form data to localStorage every 10 seconds.
 * Restores data on mount if available and not older than 24 hours.
 *
 * @param key Unique key for this form (e.g. "add-property", "tenant-form")
 * @param data Current form data to save
 * @param onRestore Callback to restore saved data
 * @param enabled Whether auto-save is active (default true)
 */
export function useAutoSave(
  key: string,
  data: Record<string, unknown>,
  onRestore?: (saved: Record<string, unknown>) => void,
  enabled = true,
) {
  const dataRef = useRef(data);
  dataRef.current = data;
  const restoredRef = useRef(false);

  /* Restore on mount (once) */
  useEffect(() => {
    if (!enabled || restoredRef.current || !onRestore) return;
    restoredRef.current = true;
    try {
      const raw = localStorage.getItem(`${AUTO_SAVE_KEY}_${key}`);
      if (!raw) return;
      const saved: AutoSaveData = JSON.parse(raw);
      /* Only restore if less than 24 hours old */
      if (Date.now() - saved.timestamp > 24 * 60 * 60 * 1000) {
        localStorage.removeItem(`${AUTO_SAVE_KEY}_${key}`);
        return;
      }
      onRestore(saved.data);
    } catch { /* ignore corrupt data */ }
  }, [key, enabled, onRestore]);

  /* Save every 10 seconds */
  useEffect(() => {
    if (!enabled) return;
    const interval = setInterval(() => {
      try {
        const entry: AutoSaveData = {
          timestamp: Date.now(),
          path: window.location.pathname,
          data: dataRef.current,
        };
        localStorage.setItem(`${AUTO_SAVE_KEY}_${key}`, JSON.stringify(entry));
      } catch { /* localStorage full or unavailable */ }
    }, AUTO_SAVE_INTERVAL);

    return () => clearInterval(interval);
  }, [key, enabled]);

  /* Clear saved data (call after successful save) */
  const clearAutoSave = useCallback(() => {
    localStorage.removeItem(`${AUTO_SAVE_KEY}_${key}`);
  }, [key]);

  return { clearAutoSave };
}

/**
 * Global auto-save that periodically saves the current page state.
 * Used in AppLayout to protect against browser/app crashes.
 */
export function useGlobalAutoSave() {
  useEffect(() => {
    const save = () => {
      try {
        const state = {
          timestamp: Date.now(),
          path: window.location.pathname,
          scroll: getAppScrollTop(),
        };
        localStorage.setItem(`${AUTO_SAVE_KEY}_global`, JSON.stringify(state));
      } catch { /* ignore */ }
    };

    const interval = setInterval(save, AUTO_SAVE_INTERVAL);
    /* Also save on visibility change (tab switch, app minimize) */
    const onVisibilityChange = () => {
      if (document.visibilityState === "hidden") save();
    };
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, []);
}

export default useAutoSave;
