/**
 * Web-Push bei geschlossener App — sendet an Abos in push_subscriptions.
 * VAPID: Secret VAPID_KEYS_JSON = JSON von exportVapidKeys() aus @negrel/webpush (JWK).
 * Body: { user_id: string, payload: { title: string, body: string, url?: string, tag?: string } }
 *       oder { user_id: string } für Test-Push.
 */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  ApplicationServer,
  importVapidKeys,
  type PushSubscription as WebPushSubscription,
  type ExportedVapidKeys,
} from "jsr:@negrel/webpush@0.5.0";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const VAPID_KEYS_JSON = Deno.env.get("VAPID_KEYS_JSON"); // JWK from exportVapidKeys()
const CONTACT_MAIL = Deno.env.get("VAPID_CONTACT_MAIL") ?? "noreply@immocontrol.app";

interface PushPayload {
  title: string;
  body: string;
  url?: string;
  tag?: string;
}

interface RequestBody {
  user_id: string;
  payload?: PushPayload;
}

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  };
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

  if (!VAPID_KEYS_JSON) {
    return new Response(
      JSON.stringify({ error: "VAPID_KEYS_JSON not configured. Use exportVapidKeys() from @negrel/webpush and set in Supabase secrets." }),
      { status: 503, headers: { ...corsHeaders(), "Content-Type": "application/json" } }
    );
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
    tag: "immo-notification",
  };

  const supabase = supabaseAuth;
  const { data: rows, error: fetchError } = await supabase
    .from("push_subscriptions")
    .select("endpoint, p256dh, auth")
    .eq("user_id", userId);

  if (fetchError || !rows?.length) {
    return new Response(
      JSON.stringify({ sent: 0, error: fetchError?.message ?? "No subscriptions for user" }),
      { status: 200, headers: { ...corsHeaders(), "Content-Type": "application/json" } }
    );
  }

  let vapidKeys: CryptoKeyPair;
  try {
    const exported = JSON.parse(VAPID_KEYS_JSON) as ExportedVapidKeys;
    vapidKeys = await importVapidKeys(exported);
  } catch (e) {
    return new Response(
      JSON.stringify({ error: "Invalid VAPID_KEYS_JSON: " + (e instanceof Error ? e.message : String(e)) }),
      { status: 503, headers: { ...corsHeaders(), "Content-Type": "application/json" } }
    );
  }

  const appServer = await ApplicationServer.new({
    contactInformation: `mailto:${CONTACT_MAIL}`,
    vapidKeys,
  });

  const message = JSON.stringify({
    title: payload.title,
    body: payload.body,
    url: payload.url ?? "/",
    tag: payload.tag ?? "immo-notification",
  });

  let sent = 0;
  const gone: string[] = [];

  for (const row of rows) {
    const sub: WebPushSubscription = {
      endpoint: row.endpoint,
      keys: { p256dh: row.p256dh, auth: row.auth },
    };
    try {
      const subscriber = appServer.subscribe(sub as unknown as globalThis.PushSubscription);
      await subscriber.pushTextMessage(message, { urgency: "high" });
      sent++;
    } catch (e: unknown) {
      const err = e as { isGone?: () => boolean };
      if (typeof err?.isGone === "function" && err.isGone()) {
        gone.push(row.endpoint);
      }
    }
  }

  if (gone.length > 0) {
    await supabase.from("push_subscriptions").delete().in("endpoint", gone);
  }

  return new Response(
    JSON.stringify({ sent, total: rows.length, removed: gone.length }),
    { status: 200, headers: { ...corsHeaders(), "Content-Type": "application/json" } }
  );
});
