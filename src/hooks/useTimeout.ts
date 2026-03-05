import { useEffect, useRef, useCallback } from "react";

/**
 * FIX-14: Hook for declarative setTimeout with automatic cleanup on unmount.
 * Prevents memory leaks from orphaned timers when components unmount.
 *
 * @param callback - Function to call after delay
 * @param delay - Delay in ms, or null to disable
 */
export function useTimeout(callback: () => void, delay: number | null): void {
  const savedCallback = useRef(callback);

  useEffect(() => { savedCallback.current = callback; }, [callback]);

  useEffect(() => {
    if (delay === null) return;
    const id = setTimeout(() => savedCallback.current(), delay);
    return () => clearTimeout(id);
  }, [delay]);
}

/**
 * FIX-14: Returns a `set` / `clear` pair for imperative timeouts that
 * auto-clear on unmount.  Useful inside event handlers where you need
 * a one-shot timer that is cleaned up if the component is destroyed.
 */
export function useTimeoutFn() {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clear = useCallback(() => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const set = useCallback((fn: () => void, delay: number) => {
    clear();
    timerRef.current = setTimeout(() => {
      timerRef.current = null;
      fn();
    }, delay);
  }, [clear]);

  useEffect(() => clear, [clear]);

  return { set, clear } as const;
}
