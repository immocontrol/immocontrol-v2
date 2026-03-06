# Offline-Verhalten (ImmoControl)

## Übersicht

Die App unterstützt Offline-Nutzung für zentrale Daten: Objekte werden gecacht, und bestimmte Aktionen werden in eine lokale Warteschlange gelegt und beim nächsten Verbindungsaufbau mit dem Server abgeglichen.

## Gequeute Aktionen

- **Objekte anlegen:** Wenn du offline ein neues Objekt anlegst, wird es in der **Offline-Queue** gespeichert. Beim Speichern erscheint der Hinweis: „Wird gespeichert, sobald du wieder online bist.“ Nach Reconnect werden die gequeuten Einträge in der Reihenfolge an Supabase gesendet.

## Technik

- **Cache:** IndexedDB (`immocontrol-offline`) mit Stores für Cache und `pending_mutations`.
- **Sync:** `useBackgroundSync` (in App.tsx aktiviert) hört auf „online“ und auf Nachrichten vom Service Worker und ruft `syncPendingToServer()` auf.
- **Reihenfolge:** Mutations werden in der Reihenfolge abgearbeitet, in der sie gequeuet wurden. Schlägt eine Mutation fehl, wird die Verarbeitung gestoppt; bereits erfolgreiche werden aus der Queue entfernt, der Rest bleibt für den nächsten Sync.
- **Konflikte:** Es gibt keine automatische Konfliktauflösung (z. B. Last-Write-Wins). Bei Fehlern (z. B. doppelte IDs oder RLS) bleibt die betroffene Mutation in der Queue; Nutzer können Fehler in der App (z. B. Toasts) sehen.

## Sichtbarkeit

- **Offline-Banner:** Wenn kein Netz verfügbar ist, erscheint ein Banner (Desktop und Mobil).
- **Mobile Offline Queue:** Auf Mobil zeigt die Offline-Queue die Anzahl ausstehender Aktionen und optional einen Sync-Button nach Reconnect.

## Geplante Erweiterungen

- Offline-Queue für **Kontakte** und **Darlehen** (analog zu Objekten) ist vorgesehen.
- Optionale Konfliktauflösung oder bessere Fehlermeldungen bei Sync-Fehlern können ergänzt werden.
