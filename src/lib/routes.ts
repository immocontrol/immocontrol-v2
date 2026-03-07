/**
 * Route path constants — single source of truth for app routes.
 * Used by App.tsx and pages (e.g. ObjekteList) to avoid circular imports.
 */
export const ROUTES = {
  HOME: "/",
  PERSONAL_DASHBOARD: "/dashboard",
  HOCKEY_STICK: "/hockey-stick",
  AUTH: "/auth",
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
