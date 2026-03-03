/**
 * Improvement 16: Audit-integrated mutation hook.
 * Wraps useMutation to automatically log audit entries on success.
 */
import { useMutation, useQueryClient, type QueryKey } from "@tanstack/react-query";
import { toast } from "sonner";
import { logAudit, type AuditAction, type AuditEntity } from "@/lib/auditLog";

interface AuditedMutationOptions<TData, TVariables> {
  mutationFn: (variables: TVariables) => Promise<TData>;
  /** Audit action type */
  action: AuditAction;
  /** Audit entity type */
  entity: AuditEntity;
  /** Extract entity name from variables for audit log */
  getEntityName?: (variables: TVariables) => string;
  /** Extract entity ID from variables for audit log */
  getEntityId?: (variables: TVariables) => string;
  /** Extra audit details */
  getDetails?: (variables: TVariables) => string;
  /** Query keys to invalidate on success */
  invalidateKeys?: QueryKey[];
  /** Success toast message */
  successMessage?: string;
  /** Error toast prefix */
  errorMessage?: string;
  /** User ID for audit log */
  userId?: string;
  /** Additional onSuccess callback */
  onSuccess?: (data: TData, variables: TVariables) => void;
  /** Additional onError callback */
  onError?: (error: Error) => void;
}

export function useAuditedMutation<TData, TVariables>({
  mutationFn,
  action,
  entity,
  getEntityName,
  getEntityId,
  getDetails,
  invalidateKeys = [],
  successMessage,
  errorMessage = "Fehler",
  userId,
  onSuccess,
  onError,
}: AuditedMutationOptions<TData, TVariables>) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn,
    onSuccess: (data, variables) => {
      // Log audit entry
      logAudit(action, entity, {
        entityName: getEntityName?.(variables),
        entityId: getEntityId?.(variables),
        details: getDetails?.(variables),
        userId,
      });

      // Invalidate queries
      invalidateKeys.forEach((key) => {
        queryClient.invalidateQueries({ queryKey: key });
      });

      // Show success toast
      if (successMessage) toast.success(successMessage);

      // Call additional onSuccess
      onSuccess?.(data, variables);
    },
    onError: (error: Error) => {
      toast.error(`${errorMessage}: ${error.message}`);
      onError?.(error);
    },
  });
}
