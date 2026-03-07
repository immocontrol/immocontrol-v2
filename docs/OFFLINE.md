# Offline-Verhalten (ImmoControl)

Kurzbeschreibung, welche Aktionen offline gequeuet werden und wie der Sync funktioniert.

## Aktuell unterstützt

### Objekte (Properties)

- **Anlegen:** Beim Anlegen eines Objekts ohne Netz wird die Mutation in die Offline-Queue geschrieben. Toast: „Wird gespeichert, sobald du wieder online bist.“
- **Sync:** Beim Wieder-online werden ausstehende Mutationen nacheinander an Supabase gesendet. Danach wird der Properties-Cache invalidiert, damit die echten Daten geladen werden.
- **Speicherort:** IndexedDB (Store `pending_mutations`), Key `immocontrol-offline`.

### Lesen (Cache)

- Abfragen (React Query) nutzen bei Offline den IndexedDB-Cache, wenn zuvor Daten geladen wurden. Keine Garantie auf Aktualität.

## Ablauf

1. **Online:** Mutations gehen direkt an Supabase.
2. **Offline:** Mutations (derzeit nur Objekt-Anlegen) werden in die Queue geschrieben, lokaler Cache ggf. optimistisch aktualisiert.
3. **Wieder online:** `useOfflineCache` / Background-Sync verarbeitet die Queue in Reihenfolge. Bei Fehler (z. B. 409) wird die Mutation übersprungen oder gemeldet; der Rest läuft weiter.
4. Nach Sync: entsprechende Query-Keys werden invalidiert (z. B. `queryKeys.properties.all`).

## Geplante Erweiterungen

- **Kontakte:** Offline-Queue für Anlegen/Bearbeiten/Löschen (analog zu Objekten).
- **Darlehen:** Offline-Queue für Anlegen/Bearbeiten.
- **Konflikthandling:** Dokumentation, wie Duplikate oder Konflikte (z. B. gleiche ID) behandelt werden.

## Technische Referenz

- Hook: `useOfflineCache.ts` (IndexedDB, `addPendingMutation`, `getPendingMutations`, Sync-Loop).
- PropertyContext: `addProperty` prüft `isOnline` und schreibt bei Offline in die Queue.
- Query-Invalidierung nach Sync: `queryKeys.properties.all` in `useBackgroundSync`.
