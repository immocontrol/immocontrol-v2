/**
 * Route path constants — single source of truth for app routes.
 * Used by App.tsx and pages (e.g. ObjekteList) to avoid circular imports.
 */
export const ROUTES = {
  HOME: "/",
  PERSONAL_DASHBOARD: "/dashboard",
  HOCKEY_STICK: "/hockey-stick",
  AUTH: "/auth",
  /** Öffentliche Datenschutz-Seite (ohne Anmeldung erreichbar) */
  DATENSCHUTZ: "/datenschutz",
  /** Öffentliche Impressum-Seite */
  IMPRESSUM: "/impressum",
  /** Öffentliche Nutzungsbedingungen-Seite */
  NUTZUNGSBEDINGUNGEN: "/nutzungsbedingungen",
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
  /** Steuer-Cockpit: Anlage V, AfA, Verlustverrechnung, Veräußerungsgewinn */
  STEUER_COCKPIT: "/steuer-cockpit",
  /** Refinanzierungs-Szenario-Rechner */
  REFINANZIERUNG: "/refinanzierung",
  /** Stress-Test / Risiko-Simulation */
  STRESS_TEST: "/stress-test",
  /** Portfolio-Diversifikation */
  DIVERSIFIKATION: "/diversifikation",
  /** Mietspiegel- und Markt-Check */
  MIETSPIEGEL: "/mietspiegel",
  /** KPIs im Zeitverlauf */
  KPI_ZEITREISE: "/kpi-zeitreise",
  /** Benachrichtigungen / Alarm-System */
  BENACHRICHTIGUNGEN: "/benachrichtigungen",
  /** Syndication / Co-Invest-Tracking */
  SYNDICATION: "/syndication",
  /** Deal-Benchmark: erwartete vs. realisierte Rendite */
  DEAL_BENCHMARK: "/deal-benchmark",
  /** Sammel-Seite mit Tabs: Mieten, Nebenkosten, Cashflow-Prognose */
  MIETEN_BETRIEB: "/mieten-betrieb",
  /** Sammel-Seite mit Tabs: Stress-Test, Diversifikation, Mietspiegel, KPI, Berichte, Rechner, Hockey Stick */
  ANALYSE_RISIKO: "/analyse-risiko",
  /** Sammel-Seite mit Tabs: Verträge, Kontakte */
  VERTRAEGE_KONTAKTE: "/vertraege-kontakte",
  /** Sammel-Seite mit Tabs: Aufgaben, Dokumente, Wartung */
  AUFGABEN_DOKUMENTE: "/aufgaben-dokumente",
  /** Sammel-Seite mit Tabs: CRM, Deals, Deal-Benchmark, Schnellbewertung */
  DEALS_BEWERTUNG: "/deals-bewertung",
  /** Öffentlicher Link: Mieter bestätigt Übergabeprotokoll (Token in URL) */
  HANDOVER_CONFIRM: "/uebergabe",
  /** Öffentlicher Link: Mieter unterschreibt Mietvertrag (Token in URL) */
  CONTRACT_SIGN: "/vertrag",
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

/** Helper: Dokumente page with ID filter (document id) */
export function documentsWithId(id: string): string {
  return `${ROUTES.DOKUMENTE}?id=${encodeURIComponent(id)}`;
}

/** Helper: Dokumente page filtered by property */
export function dokumenteForProperty(propertyId: string): string {
  return `${ROUTES.DOKUMENTE}?property=${encodeURIComponent(propertyId)}`;
}

/** Helper: Finanzierungs-Cockpit with property pre-selected */
export function finanzierungForProperty(propertyId: string): string {
  return `${ROUTES.FINANZIERUNG}?property=${encodeURIComponent(propertyId)}`;
}

/** Helper: Darlehen page with ID filter */
export function loansWithId(id: string): string {
  return `${ROUTES.LOANS}?id=${encodeURIComponent(id)}`;
}

/** Helper: CRM page with leads tab and optional lead highlight */
export function crmWithLeadId(id: string): string {
  return `${ROUTES.CRM}?tab=leads&lead=${encodeURIComponent(id)}`;
}

/** Helper: CRM page with specific tab */
export function crmWithTab(tab: string): string {
  return `${ROUTES.CRM}?tab=${encodeURIComponent(tab)}`;
}
