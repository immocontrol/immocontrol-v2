-- Morgen-Push (9 Uhr): Top 6 News der letzten 24h — Nutzer kann in Einstellungen deaktivieren
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS morning_news_push_enabled boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.profiles.morning_news_push_enabled IS 'Native Push 1× täglich (Edge morning-news-push): 3 bundesweit + 3 vor Ort (Heuristik).';
