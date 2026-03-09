/**
 * UX: Warnung beim Verlassen, wenn ungespeicherte Änderungen.
 * - beforeunload: Browser-Dialog beim Schließen/Neuladen der Seite.
 * - Optional: Kann von Formularen/Dialogen mit isDirty genutzt werden.
 */
import { useEffect } from "react";

export function useUnsavedChanges(isDirty: boolean) {
  useEffect(() => {
    if (!isDirty) return;
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [isDirty]);
}
