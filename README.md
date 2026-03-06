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

Weitere Keys (z. B. für Auth-Provider) je nach Deployment.

## Deployment

- **Beliebige Plattform**: `npm run build` → Ordner `dist/` auf einen Static-/SPA-Host (Vercel, Netlify, GitHub Pages, eigener Server) deployen.
- **Canonical / OG**: Beim Build werden `__VITE_APP_URL__` und `__VITE_APP_OG_IMAGE__` in `index.html` durch die genannten Env-Variablen ersetzt.

## Projektstruktur (wichtig für Tool-Wechsel)

- **`src/integrations/auth.ts`** – Einzige Auth-API, die die App nutzt. Implementierung (z. B. Lovable, Supabase direkt) liegt in `src/integrations/` und kann gewechselt werden, ohne den Rest der App anzufassen.
- **`src/integrations/lovable/`** – Optional; nur wenn du den Lovable-Auth-Adapter nutzt. Beim Wechsel des Tools die Implementierung in `auth.ts` umstellen.
- **Keine Pflicht zu tool-spezifischen Paketen**: Build läuft auch ohne z. B. `lovable-tagger` (wird in Vite nur optional geladen).

## Lizenz & Support

Projekt-spezifisch. Bei Fragen: Repo-Issues oder Kontakt des Betreibers.
