/**
 * #19: Zod validation schemas for Supabase database responses.
 * Validates data coming FROM the database to catch schema mismatches early.
 */
import { z } from "zod";
import { logger } from "@/lib/logger";

/* ── Property row from Supabase ─────────────────────────── */
export const propertyRowSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  location: z.string().default(""),
  address: z.string().default(""),
  type: z.string().default("ETW"),
  units: z.coerce.number().default(1),
  purchase_price: z.coerce.number().default(0),
  purchase_date: z.string().default(""),
  current_value: z.coerce.number().default(0),
  monthly_rent: z.coerce.number().default(0),
  warm_rent: z.coerce.number().nullable().optional(),
  monthly_expenses: z.coerce.number().default(0),
  monthly_credit_rate: z.coerce.number().default(0),
  monthly_cashflow: z.coerce.number().default(0),
  remaining_debt: z.coerce.number().default(0),
  interest_rate: z.coerce.number().default(0),
  sqm: z.coerce.number().default(0),
  commercial_sqm: z.coerce.number().default(0).optional(),
  year_built: z.coerce.number().default(0),
  ownership: z.string().default("privat"),
  restnutzungsdauer: z.coerce.number().int().min(1).max(100).nullable().optional(),
  building_share_percent: z.coerce.number().min(0).max(100).nullable().optional(),
  parking_underground: z.coerce.number().int().min(0).default(0).optional(),
  parking_stellplatz: z.coerce.number().int().min(0).default(0).optional(),
  parking_garage: z.coerce.number().int().min(0).default(0).optional(),
  garden_sqm: z.coerce.number().min(0).nullable().optional(),
  other_rentable_notes: z.string().nullable().optional(),
  mietspiegel_reference_per_sqm: z.coerce.number().nullable().optional(),
});
export type PropertyRow = z.infer<typeof propertyRowSchema>;

/* ── Tenant row from Supabase ───────────────────────────── */
export const tenantRowSchema = z.object({
  id: z.string().uuid(),
  property_id: z.string().uuid(),
  name: z.string(),
  email: z.string().nullable().default(null),
  phone: z.string().nullable().default(null),
  unit_number: z.string().nullable().default(null),
  monthly_rent: z.coerce.number().default(0),
  monthly_utilities: z.coerce.number().default(0),
  deposit: z.coerce.number().default(0),
  lease_start: z.string().nullable().default(null),
  lease_end: z.string().nullable().default(null),
  is_active: z.boolean().default(true),
  created_at: z.string(),
});
export type TenantRow = z.infer<typeof tenantRowSchema>;

/* ── Loan row from Supabase ─────────────────────────────── */
export const loanRowSchema = z.object({
  id: z.string().uuid(),
  user_id: z.string().uuid(),
  property_id: z.string().uuid(),
  bank_name: z.string(),
  loan_amount: z.coerce.number().default(0),
  remaining_balance: z.coerce.number().default(0),
  interest_rate: z.coerce.number().default(0),
  repayment_rate: z.coerce.number().default(0),
  monthly_payment: z.coerce.number().default(0),
  tilgungsfreie_monate: z.coerce.number().nullable().default(null),
  fixed_interest_until: z.string().nullable().default(null),
  start_date: z.string().nullable().default(null),
  end_date: z.string().nullable().default(null),
  loan_type: z.string().default("annuity"),
  notes: z.string().nullable().default(null),
  created_at: z.string(),
});
export type LoanRow = z.infer<typeof loanRowSchema>;

/* ── Contact row from Supabase ──────────────────────────── */
export const contactRowSchema = z.object({
  id: z.string().uuid(),
  user_id: z.string().uuid(),
  name: z.string(),
  email: z.string().nullable().default(null),
  phone: z.string().nullable().default(null),
  company: z.string().nullable().default(null),
  role: z.string().nullable().default(null),
  notes: z.string().nullable().default(null),
  address: z.string().nullable().default(null),
  created_at: z.string(),
});
export type ContactRow = z.infer<typeof contactRowSchema>;

/* ── Todo row from Supabase ─────────────────────────────── */
export const todoRowSchema = z.object({
  id: z.string().uuid(),
  user_id: z.string().uuid(),
  title: z.string(),
  description: z.string().default(""),
  due_date: z.string().nullable().default(null),
  due_time: z.string().nullable().default(null),
  priority: z.coerce.number().default(4),
  completed: z.boolean().default(false),
  completed_at: z.string().nullable().default(null),
  project: z.string().default(""),
  labels: z.array(z.string()).default([]),
  sort_order: z.coerce.number().default(0),
  created_at: z.string(),
  updated_at: z.string(),
});
export type TodoRow = z.infer<typeof todoRowSchema>;

/* ── FUND-11: Deal row from Supabase ──────────────────────── */
export const dealRowSchema = z.object({
  id: z.string().uuid(),
  user_id: z.string().uuid(),
  title: z.string(),
  stage: z.string().default("lead"),
  source: z.string().nullable().default(null),
  purchase_price: z.coerce.number().default(0),
  expected_rent: z.coerce.number().default(0),
  expected_yield: z.coerce.number().default(0),
  address: z.string().nullable().default(null),
  city: z.string().nullable().default(null),
  sqm: z.coerce.number().default(0),
  rooms: z.coerce.number().default(0),
  year_built: z.coerce.number().nullable().default(null),
  notes: z.string().nullable().default(null),
  expose_url: z.string().nullable().default(null),
  contact_name: z.string().nullable().default(null),
  contact_phone: z.string().nullable().default(null),
  contact_email: z.string().nullable().default(null),
  created_at: z.string(),
});
export type DealRow = z.infer<typeof dealRowSchema>;

/* ── FUND-11: Maintenance item row ────────────────────────── */
export const maintenanceItemRowSchema = z.object({
  id: z.string().uuid(),
  property_id: z.string().uuid(),
  title: z.string(),
  description: z.string().nullable().default(null),
  category: z.string().default("general"),
  priority: z.string().default("medium"),
  status: z.string().default("pending"),
  due_date: z.string().nullable().default(null),
  estimated_cost: z.coerce.number().default(0),
  actual_cost: z.coerce.number().nullable().default(null),
  assigned_to: z.string().nullable().default(null),
  is_recurring: z.boolean().default(false),
  recurrence_interval: z.string().nullable().default(null),
  next_due_date: z.string().nullable().default(null),
  created_at: z.string(),
});
export type MaintenanceItemRow = z.infer<typeof maintenanceItemRowSchema>;

/* ── FUND-11: CRM lead row ────────────────────────────────── */
export const crmLeadRowSchema = z.object({
  id: z.string().uuid(),
  user_id: z.string().uuid(),
  name: z.string(),
  email: z.string().nullable().default(null),
  phone: z.string().nullable().default(null),
  company: z.string().nullable().default(null),
  source: z.string().nullable().default(null),
  status: z.string().default("new"),
  notes: z.string().nullable().default(null),
  last_contact: z.string().nullable().default(null),
  next_follow_up: z.string().nullable().default(null),
  created_at: z.string(),
});
export type CrmLeadRow = z.infer<typeof crmLeadRowSchema>;

/* ── FUND-11: Document row ────────────────────────────────── */
export const documentRowSchema = z.object({
  id: z.string().uuid(),
  property_id: z.string().uuid(),
  name: z.string(),
  file_path: z.string(),
  file_type: z.string().nullable().default(null),
  file_size: z.coerce.number().default(0),
  category: z.string().default("sonstiges"),
  expiry_date: z.string().nullable().default(null),
  notes: z.string().nullable().default(null),
  created_at: z.string(),
});
export type DocumentRow = z.infer<typeof documentRowSchema>;

/* ── FUND-11: Contract row ────────────────────────────────── */
export const contractRowSchema = z.object({
  id: z.string().uuid(),
  property_id: z.string().uuid(),
  title: z.string(),
  type: z.string().default("sonstiges"),
  partner: z.string().nullable().default(null),
  start_date: z.string().nullable().default(null),
  end_date: z.string().nullable().default(null),
  notice_period_months: z.coerce.number().default(3),
  monthly_cost: z.coerce.number().default(0),
  notes: z.string().nullable().default(null),
  auto_renew: z.boolean().default(false),
  created_at: z.string(),
});
export type ContractRow = z.infer<typeof contractRowSchema>;

/* ── FUND-11: Invoice row ─────────────────────────────────── */
export const invoiceRowSchema = z.object({
  id: z.string().uuid(),
  property_id: z.string().uuid(),
  invoice_number: z.string().nullable().default(null),
  vendor: z.string(),
  amount: z.coerce.number().default(0),
  invoice_date: z.string(),
  due_date: z.string().nullable().default(null),
  status: z.string().default("open"),
  category: z.string().default("sonstiges"),
  notes: z.string().nullable().default(null),
  created_at: z.string(),
});
export type InvoiceRow = z.infer<typeof invoiceRowSchema>;

/* ── Safe parse helper with logging ─────────────────────── */
export function safeParseRows<T>(
  schema: z.ZodSchema<T>,
  rows: unknown[],
  tableName: string
): T[] {
  return rows.map((row, idx) => {
    const result = schema.safeParse(row);
    if (result.success) return result.data;
    // Log validation error but don't crash — return row as-is with defaults applied
    logger.warn(`[Zod] ${tableName}[${idx}] validation warning`, result.error.issues.map(i => `${i.path.join(".")}: ${i.message}`).join(", "));
    // safeParse failed — return row as-is (parse would fail identically)
    return row as T;
  });
}
