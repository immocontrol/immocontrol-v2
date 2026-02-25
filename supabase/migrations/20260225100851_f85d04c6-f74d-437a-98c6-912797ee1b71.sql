
-- Zählermanagement: Meters table
CREATE TABLE public.meters (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  property_id UUID NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  unit_label TEXT DEFAULT '',
  meter_type TEXT NOT NULL DEFAULT 'Strom',
  meter_number TEXT NOT NULL DEFAULT '',
  location_note TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.meters ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own meters" ON public.meters FOR ALL USING (auth.uid() = user_id);

-- Zählerstände: Meter readings
CREATE TABLE public.meter_readings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  meter_id UUID NOT NULL REFERENCES public.meters(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  reading_date DATE NOT NULL DEFAULT CURRENT_DATE,
  value NUMERIC NOT NULL DEFAULT 0,
  note TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.meter_readings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own meter readings" ON public.meter_readings FOR ALL USING (auth.uid() = user_id);

-- Nebenkostenabrechnung: Utility billing
CREATE TABLE public.utility_billings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  property_id UUID NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  tenant_id UUID REFERENCES public.tenants(id),
  billing_period_start DATE NOT NULL,
  billing_period_end DATE NOT NULL,
  total_costs NUMERIC NOT NULL DEFAULT 0,
  tenant_share NUMERIC NOT NULL DEFAULT 0,
  prepayments NUMERIC NOT NULL DEFAULT 0,
  balance NUMERIC NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'draft',
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.utility_billings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own utility billings" ON public.utility_billings FOR ALL USING (auth.uid() = user_id);

-- Nebenkostenpositionen: Line items
CREATE TABLE public.utility_billing_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  billing_id UUID NOT NULL REFERENCES public.utility_billings(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  category TEXT NOT NULL DEFAULT 'Sonstiges',
  description TEXT NOT NULL DEFAULT '',
  total_amount NUMERIC NOT NULL DEFAULT 0,
  distribution_key TEXT NOT NULL DEFAULT 'Fläche',
  tenant_amount NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.utility_billing_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own billing items" ON public.utility_billing_items FOR ALL USING (auth.uid() = user_id);
