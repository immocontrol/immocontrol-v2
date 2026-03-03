/**
 * #9: Form Auto-Recovery — saves form drafts to sessionStorage
 * so data is not lost when dialogs are accidentally closed.
 */
import { useState, useEffect, useCallback, useRef } from "react";

const PREFIX = "immo_draft_";

export function useFormDraft<T extends Record<string, unknown>>(
  key: string,
  initialValues: T
): {
  values: T;
  setValues: React.Dispatch<React.SetStateAction<T>>;
  updateField: <K extends keyof T>(field: K, value: T[K]) => void;
  clearDraft: () => void;
  hasDraft: boolean;
} {
  const storageKey = `${PREFIX}${key}`;
  const initialRef = useRef(initialValues);
  const clearedRef = useRef(false);

  const [values, setValues] = useState<T>(() => {
    try {
      const stored = sessionStorage.getItem(storageKey);
      if (stored) {
        const parsed = JSON.parse(stored) as T;
        // Only restore if it has meaningful data (not all empty/default)
        const hasData = Object.entries(parsed).some(([k, v]) => {
          const init = initialRef.current[k as keyof T];
          return v !== init && v !== "" && v !== 0 && v !== null;
        });
        if (hasData) return { ...initialValues, ...parsed };
      }
    } catch { /* ignore */ }
    return initialValues;
  });

  const [hasDraft] = useState(() => {
    try {
      return sessionStorage.getItem(storageKey) !== null;
    } catch { return false; }
  });

  // Persist to sessionStorage on change — skip if draft was just cleared
  useEffect(() => {
    if (clearedRef.current) {
      clearedRef.current = false;
      return;
    }
    try {
      sessionStorage.setItem(storageKey, JSON.stringify(values));
    } catch { /* storage full — ignore */ }
  }, [storageKey, values]);

  const updateField = useCallback(<K extends keyof T>(field: K, value: T[K]) => {
    setValues(prev => ({ ...prev, [field]: value }));
  }, []);

  const clearDraft = useCallback(() => {
    try { sessionStorage.removeItem(storageKey); } catch { /* ignore */ }
    clearedRef.current = true;
    setValues(initialRef.current);
  }, [storageKey]);

  return { values, setValues, updateField, clearDraft, hasDraft };
}
