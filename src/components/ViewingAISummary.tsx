/**
 * KI-Zusammenfassung für Besichtigungen — fasst Notizen, Pro/Kontra zu einer Kurzfassung
 */
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Sparkles, Loader2 } from "lucide-react";
import { completeDeepSeekChat, isDeepSeekConfigured } from "@/integrations/ai/deepseek";
import { toast } from "sonner";

interface ViewingAISummaryProps {
  title: string;
  address: string | null;
  notes: string | null;
  pro_points: string | null;
  contra_points: string | null;
  rating: number | null;
}

export function ViewingAISummary({
  title,
  address,
  notes,
  pro_points,
  contra_points,
  rating,
}: ViewingAISummaryProps) {
  const [loading, setLoading] = useState(false);
  const [summary, setSummary] = useState("");

  const text =
    [title, address, notes, pro_points, contra_points, rating ? `Bewertung: ${rating}/5` : null]
      .filter(Boolean)
      .join("\n\n");

  const run = async () => {
    if (!text.trim()) {
      toast.error("Keine Notizen zum Zusammenfassen");
      return;
    }
    if (!isDeepSeekConfigured()) {
      toast.error("VITE_DEEPSEEK_API_KEY ist nicht gesetzt.");
      return;
    }
    setLoading(true);
    setSummary("");
    try {
      const answer = await completeDeepSeekChat(
        [{ role: "user", content: `Fasse diese Besichtigungsnotizen in 3–5 Sätzen zusammen. Behalte Pro/Kontra und die wichtigsten Punkte bei:\n\n${text}` }],
        { systemPrompt: "Du bist Assistent für Immobilien-Besichtigungen. Antworte auf Deutsch, sachlich.", maxTokens: 512 }
      );
      setSummary(answer.trim() || "Keine Zusammenfassung erhalten.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "KI-Fehler");
    } finally {
      setLoading(false);
    }
  };

  if (!isDeepSeekConfigured()) return null;

  return (
    <div className="rounded-lg border border-border bg-muted/30 p-3 space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-muted-foreground">KI-Zusammenfassung</span>
        <Button variant="outline" size="sm" onClick={run} disabled={loading} className="gap-1.5 text-xs">
          {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
          Generieren
        </Button>
      </div>
      {summary && <p className="text-sm whitespace-pre-wrap">{summary}</p>}
    </div>
  );
}
