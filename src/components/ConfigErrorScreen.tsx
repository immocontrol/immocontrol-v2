/**
 * Shown when VITE_SUPABASE_URL and Supabase key were not set at build time
 * (Railway Web, Codemagic iOS, or local without .env). Prevents white screen and explains how to fix.
 */
import { AlertTriangle, ExternalLink } from "lucide-react";

const isLikelyNativeApp = (): boolean =>
  typeof navigator !== "undefined" &&
  (navigator.userAgent.includes("ImmoControl") || (window as unknown as { Capacitor?: unknown }).Capacitor != null);

/** Shown when Supabase env vars were missing at build time. */
export function ConfigErrorScreen() {
  const isNative = isLikelyNativeApp();

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6 text-center">
      <div className="w-full max-w-md rounded-2xl border border-border/80 bg-card p-6 shadow-xl">
        <div className="w-14 h-14 rounded-xl bg-amber-500/10 flex items-center justify-center mx-auto mb-4">
          <AlertTriangle className="h-7 w-7 text-amber-600 dark:text-amber-400" />
        </div>
        <h1 className="text-xl font-semibold mb-2">Konfiguration fehlt</h1>
        <p className="text-sm text-muted-foreground mb-4 text-wrap-safe">
          Die App wurde ohne Supabase-Zugangsdaten gebaut. Bitte die Umgebungsvariablen setzen und einen neuen Build
          auslösen. Lokal: <code className="text-xs bg-muted px-1 rounded">.env</code> oder <code className="text-xs bg-muted px-1 rounded">.env.local</code> mit{" "}
          <code className="text-xs bg-muted px-1 rounded">VITE_SUPABASE_URL</code> und{" "}
          <code className="text-xs bg-muted px-1 rounded">VITE_SUPABASE_ANON_KEY</code> (oder <code className="text-xs bg-muted px-1 rounded">VITE_SUPABASE_PUBLISHABLE_KEY</code>), dann <code className="text-xs bg-muted px-1 rounded">npm run dev</code> neu starten.
        </p>
        <div className="text-left bg-muted/50 rounded-lg p-4 text-sm space-y-3 mb-4">
          {isNative ? (
            <>
              <p className="font-medium">So behebst du es (Codemagic / iOS):</p>
              <ol className="list-decimal list-inside space-y-1 text-muted-foreground">
                <li>Codemagic Dashboard → deine App → <strong>Environment variables</strong></li>
                <li>Gruppe anlegen (z. B. <strong>supabase_config</strong>) und dem Workflow zuweisen</li>
                <li>In der Gruppe setzen:
                  <ul className="list-disc list-inside mt-1 ml-2">
                    <li><code className="text-xs bg-muted px-1 rounded">VITE_SUPABASE_URL</code></li>
                    <li><code className="text-xs bg-muted px-1 rounded">VITE_SUPABASE_ANON_KEY</code> oder <code className="text-xs bg-muted px-1 rounded">VITE_SUPABASE_PUBLISHABLE_KEY</code></li>
                  </ul>
                </li>
                <li>Neuen Build starten (Push oder manuell)</li>
              </ol>
            </>
          ) : (
            <>
              <p className="font-medium">So behebst du es (Railway):</p>
              <ol className="list-decimal list-inside space-y-1 text-muted-foreground">
                <li>Railway Dashboard → dein Projekt → Service → <strong>Variables</strong></li>
                <li>Variablen hinzufügen (für Build sichtbar):
                  <ul className="list-disc list-inside mt-1 ml-2">
                    <li><code className="text-xs bg-muted px-1 rounded">VITE_SUPABASE_URL</code></li>
                    <li><code className="text-xs bg-muted px-1 rounded">VITE_SUPABASE_ANON_KEY</code> oder <code className="text-xs bg-muted px-1 rounded">VITE_SUPABASE_PUBLISHABLE_KEY</code></li>
                  </ul>
                </li>
                <li>Redeploy auslösen, damit der Build die neuen Werte nutzt</li>
              </ol>
            </>
          )}
        </div>
        <a
          href={isNative ? "https://docs.codemagic.io/flutter-configuration/environment-variables/" : "https://docs.railway.app/develop/variables"}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline"
        >
          {isNative ? "Codemagic: Environment variables" : "Railway: Variables"}
          <ExternalLink className="h-3.5 w-3.5" />
        </a>
      </div>
    </div>
  );
}
