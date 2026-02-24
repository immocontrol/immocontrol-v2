/** Centralised React Query key factory – keeps cache keys consistent across the app. */
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
} as const;
