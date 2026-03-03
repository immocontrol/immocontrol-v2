/**
 * Audit Log utility — tracks user actions for compliance and debugging.
 * Improvement 19: Audit log for tracking changes to properties, tenants, etc.
 * Stores entries in localStorage with automatic rotation (max 500 entries).
 */

export interface AuditEntry {
  id: string;
  timestamp: string;
  action: AuditAction;
  entity: AuditEntity;
  entityId?: string;
  entityName?: string;
  details?: string;
  userId?: string;
}

export type AuditAction =
  | "create"
  | "update"
  | "delete"
  | "export"
  | "import"
  | "login"
  | "logout"
  | "settings_change"
  | "bulk_action";

export type AuditEntity =
  | "property"
  | "tenant"
  | "contact"
  | "loan"
  | "deal"
  | "ticket"
  | "document"
  | "todo"
  | "settings"
  | "auth"
  | "report"
  | "system";

const AUDIT_STORAGE_KEY = "immocontrol_audit_log";
const MAX_ENTRIES = 500;

/** Generate a simple unique ID */
function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

/** Get all audit entries from localStorage */
export function getAuditLog(): AuditEntry[] {
  try {
    const raw = localStorage.getItem(AUDIT_STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as AuditEntry[];
  } catch {
    return [];
  }
}

/** Add a new audit entry. Automatically rotates old entries beyond MAX_ENTRIES. */
export function logAudit(
  action: AuditAction,
  entity: AuditEntity,
  options?: {
    entityId?: string;
    entityName?: string;
    details?: string;
    userId?: string;
  },
): AuditEntry {
  const entry: AuditEntry = {
    id: generateId(),
    timestamp: new Date().toISOString(),
    action,
    entity,
    entityId: options?.entityId,
    entityName: options?.entityName,
    details: options?.details,
    userId: options?.userId,
  };

  const entries = getAuditLog();
  entries.unshift(entry);

  // Rotate: keep only the most recent MAX_ENTRIES
  const trimmed = entries.slice(0, MAX_ENTRIES);

  try {
    localStorage.setItem(AUDIT_STORAGE_KEY, JSON.stringify(trimmed));
  } catch {
    // localStorage full — clear oldest half
    const half = trimmed.slice(0, Math.floor(MAX_ENTRIES / 2));
    localStorage.setItem(AUDIT_STORAGE_KEY, JSON.stringify(half));
  }

  return entry;
}

/** Clear all audit entries */
export function clearAuditLog(): void {
  localStorage.removeItem(AUDIT_STORAGE_KEY);
}

/** Export audit log as CSV */
export function exportAuditLogCSV(): void {
  const entries = getAuditLog();
  if (entries.length === 0) return;

  const headers = ["Zeitstempel", "Aktion", "Entit\u00e4t", "ID", "Name", "Details"];
  const rows = entries.map((e) => [
    new Date(e.timestamp).toLocaleString("de-DE"),
    e.action,
    e.entity,
    e.entityId || "",
    e.entityName || "",
    e.details || "",
  ]);

  const csv = [headers.join(";"), ...rows.map((r) => r.join(";"))].join("\n");
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `audit_log_${new Date().toISOString().split("T")[0]}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

/** Get recent entries filtered by entity */
export function getAuditLogByEntity(
  entity: AuditEntity,
  limit = 50,
): AuditEntry[] {
  return getAuditLog()
    .filter((e) => e.entity === entity)
    .slice(0, limit);
}

/** Get recent entries filtered by action */
export function getAuditLogByAction(
  action: AuditAction,
  limit = 50,
): AuditEntry[] {
  return getAuditLog()
    .filter((e) => e.action === action)
    .slice(0, limit);
}
