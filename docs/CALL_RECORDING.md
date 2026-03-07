# Gesprächsaufzeichnung im CRM

Aufzeichnung und Transkript von Anrufen können pro Gespräch optional gespeichert werden. **Du holst die Einwilligung der Gegenseite selbst ein** – das System spielt **keine Ansage** (ähnlich HubSpot/Satellite).

## Ablauf

1. **Vor dem Anruf:** Du fragst die Gegenseite z. B.: „Darf ich das Gespräch zur besseren Nachverfolgung aufzeichnen?“  
2. **Anruf** wie gewohnt (z. B. über `tel:`-Link oder später über Click-to-Call mit Recording).  
3. **Nach dem Anruf:** Im Dialog „Gespräch loggen“ kannst du optional eintragen:
   - **Aufzeichnung (URL)** – Link zur Aufnahme (z. B. von Twilio nach dem Call).
   - **Transkript** – manuell einfügen oder per Button **„Transkript erstellen“** aus der Aufnahme erzeugen (Whisper).
   - Anschließend: **„KI zusammenfassen“** erzeugt eine Stichpunkt-Zusammenfassung (DeepSeek).

Die Felder sind optional. Ohne URL/Transkript verhält sich das Log wie bisher (nur Notizen, Outcome, Dauer).

## Automatische Transkription

- **Im Gesprächsverlauf** (pro Eintrag mit Aufzeichnung): Button **„Transkript erstellen“** ruft die Edge Function `call-transcribe` auf.
- Die Function lädt die Audio-Datei von `recording_url`, sendet sie an **OpenAI Whisper** und speichert das Transkript in `crm_call_logs.transcript`.
- **Voraussetzung:** Supabase Edge Function `call-transcribe` deployt, Secret **OPENAI_API_KEY** gesetzt. Die Aufnahme-URL muss öffentlich abrufbar sein (z. B. Twilio Recording-URL nach dem Call).

## KI-Zusammenfassung

- **Im Gesprächsverlauf** (wenn Transkript vorhanden): Button **„KI zusammenfassen“** sendet das Transkript an **DeepSeek** und speichert die Zusammenfassung in `crm_call_logs.transcript_summary`.
- **Voraussetzung:** `VITE_DEEPSEEK_API_KEY` in der App gesetzt (wie für andere KI-Funktionen).
- Die Zusammenfassung enthält Stichpunkte zu Vereinbarungen, nächsten Schritten und offenen Punkten.

## Datenmodell

- **Tabelle:** `crm_call_logs`
- **Spalten:** `recording_url` (TEXT), `transcript` (TEXT), `transcript_summary` (TEXT), alle nullable.
- Migrationen: `20260307120000_add_call_recording_transcript.sql`, `20260307140000_add_call_transcript_summary.sql`

## Später: Automatik per Twilio o. Ä.

Wenn du einen Telefonie-Provider (z. B. Twilio Voice) nutzt:

- **Click-to-Call mit Recording:** Backend startet Anruf mit `record: true`. Keine System-Ansage – Einwilligung hast du vorher eingeholt.
- **Webhook nach Ende:** Twilio ruft deine Edge Function auf, liefert `RecordingUrl`. Du kannst dieselbe `call-transcribe`-Logik aufrufen (Audio laden → Whisper → Transkript in `crm_call_logs` schreiben).
- Optional: Nach Transkription automatisch **Zusammenfassen** anstoßen (weiterer Aufruf von DeepSeek).

## Rechtliches

Einwilligung zur Aufzeichnung wird von dir (mündlich) eingeholt. Keine automatische Ansage durch das System. Speicherdauer und Zweck in der Datenschutzerklärung dokumentieren.
