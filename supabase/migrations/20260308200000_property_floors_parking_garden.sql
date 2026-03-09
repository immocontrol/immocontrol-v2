-- Wohnfläche bleibt sqm; Gewerbefläche und separat vermietbare Einheiten für Objekt anlegen
-- Vermietete Fläche = sqm (Wohnfläche) + commercial_sqm (Gewerbefläche) für Kaltmiete/qm
ALTER TABLE public.properties
  ADD COLUMN IF NOT EXISTS commercial_sqm NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS parking_underground INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS parking_stellplatz INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS parking_garage INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS garden_sqm NUMERIC DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS other_rentable_notes TEXT DEFAULT NULL;

COMMENT ON COLUMN public.properties.commercial_sqm IS 'Gewerbefläche in m² (vermietet, für Kaltmiete/qm-Berechnung)';
COMMENT ON COLUMN public.properties.parking_underground IS 'Anzahl Tiefgaragenstellplätze';
COMMENT ON COLUMN public.properties.parking_stellplatz IS 'Anzahl Stellplätze';
COMMENT ON COLUMN public.properties.parking_garage IS 'Anzahl Garagen';
COMMENT ON COLUMN public.properties.garden_sqm IS 'Gartenfläche in m² oder Anzahl nutzbarer Gärten (optional)';
COMMENT ON COLUMN public.properties.other_rentable_notes IS 'Sonstiges separat vermietbar (z.B. Keller, Dachterrasse)';
