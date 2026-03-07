-- Optional: Aufzeichnung und Transkript pro Gespräch (Einwilligung wird von dir eingeholt, keine System-Ansage)
ALTER TABLE public.crm_call_logs
  ADD COLUMN IF NOT EXISTS recording_url TEXT,
  ADD COLUMN IF NOT EXISTS transcript TEXT;

COMMENT ON COLUMN public.crm_call_logs.recording_url IS 'Link zur Aufzeichnung (z.B. von Twilio). Einwilligung wird vom Nutzer vor dem Gespräch eingeholt.';
COMMENT ON COLUMN public.crm_call_logs.transcript IS 'Transkript des Gesprächs (z.B. per Whisper/Deepgram).';
