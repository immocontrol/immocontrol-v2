-- Mietvertrag (und ggf. andere Verträge) aus der App ausstellen und vom Mieter unterschreiben lassen
CREATE TABLE public.contract_signature_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL DEFAULT 'mietvertrag' CHECK (type IN ('mietvertrag')),
  contract_data JSONB NOT NULL DEFAULT '{}',
  pdf_storage_path TEXT,
  confirm_token UUID UNIQUE DEFAULT gen_random_uuid(),
  landlord_signed_at TIMESTAMPTZ,
  tenant_signed_at TIMESTAMPTZ,
  tenant_signature_data TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_contract_signature_requests_tenant ON public.contract_signature_requests(tenant_id);
CREATE INDEX idx_contract_signature_requests_property ON public.contract_signature_requests(property_id);
CREATE INDEX idx_contract_signature_requests_confirm_token ON public.contract_signature_requests(confirm_token) WHERE confirm_token IS NOT NULL;

ALTER TABLE public.contract_signature_requests ENABLE ROW LEVEL SECURITY;

-- Vermieter (Eigentümer der Objekte) darf alle Anfragen seiner Objekte verwalten
CREATE POLICY "Landlords manage own contract signature requests"
  ON public.contract_signature_requests FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.properties p
      WHERE p.id = contract_signature_requests.property_id AND p.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.properties p
      WHERE p.id = contract_signature_requests.property_id AND p.user_id = auth.uid()
    )
  );

-- Mieter darf eigene Anfragen lesen und Unterschrift setzen (tenant_signed_at, tenant_signature_data)
CREATE POLICY "Tenants view own contract signature requests"
  ON public.contract_signature_requests FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM public.tenants t WHERE t.id = contract_signature_requests.tenant_id AND t.user_id = auth.uid())
  );

CREATE POLICY "Tenants sign own contract signature requests"
  ON public.contract_signature_requests FOR UPDATE
  USING (
    EXISTS (SELECT 1 FROM public.tenants t WHERE t.id = contract_signature_requests.tenant_id AND t.user_id = auth.uid())
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.tenants t WHERE t.id = contract_signature_requests.tenant_id AND t.user_id = auth.uid())
  );

CREATE TRIGGER update_contract_signature_requests_updated_at
  BEFORE UPDATE ON public.contract_signature_requests
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Öffentlicher Abruf per Token (Link zum Unterschreiben ohne Login)
CREATE OR REPLACE FUNCTION public.get_contract_by_token(_token UUID)
RETURNS JSON LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  r RECORD;
BEGIN
  SELECT csr.id, csr.property_id, csr.tenant_id, csr.type, csr.contract_data, csr.tenant_signed_at, csr.created_at,
         (SELECT p.address FROM properties p WHERE p.id = csr.property_id) AS property_address,
         (SELECT t.first_name || ' ' || t.last_name FROM tenants t WHERE t.id = csr.tenant_id) AS tenant_name
  INTO r
  FROM contract_signature_requests csr
  WHERE csr.confirm_token = _token;
  IF r.id IS NULL THEN
    RETURN NULL;
  END IF;
  RETURN json_build_object(
    'id', r.id, 'property_id', r.property_id, 'tenant_id', r.tenant_id, 'type', r.type,
    'contract_data', r.contract_data, 'tenant_signed_at', r.tenant_signed_at, 'created_at', r.created_at,
    'property_address', r.property_address, 'tenant_name', r.tenant_name
  );
END;
$$;

-- Mieter unterschreibt per Token (ohne Login)
CREATE OR REPLACE FUNCTION public.sign_contract_by_token(_token UUID, _signature_data TEXT DEFAULT NULL)
RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.contract_signature_requests
  SET tenant_signed_at = now(), tenant_signature_data = _signature_data, updated_at = now()
  WHERE confirm_token = _token AND tenant_signed_at IS NULL;
  RETURN FOUND;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_contract_by_token(UUID) TO anon;
GRANT EXECUTE ON FUNCTION public.get_contract_by_token(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.sign_contract_by_token(UUID, TEXT) TO anon;
GRANT EXECUTE ON FUNCTION public.sign_contract_by_token(UUID, TEXT) TO authenticated;
