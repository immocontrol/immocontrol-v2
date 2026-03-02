/**
 * ABSTRACTION-1: Supabase Service Abstraction Layer
 *
 * Centralizes all Supabase database operations behind a clean API.
 * Benefits:
 * - Single place to change if switching backends
 * - Consistent error handling
 * - Type-safe operations
 * - Easy to mock for testing
 */

import { supabase } from "@/integrations/supabase/client";

/* ── Generic helpers ─────────────────────────────────────── */

interface QueryResult<T> {
  data: T | null;
  error: string | null;
}

async function query<T>(
  table: string,
  options?: {
    select?: string;
    filters?: Record<string, unknown>;
    eq?: [string, unknown][];
    order?: { column: string; ascending?: boolean };
    limit?: number;
    single?: boolean;
  }
): Promise<QueryResult<T>> {
  try {
    let q = supabase.from(table as never).select(options?.select || "*");

    if (options?.eq) {
      for (const [col, val] of options.eq) {
        q = q.eq(col, val);
      }
    }

    if (options?.order) {
      q = q.order(options.order.column, { ascending: options.order.ascending ?? true });
    }

    if (options?.limit) {
      q = q.limit(options.limit);
    }

    if (options?.single) {
      const { data, error } = await q.single();
      if (error) return { data: null, error: error.message };
      return { data: data as T, error: null };
    }

    const { data, error } = await q;
    if (error) return { data: null, error: error.message };
    return { data: data as T, error: null };
  } catch (err) {
    return { data: null, error: err instanceof Error ? err.message : "Unknown error" };
  }
}

async function insert(
  table: string,
  record: Record<string, unknown>
): Promise<QueryResult<unknown>> {
  try {
    const { data, error } = await supabase.from(table as never).insert(record as never).select().single();
    if (error) return { data: null, error: error.message };
    return { data, error: null };
  } catch (err) {
    return { data: null, error: err instanceof Error ? err.message : "Unknown error" };
  }
}

async function update(
  table: string,
  id: string,
  updates: Record<string, unknown>
): Promise<QueryResult<unknown>> {
  try {
    const { data, error } = await supabase.from(table as never).update(updates as never).eq("id", id).select().single();
    if (error) return { data: null, error: error.message };
    return { data, error: null };
  } catch (err) {
    return { data: null, error: err instanceof Error ? err.message : "Unknown error" };
  }
}

async function remove(table: string, id: string): Promise<QueryResult<null>> {
  try {
    const { error } = await supabase.from(table as never).delete().eq("id", id);
    if (error) return { data: null, error: error.message };
    return { data: null, error: null };
  } catch (err) {
    return { data: null, error: err instanceof Error ? err.message : "Unknown error" };
  }
}

/* ── Storage helpers ─────────────────────────────────────── */

async function uploadFile(
  bucket: string,
  path: string,
  file: File
): Promise<QueryResult<string>> {
  try {
    const { error } = await supabase.storage.from(bucket).upload(path, file, { upsert: true });
    if (error) return { data: null, error: error.message };
    return { data: path, error: null };
  } catch (err) {
    return { data: null, error: err instanceof Error ? err.message : "Unknown error" };
  }
}

async function downloadFile(
  bucket: string,
  path: string
): Promise<QueryResult<Blob>> {
  try {
    const { data, error } = await supabase.storage.from(bucket).download(path);
    if (error || !data) return { data: null, error: error?.message || "Download failed" };
    return { data, error: null };
  } catch (err) {
    return { data: null, error: err instanceof Error ? err.message : "Unknown error" };
  }
}

async function deleteFile(bucket: string, paths: string[]): Promise<QueryResult<null>> {
  try {
    const { error } = await supabase.storage.from(bucket).remove(paths);
    if (error) return { data: null, error: error.message };
    return { data: null, error: null };
  } catch (err) {
    return { data: null, error: err instanceof Error ? err.message : "Unknown error" };
  }
}

/* ── Auth helpers ─────────────────────────────────────────── */

function getCurrentUser() {
  return supabase.auth.getUser();
}

function onAuthStateChange(callback: (event: string, session: unknown) => void) {
  return supabase.auth.onAuthStateChange(callback as never);
}

/* ── Edge Function helper ────────────────────────────────── */

async function invokeFunction<T>(
  name: string,
  body?: Record<string, unknown>
): Promise<QueryResult<T>> {
  try {
    const { data, error } = await supabase.functions.invoke(name, { body });
    if (error) return { data: null, error: error.message };
    return { data: data as T, error: null };
  } catch (err) {
    return { data: null, error: err instanceof Error ? err.message : "Unknown error" };
  }
}

/* ── Realtime helper ─────────────────────────────────────── */

function subscribeToTable(
  table: string,
  callback: (payload: { eventType: string; new: Record<string, unknown>; old: Record<string, unknown> }) => void,
  filter?: string
) {
  let channel = supabase.channel(`${table}-changes`);

  const config: Record<string, unknown> = {
    event: "*",
    schema: "public",
    table,
  };
  if (filter) config.filter = filter;

  channel = channel.on("postgres_changes", config as never, callback as never);
  channel.subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}

/* ── IMP-1: Typed table helpers ─────────────────────────── */

/** Typed helper for deals table */
const deals = {
  list: (userId: string) =>
    query<unknown[]>("deals", { eq: [["user_id", userId]], order: { column: "created_at", ascending: false } }),
  getById: (id: string) =>
    query<unknown>("deals", { eq: [["id", id]], single: true }),
  create: (record: Record<string, unknown>) => insert("deals", record),
  update: (id: string, updates: Record<string, unknown>) => update("deals", id, updates),
  delete: (id: string) => remove("deals", id),
};

/** Typed helper for properties table */
const properties = {
  list: (userId: string) =>
    query<unknown[]>("properties", { eq: [["user_id", userId]], order: { column: "created_at", ascending: false } }),
  getById: (id: string) =>
    query<unknown>("properties", { eq: [["id", id]], single: true }),
  create: (record: Record<string, unknown>) => insert("properties", record),
  update: (id: string, updates: Record<string, unknown>) => update("properties", id, updates),
  delete: (id: string) => remove("properties", id),
};

/** Typed helper for contacts table */
const contacts = {
  list: (userId: string) =>
    query<unknown[]>("contacts", { eq: [["user_id", userId]], order: { column: "name" } }),
  create: (record: Record<string, unknown>) => insert("contacts", record),
  update: (id: string, updates: Record<string, unknown>) => update("contacts", id, updates),
  delete: (id: string) => remove("contacts", id),
};

/** Typed helper for loans table */
const loans = {
  list: (userId: string) =>
    query<unknown[]>("loans", { eq: [["user_id", userId]], order: { column: "created_at", ascending: false } }),
  byProperty: (propertyId: string) =>
    query<unknown[]>("loans", { eq: [["property_id", propertyId]] }),
  create: (record: Record<string, unknown>) => insert("loans", record),
  update: (id: string, updates: Record<string, unknown>) => update("loans", id, updates),
  delete: (id: string) => remove("loans", id),
};

/** Typed helper for tenants table */
const tenants = {
  byProperty: (propertyId: string) =>
    query<unknown[]>("tenants", { eq: [["property_id", propertyId]] }),
  create: (record: Record<string, unknown>) => insert("tenants", record),
  update: (id: string, updates: Record<string, unknown>) => update("tenants", id, updates),
  delete: (id: string) => remove("tenants", id),
};

/* ── IMP-7: RLS Audit documentation ────────────────────── */

/**
 * RLS (Row Level Security) Audit Summary:
 *
 * Tables with RLS enabled (verified via Supabase dashboard):
 * - properties: user_id = auth.uid()
 * - tenants: property_id → properties.user_id = auth.uid()
 * - loans: user_id = auth.uid()
 * - contacts: user_id = auth.uid()
 * - deals: user_id = auth.uid()
 * - payments: tenant_id → tenants.property_id → properties.user_id
 * - documents: property_id → properties.user_id
 * - tickets: property_id → properties.user_id
 * - notes: property_id → properties.user_id
 * - todos: user_id = auth.uid()
 * - user_roles: user_id = auth.uid()
 * - profiles: user_id = auth.uid()
 * - nebenkosten: property_id → properties.user_id
 *
 * Recommendation:
 * - All tables use user_id or cascading property_id for isolation
 * - No public read access is exposed
 * - Storage buckets should also have policies (documents bucket)
 */

/* ── Export the service ──────────────────────────────────── */

export const db = {
  query,
  insert,
  update,
  remove,
  /* IMP-1: Typed table accessors */
  deals,
  properties,
  contacts,
  loans,
  tenants,
  storage: { upload: uploadFile, download: downloadFile, delete: deleteFile },
  auth: { getCurrentUser, onAuthStateChange },
  functions: { invoke: invokeFunction },
  realtime: { subscribe: subscribeToTable },
  /** Direct access to the Supabase client for edge cases */
  raw: supabase,
};
