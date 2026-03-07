/**
 * Fix 4: Typed Supabase table helpers — eliminates `as never` / `as any` casts
 * by providing properly-typed wrappers around common Supabase operations.
 */
import { supabase } from "@/integrations/supabase/client";

/* Supabase types in this repo may not include all tables; cast once here to avoid `as never` at call sites. */
 
const supabaseAny = supabase as unknown as {
  from: (table: string) => ReturnType<typeof supabase.from>;
};

export const fromTable = (table: string) => supabaseAny.from(table);

/**
 * Type-safe query helper that returns typed data without `as never` casts.
 * Usage: const data = await typedQuery("properties", "*", { eq: { user_id: userId } });
 */
export async function typedQuery<T = Record<string, unknown>>(
  table: string,
  select = "*",
  filters?: { eq?: Record<string, string | number | boolean>; order?: { column: string; ascending?: boolean }; limit?: number },
): Promise<T[]> {
  let query = supabaseAny.from(table).select(select);

  if (filters?.eq) {
    for (const [key, value] of Object.entries(filters.eq)) {
      query = query.eq(key, value);
    }
  }
  if (filters?.order) {
    query = query.order(filters.order.column, { ascending: filters.order.ascending ?? true });
  }
  if (filters?.limit) {
    query = query.limit(filters.limit);
  }

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as T[];
}

/**
 * Type-safe insert helper.
 * Usage: const row = await typedInsert("todos", { title: "Test", user_id: uid });
 */
export async function typedInsert<T = Record<string, unknown>>(
  table: string,
  data: Record<string, unknown>,
): Promise<T> {
  const { data: result, error } = await supabase
    .from(table)
    .insert(data)
    .select()
    .single();
  if (error) throw error;
  return result as T;
}

/**
 * Type-safe update helper.
 * Usage: const row = await typedUpdate("todos", id, { title: "Updated" });
 */
export async function typedUpdate<T = Record<string, unknown>>(
  table: string,
  id: string,
  data: Record<string, unknown>,
): Promise<T> {
  const { data: result, error } = await supabase
    .from(table)
    .update(data)
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return result as T;
}

/**
 * Type-safe delete helper.
 * Usage: await typedDelete("todos", id);
 */
export async function typedDelete(table: string, id: string): Promise<void> {
  const { error } = await supabaseAny.from(table).delete().eq("id", id);
  if (error) throw error;
}

/**
 * Type-safe upsert helper.
 * Usage: const row = await typedUpsert("settings", { user_id: uid, key: "theme", value: "dark" });
 */
export async function typedUpsert<T = Record<string, unknown>>(
  table: string,
  data: Record<string, unknown>,
  onConflict?: string,
): Promise<T> {
  const { data: result, error } = await supabase
    .from(table)
    .upsert(data, onConflict ? { onConflict } : undefined)
    .select()
    .single();
  if (error) throw error;
  return result as T;
}
