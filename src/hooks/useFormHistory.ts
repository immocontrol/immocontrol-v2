/**
 * UX-13: Undo/Redo for Forms
 * Tracks form state history and provides undo/redo with Ctrl+Z / Ctrl+Shift+Z.
 */
import { useState, useCallback, useEffect, useRef } from "react";

interface FormHistoryOptions {
  /** Max history entries (default: 30) */
  maxHistory?: number;
  /** Debounce ms before recording a new history entry (default: 500) */
  debounceMs?: number;
}

export function useFormHistory<T extends Record<string, unknown>>(
  initialValues: T,
  options: FormHistoryOptions = {},
) {
  const { maxHistory = 30, debounceMs = 500 } = options;
  const [values, setValuesRaw] = useState<T>(initialValues);
  const historyRef = useRef<T[]>([initialValues]);
  const indexRef = useRef(0);
  const debounceTimer = useRef<ReturnType<typeof setTimeout>>();

  const pushHistory = useCallback((newValues: T) => {
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => {
      const hist = historyRef.current;
      /* Truncate any redo entries */
      historyRef.current = hist.slice(0, indexRef.current + 1);
      historyRef.current.push({ ...newValues });
      if (historyRef.current.length > maxHistory) {
        historyRef.current.shift();
      }
      indexRef.current = historyRef.current.length - 1;
    }, debounceMs);
  }, [maxHistory, debounceMs]);

  const setValues = useCallback((newValues: T | ((prev: T) => T)) => {
    setValuesRaw((prev) => {
      const next = typeof newValues === "function" ? (newValues as (prev: T) => T)(prev) : newValues;
      pushHistory(next);
      return next;
    });
  }, [pushHistory]);

  const undo = useCallback(() => {
    if (indexRef.current > 0) {
      indexRef.current -= 1;
      setValuesRaw(historyRef.current[indexRef.current]);
    }
  }, []);

  const redo = useCallback(() => {
    if (indexRef.current < historyRef.current.length - 1) {
      indexRef.current += 1;
      setValuesRaw(historyRef.current[indexRef.current]);
    }
  }, []);

  const canUndo = indexRef.current > 0;
  const canRedo = indexRef.current < historyRef.current.length - 1;

  /* Keyboard shortcuts: Ctrl+Z / Ctrl+Shift+Z */
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey)) return;
      if (e.key === "z" && !e.shiftKey) {
        e.preventDefault();
        undo();
      } else if ((e.key === "z" && e.shiftKey) || e.key === "y") {
        e.preventDefault();
        redo();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [undo, redo]);

  const reset = useCallback((newInitial?: T) => {
    const init = newInitial ?? initialValues;
    setValuesRaw(init);
    historyRef.current = [init];
    indexRef.current = 0;
  }, [initialValues]);

  return { values, setValues, undo, redo, canUndo, canRedo, reset };
}
