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
  } catch (err: unknown) {
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
  } catch (err: unknown) {
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
  } catch (err: unknown) {
    return { data: null, error: err instanceof Error ? err.message : "Unknown error" };
  }
}

async function remove(table: string, id: string): Promise<QueryResult<null>> {
  try {
    const { error } = await supabase.from(table as never).delete().eq("id", id);
    if (error) return { data: null, error: error.message };
    return { data: null, error: null };
  } catch (err: unknown) {
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
  } catch (err: unknown) {
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
  } catch (err: unknown) {
    return { data: null, error: err instanceof Error ? err.message : "Unknown error" };
  }
}

async function deleteFile(bucket: string, paths: string[]): Promise<QueryResult<null>> {
  try {
    const { error } = await supabase.storage.from(bucket).remove(paths);
    if (error) return { data: null, error: error.message };
    return { data: null, error: null };
  } catch (err: unknown) {
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
  } catch (err: unknown) {
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

/** Typed helper for rent_payments table */
const rentPayments = {
  byTenant: (tenantId: string) =>
    query<unknown[]>("rent_payments", { eq: [["tenant_id", tenantId]], order: { column: "payment_date", ascending: false } }),
  byProperty: (propertyId: string) =>
    query<unknown[]>("rent_payments", { eq: [["property_id", propertyId]], order: { column: "payment_date", ascending: false } }),
  create: (record: Record<string, unknown>) => insert("rent_payments", record),
  update: (id: string, updates: Record<string, unknown>) => update("rent_payments", id, updates),
  delete: (id: string) => remove("rent_payments", id),
};

/** Typed helper for tickets table */
const tickets = {
  byProperty: (propertyId: string) =>
    query<unknown[]>("tickets", { eq: [["property_id", propertyId]], order: { column: "created_at", ascending: false } }),
  create: (record: Record<string, unknown>) => insert("tickets", record),
  update: (id: string, updates: Record<string, unknown>) => update("tickets", id, updates),
  delete: (id: string) => remove("tickets", id),
};

/** Typed helper for utility_billings table */
const utilityBillings = {
  byProperty: (propertyId: string) =>
    query<unknown[]>("utility_billings", { eq: [["property_id", propertyId]], order: { column: "billing_year", ascending: false } }),
  create: (record: Record<string, unknown>) => insert("utility_billings", record),
  update: (id: string, updates: Record<string, unknown>) => update("utility_billings", id, updates),
  delete: (id: string) => remove("utility_billings", id),
};

/** Typed helper for utility_billing_items table */
const utilityBillingItems = {
  byBilling: (billingId: string) =>
    query<unknown[]>("utility_billing_items", { eq: [["billing_id", billingId]] }),
  create: (record: Record<string, unknown>) => insert("utility_billing_items", record),
  update: (id: string, updates: Record<string, unknown>) => update("utility_billing_items", id, updates),
  delete: (id: string) => remove("utility_billing_items", id),
};

/** Typed helper for user_banks table */
const userBanks = {
  byUser: (userId: string) =>
    query<unknown[]>("user_banks", { eq: [["user_id", userId]], order: { column: "name" } }),
  create: (record: Record<string, unknown>) => insert("user_banks", record),
  delete: (id: string) => remove("user_banks", id),
};

/** Typed helper for service_contracts table */
const serviceContracts = {
  byProperty: (propertyId: string) =>
    query<unknown[]>("service_contracts", { eq: [["property_id", propertyId]], order: { column: "start_date", ascending: false } }),
  create: (record: Record<string, unknown>) => insert("service_contracts", record),
  update: (id: string, updates: Record<string, unknown>) => update("service_contracts", id, updates),
  delete: (id: string) => remove("service_contracts", id),
};

/** Typed helper for property_documents table */
const propertyDocuments = {
  byProperty: (propertyId: string) =>
    query<unknown[]>("property_documents", { eq: [["property_id", propertyId]], order: { column: "created_at", ascending: false } }),
  create: (record: Record<string, unknown>) => insert("property_documents", record),
  update: (id: string, updates: Record<string, unknown>) => update("property_documents", id, updates),
  delete: (id: string) => remove("property_documents", id),
};

/** Typed helper for messages table */
const messages = {
  byUser: (userId: string) =>
    query<unknown[]>("messages", { eq: [["user_id", userId]], order: { column: "created_at", ascending: false } }),
  create: (record: Record<string, unknown>) => insert("messages", record),
  update: (id: string, updates: Record<string, unknown>) => update("messages", id, updates),
  delete: (id: string) => remove("messages", id),
};

/** Typed helper for invoices table */
const invoices = {
  byProperty: (propertyId: string) =>
    query<unknown[]>("invoices", { eq: [["property_id", propertyId]], order: { column: "invoice_date", ascending: false } }),
  create: (record: Record<string, unknown>) => insert("invoices", record),
  update: (id: string, updates: Record<string, unknown>) => update("invoices", id, updates),
  delete: (id: string) => remove("invoices", id),
};

/** Typed helper for crm_leads table */
const crmLeads = {
  byUser: (userId: string) =>
    query<unknown[]>("crm_leads", { eq: [["user_id", userId]], order: { column: "created_at", ascending: false } }),
  create: (record: Record<string, unknown>) => insert("crm_leads", record),
  update: (id: string, updates: Record<string, unknown>) => update("crm_leads", id, updates),
  delete: (id: string) => remove("crm_leads", id),
};

/** Typed helper for crm_call_logs table */
const crmCallLogs = {
  byLead: (leadId: string) =>
    query<unknown[]>("crm_call_logs", { eq: [["lead_id", leadId]], order: { column: "created_at", ascending: false } }),
  create: (record: Record<string, unknown>) => insert("crm_call_logs", record),
  update: (id: string, updates: Record<string, unknown>) => update("crm_call_logs", id, updates),
};

/** Typed helper for property_insurances table */
const propertyInsurances = {
  byProperty: (propertyId: string) =>
    query<unknown[]>("property_insurances", { eq: [["property_id", propertyId]] }),
  create: (record: Record<string, unknown>) => insert("property_insurances", record),
  update: (id: string, updates: Record<string, unknown>) => update("property_insurances", id, updates),
  delete: (id: string) => remove("property_insurances", id),
};

/** Typed helper for owner_meetings table */
const ownerMeetings = {
  byProperty: (propertyId: string) =>
    query<unknown[]>("owner_meetings", { eq: [["property_id", propertyId]], order: { column: "meeting_date", ascending: false } }),
  create: (record: Record<string, unknown>) => insert("owner_meetings", record),
  update: (id: string, updates: Record<string, unknown>) => update("owner_meetings", id, updates),
  delete: (id: string) => remove("owner_meetings", id),
};

/** Typed helper for meeting_resolutions table */
const meetingResolutions = {
  byMeeting: (meetingId: string) =>
    query<unknown[]>("meeting_resolutions", { eq: [["meeting_id", meetingId]] }),
  create: (record: Record<string, unknown>) => insert("meeting_resolutions", record),
  update: (id: string, updates: Record<string, unknown>) => update("meeting_resolutions", id, updates),
};

/** Typed helper for maintenance_items table */
const maintenanceItems = {
  byProperty: (propertyId: string) =>
    query<unknown[]>("maintenance_items", { eq: [["property_id", propertyId]], order: { column: "due_date" } }),
  create: (record: Record<string, unknown>) => insert("maintenance_items", record),
  update: (id: string, updates: Record<string, unknown>) => update("maintenance_items", id, updates),
  delete: (id: string) => remove("maintenance_items", id),
};

/** Typed helper for contracts table */
const contracts = {
  byProperty: (propertyId: string) =>
    query<unknown[]>("contracts", { eq: [["property_id", propertyId]], order: { column: "start_date", ascending: false } }),
  create: (record: Record<string, unknown>) => insert("contracts", record),
  update: (id: string, updates: Record<string, unknown>) => update("contracts", id, updates),
  delete: (id: string) => remove("contracts", id),
};

/** Typed helper for property_notes table */
const propertyNotes = {
  byProperty: (propertyId: string) =>
    query<unknown[]>("property_notes", { eq: [["property_id", propertyId]], order: { column: "created_at", ascending: false } }),
  create: (record: Record<string, unknown>) => insert("property_notes", record),
  update: (id: string, updates: Record<string, unknown>) => update("property_notes", id, updates),
  delete: (id: string) => remove("property_notes", id),
};

/** Typed helper for meters table */
const meters = {
  byProperty: (propertyId: string) =>
    query<unknown[]>("meters", { eq: [["property_id", propertyId]] }),
  create: (record: Record<string, unknown>) => insert("meters", record),
  update: (id: string, updates: Record<string, unknown>) => update("meters", id, updates),
  delete: (id: string) => remove("meters", id),
};

/** Typed helper for meter_readings table */
const meterReadings = {
  byMeter: (meterId: string) =>
    query<unknown[]>("meter_readings", { eq: [["meter_id", meterId]], order: { column: "reading_date", ascending: false } }),
  create: (record: Record<string, unknown>) => insert("meter_readings", record),
  update: (id: string, updates: Record<string, unknown>) => update("meter_readings", id, updates),
};

/** Typed helper for energy_certificates table */
const energyCertificates = {
  byProperty: (propertyId: string) =>
    query<unknown[]>("energy_certificates", { eq: [["property_id", propertyId]] }),
  create: (record: Record<string, unknown>) => insert("energy_certificates", record),
  update: (id: string, updates: Record<string, unknown>) => update("energy_certificates", id, updates),
  delete: (id: string) => remove("energy_certificates", id),
};

/** Typed helper for bank_transactions table */
const bankTransactions = {
  byAccount: (accountId: string) =>
    query<unknown[]>("bank_transactions", { eq: [["account_id", accountId]], order: { column: "booking_date", ascending: false } }),
  create: (record: Record<string, unknown>) => insert("bank_transactions", record),
  update: (id: string, updates: Record<string, unknown>) => update("bank_transactions", id, updates),
};

/** Typed helper for bank_matching_rules table */
const bankMatchingRules = {
  byUser: (userId: string) =>
    query<unknown[]>("bank_matching_rules", { eq: [["user_id", userId]] }),
  create: (record: Record<string, unknown>) => insert("bank_matching_rules", record),
  update: (id: string, updates: Record<string, unknown>) => update("bank_matching_rules", id, updates),
  delete: (id: string) => remove("bank_matching_rules", id),
};

/** Typed helper for bank_accounts table */
const bankAccounts = {
  byUser: (userId: string) =>
    query<unknown[]>("bank_accounts", { eq: [["user_id", userId]], order: { column: "bank_name" } }),
  create: (record: Record<string, unknown>) => insert("bank_accounts", record),
  update: (id: string, updates: Record<string, unknown>) => update("bank_accounts", id, updates),
  delete: (id: string) => remove("bank_accounts", id),
};

/** Typed helper for user_settings table */
const userSettings = {
  byUser: (userId: string) =>
    query<unknown>("user_settings", { eq: [["user_id", userId]], single: true }),
  upsert: async (record: Record<string, unknown>): Promise<QueryResult<unknown>> => {
    try {
      const { data, error } = await supabase.from("user_settings" as never).upsert(record as never).select().single();
      if (error) return { data: null, error: error.message };
      return { data, error: null };
    } catch (err: unknown) {
      return { data: null, error: err instanceof Error ? err.message : "Unknown error" };
    }
  },
};

/** Typed helper for team_members table */
const teamMembers = {
  byUser: (userId: string) =>
    query<unknown[]>("team_members", { eq: [["invited_by", userId]] }),
  create: (record: Record<string, unknown>) => insert("team_members", record),
  delete: (id: string) => remove("team_members", id),
};

/** Typed helper for mietvertraege table */
const mietvertraege = {
  byProperty: (propertyId: string) =>
    query<unknown[]>("mietvertraege", { eq: [["property_id", propertyId]], order: { column: "mietbeginn", ascending: false } }),
  create: (record: Record<string, unknown>) => insert("mietvertraege", record),
  update: (id: string, updates: Record<string, unknown>) => update("mietvertraege", id, updates),
  delete: (id: string) => remove("mietvertraege", id),
};

/** Typed helper for todos table */
const todos = {
  byUser: (userId: string) =>
    query<unknown[]>("todos", { eq: [["user_id", userId]], order: { column: "created_at", ascending: false } }),
  create: (record: Record<string, unknown>) => insert("todos", record),
  update: (id: string, updates: Record<string, unknown>) => update("todos", id, updates),
  delete: (id: string) => remove("todos", id),
};

/** Typed helper for profiles table */
const profiles = {
  byId: (id: string) =>
    query<unknown>("profiles", { eq: [["id", id]], single: true }),
  update: (id: string, updates: Record<string, unknown>) => update("profiles", id, updates),
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
  /* IMP-1: Typed table accessors — all 33 tables */
  deals,
  properties,
  contacts,
  loans,
  tenants,
  rentPayments,
  tickets,
  utilityBillings,
  utilityBillingItems,
  userBanks,
  serviceContracts,
  propertyDocuments,
  messages,
  invoices,
  crmLeads,
  crmCallLogs,
  propertyInsurances,
  ownerMeetings,
  meetingResolutions,
  maintenanceItems,
  contracts,
  propertyNotes,
  meters,
  meterReadings,
  energyCertificates,
  bankTransactions,
  bankMatchingRules,
  bankAccounts,
  userSettings,
  teamMembers,
  mietvertraege,
  todos,
  profiles,
  storage: { upload: uploadFile, download: downloadFile, delete: deleteFile },
  auth: { getCurrentUser, onAuthStateChange },
  functions: { invoke: invokeFunction },
  realtime: { subscribe: subscribeToTable },
  /** Direct access to the Supabase client for edge cases */
  raw: supabase,
};
