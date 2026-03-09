/**
 * Shared hook for open/close (expand/collapse, modal) state.
 * Reduces duplicate useState(false) + toggle patterns across the app.
 */
import { useState, useCallback } from "react";

export function useDisclosure(initial = false) {
  const [isOpen, setIsOpen] = useState(initial);
  const open = useCallback(() => setIsOpen(true), []);
  const close = useCallback(() => setIsOpen(false), []);
  const toggle = useCallback(() => setIsOpen((prev) => !prev), []);
  return { isOpen, open, close, toggle };
}
