-- KI-Zusammenfassung des Gesprächstranskripts (z. B. per DeepSeek)
ALTER TABLE public.crm_call_logs
  ADD COLUMN IF NOT EXISTS transcript_summary TEXT;

COMMENT ON COLUMN public.crm_call_logs.transcript_summary IS 'KI-Zusammenfassung des Transkripts (Stichpunkte, nächste Schritte, Vereinbarungen).';
