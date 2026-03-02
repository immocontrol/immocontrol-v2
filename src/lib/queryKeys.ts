/** Centralised React Query key factory – keeps cache keys consistent across the app.
 * Item 7: Added reports, nebenkosten, forecast keys for new nav entries */
export const queryKeys = {
  properties: {
    all: ["properties"] as const,
    detail: (id: string) => ["properties", id] as const,
  },
  tenants: {
    byProperty: (propertyId: string) => ["tenants", propertyId] as const,
  },
  contacts: {
    all: ["contacts"] as const,
    handworkers: ["contacts", "handworkers"] as const,
  },
  notes: {
    byProperty: (propertyId: string) => ["notes", propertyId] as const,
  },
  documents: {
    byProperty: (propertyId: string) => ["documents", propertyId] as const,
  },
  payments: {
    byProperty: (propertyId: string) => ["payments", propertyId] as const,
    byTenant: (tenantId: string) => ["payments", "tenant", tenantId] as const,
  },
  tickets: {
    byProperty: (propertyId: string) => ["tickets", propertyId] as const,
    byTenant: (tenantId: string) => ["tickets", "tenant", tenantId] as const,
    byHandworker: (userId: string) => ["tickets", "handworker", userId] as const,
  },
  messages: {
    byTenant: (tenantId: string) => ["messages", tenantId] as const,
    tenantList: (propertyId: string) => ["messages", "tenants", propertyId] as const,
  },
  dashboard: {
    actions: (userId: string) => ["dashboard", "actions", userId] as const,
  },
  timeline: {
    byProperty: (propertyId: string) => ["timeline", propertyId] as const,
  },
  loans: {
    all: ["loans"] as const,
    byProperty: (propertyId: string) => ["loans", propertyId] as const,
  },
  todos: {
    all: (userId: string) => ["todos", userId] as const,
  },
  customCompanies: {
    all: ["custom_companies"] as const,
  },
  /* UPD-45: Deals query keys for Telegram import and pipeline */
  deals: {
    all: ["deals"] as const,
    detail: (id: string) => ["deals", id] as const,
  },
  /* Item 7: New query keys for financial pages */
  reports: {
    all: ["reports"] as const,
    byProperty: (propertyId: string) => ["reports", propertyId] as const,
  },
  nebenkosten: {
    all: ["nebenkosten"] as const,
    byProperty: (propertyId: string) => ["nebenkosten", propertyId] as const,
  },
  forecast: {
    all: ["forecast"] as const,
  },
} as const;
