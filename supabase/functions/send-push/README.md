# send-push — Web-Push bei geschlossener App

Sendet Web-Push an Abonnements aus der Tabelle `push_subscriptions` (pro User).

## Aufruf

- **POST** mit **Authorization: Bearer &lt;user JWT&gt;** (z. B. aus `supabase.auth.getSession()`).
- Body (JSON):
  - `user_id`: optional, wird auf den authentifizierten User begrenzt.
  - `payload`: optional, `{ title, body, url?, tag? }`. Ohne Payload wird ein Standard-Test-Push gesendet.

Beispiel aus der App (mit Session):

```ts
const { data: { session } } = await supabase.auth.getSession();
await supabase.functions.invoke("send-push", {
  body: { payload: { title: "Test", body: "Push bei geschlossener App", url: "/" } },
  headers: { Authorization: `Bearer ${session?.access_token}` },
});
```

## VAPID-Konfiguration

1. VAPID-Keys im JWK-Format (für Deno-Library `@negrel/webpush`):
   - Keys erzeugen und exportieren (z. B. in einem kleinen Deno-Skript mit `generateVapidKeys()` und `exportVapidKeys()` aus `jsr:@negrel/webpush`).
   - Öffentlichen Schlüssel als Base64-URL für den Client nutzen → `VITE_VAPID_PUBLIC_KEY` in der App.
   - Den exportierten JSON (privateKey + publicKey als JWK) in Supabase Secrets speichern:
     ```bash
     supabase secrets set VAPID_KEYS_JSON='{"privateKey":{...},"publicKey":{...}}'
     ```
2. Optional: `VAPID_CONTACT_MAIL` (z. B. `noreply@immocontrol.app`).

Ohne `VAPID_KEYS_JSON` antwortet die Function mit 503 und Hinweis auf die Konfiguration.
