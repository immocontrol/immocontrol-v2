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
  const [state, setState] = useState<TelegramBotState>({
    messages: [],
    deals: [],
    loading: false,
    error: null,
    lastFetchedAt: null,
    botInfo: null,
  });
  const lastUpdateId = useRef<number>(0);
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

  /** TELEGRAM-3: Fetch new messages via getUpdates (long polling) */
  const fetchMessages = useCallback(async (): Promise<ParsedTelegramDeal[]> => {
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
        lastUpdateId.current = Math.max(...updates.map(u => u.update_id));

        /* Extract text content from messages and channel posts */
        const texts = updates
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
          messages: [...prev.messages, ...updates],
          deals: [...prev.deals, ...allDeals],
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
  }, [token]);

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
    isPolling: pollingRef.current !== null,
  };
}
