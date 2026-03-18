/**
 * Telegram Webhook — receives channel/group posts and private messages.
 * - Channel/group: parses ImmoMetrica deal messages, inserts into deals.
 * - Private chat: optional Manus AI replies (if manus_replies_enabled + manus_api_key).
 * URL: /telegram-webhook?secret=UUID or path /telegram-webhook/:secret
 */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const MANUS_API_BASE = "https://api.manus.im/v1";
const MANUS_POLL_MS = 2500;
const MANUS_MAX_WAIT_MS = 52000;

async function runManusAndReply(
  manusApiKey: string,
  botToken: string,
  chatId: number,
  userPrompt: string
): Promise<void> {
  const createRes = await fetch(`${MANUS_API_BASE}/tasks`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${manusApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      prompt: userPrompt,
      task_mode: "agent",
      agent_profile: "quality",
    }),
  });
  if (!createRes.ok) {
    const errText = await createRes.text();
    await sendTelegram(botToken, chatId, `Manus Fehler: ${errText.slice(0, 500)}`);
    return;
  }
  const createData = (await createRes.json()) as { task_id?: string };
  const taskId = createData.task_id;
  if (!taskId) {
    await sendTelegram(botToken, chatId, "Manus: Keine Task-ID erhalten.");
    return;
  }

  const deadline = Date.now() + MANUS_MAX_WAIT_MS;
  let lastStatus: string | null = null;
  let output: string | undefined;
  let errorMsg: string | undefined;

  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, MANUS_POLL_MS));
    const getRes = await fetch(`${MANUS_API_BASE}/tasks/${taskId}`, {
      headers: { Authorization: `Bearer ${manusApiKey}` },
    });
    if (!getRes.ok) {
      await sendTelegram(botToken, chatId, "Manus: Statusabfrage fehlgeschlagen.");
      return;
    }
    const task = (await getRes.json()) as { status?: string; output?: string; error?: string };
    lastStatus = task.status ?? null;
    if (task.status === "completed") {
      output = task.output;
      break;
    }
    if (task.status === "failed") {
      errorMsg = task.error || "Unbekannter Fehler";
      break;
    }
  }

  if (output) {
    const text = output.length > 4000 ? output.slice(0, 3997) + "…" : output;
    await sendTelegram(botToken, chatId, text);
    return;
  }
  if (errorMsg) {
    await sendTelegram(botToken, chatId, `Manus: ${errorMsg.slice(0, 500)}`);
    return;
  }
  await sendTelegram(
    botToken,
    chatId,
    "Recherche dauert länger. Bitte in 1–2 Minuten erneut fragen oder in der App prüfen."
  );
}

async function sendTelegram(botToken: string, chatId: number, text: string): Promise<void> {
  await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text }),
  });
}

// ─── ImmoMetrica message parser (port from TelegramDealImport) ───
function parseGermanNumber(str: string): number | null {
  if (!str || str === "-") return null;
  const cleaned = str.replace(/\s/g, "");
  if (cleaned.includes(",") && cleaned.includes(".")) {
    return parseFloat(cleaned.replace(/\./g, "").replace(/,/g, "."));
  }
  if (cleaned.includes(",")) return parseFloat(cleaned.replace(/,/g, "."));
  const parts = cleaned.split(".");
  if (parts.length >= 2 && parts.slice(1).every(p => p.length === 3)) {
    return parseFloat(cleaned.replace(/\./g, ""));
  }
  return parseFloat(cleaned);
}

interface ParsedDeal {
  title: string;
  address: string;
  propertyType: string;
  buildYear: number | null;
  price: number | null;
  sqm: number | null;
  roi: number | null;
  marketValueDiff: string | null;
  source: string;
  searchProfile: string;
  rawText: string;
}

function parseSingleDeal(block: string, searchProfile: string): ParsedDeal | null {
  const lines = block.split("\n").map(l => l.trim()).filter(Boolean);
  if (lines.length < 3) return null;

  let title = "";
  let startIdx = 0;
  for (let i = 0; i < lines.length; i++) {
    const cleaned = lines[i].replace(/^[\u2728\u2b50\u2705\s]+/u, "").trim();
    if (cleaned === "Neu" || cleaned === "Als Favorit speichern") continue;
    if (cleaned.length > 5 && !cleaned.startsWith("War offline")) {
      title = cleaned;
      startIdx = i + 1;
      break;
    }
  }
  if (!title) return null;

  let address = "";
  let propertyType = "";
  let buildYear: number | null = null;
  let price: number | null = null;
  let sqm: number | null = null;
  let roi: number | null = null;
  let marketValueDiff: string | null = null;
  let source = "Telegram";

  for (let i = startIdx; i < lines.length; i++) {
    const line = lines[i].trim();
    if (/\d{5}/.test(line) && !line.includes("€") && !line.includes("%") && !line.includes("m²")) {
      address = line;
      continue;
    }
    const typeMatch = line.match(/^(.+?)\s*-\s*Bauj\.\s*(\d{4})/);
    if (typeMatch) {
      propertyType = typeMatch[1].trim();
      buildYear = parseInt(typeMatch[2]);
      continue;
    }
    const priceLine = line.match(/([\d.,]+)\s*€\s*\|\s*([\d.,]+)\s*m²\s*\|\s*([\d-]+)\s*Zi/);
    if (priceLine) {
      price = parseGermanNumber(priceLine[1]);
      sqm = parseGermanNumber(priceLine[2]);
      continue;
    }
    const roiMatch = line.match(/([\d.,]+)\s*%\s*ROI/);
    if (roiMatch) {
      roi = parseGermanNumber(roiMatch[1]);
      continue;
    }
    const mvMatch = line.match(/(-?[\d.,]+)\s*%\s*Marktwert/);
    if (mvMatch) {
      marketValueDiff = mvMatch[1].replace(/,/g, ".") + "%";
      continue;
    }
    if (/^(ImmoScout|Immowelt|eBay|Kleinanzeigen|Immobilienscout|immoscout)/i.test(line)) {
      source = line.trim();
    }
  }

  if (!address && title) {
    const plzMatch = title.match(/\d{5}\s*,?\s*\w+/);
    if (plzMatch) address = plzMatch[0];
  }

  return { title, address, propertyType, buildYear, price, sqm, roi, marketValueDiff, source, searchProfile, rawText: block.trim() };
}

function parseTelegramMessages(text: string): ParsedDeal[] {
  const deals: ParsedDeal[] = [];
  const sections = text.split(/(?="[^"]+":)/);
  for (const section of sections) {
    const profileMatch = section.match(/"([^"]+)":\s*(.*?)(?:\n|$)/);
    const searchProfile = profileMatch ? profileMatch[1] : "Unbekannt";
    const dealBlocks = section.split(/\u2b50\s*Als Favorit speichern/u);
    for (const block of dealBlocks) {
      if (!block.includes("€") && !block.includes("m²")) continue;
      const subBlocks = block.split(/\u2728\s*Neu\s*\n/u);
      for (const sub of subBlocks) {
        if (!sub.includes("€")) continue;
        const parsed = parseSingleDeal(sub, searchProfile);
        if (parsed) deals.push(parsed);
      }
    }
  }
  const seen = new Set<string>();
  return deals.filter(d => {
    const key = `${d.title}|${d.address}|${d.price}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function dealToInsert(parsed: ParsedDeal): Record<string, unknown> {
  const typeMap: Record<string, string> = {
    "Mehrfamilienhaus": "MFH", "Einfamilienhaus": "EFH", "Eigentumswohnung": "ETW",
    "Wohn-/ Geschäftshaus": "MFH", "Wohn- und Geschäftshaus": "MFH", "Gewerbe": "Gewerbe", "Grundstück": "Grundstück",
  };
  const propertyType = Object.entries(typeMap).find(([k]) =>
    parsed.propertyType.toLowerCase().includes(k.toLowerCase())
  )?.[1] || "MFH";

  const descParts: string[] = [];
  if (parsed.buildYear) descParts.push(`Baujahr: ${parsed.buildYear}`);
  if (parsed.roi) descParts.push(`ROI: ${parsed.roi}%`);
  if (parsed.marketValueDiff) descParts.push(`Marktwert: ${parsed.marketValueDiff}`);
  if (parsed.searchProfile) descParts.push(`Suchprofil: ${parsed.searchProfile}`);

  return {
    title: parsed.title.substring(0, 100),
    address: parsed.address,
    description: descParts.join(" | "),
    stage: "recherche",
    purchase_price: parsed.price || 0,
    expected_rent: 0,
    sqm: parsed.sqm || 0,
    units: 1,
    property_type: propertyType,
    source: `Telegram (${parsed.source})`,
    notes: parsed.rawText,
  };
}

serve(async (req) => {
  if (req.method !== "POST") return new Response("OK", { status: 200 });

  try {
    const url = new URL(req.url);
    const secret = url.searchParams.get("secret") ?? url.pathname.split("/").pop();
    if (!secret) return new Response("Missing secret", { status: 400 });

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: config } = await supabaseAdmin
      .from("telegram_webhook_config")
      .select("user_id, bot_token, chat_title_includes, allowed_chat_id, manus_replies_enabled, manus_api_key")
      .eq("webhook_secret", secret)
      .single();

    if (!config) return new Response("Config not found", { status: 404 });

    const body = await req.json() as {
      message?: { text?: string; chat?: { id: number; type?: string; title?: string } };
      channel_post?: { text?: string; chat?: { id: number; type?: string; title?: string } };
    };

    const post = body.message ?? body.channel_post;
    const text = post?.text;
    const chat = post?.chat;
    if (!text || !chat) return new Response("OK", { status: 200 });

    const cfg = config as {
      user_id: string;
      bot_token?: string;
      chat_title_includes?: string;
      allowed_chat_id?: number;
      manus_replies_enabled?: boolean;
      manus_api_key?: string | null;
    };

    // Private chat: Manus-Antworten (wenn aktiviert); sonst Deal-Import bei Weiterleitungen (z. B. von immometrica_bot)
    const manusKey = (cfg.manus_api_key && cfg.manus_api_key.trim()) || Deno.env.get("MANUS_API_KEY");
    if (chat.type === "private" && cfg.manus_replies_enabled && manusKey && cfg.bot_token) {
      try {
        await runManusAndReply(manusKey, cfg.bot_token, chat.id, text);
      } catch (e) {
        console.error("telegram-webhook Manus:", e);
        try {
          await sendTelegram(cfg.bot_token!, chat.id, "Antwort konnte nicht erstellt werden. Bitte später erneut versuchen.");
        } catch (err) {
          console.warn("Fallback send failed", err);
        }
      }
      return new Response("OK", { status: 200 });
    }

    // Deal-Import: Channel/Group (Kanal-Filter) oder Private (Weiterleitungen an den Bot, z. B. von immometrica_bot)
    const chatTitleIncludes = cfg.chat_title_includes;
    const allowedChatId = cfg.allowed_chat_id;
    if (chat.type !== "private") {
      if (typeof allowedChatId === "number" && chat.id !== allowedChatId) return new Response("OK", { status: 200 });
      if (chatTitleIncludes && !(chat.title || "").toLowerCase().includes(chatTitleIncludes.toLowerCase())) {
        return new Response("OK", { status: 200 });
      }
    }

    const parsed = parseTelegramMessages(text);
    if (parsed.length === 0) return new Response("OK", { status: 200 });

    const userId = cfg.user_id;

    // Check existing notes to avoid duplicates
    const { data: existing } = await supabaseAdmin
      .from("deals")
      .select("notes")
      .eq("user_id", userId)
      .ilike("source", "%Telegram%");

    const existingNotes = new Set((existing ?? []).map((r: { notes?: string }) => r.notes).filter(Boolean));

    const toInsert = parsed
      .filter(p => p.rawText && !existingNotes.has(p.rawText))
      .map(p => ({ ...dealToInsert(p), user_id: userId }));

    if (toInsert.length > 0) {
      await supabaseAdmin.from("deals").insert(toInsert);
    }

    return new Response("OK", { status: 200 });
  } catch (e) {
    console.error("telegram-webhook error:", e);
    return new Response("Internal error", { status: 500 });
  }
});
