# Architektur – tool-unabhängig

Dieses Projekt ist so aufgebaut, dass du die **Entwicklungsumgebung und das „Vibe Coding“-Tool** wechseln kannst (z. B. Cursor, Lovable, Replit, Bolt, Devin), ohne den App-Code umzubauen.

## Grundsätze

1. **Keine direkten Imports von tool-spezifischen Modulen in der App-Logik.**  
   Nur über Abstraktionen (z. B. `@/integrations/auth`) einbinden.

2. **Standard-Toolchain:** Node, npm, Vite, Git. Keine Abhängigkeit von einer bestimmten IDE oder Cloud-IDE.

3. **Plattform-spezifischer Code** (Auth-Provider, optionaler Tagger, etc.) lebt in:
   - `src/integrations/` – austauschbare Adapter
   - Optional: Build-Plugins in `vite.config.ts` nur optional laden (z. B. `lovable-tagger`)

4. **URLs und Keys** über Umgebungsvariablen oder zentrale Config, keine hart kodierten Hosts in der App-Logik.

## Wichtige Abstraktionen

| Bereich      | App importiert          | Implementierung / Wechsel |
|-------------|--------------------------|----------------------------|
| Auth (OAuth)| `@/integrations/auth`   | In `auth.ts`: aktuell Re-Export aus `lovable/index`. Beim Tool-Wechsel: Implementierung auf Supabase oder anderen Provider umstellen. |
| API/Backend | Supabase Client         | Standard; nur Keys aus Env. Edge Functions (z. B. AI) können eigene Env-Keys haben (z. B. `LOVABLE_API_KEY` → bei Wechsel durch anderen AI-Key ersetzen). |

## Beim Wechsel des Tools

- **Auth:** In `src/integrations/auth.ts` die Funktionen so implementieren, dass sie die neue Plattform (z. B. nur Supabase OAuth) nutzen; App-Code in `Auth.tsx` etc. bleibt unverändert.
- **Build:** `lovable-tagger` kann aus `package.json` entfernt werden; Vite-Config lädt es optional, der Build funktioniert weiter.
- **README / Docs:** Nur generisch halten („npm install && npm run dev“), keine Abhängigkeit von einem einzelnen Tool in der Doku.

## Dateien mit tool-spezifischen Referenzen (nur dort erlaubt)

- `src/integrations/lovable/` – Lovable-Auth-Adapter
- `vite.config.ts` – optionales Laden von `lovable-tagger`
- `supabase/functions/*` – können eigene Env-Keys für AI-Gateways haben; beim Wechsel Keys/URLs anpassen

Der **Rest der Codebase** soll keine Referenzen auf Lovable, Replit, Cursor, Devin o. Ä. enthalten (außer in Kommentaren, die „optional“ oder „z. B.“ erwähnen).

## Refactoring & Synergien

- **Wiederverwendbare UI:** `ExpandableCard` (Collapsible-basiert) und Hook `useDisclosure` für einheitliches Aufklappen/Einklappen; weitere Widgets können schrittweise umgestellt werden.
- **Routen:** `src/lib/routes.ts` – zentrale Helper z. B. `dokumenteForProperty(propertyId)`, `finanzierungForProperty(propertyId)` für Deep-Links von Objektseiten.
- **Fehlerbehandlung:** `handleError` (mit optional `silent: true` für Best-Effort-Flows), `toastErrorWithRetry`, `toastSuccess` aus `toastMessages.ts`; Hintergrund-Checks (z. B. useNotifications, GlobalSearch) melden Fehler an das Tracking.
- **Formulare:** `LoadingButton` und zentrale Toasts für konsistentes Lade- und Erfolgs-Feedback; Mutations nutzen einheitlich `queryKeys` und Invalidierung.
- **Objekt als Hub:** PropertyDetail verlinkt zu Darlehen, Dokumente (gefiltert), Finanzierungs-Cockpit (vorgewählt), Mietübersicht; DealCard zeigt „Zum Objekt“, wenn `property_id` gesetzt ist.
