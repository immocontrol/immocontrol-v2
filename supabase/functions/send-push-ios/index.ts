/**
 * send-push-ios — APNs-Push an iOS-Geräte (device_tokens).
 * Für wichtige Benachrichtigungen inkl. Apple Watch: interruption-level = time-sensitive.
 *
 * Secrets in Supabase: APPLE_TEAM_ID, APPLE_KEY_ID, APPLE_P8_KEY (Inhalt der .p8-Datei), optional APPLE_BUNDLE_ID.
 * Aufruf: POST mit Authorization: Bearer <user JWT>, Body: { payload?: { title, body, url? } }
 */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import * as jose from "https://deno.land/x/jose@v5.2.0/index.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const APPLE_TEAM_ID = Deno.env.get("APPLE_TEAM_ID");
const APPLE_KEY_ID = Deno.env.get("APPLE_KEY_ID");
const APPLE_P8_KEY = Deno.env.get("APPLE_P8_KEY");
const APPLE_BUNDLE_ID = Deno.env.get("APPLE_BUNDLE_ID") ?? "com.immocontrol.app";
const APNS_HOST = "api.push.apple.com";

interface PushPayload {
  title: string;
  body: string;
  url?: string;
}

interface RequestBody {
  user_id?: string;
  payload?: PushPayload;
}

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  };
}

async function getApnsToken(): Promise<string> {
  if (!APPLE_TEAM_ID || !APPLE_KEY_ID || !APPLE_P8_KEY) {
    throw new Error("APPLE_TEAM_ID, APPLE_KEY_ID, APPLE_P8_KEY must be set in Supabase secrets.");
  }
  const key = await jose.importPKCS8(APPLE_P8_KEY.trim(), "ES256");
  const jwt = await new jose.SignJWT({})
    .setProtectedHeader({ alg: "ES256", kid: APPLE_KEY_ID })
    .setIssuer(APPLE_TEAM_ID)
    .setIssuedAt(Math.floor(Date.now() / 1000))
    .sign(key);
  return jwt;
}

async function sendApns(deviceToken: string, payload: PushPayload, bearerToken: string): Promise<{ ok: boolean; status?: number }> {
  const body = {
    aps: {
      alert: { title: payload.title, body: payload.body },
      sound: "default",
      "interruption-level": "time-sensitive",
    },
    ...(payload.url && { url: payload.url }),
  };

  const res = await fetch(`https://${APNS_HOST}/3/device/${deviceToken}`, {
    method: "POST",
    headers: {
      authorization: `bearer ${bearerToken}`,
      "apns-topic": APPLE_BUNDLE_ID,
      "apns-push-type": "alert",
      "apns-priority": "10",
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
  });

  return { ok: res.ok, status: res.status };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders() });
  }

  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return new Response(JSON.stringify({ error: "Authorization required" }), {
      status: 401,
      headers: { ...corsHeaders(), "Content-Type": "application/json" },
    });
  }

  const supabaseAuth = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data: { user: authUser } } = await supabaseAuth.auth.getUser(authHeader.slice(7));
  if (!authUser) {
    return new Response(JSON.stringify({ error: "Invalid or expired token" }), {
      status: 401,
      headers: { ...corsHeaders(), "Content-Type": "application/json" },
    });
  }

  let body: RequestBody;
  try {
    body = (await req.json()) as RequestBody;
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
      status: 400,
      headers: { ...corsHeaders(), "Content-Type": "application/json" },
    });
  }

  const userId = body.user_id ?? authUser.id;
  if (userId !== authUser.id) {
    return new Response(JSON.stringify({ error: "Can only send push for authenticated user" }), {
      status: 403,
      headers: { ...corsHeaders(), "Content-Type": "application/json" },
    });
  }

  const payload: PushPayload = body.payload ?? {
    title: "ImmoControl",
    body: "Neue Benachrichtigung",
    url: "/",
  };

  if (!APPLE_TEAM_ID || !APPLE_KEY_ID || !APPLE_P8_KEY) {
    return new Response(
      JSON.stringify({
        error: "APNs not configured. Set APPLE_TEAM_ID, APPLE_KEY_ID, APPLE_P8_KEY in Supabase secrets.",
      }),
      { status: 503, headers: { ...corsHeaders(), "Content-Type": "application/json" } }
    );
  }

  const { data: tokens, error: fetchError } = await supabaseAuth
    .from("device_tokens")
    .select("token")
    .eq("user_id", userId)
    .eq("platform", "ios");

  if (fetchError || !tokens?.length) {
    return new Response(
      JSON.stringify({ sent: 0, message: "No iOS device tokens for this user" }),
      { status: 200, headers: { ...corsHeaders(), "Content-Type": "application/json" } }
    );
  }

  let bearerToken: string;
  try {
    bearerToken = await getApnsToken();
  } catch (e) {
    return new Response(
      JSON.stringify({ error: "Failed to create APNs token. Check APPLE_* secrets.", detail: String(e) }),
      { status: 503, headers: { ...corsHeaders(), "Content-Type": "application/json" } }
    );
  }

  let sent = 0;
  const failed: string[] = [];
  for (const row of tokens) {
    const token = row.token as string;
    const result = await sendApns(token, payload, bearerToken);
    if (result.ok) sent++;
    else failed.push(token.slice(0, 12) + "...");
  }

  return new Response(
    JSON.stringify({ sent, total: tokens.length, failed: failed.length, failed_tokens: failed }),
    { status: 200, headers: { ...corsHeaders(), "Content-Type": "application/json" } }
  );
});
