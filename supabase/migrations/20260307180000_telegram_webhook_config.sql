-- Telegram Webhook Config: enables server-side deal import from ImmoMetrica channel
-- One config per user; webhook URL contains secret for routing
CREATE TABLE IF NOT EXISTS public.telegram_webhook_config (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  webhook_secret TEXT NOT NULL UNIQUE,
  bot_token TEXT NOT NULL,
  chat_title_includes TEXT,
  allowed_chat_id BIGINT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);

ALTER TABLE public.telegram_webhook_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own telegram webhook config"
  ON public.telegram_webhook_config
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_telegram_webhook_config_webhook_secret
  ON public.telegram_webhook_config(webhook_secret);

CREATE TRIGGER update_telegram_webhook_config_updated_at
  BEFORE UPDATE ON public.telegram_webhook_config
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
