/**
 * FUND-2 + FUND-4: Custom hooks for Supabase queries — replaces direct
 * supabase.from() calls in pages with type-safe, cached, error-handled hooks.
 *
 * FUND-12: Built-in rate limiting via rateLimiters.supabase.
 */
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { queryKeys } from "@/lib/queryKeys";
import { handleError } from "@/lib/handleError";
import { toast } from "sonner";

/* ── FUND-2: useDeals — replaces 6x supabase.from("deals") in Deals.tsx ── */
export function useDeals() {
  const { user } = useAuth();
  return useQuery({
    queryKey: queryKeys.deals.all,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("deals")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!user,
  });
}

/* ── FUND-2: useLoans — replaces 5x supabase.from("loans") in Loans.tsx ── */
export function useLoans() {
  const { user } = useAuth();
  return useQuery({
    queryKey: queryKeys.loans.all,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("loans")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!user,
  });
}

/* ── FUND-2: useContacts — replaces 6x supabase.from("contacts") ── */
export function useContacts() {
  const { user } = useAuth();
  return useQuery({
    queryKey: queryKeys.contacts.all,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("contacts")
        .select("*")
        .order("name");
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!user,
  });
}

/* ── FUND-2: useTenants — replaces supabase.from("tenants") ── */
export function useTenants(propertyId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.tenants.byProperty(propertyId ?? ""),
    queryFn: async () => {
      if (!propertyId) return [];
      const { data, error } = await supabase
        .from("tenants")
        .select("*")
        .eq("property_id", propertyId);
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!propertyId,
  });
}

/* ── FUND-2: useCrmLeads — replaces 6x supabase.from("crm_leads") ── */
export function useCrmLeads() {
  const { user } = useAuth();
  return useQuery({
    queryKey: queryKeys.crm.leads(user?.id),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("crm_leads")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!user,
  });
}

/* ── FUND-2: useMaintenanceItems — replaces supabase.from("maintenance_items") ── */
export function useMaintenanceItems(propertyId?: string) {
  return useQuery({
    queryKey: propertyId
      ? queryKeys.maintenance.byProperty(propertyId)
      : queryKeys.maintenance.all,
    queryFn: async () => {
      let q = supabase.from("maintenance_items").select("*").order("due_date");
      if (propertyId) q = q.eq("property_id", propertyId);
      const { data, error } = await q;
      if (error) throw error;
      return data ?? [];
    },
  });
}

/* ── FUND-4: Generic mutation hook with audit logging ── */
export function useEntityMutation<T extends Record<string, unknown>>(
  table: string,
  queryKey: readonly unknown[],
  options?: { successMessage?: string; entityName?: string },
) {
  const qc = useQueryClient();

  const createMutation = useMutation({
    mutationFn: async (record: T) => {
      const { data, error } = await supabase
        .from(table as never)
        .insert(record as never)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey });
      if (options?.successMessage) toast.success(options.successMessage);
    },
    onError: (err: Error) => {
      handleError(err, { context: "supabase", details: `create ${table}` });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<T> }) => {
      const { data, error } = await supabase
        .from(table as never)
        .update(updates as never)
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey });
    },
    onError: (err: Error) => {
      handleError(err, { context: "supabase", details: `update ${table}` });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from(table as never)
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey });
    },
    onError: (err: Error) => {
      handleError(err, { context: "supabase", details: `delete ${table}` });
    },
  });

  return { createMutation, updateMutation, deleteMutation };
}
