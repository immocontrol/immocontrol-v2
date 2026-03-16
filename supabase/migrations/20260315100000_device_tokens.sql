-- Native Push: APNs-/FCM-Tokens pro User für iOS (und ggf. Android) – wichtig für Apple-Watch-Spiegelung
CREATE TABLE IF NOT EXISTS public.device_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  token text NOT NULL,
  platform text NOT NULL CHECK (platform IN ('ios', 'android')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, token)
);

CREATE INDEX IF NOT EXISTS idx_device_tokens_user_id ON public.device_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_device_tokens_platform ON public.device_tokens(platform);

ALTER TABLE public.device_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own device tokens"
  ON public.device_tokens FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

COMMENT ON TABLE public.device_tokens IS 'Native Push-Tokens (APNs iOS, FCM Android) für Geräte-Benachrichtigungen; iOS-Benachrichtigungen können auf Apple Watch gespiegelt werden.';