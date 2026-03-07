/**
 * Voice/Calling-Integration: einheitliche Schnittstelle für Anrufe.
 * Aktuell: Tel-Provider (tel:-Link). Später: Twilio, Vonage o. ä. einfach einbindbar.
 *
 * Konfiguration: VITE_VOICE_PROVIDER=tel (Standard) | twilio | vonage
 * Für Twilio/Vonage: Backend-URL und ggf. API-Keys über Env (siehe docs/VOICE_CALLING.md).
 */
import type { VoiceProvider, StartCallOptions, StartCallResult } from "./types";
import { telVoiceProvider } from "./telProvider";
import { twilioVoiceProvider } from "./twilioProvider.stub";
import { twilioDeviceVoiceProvider } from "./twilioDeviceProvider";

export type { VoiceProvider, StartCallOptions, StartCallResult, CallContext } from "./types";
export { getActiveCall, subscribeActiveCall } from "./voiceCallState";
export type { ActiveCallInfo } from "./voiceCallState";

const PROVIDER_REGISTRY: Map<string, VoiceProvider> = new Map([
  [telVoiceProvider.id, telVoiceProvider],
  [twilioVoiceProvider.id, twilioVoiceProvider],
  [twilioDeviceVoiceProvider.id, twilioDeviceVoiceProvider],
]);

function getProviderId(): string {
  const raw = typeof import.meta !== "undefined" && import.meta.env?.VITE_VOICE_PROVIDER;
  if (typeof raw === "string" && raw.trim()) {
    return raw.trim().toLowerCase();
  }
  return "tel";
}

/** Aktiven Voice-Provider liefern (für startCall, getCallUrl). */
export function getVoiceProvider(): VoiceProvider {
  const id = getProviderId();
  const provider = PROVIDER_REGISTRY.get(id);
  return provider ?? telVoiceProvider;
}

/** Anruf starten – nutzt den konfigurierten Provider. */
export async function startCall(options: StartCallOptions): Promise<StartCallResult> {
  return getVoiceProvider().startCall(options);
}

/** Telefon-URL für Links (z. B. <a href={getCallUrl(phone)}>). Beim tel-Provider: tel:…; bei VoIP oft leer oder Fallback. */
export function getCallUrl(phone: string): string {
  const provider = getVoiceProvider();
  if (provider.getCallUrl) {
    return provider.getCallUrl(phone);
  }
  return `tel:${phone.replace(/\s/g, "").trim()}`;
}

/** Neuen Provider registrieren (z. B. nach dem Einbinden von Twilio). */
export function registerVoiceProvider(provider: VoiceProvider): void {
  PROVIDER_REGISTRY.set(provider.id, provider);
}
