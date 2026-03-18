-- Gamification: Login-Streak (Tage in Folge aktiv)
-- Ein Eintrag pro User; last_active_date wird bei jedem Login/Seitenaufruf auf heute gesetzt.
CREATE TABLE IF NOT EXISTS public.user_activity (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  last_active_date DATE NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.user_activity ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own activity" ON public.user_activity
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own activity" ON public.user_activity
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own activity" ON public.user_activity
  FOR UPDATE USING (auth.uid() = user_id);

COMMENT ON TABLE public.user_activity IS 'Letzter Aktivitätstag für Login-Streak (Gamification).';

-- Pro Tag ein Eintrag, um aufeinanderfolgende Tage zu zählen
CREATE TABLE IF NOT EXISTS public.user_activity_dates (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  activity_date DATE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, activity_date)
);

ALTER TABLE public.user_activity_dates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own activity_dates" ON public.user_activity_dates
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own activity_dates" ON public.user_activity_dates
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_user_activity_dates_user_date
  ON public.user_activity_dates (user_id, activity_date DESC);

COMMENT ON TABLE public.user_activity_dates IS 'Ein Eintrag pro aktivem Tag für Streak-Berechnung.';
