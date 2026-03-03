/**
 * #7: Soft-Delete Consistent Everywhere — Generic soft-delete hook.
 * Marks items as deleted with a timestamp instead of hard-deleting.
 * Items are auto-purged after 30 days.
 * Works with any Supabase table that has is_deleted and deleted_at columns.
 */
import { useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useUndoToast } from "./useUndoToast";

type SupabaseTable = "properties" | "contacts" | "loans" | "todos" | "tickets" | "deals";

interface SoftDeleteOptions {
  table: SupabaseTable;
  /** Display name for toast messages (e.g. "Kontakt", "Darlehen") */
  itemLabel?: string;
  /** Callback after successful soft-delete */
  onDeleted?: () => void;
  /** Callback after successful restore */
  onRestored?: () => void;
}

const PURGE_DAYS = 30;

export function useSoftDelete({ table, itemLabel = "Eintrag", onDeleted, onRestored }: SoftDeleteOptions) {
  const { showUndo } = useUndoToast();

  /** Soft-delete an item — marks as deleted with 15-second undo window */
  const softDelete = useCallback(async (id: string) => {
    // Optimistically mark as deleted in the UI
    const { error } = await supabase
      .from(table)
      .update({ is_deleted: true, deleted_at: new Date().toISOString() } as never)
      .eq("id", id);

    if (error) {
      toast.error(`Fehler beim Löschen: ${error.message}`);
      return false;
    }

    onDeleted?.();

    // Show undo toast with 15-second window
    showUndo({
      message: `${itemLabel} gelöscht`,
      duration: 15_000,
      onCommit: async () => {
        // Already soft-deleted — nothing to do on commit
      },
      onUndo: async () => {
        // Restore the item
        const { error: restoreError } = await supabase
          .from(table)
          .update({ is_deleted: false, deleted_at: null } as never)
          .eq("id", id);

        if (restoreError) {
          toast.error(`Fehler beim Wiederherstellen: ${restoreError.message}`);
          return;
        }
        onRestored?.();
      },
    });

    return true;
  }, [table, itemLabel, onDeleted, onRestored, showUndo]);

  /** Hard-delete items that have been soft-deleted for more than 30 days */
  const purgeOldDeleted = useCallback(async () => {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - PURGE_DAYS);

    const { error } = await supabase
      .from(table)
      .delete()
      .eq("is_deleted", true)
      .lt("deleted_at", cutoffDate.toISOString());

    if (error) {
      console.error(`Purge error for ${table}:`, error.message);
    }
  }, [table]);

  /** Restore a soft-deleted item */
  const restore = useCallback(async (id: string) => {
    const { error } = await supabase
      .from(table)
      .update({ is_deleted: false, deleted_at: null } as never)
      .eq("id", id);

    if (error) {
      toast.error(`Fehler beim Wiederherstellen: ${error.message}`);
      return false;
    }

    toast.success(`${itemLabel} wiederhergestellt`);
    onRestored?.();
    return true;
  }, [table, itemLabel, onRestored]);

  return { softDelete, restore, purgeOldDeleted };
}
