/**
 * IMP-3: Zod validation schemas for all major forms.
 * Centralizes form validation logic with German error messages.
 */

import { z } from "zod";

/* ── Shared validators ──────────────────────────────────── */

const germanPhone = z.string().regex(/^(\+49|0)[1-9]\d{1,14}$/, "Ungültige Telefonnummer").or(z.literal(""));
const germanPLZ = z.string().regex(/^\d{5}$/, "PLZ muss 5 Ziffern haben").or(z.literal(""));
const optionalEmail = z.string().email("Ungültige E-Mail-Adresse").or(z.literal(""));
const positiveNumber = z.number().min(0, "Muss >= 0 sein");
const requiredString = z.string().min(1, "Pflichtfeld");

/* ── Deal form schema ───────────────────────────────────── */

export const dealSchema = z.object({
  title: requiredString,
  address: z.string().default(""),
  description: z.string().default(""),
  stage: z.enum(["recherche", "kontaktiert", "besichtigung", "angebot", "verhandlung", "abgeschlossen", "abgelehnt"]).default("recherche"),
  purchase_price: positiveNumber.default(0),
  expected_rent: positiveNumber.default(0),
  sqm: positiveNumber.default(0),
  units: z.number().int().min(1, "Mindestens 1 Einheit").default(1),
  property_type: z.string().default("ETW"),
  contact_name: z.string().default(""),
  contact_phone: germanPhone.default(""),
  contact_email: optionalEmail.default(""),
  source: z.string().default(""),
  notes: z.string().default(""),
  lost_reason: z.string().default(""),
});

export type DealFormData = z.infer<typeof dealSchema>;

/* ── Property form schema ───────────────────────────────── */

export const propertySchema = z.object({
  name: requiredString,
  address: requiredString,
  plz: germanPLZ.default(""),
  city: z.string().default(""),
  type: z.enum(["ETW", "MFH", "EFH", "DHH", "Gewerbe", "Grundstück", "Sonstige"]).default("ETW"),
  units: z.number().int().min(1).default(1),
  sqm: positiveNumber.default(0),
  purchasePrice: positiveNumber.default(0),
  purchaseDate: z.string().default(""),
  monthlyRent: positiveNumber.default(0),
  monthlyExpenses: positiveNumber.default(0),
  remainingDebt: positiveNumber.default(0),
  gesellschaft_id: z.string().nullable().default(null),
});

export type PropertyFormData = z.infer<typeof propertySchema>;

/* ── Contact form schema ────────────────────────────────── */

export const contactSchema = z.object({
  name: requiredString,
  email: optionalEmail.default(""),
  phone: germanPhone.default(""),
  role: z.enum(["mieter", "handwerker", "makler", "verwalter", "bank", "notar", "steuerberater", "sonstige"]).default("sonstige"),
  company: z.string().default(""),
  notes: z.string().default(""),
  address: z.string().default(""),
});

export type ContactFormData = z.infer<typeof contactSchema>;

/* ── Loan form schema ───────────────────────────────────── */

export const loanSchema = z.object({
  bank_name: requiredString,
  loan_amount: z.number().positive("Darlehensbetrag muss positiv sein"),
  interest_rate: z.number().min(0).max(100, "Zinssatz max 100%"),
  repayment_rate: z.number().min(0).max(100, "Tilgungsrate max 100%"),
  monthly_payment: positiveNumber.default(0),
  remaining_balance: positiveNumber.default(0),
  start_date: z.string().default(""),
  fixed_interest_until: z.string().default(""),
  loan_type: z.enum(["annuity", "bullet", "linear"]).default("annuity"),
  property_id: z.string().nullable().default(null),
  notes: z.string().default(""),
});

export type LoanFormData = z.infer<typeof loanSchema>;

/* ── Tenant form schema ─────────────────────────────────── */

export const tenantSchema = z.object({
  name: requiredString,
  email: optionalEmail.default(""),
  phone: germanPhone.default(""),
  unit_number: z.string().default(""),
  monthly_rent: positiveNumber.default(0),
  monthly_utilities: positiveNumber.default(0),
  deposit: positiveNumber.default(0),
  lease_start: z.string().default(""),
  lease_end: z.string().default(""),
  notes: z.string().default(""),
});

export type TenantFormData = z.infer<typeof tenantSchema>;

/* ── Nebenkosten form schema ────────────────────────────── */

export const nebenkostenSchema = z.object({
  description: requiredString,
  amount: z.number().positive("Betrag muss positiv sein"),
  category: z.enum(["heizung", "wasser", "müll", "versicherung", "grundsteuer", "hausverwaltung", "instandhaltung", "sonstige"]).default("sonstige"),
  date: z.string().default(""),
  property_id: z.string().nullable().default(null),
  is_recurring: z.boolean().default(false),
});

export type NebenkostenFormData = z.infer<typeof nebenkostenSchema>;

/* ── Settings profile schema ────────────────────────────── */

export const profileSchema = z.object({
  display_name: z.string().min(2, "Name muss mindestens 2 Zeichen haben").default(""),
  email: z.string().email("Ungültige E-Mail").default(""),
  phone: germanPhone.default(""),
  investor_type: z.string().default(""),
  strategy: z.string().default(""),
});

export type ProfileFormData = z.infer<typeof profileSchema>;

/* ── Utility: validate form data and return errors ──────── */

export function validateForm<T>(
  schema: z.ZodSchema<T>,
  data: unknown
): { success: true; data: T } | { success: false; errors: Record<string, string> } {
  const result = schema.safeParse(data);
  if (result.success) {
    return { success: true, data: result.data };
  }

  const errors: Record<string, string> = {};
  for (const issue of result.error.issues) {
    const path = issue.path.join(".");
    if (!errors[path]) {
      errors[path] = issue.message;
    }
  }
  return { success: false, errors };
}
