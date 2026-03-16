/**
 * Session-Idle-Timeout: Nach langer Inaktivität Abmeldung und Hinweis.
 * Ergänzt useInactivityHint („Noch da?“) um einen harten Timeout zur Sicherheit.
 */
import { useEffect, useRef, useCallback } from "react";
import { toast } from "sonner";

const IDLE_LOGOUT_MS = 90 * 60 * 1000; // 90 Minuten

const ACTIVITY_EVENTS = ["mousedown", "keydown", "scroll", "touchstart", "mousemove"] as const;

export function useSessionIdleTimeout(signOut: () => Promise<void>, enabled: boolean) {
  const timerRef = useRef<ReturnType<typeof setTimeout>>();
  const signOutRef = useRef(signOut);
  signOutRef.current = signOut;

  const schedule = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (!enabled) return;
    timerRef.current = setTimeout(() => {
      signOutRef.current().then(() => {
        toast.info("Deine Sitzung wurde wegen Inaktivität beendet. Bitte melde dich erneut an.", { duration: 8000 });
      });
    }, IDLE_LOGOUT_MS);
  }, [enabled]);

  useEffect(() => {
    if (!enabled) return;
    schedule();
    const reset = () => schedule();
    ACTIVITY_EVENTS.forEach((ev) => window.addEventListener(ev, reset));
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      ACTIVITY_EVENTS.forEach((ev) => window.removeEventListener(ev, reset));
    };
  }, [schedule, enabled]);
}
