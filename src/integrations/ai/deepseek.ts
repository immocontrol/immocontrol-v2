/**
 * DeepSeek API Client — Chat Completions (OpenAI-compatible).
 * Nutze VITE_DEEPSEEK_API_KEY in .env. Für Produktion empfohlen: Proxy (API-Key server-seitig).
 * Docs: https://api-docs.deepseek.com/api/create-chat-completion
 */

const DEEPSEEK_API = "https://api.deepseek.com/v1/chat/completions";
const DEFAULT_MODEL = "deepseek-chat";

export type ChatMessage = { role: "user" | "assistant" | "system"; content: string };

export function isDeepSeekConfigured(): boolean {
  const key = import.meta.env.VITE_DEEPSEEK_API_KEY;
  return typeof key === "string" && key.trim().length > 0;
}

/**
 * Stream chat completion from DeepSeek. Yields incremental content via onChunk.
 * Uses same SSE format as OpenAI (choices[0].delta.content).
 */
export async function streamDeepSeekChat(
  messages: ChatMessage[],
  options: {
    model?: string;
    systemPrompt?: string;
    onChunk: (text: string) => void;
    maxTokens?: number;
  }
): Promise<void> {
  const apiKey = import.meta.env.VITE_DEEPSEEK_API_KEY;
  if (!apiKey || typeof apiKey !== "string") {
    throw new Error("VITE_DEEPSEEK_API_KEY ist nicht gesetzt.");
  }

  const model = options.model ?? DEFAULT_MODEL;
  const msgs: ChatMessage[] =
    options.systemPrompt && options.systemPrompt.trim()
      ? [{ role: "system", content: options.systemPrompt.trim() }, ...messages]
      : messages;

  const body = {
    model,
    messages: msgs.map((m) => ({ role: m.role, content: m.content })),
    stream: true,
    max_tokens: options.maxTokens ?? 4096,
  };

  const resp = await fetch(DEEPSEEK_API, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  });

  if (!resp.ok) {
    const errText = await resp.text();
    let message = `DeepSeek API Fehler ${resp.status}`;
    try {
      const errJson = JSON.parse(errText);
      if (errJson.error?.message) message = errJson.error.message;
    } catch {
      if (errText) message = errText.slice(0, 200);
    }
    throw new Error(message);
  }

  if (!resp.body) throw new Error("Kein Stream erhalten");

  const reader = resp.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    let newlineIndex: number;
    while ((newlineIndex = buffer.indexOf("\n")) !== -1) {
      let line = buffer.slice(0, newlineIndex);
      buffer = buffer.slice(newlineIndex + 1);
      if (line.endsWith("\r")) line = line.slice(0, -1);
      if (line.startsWith(":") || line.trim() === "") continue;
      if (!line.startsWith("data: ")) continue;

      const jsonStr = line.slice(6).trim();
      if (jsonStr === "[DONE]") continue;

      try {
        const parsed = JSON.parse(jsonStr);
        const content = parsed.choices?.[0]?.delta?.content;
        if (typeof content === "string") options.onChunk(content);
      } catch {
        buffer = line + "\n" + buffer;
        break;
      }
    }
  }
}

/**
 * One-shot completion (no stream). For short answers or tool use.
 */
export async function completeDeepSeekChat(
  messages: ChatMessage[],
  options?: { model?: string; systemPrompt?: string; maxTokens?: number }
): Promise<string> {
  const apiKey = import.meta.env.VITE_DEEPSEEK_API_KEY;
  if (!apiKey || typeof apiKey !== "string") {
    throw new Error("VITE_DEEPSEEK_API_KEY ist nicht gesetzt.");
  }

  const model = options?.model ?? DEFAULT_MODEL;
  const msgs: ChatMessage[] =
    options?.systemPrompt && options.systemPrompt.trim()
      ? [{ role: "system", content: options.systemPrompt.trim() }, ...messages]
      : messages;

  const resp = await fetch(DEEPSEEK_API, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: msgs.map((m) => ({ role: m.role, content: m.content })),
      stream: false,
      max_tokens: options?.maxTokens ?? 2048,
    }),
  });

  if (!resp.ok) {
    const errText = await resp.text();
    let message = `DeepSeek API Fehler ${resp.status}`;
    try {
      const errJson = JSON.parse(errText);
      if (errJson.error?.message) message = errJson.error.message;
    } catch {
      if (errText) message = errText.slice(0, 200);
    }
    throw new Error(message);
  }

  const data = (await resp.json()) as { choices?: Array<{ message?: { content?: string } }> };
  const content = data.choices?.[0]?.message?.content;
  return typeof content === "string" ? content : "";
}
