import { useState, useEffect, useCallback, useRef } from "react";
import { useSupabaseStorage } from "@/hooks/useSupabaseStorage";
import { parseTelegramMessages, ParsedTelegramDeal } from "@/components/TelegramDealImport";

/**
 * TELEGRAM-1: Real Telegram Bot integration — auto-fetch messages via Bot API
 *
 * Uses the Telegram Bot API getUpdates endpoint to poll for new messages.
 * Stores the bot token in Supabase (via useSupabaseStorage) so it persists
 * across devices. Parses incoming messages for deal data automatically.
 */

interface TelegramMessage {
  update_id: number;
  message?: {
    message_id: number;
    from?: { id: number; first_name: string; username?: string };
    chat: { id: number; title?: string; type: string };
    date: number;
    text?: string;
  };
  channel_post?: {
    message_id: number;
    chat: { id: number; title?: string; type: string };
    date: number;
    text?: string;
  };
}

interface TelegramBotState {
  messages: TelegramMessage[];
  deals: ParsedTelegramDeal[];
  loading: boolean;
  error: string | null;
  lastFetchedAt: string | null;
  botInfo: { username: string; first_name: string } | null;
}

const TELEGRAM_API = "https://api.telegram.org/bot";

export function useTelegramBot() {
  const [token] = useSupabaseStorage<string>("immo-telegram-bot-token", "");
  const [botName] = useSupabaseStorage<string>("immo-telegram-bot-name", "");
  const [persistedLastUpdateId, setPersistedLastUpdateId] = useSupabaseStorage<number>("immo-telegram-last-update-id", 0);
  const [state, setState] = useState<TelegramBotState>({
    messages: [],
    deals: [],
    loading: false,
    error: null,
    lastFetchedAt: null,
    botInfo: null,
  });
  const lastUpdateId = useRef<number>(persistedLastUpdateId);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  /** TELEGRAM-2: Validate bot token by calling getMe */
  const validateToken = useCallback(async (botToken: string): Promise<boolean> => {
    try {
      const res = await fetch(`${TELEGRAM_API}${botToken}/getMe`);
      const data = await res.json();
      if (data.ok) {
        setState(prev => ({
          ...prev,
          botInfo: { username: data.result.username, first_name: data.result.first_name },
          error: null,
        }));
        return true;
      }
      setState(prev => ({ ...prev, error: "Ungültiger Bot-Token", botInfo: null }));
      return false;
    } catch {
      setState(prev => ({ ...prev, error: "Netzwerkfehler bei Token-Validierung", botInfo: null }));
      return false;
    }
  }, []);

  /* Keep runtime offset in sync with stored value — only move forward.
   * This avoids resetting the offset backwards if a stale Supabase load resolves
   * after fetchMessages has already advanced the ref. */
  useEffect(() => {
    if (persistedLastUpdateId > lastUpdateId.current) {
      lastUpdateId.current = persistedLastUpdateId;
    }
  }, [persistedLastUpdateId]);

  type FetchOptions = {
    /** If set, only accept updates from this chat (channel/group) */
    allowedChatId?: number;
    /** If set, only accept updates whose chat title includes this (case-insensitive) */
    chatTitleIncludes?: string;
  };

  /** TELEGRAM-3: Fetch new messages via getUpdates (polling) */
  const fetchMessages = useCallback(async (opts: FetchOptions = {}): Promise<ParsedTelegramDeal[]> => {
    if (!token) return [];

    setState(prev => ({ ...prev, loading: true, error: null }));

    try {
      const params = new URLSearchParams({
        offset: String(lastUpdateId.current + 1),
        limit: "100",
        timeout: "0",
      });

      const res = await fetch(`${TELEGRAM_API}${token}/getUpdates?${params}`);
      const data = await res.json();

      if (!data.ok) {
        setState(prev => ({ ...prev, loading: false, error: data.description || "API-Fehler" }));
        return [];
      }

      const updates: TelegramMessage[] = data.result || [];

      if (updates.length > 0) {
        /* Update offset to acknowledge processed messages */
        const nextUpdateId = Math.max(...updates.map(u => u.update_id));
        lastUpdateId.current = nextUpdateId;
        setPersistedLastUpdateId(nextUpdateId);

        /* Filter updates by chat if configured */
        const filteredUpdates = updates.filter((u) => {
          const chat = u.message?.chat || u.channel_post?.chat;
          if (!chat) return false;
          if (typeof opts.allowedChatId === "number") return chat.id === opts.allowedChatId;
          if (opts.chatTitleIncludes) {
            const title = (chat.title || "").toLowerCase();
            return title.includes(opts.chatTitleIncludes.toLowerCase());
          }
          return true;
        });

        /* Extract text content from messages and channel posts */
        const texts = filteredUpdates
          .map(u => u.message?.text || u.channel_post?.text)
          .filter((t): t is string => !!t);

        /* Parse all message texts for deals */
        const allDeals: ParsedTelegramDeal[] = [];
        for (const text of texts) {
          const parsed = parseTelegramMessages(text);
          allDeals.push(...parsed);
        }

        setState(prev => ({
          ...prev,
          messages: [...prev.messages, ...updates].slice(-200),
          deals: [...prev.deals, ...allDeals].slice(-500),
          loading: false,
          lastFetchedAt: new Date().toISOString(),
        }));

        return allDeals;
      }

      setState(prev => ({
        ...prev,
        loading: false,
        lastFetchedAt: new Date().toISOString(),
      }));

      return [];
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unbekannter Fehler";
      setState(prev => ({ ...prev, loading: false, error: msg }));
      return [];
    }
  }, [token, setPersistedLastUpdateId]);

  /** TELEGRAM-4: Start polling for new messages every 30 seconds */
  const startPolling = useCallback((intervalMs = 30_000) => {
    stopPolling();
    /* Initial fetch */
    fetchMessages();
    /* Set up interval */
    pollingRef.current = setInterval(fetchMessages, intervalMs);
  }, [fetchMessages]);

  /** TELEGRAM-5: Stop polling */
  const stopPolling = useCallback(() => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
  }, []);

  /** TELEGRAM-6: Clear all fetched messages and deals */
  const clearMessages = useCallback(() => {
    setState(prev => ({
      ...prev,
      messages: [],
      deals: [],
      lastFetchedAt: null,
    }));
  }, []);

  /* Auto-validate token on change */
  useEffect(() => {
    if (token && token.length > 20) {
      validateToken(token);
    }
  }, [token, validateToken]);

  /** TELEGRAM-7: Send a message via Telegram Bot API */
  const sendMessage = useCallback(async (chatId: number | string, text: string, parseMode: "HTML" | "Markdown" = "HTML"): Promise<boolean> => {
    if (!token) return false;
    try {
      const res = await fetch(`${TELEGRAM_API}${token}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: chatId, text, parse_mode: parseMode }),
      });
      const data = await res.json();
      return data.ok === true;
    } catch {
      return false;
    }
  }, [token]);

  /** Helper: escape HTML special chars for Telegram HTML parse mode */
  const escTg = useCallback((s: string): string =>
    s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"), []);

  /** TELEGRAM-8: Send notification alerts (overdue payments, expiring contracts, open tickets) */
  const sendNotificationAlert = useCallback(async (chatId: number | string, alerts: {
    overduePayments?: Array<{ tenant: string; amount: number; dueDate: string }>;
    expiringContracts?: Array<{ tenant: string; endDate: string; daysLeft: number }>;
    openTickets?: Array<{ title: string; priority: string }>;
    maintenanceDue?: Array<{ title: string; property: string; dueDate: string }>;
  }): Promise<boolean> => {
    const lines: string[] = ["<b>ImmoControl Benachrichtigungen</b>\n"];

    if (alerts.overduePayments?.length) {
      lines.push("🔴 <b>Überfällige Zahlungen:</b>");
      for (const p of alerts.overduePayments) {
        lines.push(`  • ${escTg(p.tenant)}: ${p.amount.toLocaleString("de-DE")} € (fällig seit ${escTg(p.dueDate)})`);
      }
      lines.push("");
    }

    if (alerts.expiringContracts?.length) {
      lines.push("🟡 <b>Auslaufende Verträge:</b>");
      for (const c of alerts.expiringContracts) {
        lines.push(`  • ${escTg(c.tenant)}: endet in ${c.daysLeft} Tagen (${escTg(c.endDate)})`);
      }
      lines.push("");
    }

    if (alerts.openTickets?.length) {
      lines.push("🔧 <b>Offene Tickets:</b>");
      for (const t of alerts.openTickets) {
        lines.push(`  • ${escTg(t.title)} (${escTg(t.priority)})`);
      }
      lines.push("");
    }

    if (alerts.maintenanceDue?.length) {
      lines.push("🛠 <b>Wartung fällig:</b>");
      for (const m of alerts.maintenanceDue) {
        lines.push(`  • ${escTg(m.title)} — ${escTg(m.property)} (${escTg(m.dueDate)})`);
      }
      lines.push("");
    }

    if (lines.length <= 1) return false; // No alerts to send
    return sendMessage(chatId, lines.join("\n"));
  }, [sendMessage, escTg]);

  /** TELEGRAM-9: Get known chat IDs from received messages */
  const getKnownChatIds = useCallback((): Array<{ id: number; title: string; type: string }> => {
    const seen = new Map<number, { id: number; title: string; type: string }>();
    for (const msg of state.messages) {
      const chat = msg.message?.chat || msg.channel_post?.chat;
      if (chat && !seen.has(chat.id)) {
        seen.set(chat.id, { id: chat.id, title: chat.title || `Chat ${chat.id}`, type: chat.type });
      }
    }
    return Array.from(seen.values());
  }, [state.messages]);

  /* Cleanup polling on unmount */
  useEffect(() => {
    return () => stopPolling();
  }, [stopPolling]);

  return {
    ...state,
    token,
    botName,
    validateToken,
    fetchMessages,
    startPolling,
    stopPolling,
    clearMessages,
    sendMessage,
    sendNotificationAlert,
    getKnownChatIds,
    isPolling: pollingRef.current !== null,
  };
}
