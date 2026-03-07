/**
 * Zeigt einen aktiven VoIP-Anruf (z. B. Twilio Device) mit Auflegen-Button.
 * Erscheint nur, wenn getActiveCall() nicht null ist.
 */
import { useState, useEffect } from "react";
import { PhoneOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getActiveCall, subscribeActiveCall } from "@/integrations/voice";
import { cn } from "@/lib/utils";

export function ActiveCallBar() {
  const [activeCall, setActiveCall] = useState(getActiveCall());

  useEffect(() => {
    setActiveCall(getActiveCall());
    return subscribeActiveCall(() => setActiveCall(getActiveCall()));
  }, []);

  if (!activeCall) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        "fixed left-0 right-0 z-[190] flex items-center justify-between gap-3 px-4 py-2.5",
        "bg-primary/95 text-primary-foreground backdrop-blur",
        "border-b border-primary/30",
        "safe-area-top",
        "md:left-auto md:right-4 md:top-4 md:bottom-auto md:w-[320px] md:rounded-xl md:border md:shadow-lg"
      )}
    >
      <div className="min-w-0 flex-1">
        <p className="text-xs font-medium opacity-90">Im Gespräch</p>
        <p className="truncate text-sm font-medium" title={activeCall.to}>
          {activeCall.toLabel || activeCall.to}
        </p>
      </div>
      <Button
        variant="secondary"
        size="sm"
        className="shrink-0 bg-background/20 hover:bg-destructive hover:text-destructive-foreground"
        onClick={activeCall.hangup}
        aria-label="Auflegen"
      >
        <PhoneOff className="h-4 w-4 mr-1" />
        Auflegen
      </Button>
    </div>
  );
}
