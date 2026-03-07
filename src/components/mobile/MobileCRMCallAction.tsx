/**
 * MOB3-18: Mobile CRM Call Quick-Action
 * One-tap call button on CRM leads with automatic call-log dialog after call ends.
 * Uses Voice-Integration (tel: oder Twilio/Vonage); Timer und Log unverändert.
 */
import { memo, useState, useCallback, useRef, useEffect } from "react";
import { Phone, PhoneOff, Clock, MessageSquare, Save } from "lucide-react";
import { useHaptic } from "@/hooks/useHaptic";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { startCall } from "@/integrations/voice";

interface MobileCRMCallActionProps {
  /** Phone number to call */
  phoneNumber: string;
  /** Contact name */
  contactName: string;
  /** Optional lead ID for recording/context when using VoIP provider */
  leadId?: string;
  /** Called when call log is saved */
  onSaveLog?: (log: CallLog) => void;
  className?: string;
}

export interface CallLog {
  contactName: string;
  phoneNumber: string;
  startedAt: string;
  duration: number; // seconds
  notes: string;
  outcome: "reached" | "voicemail" | "no_answer" | "busy";
}

export const MobileCRMCallAction = memo(function MobileCRMCallAction({
  phoneNumber, contactName, leadId, onSaveLog, className,
}: MobileCRMCallActionProps) {
  const haptic = useHaptic();
  const [calling, setCalling] = useState(false);
  const [showLogDialog, setShowLogDialog] = useState(false);
  const [callDuration, setCallDuration] = useState(0);
  const [notes, setNotes] = useState("");
  const [outcome, setOutcome] = useState<CallLog["outcome"]>("reached");
  const startTimeRef = useRef<number>(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Clean up timer on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  const handleStartCall = useCallback(async () => {
    haptic.medium();
    setCalling(true);
    startTimeRef.current = Date.now();

    timerRef.current = setInterval(() => {
      setCallDuration(Math.floor((Date.now() - startTimeRef.current) / 1000));
    }, 1000);

    const result = await startCall({
      to: phoneNumber.replace(/\s/g, ""),
      context: leadId != null ? { leadId, record: true, toLabel: contactName } : undefined,
    });
    if (!result?.ok && result?.error) {
      toast.error(result.error);
      setCalling(false);
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }
  }, [haptic, phoneNumber, leadId, contactName]);

  const endCall = useCallback(() => {
    haptic.tap();
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    setCalling(false);
    setShowLogDialog(true);
  }, [haptic]);

  const formatDuration = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  const saveLog = useCallback(() => {
    const log: CallLog = {
      contactName,
      phoneNumber,
      startedAt: new Date(startTimeRef.current).toISOString(),
      duration: callDuration,
      notes: notes.trim(),
      outcome,
    };
    onSaveLog?.(log);
    haptic.success();
    toast.success("Anruf-Protokoll gespeichert");
    setShowLogDialog(false);
    setNotes("");
    setCallDuration(0);
  }, [contactName, phoneNumber, callDuration, notes, outcome, onSaveLog, haptic]);

  const OUTCOMES: { value: CallLog["outcome"]; label: string }[] = [
    { value: "reached", label: "Erreicht" },
    { value: "voicemail", label: "Mailbox" },
    { value: "no_answer", label: "Keine Antwort" },
    { value: "busy", label: "Besetzt" },
  ];

  return (
    <>
      {/* Call button */}
      {!calling ? (
        <button
          onClick={handleStartCall}
          className={cn(
            "flex items-center gap-2 px-3 py-2 rounded-lg bg-emerald-500/15 text-emerald-600",
            "text-xs font-medium transition-all active:scale-95",
            className,
          )}
          aria-label={`${contactName} anrufen`}
        >
          <Phone className="h-4 w-4" />
          Anrufen
        </button>
      ) : (
        <button
          onClick={endCall}
          className={cn(
            "flex items-center gap-2 px-3 py-2 rounded-lg bg-red-500/15 text-red-600",
            "text-xs font-medium transition-all active:scale-95 animate-pulse",
            className,
          )}
          aria-label="Anruf beenden"
        >
          <PhoneOff className="h-4 w-4" />
          <Clock className="h-3 w-3" />
          {formatDuration(callDuration)}
        </button>
      )}

      {/* Post-call log dialog */}
      {showLogDialog && (
        <>
          <div className="fixed inset-0 z-[300] bg-black/40" onClick={() => setShowLogDialog(false)} />
          <div
            className="fixed z-[310] left-2 right-2 bg-background rounded-2xl border border-border shadow-2xl p-4 space-y-3 animate-slide-up"
            style={{
              bottom: "max(1rem, env(safe-area-inset-bottom, 0px))",
            }}
            role="dialog"
            aria-label="Anruf-Protokoll"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold">Anruf-Protokoll</h3>
              <span className="text-xs text-muted-foreground flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {formatDuration(callDuration)}
              </span>
            </div>

            <p className="text-xs text-muted-foreground">
              {contactName} — {phoneNumber}
            </p>

            {/* Outcome */}
            <div>
              <p className="text-[10px] text-muted-foreground mb-1.5">Ergebnis</p>
              <div className="flex flex-wrap gap-1.5">
                {OUTCOMES.map((o) => (
                  <button
                    key={o.value}
                    onClick={() => setOutcome(o.value)}
                    className={cn(
                      "px-2.5 py-1 rounded-full text-[11px] font-medium transition-all",
                      outcome === o.value
                        ? "bg-primary/15 text-primary ring-1 ring-primary/30"
                        : "bg-secondary text-muted-foreground",
                    )}
                  >
                    {o.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Notes */}
            <div>
              <p className="text-[10px] text-muted-foreground mb-1.5 flex items-center gap-1">
                <MessageSquare className="h-3 w-3" /> Notizen
              </p>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Gesprächsnotizen..."
                className="w-full h-20 px-3 py-2 text-sm border border-border rounded-lg bg-background resize-none focus:outline-none focus:ring-2 focus:ring-primary/30"
                /* Safari: prevent zoom on focus */
                style={{ fontSize: "16px" }}
              />
            </div>

            {/* Actions */}
            <div className="flex gap-2">
              <button
                onClick={() => setShowLogDialog(false)}
                className="flex-1 py-2 rounded-lg bg-secondary text-sm font-medium transition-all active:scale-95"
              >
                Abbrechen
              </button>
              <button
                onClick={saveLog}
                className="flex-1 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium flex items-center justify-center gap-1.5 transition-all active:scale-95"
              >
                <Save className="h-3.5 w-3.5" />
                Speichern
              </button>
            </div>
          </div>
        </>
      )}
    </>
  );
});
