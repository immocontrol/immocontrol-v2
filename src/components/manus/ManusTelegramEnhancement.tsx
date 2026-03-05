/**
 * MANUS-8: Telegram Bot Enhancement
 * UI placeholder showing Manus-powered Telegram bot capabilities
 */
import { Bot, MessageSquare, CheckCircle2, Zap } from "lucide-react";
import { hasManusApiKey } from "@/lib/manusAgent";

export const ManusTelegramEnhancement = () => {
  const isConfigured = hasManusApiKey();

  const capabilities = [
    { label: "Marktdaten abfragen", example: '"Wie ist der aktuelle Mietpreis in Berlin-Mitte?"' },
    { label: "Deal bewerten", example: '"Bewerte: 3-Zi ETW, 80m², 350k€, Berlin-Pankow"' },
    { label: "Finanzierung prüfen", example: '"Vergleiche Zinsen für 300k€, 10 Jahre Zinsbindung"' },
    { label: "Due Diligence starten", example: '"Prüfe Musterstraße 1, 10115 Berlin"' },
    { label: "Steuer-Tipps", example: '"AfA-Optimierung für Baujahr 1985, Kaufpreis 250k€"' },
    { label: "News-Briefing", example: '"Was gibt es Neues auf dem Berliner Immobilienmarkt?"' },
  ];

  return (
    <div className="space-y-4 rounded-xl border border-border bg-card/50 p-4">
      <div className="flex items-center gap-2">
        <Bot className="h-4 w-4 text-blue-500" />
        <h3 className="text-sm font-semibold">Manus AI: Telegram Bot</h3>
        {isConfigured ? (
          <span className="ml-auto flex items-center gap-1 text-emerald-500 text-[10px] font-medium">
            <CheckCircle2 className="h-3 w-3" /> Bereit
          </span>
        ) : (
          <span className="ml-auto text-[10px] text-muted-foreground">API Key erforderlich</span>
        )}
      </div>

      <p className="text-xs text-muted-foreground leading-relaxed">
        Mit Manus AI kann dein Telegram Bot komplexe Immobilien-Anfragen beantworten.
        Sende einfach eine Nachricht an deinen Bot — Manus recherchiert automatisch.
      </p>

      <div className="space-y-2">
        <h4 className="text-xs font-medium flex items-center gap-1.5">
          <Zap className="h-3 w-3 text-amber-500" /> Mögliche Anfragen
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
        <strong>Hinweis:</strong> Der Telegram Bot nutzt Manus AI im Hintergrund. Komplexe Anfragen
        können 1-5 Minuten dauern. Die Ergebnisse werden als strukturierte Nachricht zurückgesendet.
        Konfiguriere deinen Bot unter Einstellungen → Telegram.
      </div>
    </div>
  );
};
