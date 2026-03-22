# Offline-Verhalten (ImmoControl)

Kurzbeschreibung, welche Aktionen offline gequeuet werden und wie der Sync funktioniert.

## Aktuell unterstützt

### Objekte (Properties) — einzige produktive Queue-Nutzung

- **Anlegen:** Nur **`addProperty`** in `PropertyContext` schreibt bei Offline ein **`insert`** auf Tabelle `properties` in die Queue. Toast: „Wird gespeichert, sobald du wieder online bist.“
- **Nicht gequeuet:** Update/Löschen von Objekten offline, sowie andere Tabellen (Kontakte, Darlehen, …) — Sync-Engine unterstützt generisch `insert`/`update`/`delete`, aber es gibt derzeit **keine weiteren Aufrufe** von `addPendingMutation` außer Objekt-Anlegen.
- **Speicherort:** IndexedDB, Datenbankname `immocontrol-offline`, Store **`pending_mutations`** (Auto-Increment-Keys).

### Lesen (Cache)

- Abfragen (React Query) nutzen bei Offline den IndexedDB-Cache, wenn zuvor Daten geladen wurden. Keine Garantie auf Aktualität.

## Ablauf

1. **Online:** Mutations gehen direkt an Supabase.
2. **Offline:** Mutations (derzeit nur Objekt-Anlegen) werden in die Queue geschrieben, lokaler Cache ggf. optimistisch aktualisiert.
3. **Wieder online:** `useOfflineCache` / Background-Sync verarbeitet die Queue in Reihenfolge. Bei Fehler (z. B. 409) wird die Mutation übersprungen oder gemeldet; der Rest läuft weiter.
4. Nach Sync: entsprechende Query-Keys werden invalidiert (z. B. `queryKeys.properties.all`).

## Konflikthandling nach Reconnect

- **Reihenfolge:** FIFO gemäß Speicherreihenfolge in `pending_mutations`.
- **Fehler:** Bei **erstem** Fehler stoppt der Sync; es werden keine weiteren Mutationen in **diesem** Lauf versucht. Erfolgreiche vor dem Fehler sind aus der Queue entfernt.
- **Duplikate:** Mehrfaches offline Anlegen erzeugt mehrere Inserts nach Reconnect (keine Deduplizierung).

## Geplante Erweiterungen

- **Kontakte / Darlehen / weitere Tabellen:** `addPendingMutation` aus Kontexten analog zu Objekten aufrufen; Sync-Loop ist tabellenagnostisch.
- **Konfliktlösung:** ggf. Retry, Merge oder Nutzerhinweis bei 409 — derzeit nicht implementiert.

## Technische Referenz

- Hook: `useOfflineCache.ts` (IndexedDB, `addPendingMutation`, `getPendingMutations`, Sync-Loop).
- PropertyContext: `addProperty` prüft `isOnline` und schreibt bei Offline in die Queue.
- Query-Invalidierung nach Sync: `queryKeys.properties.all` in `useBackgroundSync`.
