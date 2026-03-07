/**
 * Liefert TwiML für ausgehende Anrufe (Browser → Twilio → diese URL → Dial zur Zielnummer).
 * Die TwiML-App in Twilio muss mit der Voice Request URL auf diese Function zeigen
 * (z. B. https://<project>.supabase.co/functions/v1/voice-twiml).
 * Query: To (Zielnummer, E.164), optional Record=true für Aufzeichnung.
 */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const to = url.searchParams.get("To")?.trim();
    const record = url.searchParams.get("Record") === "true" || url.searchParams.get("record") === "true";

    if (!to) {
      return new Response(
        '<?xml version="1.0" encoding="UTF-8"?><Response><Say language="de-DE">Zielnummer fehlt.</Say><Hangup/></Response>',
        { status: 200, headers: { "Content-Type": "application/xml" } }
      );
    }

    const dialAttrs = record ? ' record="record-from-answer"' : "";
    const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Dial${dialAttrs}>
    <Number>${escapeXml(to)}</Number>
  </Dial>
</Response>`;

    return new Response(twiml, {
      status: 200,
      headers: { "Content-Type": "application/xml" },
    });
  } catch (e) {
    console.error("voice-twiml error:", e);
    return new Response(
      '<?xml version="1.0" encoding="UTF-8"?><Response><Say language="de-DE">Fehler.</Say><Hangup/></Response>',
      { status: 500, headers: { "Content-Type": "application/xml" } }
    );
  }
});

function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}
