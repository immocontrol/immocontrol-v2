/**
 * Supabase Edge Function: Einladung annehmen
 *
 * Validiert den Einladungs-Token und aktualisiert team_members:
 * member_user_id = eingeloggter Nutzer, status = accepted.
 *
 * Benötigt: Nutzer muss eingeloggt sein (JWT) und E-Mail muss zu member_email passen.
 */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ success: false, error: "Nicht authentifiziert" }, 401);

    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) return json({ success: false, error: "Nicht authentifiziert" }, 401);

    const body = (await req.json()) as { token?: string };
    const token = typeof body.token === "string" ? body.token.trim() : "";
    if (!token) return json({ success: false, error: "Token fehlt" }, 400);

    const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const { data: rows, error: selectErr } = await adminClient
      .from("team_members")
      .select("id, member_email, status")
      .eq("invitation_token", token)
      .eq("status", "pending")
      .limit(1);

    if (selectErr) return json({ success: false, error: "DB-Fehler: " + selectErr.message }, 500);
    const row = rows?.[0];
    if (!row) return json({ success: false, error: "Ungültiger oder abgelaufener Einladungslink" }, 404);

    const userEmail = (user.email ?? "").trim().toLowerCase();
    const memberEmail = (row.member_email ?? "").trim().toLowerCase();
    if (userEmail !== memberEmail) {
      return json({
        success: false,
        error: `Diese Einladung gilt für ${memberEmail}. Du bist als ${userEmail} angemeldet.`,
      }, 403);
    }

    const { error: updateErr } = await adminClient
      .from("team_members")
      .update({
        member_user_id: user.id,
        status: "accepted",
        invitation_token: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", row.id);

    if (updateErr) return json({ success: false, error: "Fehler beim Annehmen: " + updateErr.message }, 500);

    return json({
      success: true,
      message: "Einladung angenommen. Du bist jetzt Teil des Teams.",
    });
  } catch (e) {
    console.error("accept-invitation error:", e);
    return json({ success: false, error: e instanceof Error ? e.message : "Unbekannter Fehler" }, 500);
  }
});
