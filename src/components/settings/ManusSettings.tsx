/**
 * ManusSettings — Settings component for Manus AI API key configuration
 */
import { useState, useEffect } from "react";
import { Bot, Eye, EyeOff, CheckCircle2, AlertCircle, Loader2, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { getManusApiKey, setManusApiKey, hasManusApiKey, getTask } from "@/lib/manusAgent";

interface ManusSettingsProps {
  sectionRef: (el: HTMLElement | null) => void;
}

export const ManusSettings = ({ sectionRef }: ManusSettingsProps) => {
  const [apiKey, setApiKeyState] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [testing, setTesting] = useState(false);
  const [isConfigured, setIsConfigured] = useState(false);

  useEffect(() => {
    const existing = getManusApiKey();
    if (existing) {
      setApiKeyState(existing);
      setIsConfigured(true);
    }
  }, []);

  const handleSave = () => {
    if (!apiKey.trim()) {
      toast.error("Bitte einen API Key eingeben");
      return;
    }
    setManusApiKey(apiKey.trim());
    setIsConfigured(true);
    toast.success("Manus API Key gespeichert");
  };

  const handleTest = async () => {
    if (!apiKey.trim()) {
      toast.error("Bitte zuerst einen API Key eingeben");
      return;
    }
    setTesting(true);
    try {
      // Save key first so the API call uses it
      setManusApiKey(apiKey.trim());
      // Try a simple API call to verify the key works
      await getTask("test-connection");
      // If we get here without auth error, key is valid
      setIsConfigured(true);
      toast.success("Manus API Key ist gültig!");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Unbekannter Fehler";
      if (msg.includes("401") || msg.includes("403") || msg.includes("unauthorized")) {
        toast.error("API Key ungültig — bitte prüfen");
        setIsConfigured(false);
      } else if (msg.includes("404")) {
        // 404 for test task is expected — means auth worked
        setIsConfigured(true);
        toast.success("Manus API Key ist gültig!");
      } else {
        // Network or other error — key might still be valid
        toast.info(`Verbindungstest: ${msg}`);
      }
    } finally {
      setTesting(false);
    }
  };

  const handleRemove = () => {
    setManusApiKey("");
    setApiKeyState("");
    setIsConfigured(false);
    toast.success("Manus API Key entfernt");
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
        Due Diligence und mehr. Hinterlege deinen API Key von{" "}
        <a
          href="https://manus.im"
          target="_blank"
          rel="noopener noreferrer"
          className="text-primary hover:underline inline-flex items-center gap-0.5"
        >
          manus.im <ExternalLink className="h-2.5 w-2.5" />
        </a>
      </p>

      <div className="space-y-1.5">
        <Label className="text-xs text-muted-foreground">API Key</Label>
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Input
              type={showKey ? "text" : "password"}
              value={apiKey}
              onChange={(e) => setApiKeyState(e.target.value)}
              placeholder="manus_..."
              className="h-9 text-sm pr-9 font-mono"
            />
            <button
              type="button"
              onClick={() => setShowKey(!showKey)}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              {showKey ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
            </button>
          </div>
        </div>
      </div>

      <div className="flex gap-2">
        <Button size="sm" onClick={handleSave} disabled={!apiKey.trim()}>
          Speichern
        </Button>
        <Button size="sm" variant="outline" onClick={handleTest} disabled={!apiKey.trim() || testing}>
          {testing ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : null}
          Testen
        </Button>
        {isConfigured && (
          <Button size="sm" variant="ghost" onClick={handleRemove} className="text-red-500 hover:text-red-600 hover:bg-red-500/10">
            Entfernen
          </Button>
        )}
      </div>

      {!isConfigured && (
        <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400">
          <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
          <div className="text-xs leading-relaxed">
            <strong>Nicht konfiguriert.</strong> Manus AI Features wie S-ImmoPreisfinder,
            Marktanalyse, Deal-Scoring und Due Diligence benötigen einen gültigen API Key.
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
