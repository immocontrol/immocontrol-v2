/**
 * MANUS-8: Telegram Bot Enhancement
 * Konfigurierbar: Manus-Antworten für private Nachrichten an den Bot aktivieren.
 * Nutzt Webhook-Config (manus_replies_enabled, manus_api_key) und Manus API Key aus Einstellungen.
 */
import { Bot, MessageSquare, CheckCircle2, Zap, Loader2 } from "lucide-react";
import { hasManusApiKey } from "@/lib/manusAgent";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";

interface ManusTelegramEnhancementProps {
  webhookActive: boolean;
  manusRepliesEnabled: boolean;
  onManusRepliesChange: (enabled: boolean) => void;
  manusLoading?: boolean;
}

export const ManusTelegramEnhancement = ({
  webhookActive,
  manusRepliesEnabled,
  onManusRepliesChange,
  manusLoading = false,
}: ManusTelegramEnhancementProps) => {
  const hasManusKey = hasManusApiKey();

  const capabilities = [
    { label: "Marktdaten abfragen", example: '"Wie ist der aktuelle Mietpreis in Berlin-Mitte?"' },
    { label: "Deal bewerten", example: '"Bewerte: 3-Zi ETW, 80m², 350k€, Berlin-Pankow"' },
    { label: "Finanzierung prüfen", example: '"Vergleiche Zinsen für 300k€, 10 Jahre Zinsbindung"' },
    { label: "Due Diligence starten", example: '"Prüfe Musterstraße 1, 10115 Berlin"' },
    { label: "Steuer-Tipps", example: '"AfA-Optimierung für Baujahr 1985, Kaufpreis 250k€"' },
    { label: "News-Briefing", example: '"Was gibt es Neues auf dem Berliner Immobilienmarkt?"' },
  ];

  const canEnableManus = webhookActive && hasManusKey;

  return (
    <div className="space-y-4 rounded-xl border border-border bg-card/50 p-4">
      <div className="flex items-center gap-2">
        <Bot className="h-4 w-4 text-blue-500" />
        <h3 className="text-sm font-semibold">Manus AI: Telegram Bot</h3>
        {manusRepliesEnabled ? (
          <span className="ml-auto flex items-center gap-1 text-emerald-500 text-[10px] font-medium">
            <CheckCircle2 className="h-3 w-3" /> Aktiv
          </span>
        ) : hasManusKey && webhookActive ? (
          <span className="ml-auto text-[10px] text-muted-foreground">Aus</span>
        ) : (
          <span className="ml-auto text-[10px] text-muted-foreground">
            {!webhookActive ? "Zuerst Webhook aktivieren" : "API Key in Einstellungen → Manus AI"}
          </span>
        )}
      </div>

      <p className="text-xs text-muted-foreground leading-relaxed">
        Private Nachrichten an deinen Bot werden mit Manus AI beantwortet (Recherche, Bewertung, Marktdaten).
      </p>

      <div className="flex items-center justify-between gap-3 p-3 rounded-lg bg-secondary/30 border border-border">
        <div>
          <Label className="text-xs font-medium">Manus-Antworten aktivieren</Label>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            Nur für Direktnachrichten an den Bot. Webhook muss aktiv sein; Manus API Key unter Einstellungen → Manus AI.
          </p>
        </div>
        <Switch
          checked={manusRepliesEnabled}
          onCheckedChange={onManusRepliesChange}
          disabled={!canEnableManus || manusLoading}
        />
        {manusLoading && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
      </div>

      <div className="space-y-2">
        <h4 className="text-xs font-medium flex items-center gap-1.5">
          <Zap className="h-3 w-3 text-amber-500" /> Beispiele (private Nachricht an den Bot)
        </h4>
        <div className="space-y-1.5">
          {capabilities.map((cap, i) => (
            <div key={i} className="text-xs p-2 rounded-lg bg-secondary/30">
              <div className="flex items-center gap-1.5 mb-0.5">
                <MessageSquare className="h-3 w-3 text-blue-500 shrink-0" />
                <span className="font-medium">{cap.label}</span>
              </div>
              <div className="text-muted-foreground italic ml-4.5 pl-[18px]">{cap.example}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="text-[10px] text-muted-foreground p-2 rounded-lg bg-secondary/50">
        <strong>Hinweis:</strong> Antworten können 30–60 Sekunden dauern. Bei längeren Recherchen erhältst du eine Hinweismeldung.
      </div>
    </div>
  );
};
