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
- **CI:** `.github/workflows/ci.yml` — bei Push/PR: ESLint (nur Fehler), `npm test`, `npm run build`.

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
- **RLS & Validierung:** [VALIDIERUNG_UND_RLS.md](./VALIDIERUNG_UND_RLS.md).

## Feature-Flags (experimentell)

- [FEATURE_FLAGS.md](./FEATURE_FLAGS.md) — `VITE_FEATURE_*` und `isFeatureEnabled()` in `src/lib/featureFlags.ts`.

## Newsticker (RSS)

- Browser können RSS-URLs **nicht direkt** laden (CORS). Deshalb: **Supabase Edge Function** `rss-fetch` holt das XML serverseitig.
- **Ohne Login:** Die Function akzeptiert `apikey` (Anon-Key) + `Authorization: Bearer <Anon-Key>` nur für **bekannte Feed-Hosts** (Allowlist in `supabase/functions/rss-fetch/index.ts`, parallel zu `src/pages/newsticker/newsFetch.ts`).
- **Mit Login:** Beliebige erlaubte öffentliche `http(s)`-URLs (SSRF-Filter wie zuvor).
- Nach Änderungen deployen: `supabase functions deploy rss-fetch` (lokal: `supabase functions serve`).
- Optional: **`VITE_RSS2JSON_API_KEY`** — höheres Kontingent bei [rss2json.com](https://rss2json.com) als zweiter Fallback (CORS-fähig).
- **Tages-Top 3:** Zwei automatische Listen (bundesweit vs. regional) mit **kurzen Gründen** unter jeder Zeile; Zeitfenster **48h / 72h / 7 Tage** und optional **nur Kalendertag Europe/Berlin** (localStorage). Logik: `src/pages/newsticker/dailyTopPicks.ts`. **„Vor Ort“** gewichtet nach Orten aus **Objekten** und **aktiven Deals** (`investmentLocationHints.ts`).
- **Feed-Cache:** Bei Netzwerkfehler wird die letzte erfolgreiche Liste aus **localStorage** angezeigt (bis ca. 48h, `newsCache.ts`).
- **Deduplizierung:** `newsDedup.ts` reduziert Dubletten (gleiche Story, Google vs. Original).
- **Monitoring:** Sentry (optional, siehe unten); bei leerem Newsticker in Prod prüfen: Edge-Function `rss-fetch` deployed, Allowlist, ggf. `VITE_RSS2JSON_API_KEY`.
- **Smoke:** `npm run smoke -- https://…` prüft `/` und optional **`/newsticker`** (SPA muss Route ausliefern).

## Investor-News-Landkarte (täglicher Server-Snapshot)

- **Zweck:** Bundesland-Scores aus denselben RSS-Quellen wie der Newsticker (Heuristik: positive Investoren-/Standort-Signale). Öffentlich lesbar (`news_investor_map_snapshots`, RLS `SELECT` für `anon`).
- **Edge Function:** `supabase/functions/news-daily-aggregate/index.ts` — **POST** mit `Authorization: Bearer <SUPABASE_SERVICE_ROLE_KEY>`. Schreibt/aktualisiert den Snapshot für den Kalendertag **Europe/Berlin**.
- **Deploy:** `supabase functions deploy news-daily-aggregate` (lokal: `supabase functions serve`). In `supabase/config.toml`: `[functions.news-daily-aggregate]` mit `verify_jwt = false` (Auth nur über Service-Role-Header).
- **Migration:** `supabase/migrations/…_news_investor_map_snapshots.sql` auf dem Projekt anwenden.
- **Cron (1×/Tag):** z. B. GitHub Actions **`.github/workflows/news-daily-aggregate.yml`** (Secrets: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`) oder externer Scheduler mit `curl`:

```bash
curl -sS -X POST \
  -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
  -H "apikey: $SUPABASE_ANON_KEY" \
  "$SUPABASE_URL/functions/v1/news-daily-aggregate"
```

- **Frontend:** Route `ROUTES.NEWS_INVESTOR_MAP` (`/news-investor-karte`) — auch **ohne Login** (öffentliche App-Pfade in `RoleRouter`). Datenabruf: `src/integrations/news/investorMapSnapshot.ts`.

## Morgen-Push (Top-6-News, 24h)

- **Zweck:** Täglich **3 bundesweit + 3 „vor Ort“** aus den **letzten 24 Stunden** (Heuristik wie Newsticker-Tages-Top; `src/pages/newsticker/dailyTopPicks.ts` / `supabase/functions/_shared/morningNewsDigest.ts`).
- **Opt-in:** `profiles.morning_news_push_enabled` — Schalter unter **Einstellungen → Benachrichtigungen**.
- **Edge Function:** `supabase/functions/morning-news-push` — **POST** mit `Authorization: Bearer <SUPABASE_SERVICE_ROLE_KEY>`. RSS-URLs parallel zu `newsFetch.ts` (`FEEDS` in der Function).
- **Zielgeräte:** Einträge in `device_tokens`; Versand **iOS** über **APNs** (gleiche Secrets wie `send-push-ios`: `APPLE_TEAM_ID`, `APPLE_KEY_ID`, `APPLE_P8_KEY`). Android-Tokens werden aktuell gezählt, FCM-Versand kann später ergänzt werden.
- **Deploy:** `supabase functions deploy morning-news-push`. In `supabase/config.toml`: `[functions.morning-news-push]` mit `verify_jwt = false`.
- **Cron (~9 Uhr):** z. B. GitHub Actions **`.github/workflows/morning-news-push.yml`** (Standard `0 8 * * *` UTC = 9:00 MEZ) oder externer Scheduler.

## Dialoge und Barrierefreiheit

- **`DialogContent`** und **`SheetContent`** enthalten versteckte Radix-**Title**/**Description**-Fallbacks, damit Screenreader und Radix-Warnungen konsistent abgedeckt sind, auch wenn ein Screen nur eine sichtbare Überschrift hat.
- Sichtbare **`DialogDescription`** / **`SheetDescription`** in den konkreten Features sollten gesetzt werden, wenn zusätzlicher Kontext für Nutzer sinnvoll ist.
