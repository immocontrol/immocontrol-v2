# ImmoControl

Immobilien-Portfolio verwalten: Renditen, Cashflow und Wertentwicklung auf einen Blick.

## Tech-Stack

- **Vite** – Build & Dev-Server
- **React 18** + **TypeScript**
- **Tailwind CSS** + **shadcn/ui** (Radix)
- **Supabase** – Auth, DB, Storage
- **React Query** – Server State

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
- Preview: `npm run preview`
- Tests: `npm run test`

## Umgebungsvariablen

Lege `.env` bzw. `.env.local` an (siehe `.env.example` falls vorhanden). Typisch:

- `VITE_SUPABASE_URL` – Supabase Project URL
- `VITE_SUPABASE_ANON_KEY` – Supabase anon key
- `VITE_APP_URL` – (optional) Canonical- und OG-URL der App, z. B. `https://deine-app.de`. Beim Build werden `index.html`-Platzhalter ersetzt.
- `VITE_APP_OG_IMAGE` – (optional) Voll-URL des OG/Twitter-Bildes. Fallback: Default-Image.
- `VITE_SENTRY_DSN` – (optional) Wenn gesetzt, können Fehler per `window.__immocontrol_reportError` (z. B. an Sentry) gesendet werden. Fehlermeldungen werden vorher bereinigt (keine Passwörter/PII).
- **`VITE_DEEPSEEK_API_KEY`** – (optional) API-Key von [DeepSeek](https://platform.deepseek.com). Wenn gesetzt, nutzen der **Immo-Chat** (Seite „Immo-AI“ und Chat-Bubble) und der **KI-Tipp** auf dem Dashboard die DeepSeek-API direkt. Ohne Key wird die bestehende Supabase Edge Function `immo-ai-chat` verwendet. **Hinweis:** Der Key ist im Frontend sichtbar; für Produktion empfiehlt sich ein eigener Proxy, der den Key server-seitig hält.

Weitere Keys (z. B. für Auth-Provider) je nach Deployment.

## Deployment

- **Vercel**: Repo auf [vercel.com](https://vercel.com) importieren (Import Git Repository). `vercel.json` ist vorhanden – Build & Deploy laufen automatisch. Env-Variablen (Supabase, optional DeepSeek) im Vercel-Dashboard unter Settings → Environment Variables setzen.
- **Netlify**: Repo auf [netlify.com](https://netlify.com) importieren. `netlify.toml` ist vorhanden – Build-Kommando und `publish`-Ordner sind gesetzt. **Wichtig:** `VITE_SUPABASE_URL` und `VITE_SUPABASE_PUBLISHABLE_KEY` unter Site configuration → Environment variables eintragen, Scope **Build** (oder **All**) wählen, danach „Clear cache and deploy site“. Ohne diese Variablen erscheint nach dem Deploy eine Konfigurations-Hinweisseite statt der App.
- **Beliebige Plattform**: `npm run build` → Ordner `dist/` auf einen Static-/SPA-Host (GitHub Pages, eigener Server) deployen.
- **Canonical / OG**: Beim Build werden `__VITE_APP_URL__` und `__VITE_APP_OG_IMAGE__` in `index.html` durch die genannten Env-Variablen ersetzt.

## Projektstruktur (wichtig für Tool-Wechsel)

- **`src/integrations/auth.ts`** – Einzige Auth-API, die die App nutzt. Implementierung (z. B. Lovable, Supabase direkt) liegt in `src/integrations/` und kann gewechselt werden, ohne den Rest der App anzufassen.
- **`src/integrations/lovable/`** – Optional; nur wenn du den Lovable-Auth-Adapter nutzt. Beim Wechsel des Tools die Implementierung in `auth.ts` umstellen.
- **Keine Pflicht zu tool-spezifischen Paketen**: Build läuft auch ohne z. B. `lovable-tagger` (wird in Vite nur optional geladen).

## Fundamentale Verbesserungen (Auswahl)

- **UX**: Einheitliche Empty-State-Komponente (Nachrichten, Dokumente); Return-URL nach Login (Weiterleitung zur zuvor aufgerufenen Seite); 404 mit A11y (aria-live, Fokus) und ErrorBoundary; Lade-Anzeige mit role="status"/aria-live.
- **Performance**: Route-Preload auf 3s verzögert; Service-Worker-Registration zentral in main.tsx; Document-Queries mit staleTime 2 Min.
- **Sicherheit**: AI-Markdown mit rehype-sanitize (XSS-Schutz); CSP um api.deepseek.com erweitert; Form-Sanitization vor Supabase (Verträge); zentraler Mutation-Error-Handler (Vertrag anlegen).
- **Barrierefreiheit**: PageLoader und 404-Countdown als Live-Region; Fokus-Ring für „Zurück zum Portfolio“.
- **Daten-Feedback**: Indikator „Daten werden aktualisiert…“ im Layout bei laufendem Refetch; einheitliche Empty-State-Texte in i18n.

## Lizenz & Support

Projekt-spezifisch. Bei Fragen: Repo-Issues oder Kontakt des Betreibers.
