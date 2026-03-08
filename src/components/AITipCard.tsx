/**
 * KI-Tipp: Kurzer Immobilien-Tipp per DeepSeek (nur wenn VITE_DEEPSEEK_API_KEY gesetzt).
 */
import { useState, useCallback, useEffect } from "react";
import { Sparkles, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { completeDeepSeekChat, isDeepSeekConfigured } from "@/integrations/ai/deepseek";
import { logger } from "@/lib/logger";

const SYSTEM_PROMPT = `Du bist ein Experte für Immobilien-Investments in Deutschland.
Antworte mit genau einem kurzen, konkreten Tipp (1–3 Sätze) für private Immobilien-Investoren.
Thema: z.B. Steuern, Mietanpassung, Finanzierung, Instandhaltung, Leerstand, Rendite.
Antworte nur mit dem Tipp, ohne Anrede oder Einleitung.`;

export function AITipCard() {
  const [tip, setTip] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchTip = useCallback(async () => {
    if (!isDeepSeekConfigured()) return;
    setLoading(true);
    setError(null);
    try {
      const month = new Date().toLocaleString("de-DE", { month: "long" });
      const text = await completeDeepSeekChat(
        [{ role: "user", content: `Gib einen aktuellen Immobilien-Tipp für ${month} (kurz, 1–3 Sätze).` }],
        { systemPrompt: SYSTEM_PROMPT, maxTokens: 200 }
      );
      setTip(text.trim() || "Kein Tipp erhalten.");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Fehler beim Laden";
      setError(msg);
      setTip(null);
      logger.warn("AITipCard fetch failed", { error: e });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!isDeepSeekConfigured()) return;
    fetchTip();
  }, [fetchTip]);

  if (!isDeepSeekConfigured()) return null;

  return (
    <div className="gradient-card rounded-xl border border-border p-4 card-accent-shadow">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold flex items-center gap-1.5">
          <Sparkles className="h-4 w-4 text-primary" />
          KI-Tipp
        </h3>
        <Button
          variant="ghost"
          size="icon"
          className="h-10 w-10 touch-target min-h-[44px] min-w-[44px]"
          onClick={fetchTip}
          disabled={loading}
          aria-label="Tipp aktualisieren"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
        </Button>
      </div>
      <div className="mt-2 text-sm text-muted-foreground min-h-[2.5rem]">
        {loading && !tip && <span className="animate-pulse">Lade Tipp…</span>}
        {error && <span className="text-destructive">{error}</span>}
        {tip && !error && <p className="text-foreground/90 leading-snug">{tip}</p>}
      </div>
    </div>
  );
}
