# ImmoControl

Immobilien-Portfolio verwalten: Renditen, Cashflow und Wertentwicklung auf einen Blick.

## Tech-Stack

- **Vite** – Build & Dev-Server
- **React 18** + **TypeScript**
- **Tailwind CSS** + **shadcn/ui** (Radix)
- **Supabase** – Datenbank, Auth, Storage (einzige Backend-Datenbank)
- **React Query** – Server State

**Deployment:** Web-App über **Railway**, iOS-App über **Codemagic**.

Das Projekt ist **tool-unabhängig**: Du kannst es in beliebigen IDEs und mit beliebigen Tools (Cursor, VS Code, Lovable, Replit, Bolt, GitHub Codespaces, etc.) bearbeiten. Der Code nutzt Standard-NPM-Skripte und keine plattformspezifischen Pfade.

## Lokal starten

```sh
git clone <REPO_URL>
cd immocontrol-v2
npm install
npm run dev
```

- App: **http://localhost:8080**
- Build: `npm run build`
- Build mit Bundle-Analyse (erzeugt `dist/stats.html`): `ANALYZE=1 npm run build` bzw. `npm run build:analyze` (Unix)
- Preview: `npm run preview`
- Tests: `npm run test`

## Umgebungsvariablen

Lege `.env` bzw. `.env.local` an (siehe `.env.example` falls vorhanden). Typisch:

- `VITE_SUPABASE_URL` – Supabase Project URL
- `VITE_SUPABASE_ANON_KEY` – Supabase anon key
- `VITE_APP_URL` – (optional) Canonical- und OG-URL der App, z. B. `https://deine-app.de`. Beim Build werden `index.html`-Platzhalter ersetzt.
- `VITE_APP_OG_IMAGE` – (optional) Voll-URL des OG/Twitter-Bildes. Fallback: Default-Image.
- `VITE_SENTRY_DSN` – (optional) Wenn gesetzt, werden Fehler automatisch an Sentry gesendet (Projekt nutzt `@sentry/react`). Sonst: Fehler landen nur in localStorage; `window.__immocontrol_reportError` kann manuell gesetzt werden.
- **`VITE_DEEPSEEK_API_KEY`** – (optional) API-Key von [DeepSeek](https://platform.deepseek.com). Wenn gesetzt, nutzen der **Immo-Chat** (Seite „Immo-AI“ und Chat-Bubble) und der **KI-Tipp** auf dem Dashboard die DeepSeek-API direkt. Ohne Key wird die bestehende Supabase Edge Function `immo-ai-chat` verwendet. **Hinweis:** Der Key ist im Frontend sichtbar; für Produktion empfiehlt sich ein eigener Proxy, der den Key server-seitig hält.

Weitere Keys (z. B. für Auth-Provider) je nach Deployment.

## Deployment

- **Web (Railway)**: Projekt auf [Railway](https://railway.app) deployen. Env-Variablen (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` etc.) im Railway-Dashboard unter dem Service → Variables setzen. Build: `npm run build`, Output: `dist/` (z. B. mit Caddy oder `npm run start`).
- **iOS (Codemagic)**: Build und TestFlight/App Store über [Codemagic](https://codemagic.io). Env-Variablen in Codemagic unter Environment variables (z. B. Gruppe `supabase_config`) setzen und dem Workflow zuweisen.
- **Canonical / OG**: Beim Build werden `__VITE_APP_URL__` und `__VITE_APP_OG_IMAGE__` in `index.html` durch die genannten Env-Variablen ersetzt.

## Projektstruktur (wichtig für Tool-Wechsel)

- **`src/integrations/auth.ts`** – Einzige Auth-API, die die App nutzt. Implementierung (z. B. Lovable, Supabase direkt) liegt in `src/integrations/` und kann gewechselt werden, ohne den Rest der App anzufassen.
- **`src/integrations/lovable/`** – Optional; nur wenn du den Lovable-Auth-Adapter nutzt. Beim Wechsel des Tools die Implementierung in `auth.ts` umstellen.
- **Keine Pflicht zu tool-spezifischen Paketen**: Build läuft auch ohne z. B. `lovable-tagger` (wird in Vite nur optional geladen).

## Fundamentale Verbesserungen (Auswahl)

**Batch 1**
- **UX**: Einheitliche Empty-State-Komponente (Nachrichten, Dokumente); Return-URL nach Login; 404 mit A11y und ErrorBoundary; Lade-Anzeige mit role="status"/aria-live.
- **Performance**: Route-Preload 3s; Service-Worker zentral; Document-Queries staleTime 2 Min.
- **Sicherheit**: AI-Markdown rehype-sanitize; CSP api.deepseek.com; Form-Sanitization Verträge; zentraler Mutation-Error-Handler.
- **Barrierefreiheit**: PageLoader/404 Live-Region; Fokus-Ring „Zurück zum Portfolio“.
- **Daten-Feedback**: Indikator „Daten werden aktualisiert…“; Empty-State-Texte in i18n.

**Batch 2**
- **EmptyState**: ServiceContracts, InvoiceManagement, Nebenkosten, DocumentExpiryTracker; Lade-Fallbacks mit role="status" (App, ServiceContracts, InvoiceManagement).
- **Mutation-Handler**: Loans, Contacts (löschen/wiederherstellen/endgültig), ServiceContracts, InvoiceManagement; LoadingButton bei Loans-Speichern.
- **Formatierung**: formatDate/formatTime in ContractManagement, ServiceContracts, InvoiceManagement, MessageCenter, PropertyDocuments, DocumentExpiryTracker.
- **A11y**: aria-label für Buttons (Dokument hochladen/löschen, Nachricht senden, Abmelden, Vertrag/Rechnung löschen, CashflowKalender Vorheriger/Nächster Monat).
- **Sicherheit**: sanitizeFormData beim Deal-Speichern; Auth-Seite mit Safe-Area (pb safe-area-inset-bottom).
- **Performance**: loading="lazy" für Bilder (DamageReport, MobileMaintenanceTimeline); Tickets-Queries staleTime 2 Min.

## Dokumentation

- **CHANGELOG.md** – Änderungshistorie (Neu, Geändert, Behoben)
- **.github/CONTRIBUTING.md** – Commit-Konventionen
- **docs/** – Architektur, AI (DEEPSEEK_NUTZUNG), Synergien (SYNERGIEN), Mobile (MOBILE_BREAKPOINTS, USABILITY_UND_MOBILE), Dokumentationsrichtlinien (DOKUMENTATION)
- **docs/IOS_APPSTORE.md** – ImmoControl als native iOS-App im App Store (Capacitor, Xcode, App Store Connect)

## Lizenz & Support

Projekt-spezifisch. Bei Fragen: Repo-Issues oder Kontakt des Betreibers.
