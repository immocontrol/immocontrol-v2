/**
 * Telegram Set Webhook — enables server-side deal import from ImmoMetrica channel.
 * Client calls with auth; registers webhook URL with Telegram for the user's bot.
 */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Nicht authentifiziert" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Nicht authentifiziert" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = (await req.json()) as {
      bot_token: string;
      chat_title_includes?: string;
      allowed_chat_id?: number;
    };

    const { bot_token, chat_title_includes, allowed_chat_id } = body;
    if (!bot_token || typeof bot_token !== "string" || bot_token.length < 20) {
      return new Response(JSON.stringify({ error: "Ungültiger Bot-Token" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const webhookSecret = crypto.randomUUID();
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const webhookUrl = `${supabaseUrl}/functions/v1/telegram-webhook?secret=${webhookSecret}`;

    // Verify bot token
    const meRes = await fetch(`https://api.telegram.org/bot${bot_token}/getMe`);
    const meData = await meRes.json();
    if (!meData.ok) {
      return new Response(JSON.stringify({ error: "Bot-Token ungültig oder abgelaufen" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Set webhook with Telegram
    const setRes = await fetch(`https://api.telegram.org/bot${bot_token}/setWebhook`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: webhookUrl }),
    });
    const setData = await setRes.json();
    if (!setData.ok) {
      return new Response(JSON.stringify({
        error: "Webhook konnte nicht gesetzt werden",
        details: setData.description,
      }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Upsert config
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    await supabaseAdmin.from("telegram_webhook_config").upsert({
      user_id: user.id,
      webhook_secret: webhookSecret,
      bot_token,
      chat_title_includes: chat_title_includes || null,
      allowed_chat_id: allowed_chat_id ?? null,
      updated_at: new Date().toISOString(),
    }, {
      onConflict: "user_id",
    });

    return new Response(JSON.stringify({
      success: true,
      message: "Webhook aktiviert. Deals aus deinem ImmoMetrica Kanal landen jetzt automatisch in ImmoControl.",
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("telegram-set-webhook error:", e);
    return new Response(JSON.stringify({ error: "Interner Fehler" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
