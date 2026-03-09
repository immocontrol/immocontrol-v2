/**
 * Deals page — shared types and constants (extracted for smaller Deals.tsx).
 */

export interface DealRecord {
  id: string;
  title: string;
  address?: string;
  description?: string;
  stage: string;
  purchase_price?: number;
  expected_rent?: number;
  expected_yield?: number;
  sqm?: number;
  units?: number;
  property_type?: string;
  /** Set when deal was converted to a property (links to Objekte) */
  property_id?: string | null;
  contact_name?: string;
  contact_phone?: string;
  contact_email?: string;
  source?: string;
  notes?: string;
  lost_reason?: string;
  created_at: string;
}

export const STAGES = [
  { key: "recherche", label: "Recherche", color: "bg-slate-500" },
  { key: "kontaktiert", label: "Kontaktiert", color: "bg-blue-500" },
  { key: "besichtigung", label: "Besichtigung", color: "bg-yellow-500" },
  { key: "angebot", label: "Angebot", color: "bg-orange-500" },
  { key: "verhandlung", label: "Verhandlung", color: "bg-purple-500" },
  { key: "abgeschlossen", label: "Abgeschlossen", color: "bg-green-500" },
  { key: "abgelehnt", label: "Abgelehnt", color: "bg-red-500" },
] as const;

export const stageMap = Object.fromEntries(STAGES.map(s => [s.key, s]));

export const emptyForm = {
  title: "",
  address: "",
  description: "",
  stage: "recherche",
  purchase_price: 0,
  expected_rent: 0,
  sqm: 0,
  units: 1,
  property_type: "ETW",
  contact_name: "",
  contact_phone: "",
  contact_email: "",
  source: "",
  notes: "",
  lost_reason: "",
};
