/**
 * #2: TypeScript Types for Supabase Service Layer — Strong typing replaces Record<string, unknown>.
 * These types mirror the Supabase database schema for type-safe operations.
 */

/** Property insert/update payload */
export interface PropertyPayload {
  id?: string;
  user_id: string;
  name: string;
  address?: string;
  city?: string;
  zip_code?: string;
  state?: string;
  country?: string;
  latitude?: number;
  longitude?: number;
  type?: string;
  units?: number;
  sqm?: number;
  purchase_price?: number;
  current_value?: number;
  purchase_date?: string;
  monthly_rent?: number;
  monthly_expenses?: number;
  monthly_credit_rate?: number;
  remaining_debt?: number;
  interest_rate?: number;
  gesellschaft?: string;
  notes?: string;
  is_deleted?: boolean;
  deleted_at?: string;
}

/** Tenant insert/update payload */
export interface TenantPayload {
  id?: string;
  property_id: string;
  user_id: string;
  first_name: string;
  last_name: string;
  email?: string;
  phone?: string;
  monthly_rent?: number;
  deposit?: number;
  move_in_date?: string;
  move_out_date?: string;
  is_active?: boolean;
  unit_number?: string;
  notes?: string;
  contract_start?: string;
  contract_end?: string;
}

/** Contact insert/update payload */
export interface ContactPayload {
  id?: string;
  user_id: string;
  name: string;
  company?: string;
  email?: string;
  phone?: string;
  type?: string;
  notes?: string;
  is_deleted?: boolean;
  deleted_at?: string;
  address?: string;
  city?: string;
  zip_code?: string;
}

/** Loan insert/update payload */
export interface LoanPayload {
  id?: string;
  user_id: string;
  property_id?: string;
  bank_name?: string;
  loan_amount?: number;
  remaining_amount?: number;
  interest_rate?: number;
  monthly_rate?: number;
  start_date?: string;
  end_date?: string;
  fixed_rate_end?: string;
  type?: string;
  notes?: string;
  is_deleted?: boolean;
  deleted_at?: string;
}

/** Payment insert/update payload */
export interface PaymentPayload {
  id?: string;
  tenant_id: string;
  property_id: string;
  user_id: string;
  amount: number;
  due_date: string;
  paid_date?: string;
  status?: string;
  type?: string;
  notes?: string;
}

/** Todo insert/update payload */
export interface TodoPayload {
  id?: string;
  user_id: string;
  title: string;
  description?: string;
  priority?: "low" | "medium" | "high" | "urgent";
  status?: "open" | "in_progress" | "done";
  due_date?: string;
  property_id?: string;
  is_deleted?: boolean;
  deleted_at?: string;
}

/** Ticket insert/update payload */
export interface TicketPayload {
  id?: string;
  user_id: string;
  property_id?: string;
  tenant_id?: string;
  title: string;
  description?: string;
  status?: string;
  priority?: string;
  assigned_to?: string;
  category?: string;
}

/** Document insert/update payload */
export interface DocumentPayload {
  id?: string;
  user_id: string;
  property_id?: string;
  name: string;
  file_path: string;
  file_type?: string;
  file_size?: number;
  category?: string;
  notes?: string;
}

/** Deal insert/update payload */
export interface DealPayload {
  id?: string;
  user_id: string;
  title: string;
  address?: string;
  asking_price?: number;
  estimated_rent?: number;
  sqm?: number;
  units?: number;
  type?: string;
  status?: string;
  notes?: string;
  source?: string;
  url?: string;
}

/** Note insert/update payload */
export interface NotePayload {
  id?: string;
  user_id: string;
  property_id: string;
  content: string;
  category?: string;
}

/** Nebenkosten (utility costs) payload */
export interface NebenkostenPayload {
  id?: string;
  user_id: string;
  property_id: string;
  year: number;
  tenant_id?: string;
  heating_cost?: number;
  water_cost?: number;
  trash_cost?: number;
  insurance_cost?: number;
  property_tax?: number;
  maintenance_cost?: number;
  management_cost?: number;
  other_cost?: number;
  total_advance?: number;
  total_actual?: number;
  settlement_date?: string;
  status?: string;
}

/** Anlage V tax export data */
export interface AnlageVData {
  year: number;
  propertyId: string;
  mieteinnahmen: number;
  werbungskosten: {
    abschreibung: number;
    zinsen: number;
    verwaltung: number;
    instandhaltung: number;
    versicherung: number;
    grundsteuer: number;
    sonstige: number;
  };
  ergebnis: number;
}

/** Mietspiegel (rent index) comparison */
export interface MietspiegelEntry {
  city: string;
  zipCode: string;
  avgRentPerSqm: number;
  minRentPerSqm: number;
  maxRentPerSqm: number;
  buildingYear?: string;
  quality?: string;
  lastUpdated: string;
  source: string;
}
