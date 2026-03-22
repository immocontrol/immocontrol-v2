/** IMP-145: Zod validation schemas for form inputs and API payloads */
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
const requiredString = z.string().min(1, "Bitte ausfüllen");

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

/** Add-Property-Dialog: Wenige Pflichtangaben, Rest wird berechnet oder hat Defaults. */
export const addPropertyFormSchema = z.object({
  name: requiredString,
  address: z.string().min(5, "Adresse angeben"),
  type: z.enum(["ETW", "MFH", "EFH", "DHH", "ZFH", "Gewerbe", "Grundstück", "Sonstige"]).default("ETW"),
  units: z.coerce.number().int().min(1, "Mindestens 1"),
  ownership: z.string().min(1, "Besitzverhältnis wählen"),
  purchasePrice: z.coerce.number().min(1, "Kaufpreis angeben"),
  purchaseDate: z.string().optional().default(""),
  currentValue: z.coerce.number().min(0),
  monthlyRent: z.coerce.number().min(0),
  warmRent: z.coerce.number().min(0).nullable().optional(),
  monthlyExpenses: z.coerce.number().min(0),
  monthlyCreditRate: z.coerce.number().min(0),
  remainingDebt: z.coerce.number().min(0),
  interestRate: z.coerce.number().min(0).max(20, "Zinssatz max 20%"),
  sqm: z.coerce.number().min(0),
  commercialSqm: z.coerce.number().min(0).optional().default(0),
  yearBuilt: z.coerce.number().min(0).max(2030, "Jahr bis 2030"),
  restnutzungsdauer: z.coerce.number().int().min(1).max(100).optional().or(z.literal("")),
  buildingSharePercent: z.coerce.number().min(0).max(100).optional().or(z.literal("")),
  monthlyCashflow: z.coerce.number().optional(),
  instandhaltungProSqm: z.coerce.number().min(0).max(200).optional().default(20),
  parkingUnderground: z.coerce.number().int().min(0).optional().default(0),
  parkingStellplatz: z.coerce.number().int().min(0).optional().default(0),
  parkingGarage: z.coerce.number().int().min(0).optional().default(0),
  gardenSqm: z.coerce.number().min(0).optional().default(0),
  otherRentableNotes: z.string().optional().default(""),
  /** Optional €/m² kalt als Mietspiegel-Referenz (Objekt bearbeiten). */
  mietspiegelReferencePerSqm: z.preprocess(
    (v) => (v === "" || v === null || v === undefined ? undefined : Number(v)),
    z.number().min(0).max(80).optional(),
  ),
});

export type AddPropertyFormData = z.infer<typeof addPropertyFormSchema>;

/** Edit-Property-Dialog: gleiche Felder wie Add (einheitliche Typen). */
export const editPropertyFormSchema = addPropertyFormSchema;
export type EditPropertyFormData = AddPropertyFormData;

/** Objekttypen für Selects (Add/Edit Property). */
export const PROPERTY_TYPES = ["ETW", "MFH", "EFH", "DHH", "ZFH", "Gewerbe", "Grundstück", "Sonstige"] as const;

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

/** Add/Edit Contact form (DB category values). Use for validation before submit. */
export const contactFormSchema = z.object({
  name: requiredString,
  email: z.string().email("Ungültige E-Mail-Adresse").or(z.literal("")).default(""),
  phone: germanPhone.default(""),
  category: z.enum(["Handwerker", "Hausverwaltung", "Versicherung", "Sonstiges"]),
  company: z.string().default(""),
  address: z.string().default(""),
  notes: z.string().default(""),
});

export type ContactFormDataUI = z.infer<typeof contactFormSchema>;

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

/* ── Ticket form schema ───────────────────────────────────── */

export const ticketSchema = z.object({
  title: requiredString,
  description: z.string().default(""),
  priority: z.enum(["low", "medium", "high", "urgent"]).default("medium"),
  status: z.enum(["open", "in_progress", "waiting", "resolved", "closed"]).default("open"),
  category: z.enum(["repair", "maintenance", "complaint", "request", "other"]).default("other"),
  property_id: z.string().nullable().default(null),
  tenant_id: z.string().nullable().default(null),
  assigned_to: z.string().default(""),
  due_date: z.string().default(""),
});

export type TicketFormData = z.infer<typeof ticketSchema>;

/* ── Invoice form schema ──────────────────────────────────── */

export const invoiceSchema = z.object({
  invoice_number: requiredString,
  vendor_name: requiredString,
  amount: z.number().positive("Betrag muss positiv sein"),
  tax_amount: positiveNumber.default(0),
  invoice_date: z.string().default(""),
  due_date: z.string().default(""),
  status: z.enum(["draft", "sent", "paid", "overdue", "cancelled"]).default("draft"),
  category: z.string().default(""),
  property_id: z.string().nullable().default(null),
  notes: z.string().default(""),
});

export type InvoiceFormData = z.infer<typeof invoiceSchema>;

/* ── Service contract form schema ─────────────────────────── */

export const serviceContractSchema = z.object({
  provider_name: requiredString,
  service_type: requiredString,
  monthly_cost: positiveNumber.default(0),
  annual_cost: positiveNumber.default(0),
  start_date: z.string().default(""),
  end_date: z.string().default(""),
  cancellation_period_months: z.number().int().min(0).default(3),
  auto_renew: z.boolean().default(true),
  property_id: z.string().nullable().default(null),
  notes: z.string().default(""),
});

export type ServiceContractFormData = z.infer<typeof serviceContractSchema>;

/* ── Meter form schema ────────────────────────────────────── */

export const meterSchema = z.object({
  meter_number: requiredString,
  meter_type: z.enum(["electricity", "gas", "water", "heating", "other"]).default("electricity"),
  location: z.string().default(""),
  property_id: z.string().nullable().default(null),
  tenant_id: z.string().nullable().default(null),
  installation_date: z.string().default(""),
});

export type MeterFormData = z.infer<typeof meterSchema>;

/* ── Meter reading form schema ────────────────────────────── */

export const meterReadingSchema = z.object({
  meter_id: requiredString,
  reading_value: z.number().min(0, "Zählerstand muss >= 0 sein"),
  reading_date: requiredString,
  notes: z.string().default(""),
});

export type MeterReadingFormData = z.infer<typeof meterReadingSchema>;

/* ── Owner meeting form schema ────────────────────────────── */

export const ownerMeetingSchema = z.object({
  title: requiredString,
  meeting_date: requiredString,
  location: z.string().default(""),
  agenda: z.string().default(""),
  minutes: z.string().default(""),
  property_id: z.string().nullable().default(null),
});

export type OwnerMeetingFormData = z.infer<typeof ownerMeetingSchema>;

/* ── Mietvertrag form schema ──────────────────────────────── */

export const mietvertragSchema = z.object({
  tenant_name: requiredString,
  unit_number: z.string().default(""),
  kaltmiete: positiveNumber.default(0),
  nebenkosten_vorauszahlung: positiveNumber.default(0),
  kaution: positiveNumber.default(0),
  mietbeginn: requiredString,
  mietende: z.string().default(""),
  kuendigungsfrist_monate: z.number().int().min(1).default(3),
  property_id: z.string().nullable().default(null),
  notes: z.string().default(""),
});

export type MietvertragFormData = z.infer<typeof mietvertragSchema>;

/* ── Maintenance item form schema ─────────────────────────── */

export const maintenanceItemSchema = z.object({
  title: requiredString,
  description: z.string().default(""),
  category: z.enum(["inspection", "repair", "replacement", "cleaning", "other"]).default("other"),
  priority: z.enum(["low", "medium", "high"]).default("medium"),
  due_date: z.string().default(""),
  estimated_cost: positiveNumber.default(0),
  property_id: z.string().nullable().default(null),
  recurring: z.boolean().default(false),
  interval_months: z.number().int().min(0).default(0),
});

export type MaintenanceItemFormData = z.infer<typeof maintenanceItemSchema>;

/* ── Bank account form schema ─────────────────────────────── */

export const bankAccountSchema = z.object({
  bank_name: requiredString,
  iban: z.string().regex(/^DE\d{20}$/, "IBAN muss deutsches Format haben (DE + 20 Ziffern)").or(z.literal("")),
  bic: z.string().default(""),
  account_holder: z.string().default(""),
  notes: z.string().default(""),
});

export type BankAccountFormData = z.infer<typeof bankAccountSchema>;

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
