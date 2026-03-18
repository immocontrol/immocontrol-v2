-- Gamification: Verlauf für Einheiten/Portfolio (Sparkline, "vor X Monaten")
-- Ein Snapshot pro User und Tag (datum = DATE in UTC); bei Bedarf upsert für heutigen Tag.
CREATE TABLE IF NOT EXISTS public.user_stats_snapshots (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  snapshot_date DATE NOT NULL,
  total_units INTEGER NOT NULL DEFAULT 0,
  property_count INTEGER NOT NULL DEFAULT 0,
  equity NUMERIC NOT NULL DEFAULT 0,
  total_cashflow NUMERIC NOT NULL DEFAULT 0,
  total_value NUMERIC NOT NULL DEFAULT 0,
  total_rent NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, snapshot_date)
);

ALTER TABLE public.user_stats_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own snapshots" ON public.user_stats_snapshots
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own snapshots" ON public.user_stats_snapshots
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own snapshots" ON public.user_stats_snapshots
  FOR UPDATE USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_user_stats_snapshots_user_date
  ON public.user_stats_snapshots (user_id, snapshot_date DESC);

COMMENT ON TABLE public.user_stats_snapshots IS 'Tägliche Portfolio-Snapshots für Gamification (Einheiten-Verlauf, Sparkline).';
