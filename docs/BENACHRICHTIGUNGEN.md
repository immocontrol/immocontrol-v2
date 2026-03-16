# Benachrichtigungen (ImmoControl)

Übersicht Kanäle und Einstellungen (Vorschlag 12).

## Kanäle

- **In-App:** Hinweise im Dashboard (z. B. überfällige Mieten, Vertragsende, offene Tickets). Nutzung von `useNotifications` und einzelnen Bannern (OverduePaymentBanner, LoanFixedInterestCountdown, etc.).
- **Browser:** Browser-Notification-API (optional, nach Berechtigung) — z. B. in `useNotifications`; Benachrichtigungen erscheinen auch bei geöffnetem Tab.
- **iOS/Apple Watch:** Native Push (APNs) über die ImmoControl-iOS-App. Nach Berechtigung werden wichtige Benachrichtigungen auf dem iPhone und bei aktivierter Spiegelung auch auf der **Apple Watch** angezeigt. Siehe unten „Apple Watch“.
- **Telegram:** Einstellungen unter **Einstellungen → Telegram** (`TelegramSettings`). Bot verknüpfen für Benachrichtigungen per Telegram. **ImmoMetrica Direktimport:** Webhook aktivieren – Deals aus dem ImmoMetrica-Kanal landen automatisch in der Deals-Liste, auch wenn die App geschlossen ist.

## Wo einstellen

- **Telegram:** Einstellungen → Bereich „Telegram“.
- **Browser-Benachrichtigungen:** Werden bei Bedarf angefragt (Permission); keine zentrale Ein/Aus-Schaltung in der App außer über den Browser selbst.

## Apple Watch (wichtige Benachrichtigungen)

Damit wichtige Benachrichtigungen auch auf der **Apple Watch** erscheinen:

1. **iPhone:** In der ImmoControl-App Benachrichtigungsberechtigung erlauben (wird beim ersten relevanten Hinweis oder in den Einstellungen angefragt).
2. **Apple Watch:** Auf dem iPhone **Watch**-App öffnen → **Benachrichtigungen** → **ImmoControl** → **iPhone-Benachrichtigungen spiegeln** aktivieren. Dann werden Push-Benachrichtigungen der App auf die Uhr gespiegelt.
3. **Backend:** Die Edge Function **`send-push-ios`** sendet bereits mit **`interruption-level: time-sensitive`**. In Supabase Secrets `APPLE_TEAM_ID`, `APPLE_KEY_ID` und `APPLE_P8_KEY` (Inhalt der .p8-Datei aus Apple Developer) setzen, dann z. B. aus der App oder aus anderen Functions `supabase.functions.invoke("send-push-ios", { body: { payload: { title, body, url } } })` aufrufen. Siehe `supabase/functions/send-push-ios/README.md`.

Es ist **keine eigene Watch-App** nötig – die Spiegelung übernimmt iOS.

## Geplant

Eine zentrale Sektion „Benachrichtigungen“ in den Einstellungen (pro Kanal und Thema ein-/ausschaltbar) ist vorgesehen und kann schrittweise ergänzt werden.
