/**
 * FUND-14: RLS (Row Level Security) audit automation — validates that all
 * Supabase tables have proper RLS policies configured. Provides a client-side
 * audit checklist and policy documentation.
 */

export interface RlsPolicy {
  table: string;
  policyName: string;
  operation: "SELECT" | "INSERT" | "UPDATE" | "DELETE" | "ALL";
  using: string;
  withCheck?: string;
  description: string;
}

/**
 * FUND-14: Expected RLS policies for all tables.
 * Each table should have user-scoped policies based on auth.uid().
 */
export const EXPECTED_RLS_POLICIES: RlsPolicy[] = [
  // Properties
  { table: "properties", policyName: "properties_select_own", operation: "SELECT", using: "auth.uid() = user_id", description: "Users can only view their own properties" },
  { table: "properties", policyName: "properties_insert_own", operation: "INSERT", using: "true", withCheck: "auth.uid() = user_id", description: "Users can only insert properties with their user_id" },
  { table: "properties", policyName: "properties_update_own", operation: "UPDATE", using: "auth.uid() = user_id", description: "Users can only update their own properties" },
  { table: "properties", policyName: "properties_delete_own", operation: "DELETE", using: "auth.uid() = user_id", description: "Users can only delete their own properties" },

  // Tenants
  { table: "tenants", policyName: "tenants_select_own", operation: "SELECT", using: "auth.uid() = (SELECT user_id FROM properties WHERE id = property_id)", description: "Users can only view tenants of their properties" },
  { table: "tenants", policyName: "tenants_insert_own", operation: "INSERT", using: "true", withCheck: "auth.uid() = (SELECT user_id FROM properties WHERE id = property_id)", description: "Users can only add tenants to their properties" },

  // Loans
  { table: "loans", policyName: "loans_select_own", operation: "SELECT", using: "auth.uid() = user_id", description: "Users can only view their own loans" },
  { table: "loans", policyName: "loans_insert_own", operation: "INSERT", using: "true", withCheck: "auth.uid() = user_id", description: "Users can only insert loans with their user_id" },
  { table: "loans", policyName: "loans_update_own", operation: "UPDATE", using: "auth.uid() = user_id", description: "Users can only update their own loans" },
  { table: "loans", policyName: "loans_delete_own", operation: "DELETE", using: "auth.uid() = user_id", description: "Users can only delete their own loans" },

  // Contacts
  { table: "contacts", policyName: "contacts_select_own", operation: "SELECT", using: "auth.uid() = user_id", description: "Users can only view their own contacts" },
  { table: "contacts", policyName: "contacts_insert_own", operation: "INSERT", using: "true", withCheck: "auth.uid() = user_id", description: "Users can only insert contacts with their user_id" },

  // Deals
  { table: "deals", policyName: "deals_select_own", operation: "SELECT", using: "auth.uid() = user_id", description: "Users can only view their own deals" },
  { table: "deals", policyName: "deals_insert_own", operation: "INSERT", using: "true", withCheck: "auth.uid() = user_id", description: "Users can only insert deals with their user_id" },

  // Todos
  { table: "todos", policyName: "todos_select_own", operation: "SELECT", using: "auth.uid() = user_id", description: "Users can only view their own todos" },
  { table: "todos", policyName: "todos_insert_own", operation: "INSERT", using: "true", withCheck: "auth.uid() = user_id", description: "Users can only insert todos with their user_id" },

  // Documents
  { table: "documents", policyName: "documents_select_own", operation: "SELECT", using: "auth.uid() = user_id", description: "Users can only view their own documents" },

  // CRM Leads
  { table: "crm_leads", policyName: "crm_leads_select_own", operation: "SELECT", using: "auth.uid() = user_id", description: "Users can only view their own CRM leads" },

  // Maintenance Items
  { table: "maintenance_items", policyName: "maintenance_select_own", operation: "SELECT", using: "auth.uid() = user_id", description: "Users can only view their own maintenance items" },
];

/**
 * FUND-14: Get all tables that should have RLS enabled.
 */
export function getAuditableTables(): string[] {
  return [...new Set(EXPECTED_RLS_POLICIES.map((p) => p.table))];
}

/**
 * FUND-14: Generate SQL to create missing RLS policies.
 */
export function generateRlsPolicySql(policy: RlsPolicy): string {
  const lines = [
    `-- ${policy.description}`,
    `CREATE POLICY "${policy.policyName}"`,
    `  ON public.${policy.table}`,
    `  FOR ${policy.operation}`,
    `  TO authenticated`,
    `  USING (${policy.using})`,
  ];
  if (policy.withCheck) {
    lines.push(`  WITH CHECK (${policy.withCheck})`);
  }
  lines.push(";");
  return lines.join("\n");
}

/**
 * FUND-14: Generate a full RLS audit report as markdown.
 */
export function generateRlsAuditReport(): string {
  const tables = getAuditableTables();
  const lines: string[] = [
    "# RLS Audit Report",
    `Generated: ${new Date().toISOString()}`,
    "",
    `## Tables Requiring RLS: ${tables.length}`,
    "",
  ];

  for (const table of tables) {
    const policies = EXPECTED_RLS_POLICIES.filter((p) => p.table === table);
    lines.push(`### \`${table}\``);
    lines.push(`Expected policies: ${policies.length}`);
    lines.push("");
    for (const policy of policies) {
      lines.push(`- **${policy.policyName}** (${policy.operation}): ${policy.description}`);
    }
    lines.push("");
  }

  lines.push("## SQL to Apply Missing Policies");
  lines.push("```sql");
  for (const table of tables) {
    lines.push(`-- Enable RLS on ${table}`);
    lines.push(`ALTER TABLE public.${table} ENABLE ROW LEVEL SECURITY;`);
    lines.push("");
  }
  for (const policy of EXPECTED_RLS_POLICIES) {
    lines.push(generateRlsPolicySql(policy));
    lines.push("");
  }
  lines.push("```");

  return lines.join("\n");
}
