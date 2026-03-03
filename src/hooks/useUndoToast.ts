/**
 * #8: Global Undo Toast Hook — 15 second undo window for destructive actions.
 * Shows a persistent toast with countdown timer and undo button.
 * If the user doesn't undo within 15 seconds, the action is committed.
 */

import { useCallback, useRef } from "react";
import { toast } from "sonner";

interface UndoOptions {
  /** Description shown in the toast (e.g. "Kontakt gelöscht") */
  message: string;
  /** The destructive action to execute after timeout (e.g. actual delete) */
  onCommit: () => void | Promise<void>;
  /** Undo action — restore the item (e.g. re-insert or un-soft-delete) */
  onUndo: () => void | Promise<void>;
  /** Duration in ms before commit (default: 15000) */
  duration?: number;
}

export function useUndoToast() {
  const pendingRef = useRef<Map<string, NodeJS.Timeout>>(new Map());

  const showUndo = useCallback(({ message, onCommit, onUndo, duration = 15_000 }: UndoOptions) => {
    const id = `undo-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

    // Schedule the commit
    const timer = setTimeout(async () => {
      pendingRef.current.delete(id);
      try {
        await onCommit();
      } catch (err: unknown) {
        toast.error(err instanceof Error ? err.message : "Fehler beim Ausführen");
      }
    }, duration);

    pendingRef.current.set(id, timer);

    toast(message, {
      id,
      duration,
      action: {
        label: "Rückgängig",
        onClick: async () => {
          // Cancel the scheduled commit
          const t = pendingRef.current.get(id);
          if (t) {
            clearTimeout(t);
            pendingRef.current.delete(id);
          }
          try {
            await onUndo();
            toast.success("Rückgängig gemacht!");
          } catch (err: unknown) {
            toast.error(err instanceof Error ? err.message : "Fehler beim Rückgängig machen");
          }
        },
      },
      onDismiss: () => {
        // If dismissed without undo, commit immediately
        const t = pendingRef.current.get(id);
        if (t) {
          clearTimeout(t);
          pendingRef.current.delete(id);
          onCommit().catch(() => {});
        }
      },
    });

    return id;
  }, []);

  const cancelAll = useCallback(() => {
    pendingRef.current.forEach((timer) => clearTimeout(timer));
    pendingRef.current.clear();
  }, []);

  return { showUndo, cancelAll };
}
