/**
 * MOB2-11: Mobile Offline-Formulare
 * Forms that work offline and auto-sync on reconnect.
 * Uses localStorage to persist form drafts and queues submissions.
 */
import { memo, useState, useCallback, useEffect, useRef } from "react";
import { WifiOff, CloudUpload, Check, Save } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";
import { useHaptic } from "@/hooks/useHaptic";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const DRAFT_PREFIX = "immo-form-draft-";
const OFFLINE_SUBMIT_KEY = "immo-offline-submissions";

interface OfflineSubmission {
  id: string;
  formId: string;
  data: Record<string, unknown>;
  timestamp: number;
}

interface MobileOfflineFormProps {
  /** Unique form identifier for draft persistence */
  formId: string;
  /** Called on submit (online or after sync) */
  onSubmit: (data: Record<string, unknown>) => Promise<void>;
  /** Form content — receives draft data and setter */
  children: (props: {
    data: Record<string, unknown>;
    setField: (key: string, value: unknown) => void;
    isOffline: boolean;
    hasDraft: boolean;
  }) => React.ReactNode;
  /** Initial form data */
  initialData?: Record<string, unknown>;
  className?: string;
}

function loadDraft(formId: string): Record<string, unknown> | null {
  try {
    const stored = localStorage.getItem(DRAFT_PREFIX + formId);
    return stored ? JSON.parse(stored) : null;
  } catch { return null; }
}

function saveDraft(formId: string, data: Record<string, unknown>) {
  try { localStorage.setItem(DRAFT_PREFIX + formId, JSON.stringify(data)); }
  catch { /* silently fail */ }
}

function clearDraft(formId: string) {
  try { localStorage.removeItem(DRAFT_PREFIX + formId); }
  catch { /* silently fail */ }
}

function loadOfflineSubmissions(): OfflineSubmission[] {
  try {
    const stored = localStorage.getItem(OFFLINE_SUBMIT_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch { return []; }
}

function saveOfflineSubmission(submission: OfflineSubmission) {
  try {
    const existing = loadOfflineSubmissions();
    existing.push(submission);
    localStorage.setItem(OFFLINE_SUBMIT_KEY, JSON.stringify(existing));
  } catch { /* silently fail */ }
}

export const MobileOfflineForm = memo(function MobileOfflineForm({
  formId, onSubmit, children, initialData = {}, className,
}: MobileOfflineFormProps) {
  const isMobile = useIsMobile();
  const haptic = useHaptic();
  const [data, setData] = useState<Record<string, unknown>>(() => loadDraft(formId) ?? initialData);
  const [isOnline, setIsOnline] = useState(typeof navigator !== "undefined" ? navigator.onLine : true);
  const [submitting, setSubmitting] = useState(false);
  const hasDraft = loadDraft(formId) !== null;
  const autoSaveTimer = useRef<ReturnType<typeof setTimeout>>();

  // Track online status
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  // Auto-sync offline submissions when back online
  useEffect(() => {
    if (!isOnline) return;
    const submissions = loadOfflineSubmissions();
    if (submissions.length === 0) return;

    const syncAll = async () => {
      let synced = 0;
      for (const sub of submissions) {
        try {
          await onSubmit(sub.data);
          synced++;
        } catch { /* skip failed */ }
      }
      if (synced > 0) {
        localStorage.setItem(OFFLINE_SUBMIT_KEY, JSON.stringify([]));
        toast.success(`${synced} Offline-${synced === 1 ? "Formular" : "Formulare"} synchronisiert`);
        haptic.success();
      }
    };
    syncAll();
  }, [isOnline, onSubmit, haptic]);

  const setField = useCallback((key: string, value: unknown) => {
    setData(prev => {
      const next = { ...prev, [key]: value };
      // Debounced auto-save draft
      if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
      autoSaveTimer.current = setTimeout(() => saveDraft(formId, next), 500);
      return next;
    });
  }, [formId]);

  const handleSubmit = useCallback(async () => {
    setSubmitting(true);
    haptic.tap();

    if (!isOnline) {
      // Queue for later sync
      saveOfflineSubmission({
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        formId,
        data,
        timestamp: Date.now(),
      });
      clearDraft(formId);
      haptic.medium();
      toast.info("Offline gespeichert — wird bei Verbindung synchronisiert");
      setSubmitting(false);
      return;
    }

    try {
      await onSubmit(data);
      clearDraft(formId);
      haptic.success();
      toast.success("Gespeichert");
    } catch {
      haptic.error();
      toast.error("Fehler beim Speichern");
    } finally {
      setSubmitting(false);
    }
  }, [isOnline, data, formId, onSubmit, haptic]);

  return (
    <div className={cn("space-y-3", className)}>
      {/* Offline indicator */}
      {!isOnline && isMobile && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-amber-500/10 border border-amber-500/20 text-xs text-amber-600 dark:text-amber-400">
          <WifiOff className="h-3.5 w-3.5 shrink-0" />
          <span>Offline-Modus — Änderungen werden bei Verbindung synchronisiert</span>
        </div>
      )}

      {/* Draft indicator */}
      {hasDraft && isMobile && (
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-blue-500/10 text-xs text-blue-600 dark:text-blue-400">
          <Save className="h-3 w-3" />
          <span>Entwurf wiederhergestellt</span>
          <button
            onClick={() => { clearDraft(formId); setData(initialData); }}
            className="ml-auto text-[10px] underline"
          >
            Verwerfen
          </button>
        </div>
      )}

      {/* Form content */}
      {children({ data, setField, isOffline: !isOnline, hasDraft })}

      {/* Submit button */}
      <button
        onClick={handleSubmit}
        disabled={submitting}
        className={cn(
          "w-full py-3 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 transition-all active:scale-[0.98]",
          isOnline
            ? "bg-primary text-primary-foreground"
            : "bg-amber-500 text-white",
        )}
      >
        {submitting ? (
          <CloudUpload className="h-4 w-4 animate-pulse" />
        ) : isOnline ? (
          <Check className="h-4 w-4" />
        ) : (
          <WifiOff className="h-4 w-4" />
        )}
        {submitting ? "Speichere..." : isOnline ? "Speichern" : "Offline speichern"}
      </button>
    </div>
  );
});
