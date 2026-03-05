/**
 * FUND-9: Supabase query batching for Dashboard — executes multiple
 * independent queries in parallel using Promise.allSettled to avoid
 * sequential waterfall loading.
 */
import { supabase } from "@/integrations/supabase/client";
import { handleError } from "@/lib/handleError";

export interface BatchQueryResult<T> {
  data: T | null;
  error: Error | null;
}

/**
 * FUND-9: Execute multiple Supabase queries in parallel.
 * Returns results for each query, with null for failed ones.
 */
export async function batchQueries<T extends Record<string, unknown>>(
  queries: Array<{
    key: string;
    table: string;
    select?: string;
    filters?: Array<{ column: string; op: "eq" | "gt" | "lt" | "gte" | "lte" | "neq"; value: unknown }>;
    order?: { column: string; ascending?: boolean };
    limit?: number;
  }>,
): Promise<Record<string, T[] | null>> {
  const promises = queries.map(async (q) => {
    let query = supabase.from(q.table as never).select(q.select ?? "*");

    if (q.filters) {
      for (const f of q.filters) {
        query = query.filter(f.column, f.op, f.value) as typeof query;
      }
    }
    if (q.order) {
      query = query.order(q.order.column, { ascending: q.order.ascending ?? true });
    }
    if (q.limit) {
      query = query.limit(q.limit);
    }

    const { data, error } = await query;
    if (error) throw error;
    return { key: q.key, data: data as T[] };
  });

  const results = await Promise.allSettled(promises);
  const output: Record<string, T[] | null> = {};

  for (let i = 0; i < results.length; i++) {
    const result = results[i];
    const key = queries[i].key;
    if (result.status === "fulfilled") {
      output[key] = result.value.data;
    } else {
      handleError(result.reason, { context: "supabase", silent: true, details: `batch query: ${key}` });
      output[key] = null;
    }
  }

  return output;
}

/**
 * FUND-9: Dashboard-specific batch loader — fetches all dashboard data
 * in a single parallel batch instead of sequential queries.
 */
export async function loadDashboardData(userId: string) {
  const results = await batchQueries([
    { key: "properties", table: "properties", select: "*", order: { column: "created_at", ascending: false } },
    { key: "loans", table: "loans", select: "*", order: { column: "created_at", ascending: false } },
    { key: "tenants", table: "tenants", select: "*" },
    { key: "todos", table: "todos", select: "*", filters: [{ column: "user_id", op: "eq", value: userId }], order: { column: "created_at", ascending: false }, limit: 50 },
    { key: "contacts", table: "contacts", select: "*", order: { column: "name", ascending: true } },
    { key: "deals", table: "deals", select: "*", order: { column: "created_at", ascending: false }, limit: 20 },
  ]);

  return results;
}
