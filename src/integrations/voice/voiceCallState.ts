/**
 * Aktiver VoIP-Anruf (z. B. Twilio Device) für UI: Anzeige „Im Gespräch“ und Auflegen.
 * Wird von Providern gesetzt/geleert; Komponenten abonnieren über subscribeActiveCall.
 */
export interface ActiveCallInfo {
  to: string;
  toLabel?: string;
  callId?: string;
  hangup: () => void;
}

let activeCall: ActiveCallInfo | null = null;
const listeners = new Set<() => void>();

export function getActiveCall(): ActiveCallInfo | null {
  return activeCall;
}

export function subscribeActiveCall(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function setActiveCall(call: ActiveCallInfo | null): void {
  activeCall = call;
  listeners.forEach((l) => l());
}
