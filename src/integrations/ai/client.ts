/**
 * Einheitlicher AI-Chat-Client für ImmoControl.
 * - Wenn VITE_DEEPSEEK_API_KEY gesetzt: DeepSeek API (Streaming).
 * - Sonst: Supabase Edge Function immo-ai-chat (bestehendes Verhalten).
 */

import {
  isDeepSeekConfigured,
  streamDeepSeekChat,
  type ChatMessage,
} from "@/integrations/ai/deepseek";

const IMMO_AI_SYSTEM = `Du bist ein freundlicher Assistent für Immobilien-Investoren in Deutschland.
Du hilfst bei Fragen zu Portfolio, Mieten, Darlehen, Rendite, Cashflow, Objektverwaltung, Tickets (Handwerker, Reparaturen) und Besichtigungen.
Antworte prägnant und auf Deutsch. Nutze ggf. Aufzählungen oder kurze Absätze.
Bei Fragen zu offenen Tickets oder Reparaturen: Weise darauf hin, dass die Ticket-Übersicht unter „Verwaltung“ die genauen Daten enthält.`;

export type StreamChatOptions = {
  messages: ChatMessage[];
  onChunk: (text: string) => void;
  getAccessToken?: () => string | undefined;
};

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/immo-ai-chat`;

/**
 * Streamed Chat: nutzt DeepSeek wenn API-Key gesetzt, sonst Supabase Edge Function.
 */
export async function streamImmoChat(options: StreamChatOptions): Promise<void> {
  const { messages, onChunk, getAccessToken } = options;

  if (isDeepSeekConfigured()) {
    await streamDeepSeekChat(messages, {
      systemPrompt: IMMO_AI_SYSTEM,
      onChunk,
      maxTokens: 4096,
    });
    return;
  }

  // Fallback: Supabase Edge Function
  const anonKey =
    import.meta.env.VITE_SUPABASE_ANON_KEY ?? import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? "";
  const token = getAccessToken?.() ?? anonKey;
  const resp = await fetch(CHAT_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      apikey: anonKey,
    },
    body: JSON.stringify({ messages }),
  });

  if (!resp.ok) {
    const errData = await resp.json().catch(() => ({}));
    throw new Error((errData as { error?: string }).error ?? `Fehler ${resp.status}`);
  }

  if (!resp.body) throw new Error("Kein Stream erhalten");

  const reader = resp.body.getReader();
  const decoder = new TextDecoder();
  let textBuffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    textBuffer += decoder.decode(value, { stream: true });

    let newlineIndex: number;
    while ((newlineIndex = textBuffer.indexOf("\n")) !== -1) {
      let line = textBuffer.slice(0, newlineIndex);
      textBuffer = textBuffer.slice(newlineIndex + 1);
      if (line.endsWith("\r")) line = line.slice(0, -1);
      if (line.startsWith(":") || line.trim() === "") continue;
      if (!line.startsWith("data: ")) continue;

      const jsonStr = line.slice(6).trim();
      if (jsonStr === "[DONE]") break;

      try {
        const parsed = JSON.parse(jsonStr);
        const content = parsed.choices?.[0]?.delta?.content as string | undefined;
        if (content) onChunk(content);
      } catch {
        textBuffer = line + "\n" + textBuffer;
        break;
      }
    }
  }
}

export { isDeepSeekConfigured } from "@/integrations/ai/deepseek";
