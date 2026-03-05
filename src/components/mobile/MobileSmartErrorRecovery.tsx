/**
 * MOB6-10: Mobile Smart Error Recovery
 * Intelligent error handling with retry strategies, offline queue visualization,
 * and sync status. Provides actionable recovery options for common errors.
 */
import { useState, useCallback, useRef, useEffect, useMemo, memo } from "react";
import { useIsMobile } from "@/hooks/use-mobile";
import {
  AlertCircle, RefreshCw, Wifi, WifiOff, Check, X,
  Clock, CloudOff, Upload, ChevronDown, ChevronUp,
  Loader2, Shield,
} from "lucide-react";
import { cn } from "@/lib/utils";

export interface RecoverableError {
  id: string;
  type: "network" | "auth" | "validation" | "server" | "timeout" | "unknown";
  message: string;
  /** Original error details */
  details?: string;
  /** Timestamp */
  timestamp: string;
  /** Number of retry attempts */
  retryCount: number;
  /** Max retries before giving up */
  maxRetries: number;
  /** Recovery status */
  status: "pending" | "retrying" | "resolved" | "failed";
  /** The action that failed (for re-execution) */
  retryAction?: () => Promise<void>;
}

interface MobileSmartErrorRecoveryProps {
  /** List of recoverable errors */
  errors: RecoverableError[];
  /** Update error status */
  onUpdateError?: (id: string, updates: Partial<RecoverableError>) => void;
  /** Remove error */
  onDismiss?: (id: string) => void;
  /** Retry all failed */
  onRetryAll?: () => void;
  /** Clear all resolved */
  onClearResolved?: () => void;
  /** Number of items in offline queue */
  offlineQueueCount?: number;
  /** Is currently online */
  isOnline?: boolean;
  /** Additional class */
  className?: string;
}

const typeIcons: Record<RecoverableError["type"], React.ReactNode> = {
  network: <WifiOff className="w-4 h-4" />,
  auth: <Shield className="w-4 h-4" />,
  validation: <AlertCircle className="w-4 h-4" />,
  server: <CloudOff className="w-4 h-4" />,
  timeout: <Clock className="w-4 h-4" />,
  unknown: <AlertCircle className="w-4 h-4" />,
};

const typeLabels: Record<RecoverableError["type"], string> = {
  network: "Netzwerkfehler",
  auth: "Authentifizierung",
  validation: "Validierungsfehler",
  server: "Serverfehler",
  timeout: "Zeitüberschreitung",
  unknown: "Unbekannter Fehler",
};

const typeColors: Record<RecoverableError["type"], string> = {
  network: "text-orange-600 bg-orange-100 dark:bg-orange-900/30 dark:text-orange-400",
  auth: "text-red-600 bg-red-100 dark:bg-red-900/30 dark:text-red-400",
  validation: "text-amber-600 bg-amber-100 dark:bg-amber-900/30 dark:text-amber-400",
  server: "text-red-600 bg-red-100 dark:bg-red-900/30 dark:text-red-400",
  timeout: "text-blue-600 bg-blue-100 dark:bg-blue-900/30 dark:text-blue-400",
  unknown: "text-gray-600 bg-gray-100 dark:bg-gray-800 dark:text-gray-400",
};

const retrySuggestions: Record<RecoverableError["type"], string> = {
  network: "Prüfen Sie Ihre Internetverbindung und versuchen Sie es erneut.",
  auth: "Bitte melden Sie sich erneut an.",
  validation: "Bitte überprüfen Sie Ihre Eingaben.",
  server: "Der Server ist vorübergehend nicht erreichbar. Versuchen Sie es in einigen Minuten erneut.",
  timeout: "Die Anfrage hat zu lange gedauert. Versuchen Sie es erneut.",
  unknown: "Ein unerwarteter Fehler ist aufgetreten.",
};

export const MobileSmartErrorRecovery = memo(function MobileSmartErrorRecovery({
  errors,
  onUpdateError,
  onDismiss,
  onRetryAll,
  onClearResolved,
  offlineQueueCount = 0,
  isOnline = true,
  className,
}: MobileSmartErrorRecoveryProps) {
  const isMobile = useIsMobile();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const activeErrors = useMemo(
    () => errors.filter(e => e.status !== "resolved"),
    [errors]
  );

  const resolvedCount = useMemo(
    () => errors.filter(e => e.status === "resolved").length,
    [errors]
  );

  // Cleanup retry timer
  useEffect(() => {
    return () => {
      if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
    };
  }, []);

  const handleRetry = useCallback(async (error: RecoverableError) => {
    if (!error.retryAction || error.retryCount >= error.maxRetries) return;

    onUpdateError?.(error.id, { status: "retrying", retryCount: error.retryCount + 1 });

    try {
      await error.retryAction();
      onUpdateError?.(error.id, { status: "resolved" });
    } catch {
      // Exponential backoff
      const delay = Math.min(30000, 1000 * Math.pow(2, error.retryCount));
      onUpdateError?.(error.id, {
        status: error.retryCount + 1 >= error.maxRetries ? "failed" : "pending",
      });

      // Auto-retry if still within limits
      if (error.retryCount + 1 < error.maxRetries && isOnline) {
        retryTimerRef.current = setTimeout(() => handleRetry({
          ...error,
          retryCount: error.retryCount + 1,
        }), delay);
      }
    }
  }, [onUpdateError, isOnline]);

  if (activeErrors.length === 0 && offlineQueueCount === 0) return null;

  return (
    <div className={cn("w-full", className)}>
      {/* Header bar */}
      <div className={cn(
        "flex items-center justify-between px-3 py-2 rounded-t-xl border",
        activeErrors.length > 0 ? "bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-800" : "bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800"
      )}>
        <button
          onClick={() => setIsCollapsed(prev => !prev)}
          className="flex items-center gap-2 flex-1 min-w-0"
        >
          {activeErrors.length > 0 ? (
            <AlertCircle className="w-4 h-4 text-red-600 dark:text-red-400 shrink-0" />
          ) : (
            <Upload className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
          )}
          <span className="text-xs font-medium truncate">
            {activeErrors.length > 0
              ? `${activeErrors.length} ${activeErrors.length === 1 ? "Fehler" : "Fehler"}`
              : `${offlineQueueCount} ausstehend`
            }
          </span>
          {isCollapsed ? <ChevronDown className="w-3 h-3" /> : <ChevronUp className="w-3 h-3" />}
        </button>
        <div className="flex items-center gap-1">
          {onRetryAll && activeErrors.some(e => e.status === "pending" || e.status === "failed") && (
            <button
              onClick={onRetryAll}
              className={cn(
                "p-1.5 rounded-lg hover:bg-white/50 dark:hover:bg-white/10 transition-colors",
                isMobile && "min-w-[36px] min-h-[36px] flex items-center justify-center"
              )}
              aria-label="Alle erneut versuchen"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
          )}
          {!isOnline && (
            <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-100 dark:bg-red-900/30">
              <WifiOff className="w-3 h-3 text-red-600" />
              <span className="text-[9px] text-red-600 font-medium">Offline</span>
            </div>
          )}
        </div>
      </div>

      {/* Error list */}
      {!isCollapsed && (
        <div className="border-x border-b rounded-b-xl overflow-hidden divide-y">
          {/* Offline queue status */}
          {offlineQueueCount > 0 && (
            <div className="px-3 py-2.5 bg-amber-50/50 dark:bg-amber-950/10 flex items-center gap-2">
              <Upload className="w-3.5 h-3.5 text-amber-600" />
              <span className="text-xs text-amber-700 dark:text-amber-400">
                {offlineQueueCount} {offlineQueueCount === 1 ? "Aktion" : "Aktionen"} in der Warteschlange
              </span>
              {isOnline && (
                <Loader2 className="w-3 h-3 text-amber-600 animate-spin ml-auto" />
              )}
            </div>
          )}

          {/* Error items */}
          {activeErrors.map(error => (
            <div key={error.id} className="px-3 py-2.5">
              <div className="flex items-start gap-2">
                <div className={cn("w-6 h-6 rounded-full flex items-center justify-center shrink-0", typeColors[error.type])}>
                  {error.status === "retrying" ? (
                    <Loader2 className="w-3 h-3 animate-spin" />
                  ) : (
                    typeIcons[error.type]
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] font-medium">{typeLabels[error.type]}</span>
                    <span className="text-[9px] text-muted-foreground">
                      Versuch {error.retryCount}/{error.maxRetries}
                    </span>
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-0.5">{error.message}</p>

                  {/* Expanded details */}
                  {expandedId === error.id && (
                    <div className="mt-1.5 text-[10px] text-muted-foreground bg-muted/50 rounded p-1.5">
                      <p className="font-medium mb-0.5">Empfehlung:</p>
                      <p>{retrySuggestions[error.type]}</p>
                      {error.details && (
                        <>
                          <p className="font-medium mt-1 mb-0.5">Details:</p>
                          <p className="font-mono">{error.details}</p>
                        </>
                      )}
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={() => setExpandedId(prev => prev === error.id ? null : error.id)}
                    className="p-1 rounded hover:bg-muted"
                    aria-label="Details"
                  >
                    {expandedId === error.id ? (
                      <ChevronUp className="w-3 h-3" />
                    ) : (
                      <ChevronDown className="w-3 h-3" />
                    )}
                  </button>
                  {error.retryAction && error.status !== "retrying" && (
                    <button
                      onClick={() => handleRetry(error)}
                      disabled={error.retryCount >= error.maxRetries}
                      className="p-1 rounded hover:bg-muted disabled:opacity-30"
                      aria-label="Erneut versuchen"
                    >
                      <RefreshCw className="w-3 h-3" />
                    </button>
                  )}
                  <button
                    onClick={() => onDismiss?.(error.id)}
                    className="p-1 rounded hover:bg-muted"
                    aria-label="Verwerfen"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              </div>
            </div>
          ))}

          {/* Clear resolved */}
          {resolvedCount > 0 && onClearResolved && (
            <button
              onClick={onClearResolved}
              className="w-full px-3 py-2 text-xs text-center text-green-600 hover:bg-green-50 dark:hover:bg-green-950/20 transition-colors"
            >
              <Check className="w-3 h-3 inline mr-1" />
              {resolvedCount} behobene Fehler entfernen
            </button>
          )}
        </div>
      )}
    </div>
  );
});
