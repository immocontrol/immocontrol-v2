/**
 * Route path constants — single source of truth for app routes.
 * Used by App.tsx and pages (e.g. ObjekteList) to avoid circular imports.
 */
export const ROUTES = {
  HOME: "/",
  PERSONAL_DASHBOARD: "/dashboard",
  HOCKEY_STICK: "/hockey-stick",
  AUTH: "/auth",
  /** Passwort-Reset nach Klick auf E-Mail-Link – nur Formular, danach Abmeldung und Anmeldung */
  PASSWORD_RESET: "/passwort-zuruecksetzen",
  ONBOARDING: "/onboarding",
  SETTINGS: "/einstellungen",
  CONTACTS: "/kontakte",
  TODOS: "/aufgaben",
  LOANS: "/darlehen",
  DEALS: "/deals",
  CRM: "/crm",
  /** CRM WGH-Scout tab — use for all "WGH finden" / Scout links */
  CRM_SCOUT: "/crm?tab=scout",
  REPORTS: "/berichte",
  RENT: "/mietuebersicht",
  CONTRACTS: "/vertraege",
  FORECAST: "/forecast",
  AI: "/immo-ai",
  NK: "/nebenkosten",
  ANALYSE: "/analyse",
  PROPERTY: "/objekt",
  INVITATION: "/einladung",
  DOKUMENTE: "/dokumente",
  WARTUNG: "/wartungsplaner",
  NEWSTICKER: "/newsticker",
  BEWERTUNG: "/bewertung",
  BESICHTIGUNGEN: "/besichtigungen",
  OBJEKTE: "/objekte",
  TENANT_PORTAL: "/mieter",
  HANDWORKER_PORTAL: "/handwerker",
  /** Finanzierungs-Cockpit: Objektübersicht, Kredite, Konten, Selbstauskunft, Unterlagen-Checkliste */
  FINANZIERUNG: "/finanzierung",
} as const;

/** Helper: Property detail URL */
export function propertyDetail(id: string): string {
  return `${ROUTES.PROPERTY}/${id}`;
}

/** Helper: Deals page with highlight */
export function dealsWithId(id: string): string {
  return `${ROUTES.DEALS}?id=${encodeURIComponent(id)}`;
}

/** Helper: Contacts page with highlight */
export function contactsWithHighlight(id: string): string {
  return `${ROUTES.CONTACTS}?highlight=${encodeURIComponent(id)}`;
}

/** Helper: Besichtigungen page with ID filter */
export function viewingsWithId(id: string): string {
  return `${ROUTES.BESICHTIGUNGEN}?id=${encodeURIComponent(id)}`;
}

/** Helper: Dokumente page with ID filter */
export function documentsWithId(id: string): string {
  return `${ROUTES.DOKUMENTE}?id=${encodeURIComponent(id)}`;
}

/** Helper: Darlehen page with ID filter */
export function loansWithId(id: string): string {
  return `${ROUTES.LOANS}?id=${encodeURIComponent(id)}`;
}
