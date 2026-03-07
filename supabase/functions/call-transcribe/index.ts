/**
 * Transkription einer Anruf-Aufnahme (Whisper API).
 * Body: { recording_url: string, call_log_id: string }
 * Lädt die Audio-Datei von recording_url, sendet sie an OpenAI Whisper, schreibt das Transkript in crm_call_logs.
 * Env: OPENAI_API_KEY (für Whisper)
 */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const WHISPER_URL = "https://api.openai.com/v1/audio/transcriptions";

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
    if (!OPENAI_API_KEY) {
      return new Response(
        JSON.stringify({ error: "OPENAI_API_KEY ist nicht konfiguriert." }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Nicht authentifiziert" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Nicht authentifiziert" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = (await req.json()) as { recording_url?: string; call_log_id?: string };
    const recording_url = body?.recording_url?.trim();
    const call_log_id = body?.call_log_id;

    if (!recording_url) {
      return new Response(JSON.stringify({ error: "recording_url fehlt" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Audio von URL laden (Twilio etc. liefern oft .mp3 oder .wav)
    const audioRes = await fetch(recording_url, {
      headers: { "User-Agent": "ImmoControl-Call-Transcribe/1.0" },
    });
    if (!audioRes.ok) {
      return new Response(
        JSON.stringify({ error: `Aufnahme konnte nicht geladen werden: ${audioRes.status}` }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const contentType = audioRes.headers.get("content-type") || "";
    const ext = contentType.includes("wav") ? "wav" : contentType.includes("ogg") ? "ogg" : "mp3";
    const blob = await audioRes.blob();

    const form = new FormData();
    form.append("file", blob, `audio.${ext}`);
    form.append("model", "whisper-1");
    form.append("language", "de");

    const whisperRes = await fetch(WHISPER_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${OPENAI_API_KEY}` },
      body: form,
    });

    if (!whisperRes.ok) {
      const errText = await whisperRes.text();
      console.error("Whisper API error:", whisperRes.status, errText);
      return new Response(
        JSON.stringify({
          error: whisperRes.status === 429
            ? "Transkriptions-Kontingent überschritten. Bitte später erneut versuchen."
            : `Transkription fehlgeschlagen: ${whisperRes.status}`,
        }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const whisperData = (await whisperRes.json()) as { text?: string };
    const transcript = typeof whisperData?.text === "string" ? whisperData.text.trim() : "";

    if (call_log_id && transcript) {
      const { error: updateError } = await supabase
        .from("crm_call_logs")
        .update({ transcript })
        .eq("id", call_log_id);
      if (updateError) {
        console.error("Update crm_call_logs:", updateError);
        return new Response(
          JSON.stringify({ error: "Transkript konnte nicht gespeichert werden.", transcript }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    return new Response(JSON.stringify({ transcript }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("call-transcribe error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unbekannter Fehler" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
