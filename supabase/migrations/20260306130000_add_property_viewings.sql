-- Besichtigungen: Notizen, Bilder, Videos für Immobilien-Besichtigungen
-- Verknüpft optional mit Deals, Properties oder freie Adresse

CREATE TABLE IF NOT EXISTS public.property_viewings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  address TEXT,
  deal_id UUID REFERENCES public.deals(id) ON DELETE SET NULL,
  property_id UUID REFERENCES public.properties(id) ON DELETE SET NULL,
  scheduled_at TIMESTAMPTZ,
  visited_at TIMESTAMPTZ,
  notes TEXT,
  pro_points TEXT,
  contra_points TEXT,
  rating INTEGER CHECK (rating >= 1 AND rating <= 5),
  contact_name TEXT,
  contact_phone TEXT,
  checklist JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.viewing_media (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  viewing_id UUID NOT NULL REFERENCES public.property_viewings(id) ON DELETE CASCADE,
  file_path TEXT NOT NULL,
  file_type TEXT NOT NULL,
  caption TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_property_viewings_user_id ON public.property_viewings(user_id);
CREATE INDEX IF NOT EXISTS idx_property_viewings_visited_at ON public.property_viewings(visited_at DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS idx_property_viewings_deal_id ON public.property_viewings(deal_id);
CREATE INDEX IF NOT EXISTS idx_viewing_media_viewing_id ON public.viewing_media(viewing_id);

ALTER TABLE public.property_viewings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.viewing_media ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own viewings" ON public.property_viewings
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can manage media of own viewings" ON public.viewing_media
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.property_viewings v WHERE v.id = viewing_id AND v.user_id = auth.uid())
  );

-- Storage: Nutze property-documents Bucket mit Pfad user_id/viewings/viewing_id/filename
-- Policy erlaubt bereits user_id als ersten Pfadteil
