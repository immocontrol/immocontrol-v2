/**
 * UX: Beim Öffnen eines Dialogs Fokus auf das erste fokussierbare Feld setzen.
 * Verbessert Tastaturbedienung und Screenreader-Nutzung.
 */
import { useEffect, useRef, RefObject } from "react";

const FOCUSABLE = "input:not([disabled]):not([type=hidden]), select:not([disabled]), textarea:not([disabled]), [role=combobox]";

export function useFocusFirstInput(open: boolean, containerRef: RefObject<HTMLElement | null>) {
  const didFocus = useRef(false);

  useEffect(() => {
    if (!open || !containerRef.current) {
      didFocus.current = false;
      return;
    }
    didFocus.current = true;
    const el = containerRef.current.querySelector<HTMLElement>(FOCUSABLE);
    if (el) {
      requestAnimationFrame(() => {
        el.focus({ preventScroll: true });
      });
    }
  }, [open, containerRef]);
}
