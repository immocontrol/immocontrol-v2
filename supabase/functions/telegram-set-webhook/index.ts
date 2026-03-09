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
      bot_token?: string;
      chat_title_includes?: string;
      allowed_chat_id?: number;
      disable?: boolean;
      update_manus_only?: boolean;
      manus_replies_enabled?: boolean;
      manus_api_key?: string;
    };

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    if (body.update_manus_only) {
      const { data: existing } = await supabaseAdmin
        .from("telegram_webhook_config")
        .select("id")
        .eq("user_id", user.id)
        .single();
      if (!existing) {
        return new Response(JSON.stringify({ error: "Zuerst Webhook aktivieren." }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      await supabaseAdmin.from("telegram_webhook_config").update({
        manus_replies_enabled: !!body.manus_replies_enabled,
        manus_api_key: body.manus_replies_enabled && body.manus_api_key ? String(body.manus_api_key).trim() : null,
        updated_at: new Date().toISOString(),
      }).eq("user_id", user.id);
      return new Response(JSON.stringify({
        success: true,
        message: body.manus_replies_enabled ? "Manus-Antworten aktiviert." : "Manus-Antworten deaktiviert.",
      }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (body.disable) {
      const { data: config } = await supabaseAdmin
        .from("telegram_webhook_config")
        .select("bot_token")
        .eq("user_id", user.id)
        .single();
      if (config?.bot_token) {
        await fetch(`https://api.telegram.org/bot${config.bot_token}/setWebhook`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url: "" }),
        });
      }
      await supabaseAdmin.from("telegram_webhook_config").delete().eq("user_id", user.id);
      return new Response(JSON.stringify({
        success: true,
        message: "Webhook deaktiviert.",
      }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { bot_token, chat_title_includes, allowed_chat_id, manus_replies_enabled: manusEnabled, manus_api_key: manusKey } = body;
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
    await supabaseAdmin.from("telegram_webhook_config").upsert({
      user_id: user.id,
      webhook_secret: webhookSecret,
      bot_token,
      chat_title_includes: chat_title_includes || null,
      allowed_chat_id: allowed_chat_id ?? null,
      manus_replies_enabled: !!manusEnabled,
      manus_api_key: manusEnabled && manusKey ? String(manusKey).trim() : null,
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
