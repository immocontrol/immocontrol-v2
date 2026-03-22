# Betrieb, Deploy und Fehlerdiagnose

Diese Seite ergänzt [ARCHITECTURE.md](./ARCHITECTURE.md) um **Produktion**, **Monitoring** und **Support** — ohne Bindung an ein bestimmtes Hosting-Tool.

## Build und Version

- **`npm run build`** erzeugt `dist/` inkl. **`dist/version.json`** (Zeitstempel aus dem Vite-Plugin `version-json` in `vite.config.ts` — gleicher Wert wie `__APP_VERSION__` im Build).
- **Chunk-/Deploy-Fehler:** Nach einem Deployment können alte Browser-Tabs noch veraltete JS-Chunks anfragen. Die globale **ErrorBoundary** erkennt typische Meldungen (z. B. „Failed to fetch dynamically imported module“) und weist auf **Neuladen / harten Reload** hin.

## Smoke-Check nach Deploy

- **`npm run smoke`** — prüft per HTTP, ob die App unter einer Basis-URL erreichbar ist und loggt optional `version.json`.
- **URL:** erstes Argument oder Umgebungsvariable **`SMOKE_URL`** (Standard: `http://127.0.0.1:4173`, z. B. nach `npm run build && npm run preview`).

```bash
SMOKE_URL=https://ihre-domain.de npm run smoke
# oder
npm run smoke -- https://ihre-domain.de
```

- Optional: GitHub Actions **„Smoke (manual)“** (`.github/workflows/smoke.yml`) — manuell auslösen und Deploy-URL eintragen.

## Fehler sammeln und melden

| Mechanismus | Zweck |
|-------------|--------|
| **`src/lib/errorTracking.ts`** | Lokale Historie in `localStorage` (redigiert), Export/Kopieren für Diagnose. |
| **`handleError` / `toErrorMessage`** (`src/lib/handleError.ts`) | Einheitliche Toasts und Meldungen je Kontext (`supabase`, `network`, …). |
| **`getMutationErrorMessage`** (`src/lib/mutationErrorHandler.ts`) | Supabase/React-Query-Mutationen. |
| **ErrorBoundary** (`src/components/ErrorBoundary.tsx`) | Button **„Fehler kopieren“** für Support. |
| **Sentry (optional)** | `VITE_SENTRY_DSN` setzen; Initialisierung in `src/lib/sentryInit.ts` — `window.__immocontrol_reportError` leitet an Sentry weiter, wenn `@sentry/react` installiert ist. |

In **Entwicklung** bieten manche Toasts **„Copy for AI“** (Fehlerkontext für Debugging) — nicht für produktive Nutzer gedacht.

## Session / Auth

- Supabase **`autoRefreshToken: true`** (`src/integrations/supabase/client.ts`).
- Ungültige Refresh-Tokens (`refresh_token_not_found`, `invalid_grant`, …) werden in **`useAuth`** abgefangen (Toast, lokales Abmelden) und in **`getMutationErrorMessage`** in eine verständliche Meldung übersetzt.

## Datenbank

- Schemaänderungen: Migrationen unter `supabase/migrations/` — auf dem **Ziel-Projekt** anwenden (`supabase db push` oder CI/CD eurer Wahl).

## Dialoge und Barrierefreiheit

- **`DialogContent`** und **`SheetContent`** enthalten versteckte Radix-**Title**/**Description**-Fallbacks, damit Screenreader und Radix-Warnungen konsistent abgedeckt sind, auch wenn ein Screen nur eine sichtbare Überschrift hat.
- Sichtbare **`DialogDescription`** / **`SheetDescription`** in den konkreten Features sollten gesetzt werden, wenn zusätzlicher Kontext für Nutzer sinnvoll ist.
