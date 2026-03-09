/**
 * UX: Hinweis bei langer Inaktivität ("Noch da?").
 * Zeigt einmal einen Toast nach INACTIVITY_MS ohne Nutzerinteraktion.
 */
import { useEffect, useRef } from "react";
import { toast } from "sonner";

const INACTIVITY_MS = 45 * 60 * 1000; // 45 Minuten

const ACTIVITY_EVENTS = ["mousedown", "keydown", "scroll", "touchstart", "mousemove"] as const;

export function useInactivityHint() {
  const shownRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    if (shownRef.current) return;

    const schedule = () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        if (shownRef.current) return;
        shownRef.current = true;
        toast.info("Noch da? Deine Sitzung bleibt aktiv.", { duration: 6000 });
      }, INACTIVITY_MS);
    };

    schedule();
    const reset = () => schedule();

    ACTIVITY_EVENTS.forEach((ev) => window.addEventListener(ev, reset));
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      ACTIVITY_EVENTS.forEach((ev) => window.removeEventListener(ev, reset));
    };
  }, []);
}
