/**
 * Twilio Voice Device Provider: Anrufe direkt aus dem Browser (WebRTC).
 * Nutzt @twilio/voice-sdk: Token von Edge Function voice-token, dann Device.connect().
 * Erfordert: VITE_VOICE_PROVIDER=twilio-device und konfigurierte Twilio-TwiML-App
 * (Voice Request URL → Edge Function voice-twiml).
 */
import { Device, Call } from "@twilio/voice-sdk";
import type { VoiceProvider, StartCallOptions, StartCallResult } from "./types";
import { setActiveCall } from "./voiceCallState";
import { supabase } from "@/integrations/supabase/client";

async function getToken(): Promise<string> {
  const { data, error } = await supabase.functions.invoke("voice-token");
  if (error) throw new Error(error.message || "Token konnte nicht geladen werden.");
  if (!data?.token) throw new Error("Kein Voice-Token erhalten.");
  return data.token as string;
}

export const twilioDeviceVoiceProvider: VoiceProvider = {
  id: "twilio-device",
  name: "Anruf aus der App",
  supportsRecording: true,

  async startCall(options: StartCallOptions): Promise<StartCallResult> {
    const to = options.to.replace(/\s/g, "").trim();
    if (!to) return { ok: false, method: "voip", error: "Keine Nummer angegeben." };

    try {
      const token = await getToken();
      const device = new Device(token);

      const cleanup = () => {
        setActiveCall(null);
        try {
          device.destroy();
        } catch {
          // ignore
        }
      };

      const call = await device.register().then(() =>
        device.connect({
          params: {
            To: to,
            Record: options.context?.record ? "true" : "false",
          },
        })
      );

      call.on("disconnect", cleanup);
      call.on("error", () => cleanup());

      setActiveCall({
        to,
        toLabel: options.context?.toLabel,
        callId: call.parameters?.CallSid,
        hangup: () => {
          call.disconnect();
          cleanup();
        },
      });

      return {
        ok: true,
        method: "voip",
        callId: call.parameters?.CallSid,
      };
    } catch (e) {
      setActiveCall(null);
      return {
        ok: false,
        method: "voip",
        error: e instanceof Error ? e.message : "Anruf fehlgeschlagen",
      };
    }
  },
};
