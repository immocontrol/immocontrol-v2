/**
 * Kontakt: einheitliche Abbildung role (UI/Form) ↔ category (DB).
 * Vorschlag 7 — eine zentrale Stelle für alle Formulare und API.
 */

export const CONTACT_ROLES = [
  "mieter",
  "handwerker",
  "makler",
  "verwalter",
  "bank",
  "notar",
  "steuerberater",
  "sonstige",
] as const;

export type ContactRole = (typeof CONTACT_ROLES)[number];

/** DB nutzt "category" (string), Formular nutzt "role" (enum). */
const ROLE_TO_CATEGORY: Record<ContactRole, string> = {
  mieter: "mieter",
  handwerker: "handwerker",
  makler: "makler",
  verwalter: "verwalter",
  bank: "bank",
  notar: "notar",
  steuerberater: "steuerberater",
  sonstige: "sonstige",
};

const CATEGORY_TO_ROLE: Record<string, ContactRole> = {
  mieter: "mieter",
  handwerker: "handwerker",
  makler: "makler",
  verwalter: "verwalter",
  bank: "bank",
  notar: "notar",
  steuerberater: "steuerberater",
  sonstige: "sonstige",
};

/** Form → DB: beim Speichern role in category überführen */
export function roleToCategory(role: ContactRole): string {
  return ROLE_TO_CATEGORY[role] ?? "sonstige";
}

/** DB → Form: beim Laden category in role überführen */
export function categoryToRole(category: string | null | undefined): ContactRole {
  if (!category) return "sonstige";
  return CATEGORY_TO_ROLE[category.toLowerCase()] ?? "sonstige";
}
