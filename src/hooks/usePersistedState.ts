import { useState, useCallback } from "react";
import { type ZodType } from "zod";

/**
 * FIX-19 + FIX-20: Persisted state hook with optional Zod schema validation.
 *
 * Like useLocalStorage but with runtime validation of stored data to prevent
 * corrupted localStorage from crashing the app.
 *
 * @param key - localStorage key
 * @param initialValue - default value when nothing is stored or validation fails
 * @param schema - optional Zod schema for runtime validation of stored data
 */
export function usePersistedState<T>(
  key: string,
  initialValue: T,
  schema?: ZodType<T>,
): [T, (value: T | ((prev: T) => T)) => void] {
  const [storedValue, setStoredValue] = useState<T>(() => {
    try {
      const raw = window.localStorage.getItem(key);
      if (raw === null) return initialValue;
      const parsed = JSON.parse(raw) as unknown;
      // FIX-20: Validate with Zod schema if provided
      if (schema) {
        const result = schema.safeParse(parsed);
        return result.success ? result.data : initialValue;
      }
      return parsed as T;
    } catch {
      return initialValue;
    }
  });

  const setValue = useCallback((value: T | ((prev: T) => T)) => {
    setStoredValue(prev => {
      const newValue = value instanceof Function ? value(prev) : value;
      try {
        window.localStorage.setItem(key, JSON.stringify(newValue));
      } catch { /* quota exceeded — silently fail */ }
      return newValue;
    });
  }, [key]);

  return [storedValue, setValue];
}
