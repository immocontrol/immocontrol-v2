
-- Bank accounts table
CREATE TABLE public.bank_accounts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  iban TEXT,
  bic TEXT,
  bank_name TEXT,
  is_default BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.bank_accounts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own bank accounts" ON public.bank_accounts FOR ALL USING (auth.uid() = user_id);

-- Add account_id to bank_transactions
ALTER TABLE public.bank_transactions ADD COLUMN account_id UUID REFERENCES public.bank_accounts(id) ON DELETE SET NULL;

-- Auto-matching rules table
CREATE TABLE public.bank_matching_rules (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  name TEXT NOT NULL DEFAULT '',
  match_type TEXT NOT NULL DEFAULT 'iban', -- 'iban', 'name', 'reference'
  match_value TEXT NOT NULL DEFAULT '',
  tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
  property_id UUID REFERENCES public.properties(id) ON DELETE CASCADE,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.bank_matching_rules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own matching rules" ON public.bank_matching_rules FOR ALL USING (auth.uid() = user_id);

CREATE INDEX idx_bank_accounts_user ON public.bank_accounts(user_id);
CREATE INDEX idx_bank_matching_rules_user ON public.bank_matching_rules(user_id);
CREATE INDEX idx_bank_transactions_account ON public.bank_transactions(account_id);
