/**
 * Zentrale Definition der Kontakt-Kategorien (DB-Spalte: category).
 * Einzige Quelle für UI und Formulare — Rolle/Kategorie konsistent in App und Export.
 */
import { Wrench, Building, Shield, Briefcase, LucideIcon } from "lucide-react";

export interface ContactCategoryOption {
  value: string;
  icon: LucideIcon;
  description?: string;
}

export const CONTACT_CATEGORIES: ContactCategoryOption[] = [
  { value: "Handwerker", icon: Wrench, description: "Elektriker, Klempner, Maler, …" },
  { value: "Hausverwaltung", icon: Building, description: "Externe Verwaltung, WEG, …" },
  { value: "Versicherung", icon: Shield, description: "Gebäude-, Haftpflicht-, …" },
  { value: "Sonstiges", icon: Briefcase, description: "Notar, Steuerberater, …" },
];

/** Kategorie-Label für Anzeige (falls später i18n) */
export function getContactCategoryLabel(value: string): string {
  return CONTACT_CATEGORIES.find((c) => c.value === value)?.value ?? value;
}
