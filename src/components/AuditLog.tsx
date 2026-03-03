/**
 * #17: Versionierung/Audit-Log — Wer hat was wann geändert? Änderungshistorie pro Objekt
 */
import { useState, useCallback, useEffect, useMemo } from "react";
import { History, Clock, User, Building2, ChevronDown, ChevronUp } from "lucide-react";

interface AuditEntry {
  id: string;
  timestamp: string;
  action: "create" | "update" | "delete";
  entity: string;
  entityName: string;
  field?: string;
  oldValue?: string;
  newValue?: string;
  user: string;
}

const STORAGE_KEY = "immo-audit-log";
const MAX_ENTRIES = 200;

function loadAuditLog(): AuditEntry[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch { return []; }
}

function saveAuditLog(entries: AuditEntry[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(entries.slice(0, MAX_ENTRIES)));
}

/** Call this to log an action */
export function logAuditEntry(entry: Omit<AuditEntry, "id" | "timestamp">) {
  const entries = loadAuditLog();
  const newEntry: AuditEntry = {
    ...entry,
    id: `audit_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    timestamp: new Date().toISOString(),
  };
  saveAuditLog([newEntry, ...entries]);
}

const ACTION_LABELS: Record<string, { label: string; color: string }> = {
  create: { label: "Erstellt", color: "text-profit bg-profit/10" },
  update: { label: "Geändert", color: "text-primary bg-primary/10" },
  delete: { label: "Gelöscht", color: "text-loss bg-loss/10" },
};

export function AuditLog() {
  const [entries, setEntries] = useState<AuditEntry[]>(loadAuditLog);
  const [expanded, setExpanded] = useState(false);
  const [filter, setFilter] = useState<"all" | "create" | "update" | "delete">("all");

  // Refresh on mount
  useEffect(() => {
    setEntries(loadAuditLog());
  }, []);

  const filtered = useMemo(() => {
    const list = filter === "all" ? entries : entries.filter(e => e.action === filter);
    return expanded ? list : list.slice(0, 10);
  }, [entries, filter, expanded]);

  const totalCount = filter === "all" ? entries.length : entries.filter(e => e.action === filter).length;

  const clearLog = useCallback(() => {
    saveAuditLog([]);
    setEntries([]);
  }, []);

  if (entries.length === 0) {
    return (
      <div className="gradient-card rounded-xl border border-border p-4">
        <h3 className="text-sm font-semibold flex items-center gap-2 mb-2">
          <History className="h-4 w-4 text-primary" />
          Änderungshistorie
        </h3>
        <p className="text-xs text-muted-foreground text-center py-3">
          Noch keine Änderungen protokolliert.
        </p>
      </div>
    );
  }

  return (
    <div className="gradient-card rounded-xl border border-border p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold flex items-center gap-2">
          <History className="h-4 w-4 text-primary" />
          Änderungshistorie
        </h3>
        <div className="flex items-center gap-1.5">
          <select
            value={filter}
            onChange={e => setFilter(e.target.value as typeof filter)}
            className="text-[10px] bg-secondary border border-border rounded px-1.5 py-0.5"
          >
            <option value="all">Alle ({entries.length})</option>
            <option value="create">Erstellt</option>
            <option value="update">Geändert</option>
            <option value="delete">Gelöscht</option>
          </select>
          <button onClick={clearLog} className="text-[10px] text-muted-foreground hover:text-loss transition-colors">
            Leeren
          </button>
        </div>
      </div>

      <div className="space-y-1.5">
        {filtered.map(entry => {
          const actionConfig = ACTION_LABELS[entry.action] || ACTION_LABELS.update;
          return (
            <div key={entry.id} className="flex items-start gap-2 p-2 rounded-lg bg-secondary/20 text-xs">
              <div className="mt-0.5 shrink-0">
                <Clock className="h-3 w-3 text-muted-foreground" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${actionConfig.color}`}>
                    {actionConfig.label}
                  </span>
                  <span className="font-medium truncate">{entry.entityName}</span>
                  {entry.field && (
                    <span className="text-muted-foreground">· {entry.field}</span>
                  )}
                </div>
                {entry.oldValue && entry.newValue && (
                  <p className="text-[10px] text-muted-foreground mt-0.5">
                    {entry.oldValue} → {entry.newValue}
                  </p>
                )}
                <p className="text-[10px] text-muted-foreground mt-0.5 flex items-center gap-1">
                  <User className="h-2.5 w-2.5" />
                  {entry.user} · {new Date(entry.timestamp).toLocaleString("de-DE")}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      {totalCount > 10 && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="w-full flex items-center justify-center gap-1 text-xs text-muted-foreground hover:text-foreground mt-2 py-1.5 transition-colors"
        >
          {expanded ? (
            <>Weniger anzeigen <ChevronUp className="h-3 w-3" /></>
          ) : (
            <>Alle {totalCount} anzeigen <ChevronDown className="h-3 w-3" /></>
          )}
        </button>
      )}
    </div>
  );
}

export default AuditLog;
