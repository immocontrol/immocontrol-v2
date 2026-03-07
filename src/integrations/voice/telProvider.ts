/**
 * Standard-Provider: Öffnet den nativen Wähler (tel:-Link).
 * Keine Aufzeichnung, keine Backend-Anbindung. Später durch Twilio/Vonage ersetzbar.
 */
import type { VoiceProvider, StartCallOptions, StartCallResult } from "./types";

function normalizePhone(phone: string): string {
  return phone.replace(/\s/g, "").trim();
}

export const telVoiceProvider: VoiceProvider = {
  id: "tel",
  name: "Telefon (Gerät)",
  supportsRecording: false,

  startCall(options: StartCallOptions): Promise<StartCallResult> {
    const num = normalizePhone(options.to);
    if (!num) {
      return Promise.resolve({ ok: false, method: "tel", error: "Keine Nummer angegeben." });
    }
    const url = `tel:${num}`;
    if (typeof window !== "undefined") {
      window.location.href = url;
    }
    return Promise.resolve({ ok: true, method: "tel" });
  },

  getCallUrl(phone: string): string {
    return `tel:${normalizePhone(phone)}`;
  },
};
