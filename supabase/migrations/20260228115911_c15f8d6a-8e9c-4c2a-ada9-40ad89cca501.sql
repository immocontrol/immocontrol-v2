
-- CRM Leads / Kontakte (für Kaltakquise, Geschäftsinhaber etc.)
CREATE TABLE public.crm_leads (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  company TEXT,
  phone TEXT,
  email TEXT,
  address TEXT,
  google_place_id TEXT,
  lat DOUBLE PRECISION,
  lng DOUBLE PRECISION,
  category TEXT NOT NULL DEFAULT 'sonstiges',
  status TEXT NOT NULL DEFAULT 'neu',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.crm_leads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own crm leads" ON public.crm_leads
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Anruf-/Gesprächs-Log
CREATE TABLE public.crm_call_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  lead_id UUID NOT NULL REFERENCES public.crm_leads(id) ON DELETE CASCADE,
  call_date TIMESTAMPTZ NOT NULL DEFAULT now(),
  duration_minutes INTEGER DEFAULT 0,
  outcome TEXT NOT NULL DEFAULT 'kein_ergebnis',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.crm_call_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own call logs" ON public.crm_call_logs
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Deal Pipeline
CREATE TABLE public.deals (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  title TEXT NOT NULL,
  address TEXT,
  description TEXT,
  stage TEXT NOT NULL DEFAULT 'recherche',
  purchase_price NUMERIC DEFAULT 0,
  expected_rent NUMERIC DEFAULT 0,
  expected_yield NUMERIC DEFAULT 0,
  sqm NUMERIC DEFAULT 0,
  units INTEGER DEFAULT 1,
  property_type TEXT DEFAULT 'ETW',
  contact_name TEXT,
  contact_phone TEXT,
  contact_email TEXT,
  source TEXT,
  notes TEXT,
  lost_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.deals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own deals" ON public.deals
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Triggers for updated_at
CREATE TRIGGER update_crm_leads_updated_at BEFORE UPDATE ON public.crm_leads
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_deals_updated_at BEFORE UPDATE ON public.deals
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
