
-- Table for imported bank transactions
CREATE TABLE public.bank_transactions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  booking_date DATE NOT NULL,
  value_date DATE,
  amount NUMERIC NOT NULL,
  currency TEXT NOT NULL DEFAULT 'EUR',
  sender_receiver TEXT,
  iban TEXT,
  bic TEXT,
  reference TEXT,
  booking_text TEXT,
  matched_payment_id UUID REFERENCES public.rent_payments(id) ON DELETE SET NULL,
  match_confidence TEXT, -- 'auto', 'manual', null
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.bank_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own bank transactions"
ON public.bank_transactions FOR ALL
USING (auth.uid() = user_id);

CREATE INDEX idx_bank_transactions_user ON public.bank_transactions(user_id);
CREATE INDEX idx_bank_transactions_date ON public.bank_transactions(booking_date);
CREATE INDEX idx_bank_transactions_matched ON public.bank_transactions(matched_payment_id);
