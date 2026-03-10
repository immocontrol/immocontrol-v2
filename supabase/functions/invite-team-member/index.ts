/**
 * Supabase Edge Function: Team-Einladung per E-Mail
 *
 * Verwendet auth.admin.inviteUserByEmail für neue Nutzer (Supabase sendet E-Mail).
 * Für bestehende Nutzer: direkt zum Team hinzufügen.
 *
 * Benötigt: SUPABASE_SERVICE_ROLE_KEY (automatisch in Edge Functions)
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
    if (!authHeader) return json({ error: "Nicht authentifiziert" }, 401);

    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) return json({ error: "Nicht authentifiziert" }, 401);

    const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const body = (await req.json()) as {
      email?: string;
      role?: string;
      shared_resources?: string[];
      redirect_origin?: string;
    };
    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    const redirectOrigin = typeof body.redirect_origin === "string" ? body.redirect_origin : "";
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return json({ error: "Ungültige E-Mail-Adresse" }, 400);
    }
    const redirectTo = redirectOrigin
      ? `${redirectOrigin}/einladung`
      : `${SUPABASE_URL.replace(".supabase.co", "")}.supabase.co/auth/v1/verify`;

    /* Pending team_members row: owner_id = current user, member_email = email */
    const { data: pendingRows, error: selectErr } = await adminClient
      .from("team_members")
      .select("id")
      .eq("owner_id", user.id)
      .eq("member_email", email)
      .eq("status", "pending")
      .order("created_at", { ascending: false })
      .limit(1);

    if (selectErr) return json({ error: "DB-Fehler: " + selectErr.message }, 500);
    const row = pendingRows?.[0];
    if (!row) return json({ error: "Keine ausstehende Einladung für diese E-Mail. Bitte erneut einladen." }, 400);

    const token = crypto.randomUUID();
    const { error: updateErr } = await adminClient
      .from("team_members")
      .update({
        invitation_token: token,
        updated_at: new Date().toISOString(),
      })
      .eq("id", row.id);

    if (updateErr) return json({ error: "Fehler beim Speichern des Tokens" }, 500);

    const redirectUrl = redirectOrigin ? `${redirectOrigin}/einladung?token=${token}` : undefined;

    const { data: inviteData, error: inviteErr } = await adminClient.auth.admin.inviteUserByEmail(email, {
      redirectTo: redirectUrl,
      data: { role: body.role ?? "viewer", shared_resources: body.shared_resources ?? [] },
    });

    if (inviteErr) {
      const msg = inviteErr.message ?? "";
      if (msg.toLowerCase().includes("already") || msg.toLowerCase().includes("registered") || inviteErr.status === 422) {
        /* User exists — add directly to team instead of sending invite */
        const { data: existingUsers } = await adminClient.auth.admin.listUsers({ page: 1, perPage: 1000 });
        const existing = existingUsers?.users?.find((u) => u.email?.toLowerCase() === email);
        if (existing) {
          const { error: acceptErr } = await adminClient
            .from("team_members")
            .update({
              member_user_id: existing.id,
              status: "accepted",
              invitation_token: null,
              updated_at: new Date().toISOString(),
            })
            .eq("id", row.id);
          if (!acceptErr) {
            return json({ success: true, added_directly: true, message: "Mitglied existiert bereits und wurde zum Team hinzugefügt." });
          }
        }
      }
      return json({ error: inviteErr.message ?? "Einladungs-E-Mail konnte nicht gesendet werden" }, 400);
    }

    return json({
      success: true,
      email_sent: true,
      message: inviteData?.user ? "Einladung per E-Mail gesendet" : "Einladung erstellt",
    });
  } catch (e) {
    console.error("invite-team-member error:", e);
    return json({ error: e instanceof Error ? e.message : "Unbekannter Fehler" }, 500);
  }
});
