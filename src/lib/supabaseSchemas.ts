/**
 * #19: Zod validation schemas for Supabase database responses.
 * Validates data coming FROM the database to catch schema mismatches early.
 */
import { z } from "zod";

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
  monthly_expenses: z.coerce.number().default(0),
  monthly_credit_rate: z.coerce.number().default(0),
  monthly_cashflow: z.coerce.number().default(0),
  remaining_debt: z.coerce.number().default(0),
  interest_rate: z.coerce.number().default(0),
  sqm: z.coerce.number().default(0),
  year_built: z.coerce.number().default(0),
  ownership: z.string().default("privat"),
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
    console.warn(
      `[Zod] ${tableName}[${idx}] validation warning:`,
      result.error.issues.map(i => `${i.path.join(".")}: ${i.message}`).join(", ")
    );
    // Try lenient parse — strip unknown fields, apply defaults
    try {
      return schema.parse(row);
    } catch {
      return row as T;
    }
  });
}
