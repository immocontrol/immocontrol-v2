/**
 * Twilio Voice Provider (Stub).
 * Zum Aktivieren: Twilio-Provider implementieren und in index.ts registrieren.
 * Backend (Supabase Edge Function oder eigener Server) startet den Anruf via Twilio API,
 * Frontend ruft z. B. POST /api/voice/start mit { to, leadId, record } auf.
 *
 * Env: VITE_VOICE_PROVIDER=twilio, VITE_VOICE_API_URL=https://… (Backend-URL)
 */
import type { VoiceProvider, StartCallOptions, StartCallResult } from "./types";

const API_URL =
  (typeof import.meta !== "undefined" && (import.meta.env?.VITE_VOICE_API_URL as string)) || "";

export const twilioVoiceProvider: VoiceProvider = {
  id: "twilio",
  name: "Twilio",
  supportsRecording: true,

  async startCall(options: StartCallOptions): Promise<StartCallResult> {
    if (!API_URL) {
      return { ok: false, method: "voip", error: "VITE_VOICE_API_URL nicht gesetzt." };
    }
    try {
      const res = await fetch(`${API_URL.replace(/\/$/, "")}/voice/start`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: options.to.replace(/\s/g, ""),
          leadId: options.context?.leadId,
          contactId: options.context?.contactId,
          record: options.context?.record ?? false,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        return {
          ok: false,
          method: "voip",
          error: (err as { message?: string }).message || res.statusText,
        };
      }
      const data = (await res.json()) as { callId?: string };
      return { ok: true, method: "voip", callId: data.callId };
    } catch (e) {
      return {
        ok: false,
        method: "voip",
        error: e instanceof Error ? e.message : "Anruf fehlgeschlagen",
      };
    }
  },
};
