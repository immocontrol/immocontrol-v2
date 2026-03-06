/**
 * Shown when VITE_SUPABASE_URL / VITE_SUPABASE_PUBLISHABLE_KEY were not set at build time
 * (e.g. on Netlify). Prevents white screen and explains how to fix.
 */
import { AlertTriangle, ExternalLink } from "lucide-react";

/** Shown when Supabase env vars were missing at build time (e.g. first Netlify deploy). */
export function ConfigErrorScreen() {
  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6 text-center">
      <div className="max-w-md w-full rounded-2xl border border-border bg-card p-6 shadow-lg">
        <div className="w-14 h-14 rounded-xl bg-amber-500/10 flex items-center justify-center mx-auto mb-4">
          <AlertTriangle className="h-7 w-7 text-amber-600 dark:text-amber-400" />
        </div>
        <h1 className="text-xl font-semibold mb-2">Konfiguration fehlt</h1>
        <p className="text-sm text-muted-foreground mb-4">
          Die App wurde ohne Supabase-Zugangsdaten gebaut. Das passiert oft beim ersten Deploy auf Netlify oder Vercel,
          wenn die Umgebungsvariablen noch nicht gesetzt sind.
        </p>
        <div className="text-left bg-muted/50 rounded-lg p-4 text-sm space-y-2 mb-4">
          <p className="font-medium">So behebst du es (Netlify):</p>
          <ol className="list-decimal list-inside space-y-1 text-muted-foreground">
            <li>Netlify Dashboard → deine Site → <strong>Site configuration</strong> → <strong>Environment variables</strong></li>
            <li>Variablen anlegen (Scope: <strong>Build</strong> oder <strong>All</strong>):
              <ul className="list-disc list-inside mt-1 ml-2">
                <li><code className="text-xs bg-muted px-1 rounded">VITE_SUPABASE_URL</code></li>
                <li><code className="text-xs bg-muted px-1 rounded">VITE_SUPABASE_PUBLISHABLE_KEY</code></li>
              </ul>
            </li>
            <li><strong>Trigger deploy</strong> → „Clear cache and deploy site“ (damit der Build die neuen Werte nutzt)</li>
          </ol>
        </div>
        <a
          href="https://docs.netlify.com/configure-builds/environment-variables/"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline"
        >
          Netlify: Environment variables
          <ExternalLink className="h-3.5 w-3.5" />
        </a>
      </div>
    </div>
  );
}
