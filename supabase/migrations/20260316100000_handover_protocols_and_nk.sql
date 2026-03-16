-- Übergabeprotokolle: Speichern, Link an Mieter, Bestätigung durch Mieter
CREATE TABLE public.handover_protocols (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('einzug', 'auszug')),
  protocol_data JSONB NOT NULL DEFAULT '{}',
  pdf_storage_path TEXT,
  confirm_token UUID UNIQUE DEFAULT gen_random_uuid(),
  tenant_confirmed_at TIMESTAMPTZ,
  tenant_signature_data TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_handover_protocols_tenant ON public.handover_protocols(tenant_id);
CREATE INDEX idx_handover_protocols_property ON public.handover_protocols(property_id);
CREATE INDEX idx_handover_protocols_confirm_token ON public.handover_protocols(confirm_token) WHERE confirm_token IS NOT NULL;

ALTER TABLE public.handover_protocols ENABLE ROW LEVEL SECURITY;

-- Vermieter (Eigentümer der Objekte) darf alle Protokolle seiner Objekte verwalten
CREATE POLICY "Landlords manage own handover protocols"
  ON public.handover_protocols FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.properties p
      WHERE p.id = handover_protocols.property_id AND p.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.properties p
      WHERE p.id = handover_protocols.property_id AND p.user_id = auth.uid()
    )
  );

-- Mieter darf eigenes Protokoll lesen und Bestätigung setzen (tenant_confirmed_at, tenant_signature_data)
CREATE POLICY "Tenants view own handover protocols"
  ON public.handover_protocols FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM public.tenants t WHERE t.id = handover_protocols.tenant_id AND t.user_id = auth.uid())
  );

CREATE POLICY "Tenants confirm own handover protocols"
  ON public.handover_protocols FOR UPDATE
  USING (
    EXISTS (SELECT 1 FROM public.tenants t WHERE t.id = handover_protocols.tenant_id AND t.user_id = auth.uid())
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.tenants t WHERE t.id = handover_protocols.tenant_id AND t.user_id = auth.uid())
  );

CREATE TRIGGER update_handover_protocols_updated_at
  BEFORE UPDATE ON public.handover_protocols
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Öffentlicher Abruf per Token (für Bestätigungs-Link ohne Login)
CREATE OR REPLACE FUNCTION public.get_handover_by_token(_token UUID)
RETURNS JSON LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  r RECORD;
BEGIN
  SELECT id, property_id, tenant_id, type, protocol_data, tenant_confirmed_at, created_at,
         (SELECT p.address FROM properties p WHERE p.id = hp.property_id) AS property_address,
         (SELECT t.first_name || ' ' || t.last_name FROM tenants t WHERE t.id = hp.tenant_id) AS tenant_name
  INTO r
  FROM handover_protocols hp
  WHERE hp.confirm_token = _token;
  IF r.id IS NULL THEN
    RETURN NULL;
  END IF;
  RETURN json_build_object(
    'id', r.id, 'property_id', r.property_id, 'tenant_id', r.tenant_id, 'type', r.type,
    'protocol_data', r.protocol_data, 'tenant_confirmed_at', r.tenant_confirmed_at, 'created_at', r.created_at,
    'property_address', r.property_address, 'tenant_name', r.tenant_name
  );
END;
$$;

-- Bestätigung durch Mieter per Token (ohne Login)
CREATE OR REPLACE FUNCTION public.confirm_handover_by_token(_token UUID, _signature_data TEXT DEFAULT NULL)
RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.handover_protocols
  SET tenant_confirmed_at = now(), tenant_signature_data = _signature_data, updated_at = now()
  WHERE confirm_token = _token AND tenant_confirmed_at IS NULL;
  RETURN FOUND;
END;
$$;

-- Anon darf nur diese beiden Funktionen aufrufen (für Bestätigungs-Link)
GRANT EXECUTE ON FUNCTION public.get_handover_by_token(UUID) TO anon;
GRANT EXECUTE ON FUNCTION public.get_handover_by_token(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.confirm_handover_by_token(UUID, TEXT) TO anon;
GRANT EXECUTE ON FUNCTION public.confirm_handover_by_token(UUID, TEXT) TO authenticated;

-- NK-Abrechnung: Verteilerschlüssel erweitern (BetrKV: flaeche, verbrauch, personen, einheiten)
-- utility_billing_items hat bereits distribution_key (TEXT). Wir fügen ein optionales consumption-Feld hinzu für HeizkostenV.
ALTER TABLE public.utility_billing_items
  ADD COLUMN IF NOT EXISTS consumption_share NUMERIC,
  ADD COLUMN IF NOT EXISTS betrkv_key TEXT;

COMMENT ON COLUMN public.utility_billing_items.distribution_key IS 'Fläche, Verbrauch, Personen, Einheiten (BetrKV)';
COMMENT ON COLUMN public.utility_billing_items.consumption_share IS 'Anteil bei verbrauchsabhängiger Umlage (z.B. HeizkostenV)';
