-- Manus AI im Telegram-Bot: Antworten auf private Nachrichten
ALTER TABLE public.telegram_webhook_config
  ADD COLUMN IF NOT EXISTS manus_replies_enabled BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS manus_api_key TEXT;

COMMENT ON COLUMN public.telegram_webhook_config.manus_replies_enabled IS 'Private Nachrichten an den Bot werden mit Manus AI beantwortet.';
COMMENT ON COLUMN public.telegram_webhook_config.manus_api_key IS 'Manus API Key für serverseitige Manus-Antworten (pro User).';
