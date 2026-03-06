# Validierung und RLS (ImmoControl)

Kurze Übersicht, wo Pflichtfelder und Berechtigungen definiert sind (Vorschlag 18).

## Frontend-Validierung

- **Zentrale Schemas:** `src/lib/schemas.ts` — Zod-Schemas für Objekt, Kontakt, Darlehen, Deal, Mieter, Vertrag, Ticket, Rechnungen usw. Mit deutschen Fehlermeldungen.
- **Add-Property-Formular:** Nutzt `addPropertyFormSchema` aus `schemas.ts` (einheitlich mit dem Rest).
- **Datumslogik:** `src/lib/validation.ts` — `validateDateRange(start, end)` für „Enddatum > Startdatum“. In Formularen mit Start-/Enddatum nutzen.
- **E-Mail/Telefon:** `validation.ts` — `isValidEmail`, `isValidPhoneDE`, `isValidDate`.

## Supabase / RLS

- **Tabellendefinitionen:** `src/integrations/supabase/types.ts` (generiert bzw. abgeleitet von der Datenbank).
- **RLS (Row Level Security):** In Supabase Dashboard pro Tabelle konfiguriert. Typisch: Lese-/Schreibzugriff nur für `auth.uid() = user_id` (oder entsprechende Spalte).
- **Pflichtfelder pro Tabelle:** Entsprechen den `Insert`-Typen in `types.ts`; Felder ohne `?` sind Pflicht. Frontend-Schemas in `schemas.ts` sollten dieselben Pflichtfelder abdecken.

## Empfehlung

Bei neuen Formularen: Schema aus `schemas.ts` verwenden (oder erweitern), `zodResolver` in react-hook-form, und bei Start-/Enddatum optional `validateDateRange` in einem `.refine()` oder im Submit-Handler aufrufen.
