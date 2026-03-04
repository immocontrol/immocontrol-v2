/** UX-3: Global Undo Function for Destructive Actions
 * Provides a reusable undo mechanism that delays destructive operations
 * and shows a toast with an undo button for 8 seconds. */
import { toast } from "sonner";

interface UndoOptions {
  /** Description shown in the toast */
  label: string;
  /** The destructive action to execute after timeout */
  action: () => Promise<void> | void;
  /** Duration in ms before executing (default: 8000) */
  duration?: number;
}

/** Show an undo toast. Returns a promise that resolves when the action completes or is undone. */
export function undoableAction(options: UndoOptions): Promise<boolean> {
  const { label, action, duration = 8000 } = options;

  return new Promise((resolve) => {
    let undone = false;
    let executed = false;

    const toastId = toast(label, {
      duration,
      action: {
        label: "Rückgängig",
        onClick: () => {
          undone = true;
          toast.dismiss(toastId);
          toast.info("Aktion rückgängig gemacht");
          resolve(false);
        },
      },
      onDismiss: async () => {
        if (!undone && !executed) {
          executed = true;
          try {
            await action();
            resolve(true);
          } catch {
            toast.error("Fehler beim Ausführen der Aktion");
            resolve(false);
          }
        }
      },
      onAutoClose: async () => {
        if (!undone && !executed) {
          executed = true;
          try {
            await action();
            resolve(true);
          } catch {
            toast.error("Fehler beim Ausführen der Aktion");
            resolve(false);
          }
        }
      },
    });
  });
}
