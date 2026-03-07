-- Restnutzungsdauer (Jahre) und Aufteilung Grund/Boden vs. Gebäude für AfA und 15%-Sanierungsregel
ALTER TABLE public.properties
  ADD COLUMN IF NOT EXISTS restnutzungsdauer INTEGER,
  ADD COLUMN IF NOT EXISTS building_share_percent NUMERIC(5,2) DEFAULT 80;

COMMENT ON COLUMN public.properties.restnutzungsdauer IS 'Verbleibende Nutzungsdauer in Jahren für lineare AfA; wenn gesetzt: jährliche AfA = Gebäudeanteil / restnutzungsdauer';
COMMENT ON COLUMN public.properties.building_share_percent IS 'Gebäudeanteil in % des Kaufpreises (Rest = Grund und Boden); nur der Gebäudeanteil ist abschreibbar; beeinflusst 15%-Sanierungsregel';
