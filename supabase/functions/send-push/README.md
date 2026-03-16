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

## iOS / Apple Watch (APNs)

Die App speichert APNs-Geräte-Tokens in der Tabelle **`device_tokens`** (Spalten: `user_id`, `token`, `platform = 'ios'`). Um wichtige Benachrichtigungen auch auf dem iPhone und gespiegelt auf der **Apple Watch** anzuzeigen, muss ein separater Send-Weg (z. B. eigene Edge Function oder externer Service) die Nachrichten per **APNs** an diese Tokens senden. Dabei für „wichtige“ Benachrichtigungen den APNs-Header **`apns-push-type: alert`** und im Payload **`aps.relevance-score`** bzw. **`aps.interruption-level`** nutzen; für sofortige Anzeige inkl. Watch empfiehlt Apple **`interruption-level: time-sensitive`** (siehe [Apple: Sending Notification Requests to APNs](https://developer.apple.com/documentation/usernotifications/setting_up_a_remote_notification_server/sending_notification_requests_to_apns)). Die vorliegende `send-push`-Function versendet nur Web-Push (VAPID); APNs-Versand wäre eine Erweiterung mit Apple Developer Key (.p8) und z. B. `node-apn` oder einem APNs-HTTP/2-Client.
