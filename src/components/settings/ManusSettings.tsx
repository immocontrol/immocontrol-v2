/**
 * ManusSettings — Manus AI API key configuration, geräteübergreifend.
 *
 * - API Key wird in user_settings (Supabase) + localStorage gespeichert.
 * - Zwei Modi: Server-Proxy (MANUS_API_KEY auf Server) oder lokaler Key.
 */
import { useState, useEffect } from "react";
import { Bot, Eye, EyeOff, CheckCircle2, AlertCircle, Loader2, ExternalLink, Shield, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { useSupabaseStorage } from "@/hooks/useSupabaseStorage";
import { getManusApiKey, hasManusApiKey, getTask, isProxyConfigured, resetProxyCache } from "@/lib/manusAgent";

interface ManusSettingsProps {
  sectionRef: (el: HTMLElement | null) => void;
}

export const ManusSettings = ({ sectionRef }: ManusSettingsProps) => {
  const [manusKey, setManusKey, keySyncing] = useSupabaseStorage<string>("immocontrol_manus_api_key", "");
  const [inputKey, setInputKey] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [testing, setTesting] = useState(false);
  const [proxyAvailable, setProxyAvailable] = useState<boolean | null>(null);
  const [checkingProxy, setCheckingProxy] = useState(true);

  useEffect(() => {
    setInputKey(manusKey);
  }, [manusKey]);

  useEffect(() => {
    resetProxyCache();
    isProxyConfigured().then((available) => {
      setProxyAvailable(available);
      setCheckingProxy(false);
    });
  }, []);

  const isConfigured = proxyAvailable === true || hasManusApiKey();

  const handleSave = () => {
    if (!inputKey.trim()) {
      toast.error("Bitte einen API Key eingeben");
      return;
    }
    setManusKey(inputKey.trim());
    toast.success("Manus API Key gespeichert (geräteübergreifend)");
  };

  const handleTest = async () => {
    if (!inputKey.trim()) {
      toast.error("Bitte zuerst einen API Key eingeben");
      return;
    }
    setTesting(true);
    try {
      setManusKey(inputKey.trim());
      await new Promise((r) => setTimeout(r, 100));
      await getTask("test-connection");
      toast.success("Manus API Key ist gültig!");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Unbekannter Fehler";
      if (msg.includes("401") || msg.includes("403") || msg.includes("unauthorized")) {
        toast.error("API Key ungültig — bitte prüfen");
      } else if (msg.includes("404")) {
        toast.success("Manus API Key ist gültig!");
      } else {
        toast.info(`Verbindungstest: ${msg}`);
      }
    } finally {
      setTesting(false);
    }
  };

  const handleRemove = () => {
    setManusKey("");
    setInputKey("");
    if (!proxyAvailable) {
      toast.success("API Key entfernt");
    } else {
      toast.success("Lokaler Key entfernt (Server-Proxy bleibt aktiv)");
    }
  };

  return (
    <div
      id="manus-ai"
      ref={sectionRef}
      className="gradient-card rounded-xl border border-border p-5 space-y-4 animate-fade-in scroll-mt-20"
    >
      <h2 className="text-sm font-semibold flex items-center gap-2">
        <Bot className="h-4 w-4 text-muted-foreground" />
        Manus AI Integration
        {isConfigured && (
          <span className="ml-auto flex items-center gap-1 text-emerald-500 text-[10px] font-medium">
            <CheckCircle2 className="h-3 w-3" /> Konfiguriert
          </span>
        )}
      </h2>

      <p className="text-xs text-muted-foreground leading-relaxed">
        Manus AI ermöglicht automatisierte Immobilien-Recherche, Marktanalyse, Exposé-Bewertung,
        Due Diligence und mehr. API Key von{" "}
        <a
          href="https://manus.im"
          target="_blank"
          rel="noopener noreferrer"
          className="text-primary hover:underline inline-flex items-center gap-0.5"
        >
          manus.im <ExternalLink className="h-2.5 w-2.5" />
        </a>
      </p>

      {/* ── Server-side Proxy Status ── */}
      <div className="flex items-start gap-2 p-3 rounded-lg bg-muted/50 border border-border">
        {checkingProxy ? (
          <>
            <Loader2 className="h-4 w-4 mt-0.5 shrink-0 animate-spin text-muted-foreground" />
            <div className="text-xs text-muted-foreground">Server-Proxy wird geprüft…</div>
          </>
        ) : proxyAvailable ? (
          <>
            <Shield className="h-4 w-4 mt-0.5 shrink-0 text-emerald-500" />
            <div className="text-xs leading-relaxed">
              <strong className="text-emerald-600 dark:text-emerald-400">Server-Proxy aktiv</strong>{" "}
              <span className="text-muted-foreground">
                — API Key liegt sicher auf dem Server. Kein lokaler Key nötig.
              </span>
            </div>
          </>
        ) : (
          <>
            <ShieldAlert className="h-4 w-4 mt-0.5 shrink-0 text-amber-500" />
            <div className="text-xs leading-relaxed">
              <strong className="text-amber-600 dark:text-amber-400">Server-Proxy nicht verfügbar</strong>{" "}
              <span className="text-muted-foreground">
                — Bitte lokalen API Key hinterlegen (wird im Browser gespeichert).
              </span>
            </div>
          </>
        )}
      </div>

      {/* ── API Key (Supabase user_settings + localStorage, geräteübergreifend) ── */}
      <div className="space-y-1.5">
        <Label className="text-xs text-muted-foreground">
          API Key {proxyAvailable ? "(optional — überschreibt Server-Proxy)" : "(erforderlich)"} — wird geräteübergreifend gespeichert
        </Label>
        <div className="flex gap-2">
          <div className="relative flex-1 min-w-0">
            <Input
              type={showKey ? "text" : "password"}
              value={inputKey}
              onChange={(e) => setInputKey(e.target.value)}
              placeholder="manus_..."
              className="h-9 text-sm pr-9 font-mono"
            />
            <button
              type="button"
              onClick={() => setShowKey(!showKey)}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              aria-label={showKey ? "Key verbergen" : "Key anzeigen"}
            >
              {showKey ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
            </button>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button size="sm" onClick={handleSave} disabled={!inputKey.trim() || keySyncing}>
          {keySyncing ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : null}
          Speichern
        </Button>
        <Button size="sm" variant="outline" onClick={handleTest} disabled={!inputKey.trim() || testing}>
          {testing ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : null}
          Testen
        </Button>
        {(inputKey || manusKey) && (
          <Button size="sm" variant="ghost" onClick={handleRemove} className="text-red-500 hover:text-red-600 hover:bg-red-500/10">
            Entfernen
          </Button>
        )}
      </div>

      {!isConfigured && (
        <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400">
          <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
          <div className="text-xs leading-relaxed">
            <strong>Nicht konfiguriert.</strong> Manus AI Features benötigen entweder den
            Server-Proxy (MANUS_API_KEY als Supabase Secret) oder einen lokalen API Key.
          </div>
        </div>
      )}

      {isConfigured && (
        <div className="text-xs text-muted-foreground space-y-1.5">
          <p className="font-medium">Verfügbare Manus AI Features:</p>
          <ul className="grid grid-cols-1 sm:grid-cols-2 gap-1">
            {[
              "S-ImmoPreisfinder Automation",
              "Deep Research / Marktanalyse",
              "Exposé-Analyse & Deal-Scoring",
              "Steuer-Optimierung & Anlage V",
              "Due Diligence Automatisierung",
              "Newsticker Intelligence",
              "Finanzierungs-Optimierung",
              "Telegram Bot Enhancement",
            ].map((f) => (
              <li key={f} className="flex items-center gap-1.5">
                <CheckCircle2 className="h-3 w-3 text-emerald-500 shrink-0" />
                {f}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};
