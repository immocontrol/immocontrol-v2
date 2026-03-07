# Voice- und Calling-Architektur

Einheitliche Anruf-Schnittstelle für die App. **Tel-Provider** (öffnet `tel:`-Links) oder **Anruf direkt aus der App** (Twilio Voice im Browser, WebRTC).

## Übersicht

- **Ort der Logik:** `src/integrations/voice/`
- **Typen & Interface:** `types.ts` – `VoiceProvider`, `StartCallOptions`, `StartCallResult`, `CallContext`
- **Provider:** `tel` (Standard), `twilio` (Backend startet Anruf), `twilio-device` (Anruf aus dem Browser)
- **Einstieg:** `index.ts` – `getVoiceProvider()`, `startCall()`, `getCallUrl()`, `registerVoiceProvider()`, `getActiveCall()` / `subscribeActiveCall()` für aktiven VoIP-Anruf
- **Hook:** `src/hooks/useVoiceCall.ts` – `startCall`, `getCallUrl`, `providerId`, `supportsRecording`
- **UI:** `ActiveCallBar` – zeigt „Im Gespräch“ und Auflegen, wenn ein VoIP-Anruf aktiv ist

## Konfiguration

| Variable | Bedeutung | Standard |
|----------|------------|----------|
| `VITE_VOICE_PROVIDER` | Provider-ID: `tel`, `twilio` oder `twilio-device` | `tel` |
| `VITE_VOICE_API_URL` | Backend-URL für VoIP (nur bei `twilio`, nicht bei `twilio-device`) | – |

Beispiel `.env`:

```env
# Standard: Anruf über Gerät (tel:-Link)
VITE_VOICE_PROVIDER=tel

# Anruf direkt aus der App (Browser/WebRTC, Mikrofon + Lautsprecher):
# VITE_VOICE_PROVIDER=twilio-device
# → Edge Functions voice-token + voice-twiml deployen, Twilio-TwiML-App konfigurieren (siehe unten)
```

## Nutzung in der App

- **Links (href):** `getCallUrl(phone)` – z. B. `<a href={getCallUrl(phone)}>`
- **Button „Anrufen“ mit Kontext (Lead, Recording):** `startCall(phone, { leadId, record: true, toLabel })` – verwendet den konfigurierten Provider; bei Twilio geht Kontext ans Backend.
- **Hook:** `const { startCall, getCallUrl, providerId, supportsRecording } = useVoiceCall();`

Angebundene Stellen: CRM (Leads, Suchergebnisse, Scout), GewerbeScout, Contacts, TenantManagement, TicketSystem, MobileCRMCallAction.

## Anruf direkt aus der App (twilio-device)

Mit **Twilio Voice** kannst du vom Browser/Tablet aus anrufen – ohne Handy. Mikrofon und Lautsprecher der App werden genutzt (WebRTC).

### Voraussetzungen

1. **Twilio-Konto** mit Programmable Voice.
2. **TwiML-App** in der Twilio Console anlegen:
   - **Voice Request URL:** `https://<dein-projekt>.supabase.co/functions/v1/voice-twiml` (GET; Twilio ruft diese URL mit `?To=...&Record=...` auf)
   - **Voice Request Method:** GET
3. **API Key** in Twilio erstellen (Account → API Keys) – SID und Secret für die Edge Function.
4. **Edge Functions deployen** und Secrets setzen:
   - `voice-token` – gibt JWT für das Frontend zurück (Auth erforderlich).
   - `voice-twiml` – liefert TwiML zum Wählen der Zielnummer.

### Supabase Secrets (für voice-token)

| Secret | Beschreibung |
|--------|--------------|
| `TWILIO_ACCOUNT_SID` | Account SID aus Twilio Console |
| `TWILIO_API_KEY_SID` | API Key SID |
| `TWILIO_API_KEY_SECRET` | API Key Secret |
| `TWILIO_TWIML_APP_SID` | TwiML Application SID (der App mit Voice URL → voice-twiml) |

### Aktivierung

- In der App: `VITE_VOICE_PROVIDER=twilio-device` setzen.
- Keine `VITE_VOICE_API_URL` nötig – das Frontend ruft direkt `supabase.functions.invoke('voice-token')` auf und nutzt dann das Twilio Device SDK.

Beim Klick auf „Anrufen“ (CRM, Scout, Kontakte usw.) wird der Anruf im Browser aufgebaut; die Leiste „Im Gespräch“ mit Button „Auflegen“ erscheint oben (Desktop) bzw. oben auf dem Bildschirm (Mobile).

---

## Twilio Backend-Anruf (twilio – optional)

Falls du Anrufe **vom Server aus** starten willst (z. B. Click-to-Call, bei dem zuerst das Telefon des Nutzers klingelt):

### 1. Backend (Supabase Edge Function oder eigener Server)

- **POST** `{VITE_VOICE_API_URL}/voice/start`
- **Body (JSON):** `{ to: string, leadId?: string, contactId?: string, record?: boolean }`
- **Response (JSON):** `{ callId?: string }` bei Erfolg.

### 2. Frontend

- `VITE_VOICE_PROVIDER=twilio` und `VITE_VOICE_API_URL` setzen.

### 3. Eigenen Provider hinzufügen

1. Neuen Provider in `src/integrations/voice/` implementieren (Interface aus `types.ts`).
2. In `index.ts` importieren und in `PROVIDER_REGISTRY` eintragen (oder `registerVoiceProvider()` aufrufen).
3. Provider-ID in `VITE_VOICE_PROVIDER` setzen.

## Abgrenzung zur Aufzeichnung

Aufzeichnung und Transkript werden in `crm_call_logs` geführt und im Dialog „Gespräch loggen“ optional eingetragen. Einwilligung holt der Nutzer selbst – keine System-Ansage. Details: `docs/CALL_RECORDING.md`.
