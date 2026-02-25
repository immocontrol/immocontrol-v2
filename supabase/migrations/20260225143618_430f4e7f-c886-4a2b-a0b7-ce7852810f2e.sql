
-- 1. Lease Contracts (Mietverträge)
CREATE TABLE public.contracts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  property_id UUID NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  tenant_id UUID REFERENCES public.tenants(id) ON DELETE SET NULL,
  contract_type TEXT NOT NULL DEFAULT 'mietvertrag',
  start_date DATE NOT NULL,
  end_date DATE,
  is_indefinite BOOLEAN NOT NULL DEFAULT true,
  notice_period_months INTEGER NOT NULL DEFAULT 3,
  base_rent NUMERIC NOT NULL DEFAULT 0,
  cold_rent NUMERIC NOT NULL DEFAULT 0,
  warm_rent NUMERIC NOT NULL DEFAULT 0,
  deposit_amount NUMERIC NOT NULL DEFAULT 0,
  rent_increase_index TEXT DEFAULT 'mietspiegel',
  last_rent_increase DATE,
  next_rent_increase DATE,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.contracts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own contracts" ON public.contracts FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- 2. Invoices (Rechnungseingang)
CREATE TABLE public.invoices (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  property_id UUID REFERENCES public.properties(id) ON DELETE SET NULL,
  vendor_name TEXT NOT NULL,
  invoice_number TEXT,
  invoice_date DATE NOT NULL DEFAULT CURRENT_DATE,
  due_date DATE,
  amount NUMERIC NOT NULL DEFAULT 0,
  tax_amount NUMERIC NOT NULL DEFAULT 0,
  category TEXT NOT NULL DEFAULT 'sonstiges',
  status TEXT NOT NULL DEFAULT 'offen',
  payment_date DATE,
  notes TEXT,
  is_recurring BOOLEAN NOT NULL DEFAULT false,
  recurrence_interval TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own invoices" ON public.invoices FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- 3. Owner Meetings (Eigentümerversammlungen)
CREATE TABLE public.owner_meetings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  property_id UUID NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  meeting_date TIMESTAMPTZ NOT NULL,
  location TEXT,
  is_virtual BOOLEAN NOT NULL DEFAULT false,
  meeting_link TEXT,
  status TEXT NOT NULL DEFAULT 'geplant',
  minutes TEXT,
  attendee_count INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.owner_meetings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own meetings" ON public.owner_meetings FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- 4. Meeting Resolutions (Beschlüsse)
CREATE TABLE public.meeting_resolutions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  meeting_id UUID NOT NULL REFERENCES public.owner_meetings(id) ON DELETE CASCADE,
  resolution_number INTEGER NOT NULL DEFAULT 1,
  title TEXT NOT NULL,
  description TEXT,
  votes_for INTEGER NOT NULL DEFAULT 0,
  votes_against INTEGER NOT NULL DEFAULT 0,
  votes_abstain INTEGER NOT NULL DEFAULT 0,
  result TEXT NOT NULL DEFAULT 'angenommen',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.meeting_resolutions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own resolutions" ON public.meeting_resolutions FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- 5. Energy Certificates (Energieausweise)
CREATE TABLE public.energy_certificates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  property_id UUID NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  certificate_type TEXT NOT NULL DEFAULT 'verbrauch',
  energy_class TEXT,
  energy_value NUMERIC,
  issue_date DATE NOT NULL,
  expiry_date DATE NOT NULL,
  issuer TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.energy_certificates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own certificates" ON public.energy_certificates FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- 6. Service Contracts (Dienstleisterverträge)
CREATE TABLE public.service_contracts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  property_id UUID NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  contact_id UUID REFERENCES public.contacts(id) ON DELETE SET NULL,
  service_type TEXT NOT NULL DEFAULT 'wartung',
  provider_name TEXT NOT NULL,
  contract_number TEXT,
  start_date DATE NOT NULL,
  end_date DATE,
  is_auto_renew BOOLEAN NOT NULL DEFAULT true,
  notice_period_months INTEGER NOT NULL DEFAULT 3,
  annual_cost NUMERIC NOT NULL DEFAULT 0,
  payment_interval TEXT NOT NULL DEFAULT 'monatlich',
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.service_contracts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own service contracts" ON public.service_contracts FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
