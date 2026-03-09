/**
 * UX: Toast mit "Rückgängig"-Button nach Löschaktionen.
 * Zeigt eine kurze Zeit einen Toast mit Aktion; bei Klick auf Rückgängig wird onUndo aufgerufen.
 */
import { useCallback } from "react";
import { toast } from "sonner";

const UNDO_DURATION_MS = 8_000;

export interface UndoToastOptions {
  message: string;
  onUndo: () => void;
  duration?: number;
}

export function useUndoToast() {
  const showUndoToast = useCallback(({ message, onUndo, duration = UNDO_DURATION_MS }: UndoToastOptions) => {
    const id = toast.success(message, {
      duration,
      action: {
        label: "Rückgängig",
        onClick: () => {
          onUndo();
          toast.dismiss(id);
        },
      },
    });
  }, []);

  /** Alias für Komponenten, die showUndo mit onCommit erwarten (z. B. Contacts). */
  const showUndo = useCallback(
    (opts: { message: string; onUndo: () => void; onCommit?: () => void; duration?: number }) => {
      showUndoToast({ message: opts.message, onUndo: opts.onUndo, duration: opts.duration });
    },
    [showUndoToast]
  );

  return { showUndoToast, showUndo };
}
