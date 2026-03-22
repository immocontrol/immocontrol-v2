# Validierung und Row Level Security (RLS)

Kurzüberblick, wo **Validierung** und **Zugriffskontrolle** in ImmoControl liegen — ergänzend zu [ARCHITECTURE.md](./ARCHITECTURE.md).

## Client-seitige Validierung

- **Formulare:** Zod-Schemas in `src/lib/schemas.ts` (und teils lokale Schemas) — Pflichtfelder, Zahlenbereiche, deutsche Fehlermeldungen.
- **API-Antworten:** Wo Daten aus Supabase kommen, helfen Zod-Schemas in `src/lib/supabaseSchemas.ts` (optional) beim Parsen/Abweichungserkennung.
- **Kein Ersatz für Server-Validierung:** Alles im Browser kann umgangen werden; die Datenbank und RLS bleiben maßgeblich.

## Supabase: RLS und Policies

- **Wo definiert:** In SQL-Migrationen unter `supabase/migrations/` (z. B. `CREATE POLICY … ON … FOR ALL USING (…)`).
- **Typische Muster:** Zugriff nur mit `auth.uid()` = `user_id` der Zeile, oder Mitgliedschaft über Rollen-Tabellen — je nach Tabelle.
- **Änderungen:** Neue Policies oder Anpassungen **immer** per Migration versionieren und auf Staging/Produktion anwenden (`supabase db push` oder euer Deploy-Pipeline).

## Pflichtfelder pro Tabelle (Orientierung)

Die **Single Source of Truth** sind die Migrationen (`CREATE TABLE`, `NOT NULL`) und die generierten/ gepflegten Typen in `src/integrations/supabase/types.ts`.  
App-Formulare können zusätzliche Regeln haben (z. B. UX „mindestens ein Kontakt“), die nicht in der DB stehen.

| Bereich | Typen / Schema |
|--------|----------------|
| Objekte | `properties` in `types.ts`, Form: `addPropertyFormSchema` |
| Profile / Rollen | `profiles`, `user_roles` |
| Geschäftsdaten | `deals`, `loans`, `tenants`, … jeweils in `types.ts` |

## Checkliste bei neuen Features

1. Migration: Tabellen/Spalten + RLS-Policies.
2. `types.ts` aktualisieren (oder Generator nutzen).
3. Zod/Form-Schema in `schemas.ts` ergänzen, wo Nutzer eingibt.
4. Kurz in dieser Doku oder im PR vermerken, welche RLS-Regel gilt.
