/**
 * Hook für Voice/Calling: Anruf starten und Call-URL.
 * Nutzt die konfigurierte Voice-Integration (tel, später Twilio/Vonage).
 */
import { useCallback } from "react";
import { startCall as startCallApi, getCallUrl as getCallUrlApi, getVoiceProvider } from "@/integrations/voice";
import type { StartCallOptions, CallContext } from "@/integrations/voice/types";

export function useVoiceCall() {
  const provider = getVoiceProvider();

  const startCall = useCallback(
    (to: string, context?: CallContext) =>
      startCallApi({ to, context }),
    []
  );

  const getCallUrl = useCallback((phone: string) => getCallUrlApi(phone), []);

  return {
    startCall,
    getCallUrl,
    providerId: provider.id,
    providerName: provider.name,
    supportsRecording: provider.supportsRecording,
  };
}
