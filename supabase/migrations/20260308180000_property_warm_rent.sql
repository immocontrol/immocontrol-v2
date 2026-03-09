-- Warmmiete für Objekte: Gesamtmiete = Kaltmiete + Nebenkosten (Warmmiete = Kaltmiete + NK)
-- Wenn NULL: Anzeige wie bisher nur Kaltmiete (monthly_rent).
ALTER TABLE public.properties
  ADD COLUMN IF NOT EXISTS warm_rent NUMERIC DEFAULT NULL;

COMMENT ON COLUMN public.properties.warm_rent IS 'Warmmiete (Gesamtmiete) in EUR/Monat. Nebenkosten = warm_rent - monthly_rent. NULL = nur Kaltmiete erfasst.';
