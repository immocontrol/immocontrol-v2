# send-push-ios — APNs-Push für iOS und Apple Watch

Sendet Push-Benachrichtigungen an alle iOS-Geräte des Users (Einträge in `device_tokens` mit `platform = 'ios'`). Mit **interruption-level: time-sensitive** erscheinen sie als wichtig und werden bei aktivierter Spiegelung auch auf der **Apple Watch** angezeigt.

## Secrets (Supabase Dashboard → Project Settings → Edge Functions → Secrets)

| Secret | Beschreibung |
|--------|--------------|
| `APPLE_TEAM_ID` | Team-ID aus [Apple Developer](https://developer.apple.com/account) (Membership → Team ID). |
| `APPLE_KEY_ID` | Key-ID des APNs-Keys (Developer → Keys → Key erzeugen → Key ID, 10 Zeichen). |
| `APPLE_P8_KEY` | **Kompletter Inhalt** der .p8-Datei (inkl. `-----BEGIN PRIVATE KEY-----` und `-----END PRIVATE KEY-----`). Nur einmal herunterladbar. |
| `APPLE_BUNDLE_ID` | Optional, Standard: `com.immocontrol.app`. |

APNs-Key anlegen: Apple Developer → Certificates, Identifiers & Profiles → Keys → + → Name (z. B. „ImmoControl APNs“), **Apple Push Notifications (APNs)** aktivieren → Continue → Register → .p8 herunterladen und Inhalt als Secret `APPLE_P8_KEY` eintragen.

## Aufruf

- **POST** mit **Authorization: Bearer &lt;user JWT&gt;** (z. B. aus `supabase.auth.getSession()`).
- Body (JSON):
  - `payload`: optional, `{ title: string, body: string, url?: string }`. Ohne Payload wird ein Standard-Titel/Body genutzt.

Beispiel aus der App (wichtige Benachrichtigung an iOS + Watch):

```ts
const { data: { session } } = await supabase.auth.getSession();
await supabase.functions.invoke("send-push-ios", {
  body: {
    payload: {
      title: "Überfällige Miete",
      body: "Objekt Musterstraße 1: Miete für 03/2025 offen.",
      url: "/dashboard",
    },
  },
  headers: { Authorization: `Bearer ${session?.access_token}` },
});
```

Antwort: `{ sent: number, total: number, failed: number, failed_tokens?: string[] }`.

## Kombination mit Web-Push

Für Nutzer, die sowohl im Browser als auch auf dem iPhone die App nutzen: **send-push** (Web-Push) und **send-push-ios** (APNs) mit demselben Payload aufrufen. So erhalten alle Geräte die Benachrichtigung; auf dem iPhone erscheint sie inkl. Spiegelung auf die Apple Watch (wenn der User „iPhone-Benachrichtigungen spiegeln“ für ImmoControl aktiviert hat).
