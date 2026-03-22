-- Optional Referenz-Nettokaltmiete €/m² für Mietspiegel-Check (überschreibt Stadt-Datenbank)
ALTER TABLE public.properties
  ADD COLUMN IF NOT EXISTS mietspiegel_reference_per_sqm NUMERIC;

COMMENT ON COLUMN public.properties.mietspiegel_reference_per_sqm IS
  'Optional: Referenz €/m² kalt für Mietspiegel-Vergleich (manuell; NULL = automatische Stadtzuordnung)';
