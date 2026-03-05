/**
 * MOB2-12: Optimistic Updates überall
 * Hook and utilities for immediate UI updates on save/delete.
 * Reverts on error with toast notification.
 */
import { useCallback, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useHaptic } from "@/hooks/useHaptic";
import { toast } from "sonner";

interface OptimisticOptions<T> {
  /** React Query key to update */
  queryKey: string[];
  /** Function to update the cached data optimistically */
  updater: (old: T | undefined) => T;
  /** The actual mutation to perform */
  mutationFn: () => Promise<unknown>;
  /** Success message */
  successMessage?: string;
  /** Error message */
  errorMessage?: string;
}

/**
 * Hook for optimistic updates with automatic rollback.
 * Usage:
 * ```
 * const { execute } = useOptimisticUpdate();
 * await execute({
 *   queryKey: ["properties"],
 *   updater: (old) => old.filter(p => p.id !== id),
 *   mutationFn: () => deleteProperty(id),
 *   successMessage: "Gelöscht",
 *   errorMessage: "Fehler beim Löschen",
 * });
 * ```
 */
export function useOptimisticUpdate() {
  const queryClient = useQueryClient();
  const haptic = useHaptic();
  // Map of rollback functions keyed by serialized queryKey for concurrent safety
  const rollbackMapRef = useRef<Map<string, () => void>>(new Map());

  const execute = useCallback(async <T,>(options: OptimisticOptions<T>) => {
    const { queryKey, updater, mutationFn, successMessage, errorMessage } = options;
    const key = JSON.stringify(queryKey);

    // Snapshot previous data
    const previousData = queryClient.getQueryData<T>(queryKey);

    // Optimistically update
    queryClient.setQueryData<T>(queryKey, updater);
    haptic.tap();

    // Store rollback function scoped to this queryKey
    const doRollback = () => queryClient.setQueryData(queryKey, previousData);
    rollbackMapRef.current.set(key, doRollback);

    try {
      await mutationFn();
      haptic.success();
      if (successMessage) toast.success(successMessage);
      rollbackMapRef.current.delete(key);
    } catch (error) {
      // Rollback on error — uses the closure-scoped rollback, not a shared ref
      doRollback();
      rollbackMapRef.current.delete(key);
      haptic.error();
      toast.error(errorMessage ?? "Fehler — Änderung rückgängig gemacht");
      throw error;
    }
  }, [queryClient, haptic]);

  const rollback = useCallback((queryKey?: string[]) => {
    if (queryKey) {
      const key = JSON.stringify(queryKey);
      const fn = rollbackMapRef.current.get(key);
      if (fn) { fn(); rollbackMapRef.current.delete(key); }
    } else {
      // Rollback all pending optimistic updates
      rollbackMapRef.current.forEach(fn => fn());
      rollbackMapRef.current.clear();
    }
  }, []);

  return { execute, rollback };
}

/**
 * Optimistic delete with undo toast.
 * Shows "Gelöscht — Rückgängig" toast for 5 seconds.
 */
export function useOptimisticDelete() {
  const queryClient = useQueryClient();
  const haptic = useHaptic();

  const deleteWithUndo = useCallback(async <T,>(options: {
    queryKey: string[];
    /** Filter function to remove the item */
    filter: (items: T[]) => T[];
    /** The actual delete mutation */
    mutationFn: () => Promise<unknown>;
    /** Label for the deleted item */
    itemLabel?: string;
  }) => {
    const { queryKey, filter, mutationFn, itemLabel = "Element" } = options;
    const previousData = queryClient.getQueryData<T[]>(queryKey);

    // Optimistically remove
    queryClient.setQueryData<T[]>(queryKey, (old) => old ? filter(old) : []);
    haptic.medium();

    let cancelled = false;

    toast(`${itemLabel} gelöscht`, {
      action: {
        label: "Rückgängig",
        onClick: () => {
          cancelled = true;
          queryClient.setQueryData(queryKey, previousData);
          haptic.tap();
          toast.info("Wiederhergestellt");
        },
      },
      duration: 5000,
    });

    // Wait for undo window, then perform actual delete
    await new Promise(resolve => setTimeout(resolve, 5500));

    if (!cancelled) {
      try {
        await mutationFn();
      } catch {
        // Rollback if server delete fails
        queryClient.setQueryData(queryKey, previousData);
        haptic.error();
        toast.error("Fehler beim Löschen — wiederhergestellt");
      }
    }
  }, [queryClient, haptic]);

  return { deleteWithUndo };
}
