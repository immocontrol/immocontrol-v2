-- SMART-Ziele: optionaler Grund "Relevant" (Warum ist dir das Ziel wichtig?)
ALTER TABLE public.portfolio_goals
  ADD COLUMN IF NOT EXISTS reason TEXT;

COMMENT ON COLUMN public.portfolio_goals.reason IS 'SMART: Relevant – Warum ist dir dieses Ziel wichtig?';
