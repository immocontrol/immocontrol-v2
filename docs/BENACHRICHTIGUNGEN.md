# Benachrichtigungen (ImmoControl)

Übersicht Kanäle und Einstellungen (Vorschlag 12).

## Kanäle

- **In-App:** Hinweise im Dashboard (z. B. überfällige Mieten, Vertragsende, offene Tickets). Nutzung von `useNotifications` und einzelnen Bannern (OverduePaymentBanner, LoanFixedInterestCountdown, etc.).
- **Browser:** Browser-Notification-API (optional, nach Berechtigung) — z. B. in `useNotifications`; Benachrichtigungen erscheinen auch bei geöffnetem Tab.
- **Telegram:** Einstellungen unter **Einstellungen → Telegram** (`TelegramSettings`). Bot verknüpfen für Benachrichtigungen per Telegram.

## Wo einstellen

- **Telegram:** Einstellungen → Bereich „Telegram“.
- **Browser-Benachrichtigungen:** Werden bei Bedarf angefragt (Permission); keine zentrale Ein/Aus-Schaltung in der App außer über den Browser selbst.

## Geplant

Eine zentrale Sektion „Benachrichtigungen“ in den Einstellungen (pro Kanal und Thema ein-/ausschaltbar) ist vorgesehen und kann schrittweise ergänzt werden.
