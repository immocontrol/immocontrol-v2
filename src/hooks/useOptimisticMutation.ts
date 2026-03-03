/**
 * #6: Optimistic Updates — Generic hook for optimistic mutations with React Query.
 * Provides instant UI feedback while the server processes the request.
 * Automatically rolls back on error.
 */
import { useCallback } from "react";
import { useQueryClient, useMutation, type QueryKey } from "@tanstack/react-query";
import { toast } from "sonner";

interface OptimisticMutationOptions<TData, TVariables> {
  /** Query key to invalidate/update optimistically */
  queryKey: QueryKey;
  /** The actual mutation function (e.g. supabase insert/update/delete) */
  mutationFn: (variables: TVariables) => Promise<TData>;
  /** How to update the cache optimistically before server response */
  optimisticUpdate: (old: TData[] | undefined, variables: TVariables) => TData[];
  /** Success message */
  successMessage?: string;
  /** Error message prefix */
  errorMessage?: string;
  /** Additional query keys to invalidate on success */
  invalidateKeys?: QueryKey[];
}

export function useOptimisticMutation<TData, TVariables>({
  queryKey,
  mutationFn,
  optimisticUpdate,
  successMessage,
  errorMessage = "Fehler",
  invalidateKeys = [],
}: OptimisticMutationOptions<TData, TVariables>) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn,
    onMutate: async (variables: TVariables) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey });

      // Snapshot previous value
      const previousData = queryClient.getQueryData<TData[]>(queryKey);

      // Optimistically update cache
      queryClient.setQueryData<TData[]>(queryKey, (old) => optimisticUpdate(old, variables));

      return { previousData };
    },
    onError: (_err, _variables, context) => {
      // Rollback on error
      if (context?.previousData !== undefined) {
        queryClient.setQueryData(queryKey, context.previousData);
      }
      const message = _err instanceof Error ? _err.message : String(_err);
      toast.error(`${errorMessage}: ${message}`);
    },
    onSuccess: () => {
      if (successMessage) toast.success(successMessage);
    },
    onSettled: () => {
      // Always refetch to ensure consistency
      queryClient.invalidateQueries({ queryKey });
      invalidateKeys.forEach((key) => {
        queryClient.invalidateQueries({ queryKey: key });
      });
    },
  });
}

/**
 * Helper: Create an optimistic add mutation
 */
export function useOptimisticAdd<TData extends { id: string }, TVariables extends Partial<TData>>(
  queryKey: QueryKey,
  mutationFn: (variables: TVariables) => Promise<TData>,
  successMessage?: string,
) {
  return useOptimisticMutation<TData, TVariables>({
    queryKey,
    mutationFn,
    optimisticUpdate: (old, variables) => [
      ...(old || []),
      { ...variables, id: `temp-${Date.now()}` } as TData,
    ],
    successMessage,
  });
}

/**
 * Helper: Create an optimistic delete mutation
 */
export function useOptimisticDelete<TData extends { id: string }>(
  queryKey: QueryKey,
  mutationFn: (id: string) => Promise<unknown>,
  successMessage?: string,
) {
  return useOptimisticMutation<TData, string>({
    queryKey,
    mutationFn,
    optimisticUpdate: (old, id) => (old || []).filter((item) => item.id !== id),
    successMessage,
  });
}

/**
 * Helper: Create an optimistic update mutation
 */
export function useOptimisticUpdate<TData extends { id: string }>(
  queryKey: QueryKey,
  mutationFn: (variables: Partial<TData> & { id: string }) => Promise<TData>,
  successMessage?: string,
) {
  return useOptimisticMutation<TData, Partial<TData> & { id: string }>({
    queryKey,
    mutationFn,
    optimisticUpdate: (old, variables) =>
      (old || []).map((item) =>
        item.id === variables.id ? { ...item, ...variables } : item
      ),
    successMessage,
  });
}
