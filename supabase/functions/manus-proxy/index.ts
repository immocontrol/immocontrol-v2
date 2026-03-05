import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/**
 * Supabase Edge Function: Manus API Proxy
 *
 * Keeps the MANUS_API_KEY server-side so the frontend never sees it.
 * The frontend sends requests here; this function forwards them to the
 * Manus REST API with the secret key attached.
 *
 * Required Supabase secrets:
 *   MANUS_API_KEY — your Manus Pro API key
 *
 * Supported actions (POST body "action" field):
 *   createTask   — create a new Manus task
 *   getTask      — get task status / output
 *   listFiles    — list output files for a task
 *   uploadFile   — get a presigned upload URL
 */

const MANUS_API_BASE = "https://api.manus.im/v1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function manusRequest(path: string, apiKey: string, init?: RequestInit) {
  const res = await fetch(`${MANUS_API_BASE}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    return json(
      { error: `Manus API Fehler (${res.status}): ${body || res.statusText}` },
      res.status >= 500 ? 502 : res.status,
    );
  }
  const data = await res.json();
  return json(data);
}

serve(async (req) => {
  // CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // --- Auth: require logged-in Supabase user ---
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return json({ error: "Nicht authentifiziert" }, 401);
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();
    if (userError || !user) {
      return json({ error: "Nicht authentifiziert" }, 401);
    }

    // --- Manus API key (server-side secret) ---
    const MANUS_API_KEY = Deno.env.get("MANUS_API_KEY");
    if (!MANUS_API_KEY) {
      return json(
        { error: "MANUS_API_KEY ist nicht auf dem Server konfiguriert." },
        500,
      );
    }

    // --- Parse request ---
    const body = await req.json();
    const { action } = body as { action: string };

    switch (action) {
      // ── Create Task ──
      case "createTask": {
        const { prompt, taskMode, agentProfile, fileIds, connectorIds } =
          body as {
            prompt: string;
            taskMode?: string;
            agentProfile?: string;
            fileIds?: string[];
            connectorIds?: string[];
          };
        if (!prompt) return json({ error: "prompt ist erforderlich" }, 400);

        const payload: Record<string, unknown> = {
          prompt,
          task_mode: taskMode || "agent",
          agent_profile: agentProfile || "quality",
        };
        if (fileIds?.length) payload.file_ids = fileIds;
        if (connectorIds?.length) payload.connector_ids = connectorIds;

        return manusRequest("/tasks", MANUS_API_KEY, {
          method: "POST",
          body: JSON.stringify(payload),
        });
      }

      // ── Get Task ──
      case "getTask": {
        const { taskId } = body as { taskId: string };
        if (!taskId) return json({ error: "taskId ist erforderlich" }, 400);
        return manusRequest(`/tasks/${taskId}`, MANUS_API_KEY);
      }

      // ── List Files ──
      case "listFiles": {
        const { taskId } = body as { taskId: string };
        if (!taskId) return json({ error: "taskId ist erforderlich" }, 400);
        return manusRequest(`/tasks/${taskId}/files`, MANUS_API_KEY);
      }

      // ── Upload File (get presigned URL) ──
      case "uploadFile": {
        const { filename, contentType } = body as {
          filename: string;
          contentType?: string;
        };
        if (!filename)
          return json({ error: "filename ist erforderlich" }, 400);
        return manusRequest("/files", MANUS_API_KEY, {
          method: "POST",
          body: JSON.stringify({
            filename,
            content_type: contentType || "application/octet-stream",
          }),
        });
      }

      // ── Check if Manus is configured (no secret exposed) ──
      case "ping": {
        return json({ configured: true });
      }

      default:
        return json({ error: `Unbekannte Aktion: ${action}` }, 400);
    }
  } catch (e) {
    console.error("manus-proxy error:", e);
    return json(
      { error: e instanceof Error ? e.message : "Unbekannter Fehler" },
      500,
    );
  }
});
