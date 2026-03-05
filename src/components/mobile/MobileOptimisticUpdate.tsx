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
  const rollbackRef = useRef<(() => void) | null>(null);

  const execute = useCallback(async <T,>(options: OptimisticOptions<T>) => {
    const { queryKey, updater, mutationFn, successMessage, errorMessage } = options;

    // Snapshot previous data
    const previousData = queryClient.getQueryData<T>(queryKey);

    // Optimistically update
    queryClient.setQueryData<T>(queryKey, updater);
    haptic.tap();

    // Store rollback function
    rollbackRef.current = () => {
      queryClient.setQueryData(queryKey, previousData);
    };

    try {
      await mutationFn();
      haptic.success();
      if (successMessage) toast.success(successMessage);
      rollbackRef.current = null;
    } catch (error) {
      // Rollback on error
      if (rollbackRef.current) {
        rollbackRef.current();
        rollbackRef.current = null;
      }
      haptic.error();
      toast.error(errorMessage ?? "Fehler — Änderung rückgängig gemacht");
      throw error;
    }
  }, [queryClient, haptic]);

  const rollback = useCallback(() => {
    if (rollbackRef.current) {
      rollbackRef.current();
      rollbackRef.current = null;
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
