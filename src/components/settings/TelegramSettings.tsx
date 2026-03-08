/**
 * Settings Page-Splitting — Telegram Integration section extracted from Settings.tsx
 * Includes ImmoMetrica Webhook for automatic deal import.
 */
import { useState, useCallback } from "react";
import { MessageSquare, Copy, Zap, Loader2, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { ManusTelegramEnhancement } from "@/components/manus/ManusTelegramEnhancement";

interface TelegramSettingsProps {
  sectionRef: (el: HTMLElement | null) => void;
}

export function TelegramSettings({ sectionRef }: TelegramSettingsProps) {
  const [telegramToken, setTelegramToken] = useState(() => {
    try { return localStorage.getItem("immo-telegram-bot-token") || ""; } catch { return ""; }
  });
  const [telegramBotName, setTelegramBotName] = useState(() => {
    try { return localStorage.getItem("immo-telegram-bot-name") || ""; } catch { return ""; }
  });
  const [chatTitleIncludes, setChatTitleIncludes] = useState("ImmoMetrica");
  const [webhookLoading, setWebhookLoading] = useState(false);
  const [webhookActive, setWebhookActive] = useState(false);

  const enableWebhook = useCallback(async () => {
    if (!telegramToken.trim()) {
      toast.error("Bitte zuerst den Bot-Token eintragen");
      return;
    }
    setWebhookLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("telegram-set-webhook", {
        body: {
          bot_token: telegramToken.trim(),
          chat_title_includes: chatTitleIncludes.trim() || undefined,
        },
      });
      if (error) {
        toast.error(error.message || "Webhook konnte nicht gesetzt werden");
        return;
      }
      if (data?.success) {
        setWebhookActive(true);
        toast.success(data.message || "Webhook aktiviert");
      } else {
        toast.error(data?.error || "Webhook fehlgeschlagen");
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Fehler beim Aktivieren des Webhooks");
    } finally {
      setWebhookLoading(false);
    }
  }, [telegramToken, chatTitleIncludes]);

  return (
    <div id="telegram" ref={sectionRef} className="gradient-card rounded-xl border border-border p-5 space-y-4 animate-fade-in [animation-delay:135ms] scroll-mt-20">
      <h2 className="text-sm font-semibold flex items-center gap-2">
        <MessageSquare className="h-4 w-4 text-[#0088cc]" /> Telegram Integration
      </h2>
      <p className="text-xs text-muted-foreground">
        Verbinde deinen Telegram Bot, um Deal-Nachrichten direkt in ImmoControl zu importieren.
        Kopiere dazu die Nachrichten aus deinem Telegram-Channel und nutze den "Telegram Import" Button auf der Deals-Seite.
      </p>
      <div className="space-y-3">
        <div className="space-y-1.5">
          <Label className="text-xs">Bot Token</Label>
          <div className="flex gap-2">
            <Input
              type="password"
              value={telegramToken}
              onChange={(e) => { setTelegramToken(e.target.value); localStorage.setItem("immo-telegram-bot-token", e.target.value); }}
              placeholder="123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11"
              className="h-9 text-sm font-mono flex-1"
            />
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-9 shrink-0"
                  onClick={() => {
                    const token = localStorage.getItem("immo-telegram-bot-token");
                    if (token) {
                      navigator.clipboard.writeText(token).then(
                        () => toast.success("Token kopiert"),
                        () => toast.error("Kopieren fehlgeschlagen")
                      );
                    }
                  }}
                >
                  <Copy className="h-3.5 w-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Token kopieren</TooltipContent>
            </Tooltip>
          </div>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Bot Name</Label>
          <Input
            value={telegramBotName}
            onChange={(e) => { setTelegramBotName(e.target.value); localStorage.setItem("immo-telegram-bot-name", e.target.value); }}
            placeholder="z.B. ImmoControl_bot"
            className="h-9 text-sm"
          />
        </div>
        <div className="p-3 rounded-lg bg-[#0088cc]/5 border border-[#0088cc]/10 space-y-2">
          <p className="text-xs font-medium text-[#0088cc]">Einrichtung:</p>
          <ol className="text-[11px] text-muted-foreground space-y-1 list-decimal list-inside">
            <li>Erstelle einen Bot bei <span className="font-mono text-[10px]">@BotFather</span> auf Telegram</li>
            <li>Kopiere den Bot Token und trage ihn oben ein</li>
            <li>Füge den Bot zu deinem ImmoMetrica Deal-Channel hinzu (als Admin)</li>
            <li>Optional: Webhook aktivieren für automatischen Direktimport (siehe unten)</li>
          </ol>
        </div>

        {/* ImmoMetrica Webhook – Direktimport */}
        <div className="space-y-3 p-3 rounded-lg bg-emerald-500/5 border border-emerald-500/20">
          <h3 className="text-xs font-semibold flex items-center gap-1.5">
            <Zap className="h-3.5 w-3.5 text-emerald-600" />
            ImmoMetrica Direktimport (Webhook)
          </h3>
          <p className="text-[11px] text-muted-foreground">
            Deals aus deinem ImmoMetrica-Kanal landen automatisch in ImmoControl, auch wenn die App geschlossen ist.
          </p>
          <div className="space-y-1.5">
            <Label className="text-xs">Kanal-Filter (Chat-Titel enthält)</Label>
            <Input
              value={chatTitleIncludes}
              onChange={(e) => setChatTitleIncludes(e.target.value)}
              placeholder="z.B. ImmoMetrica"
              className="h-9 text-sm"
            />
          </div>
          <Button
            size="sm"
            className="gap-1.5"
            onClick={enableWebhook}
            disabled={webhookLoading || !telegramToken.trim()}
          >
            {webhookLoading ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : webhookActive ? (
              <CheckCircle2 className="h-3.5 w-3.5" />
            ) : (
              <Zap className="h-3.5 w-3.5" />
            )}
            {webhookLoading ? "Aktiviere…" : webhookActive ? "Webhook aktiv" : "Webhook aktivieren"}
          </Button>
          <p className="text-[10px] text-muted-foreground">
            Der Bot muss Admin im ImmoMetrica-Kanal sein, um Nachrichten zu empfangen.
          </p>
        </div>

        {/* Manus AI Enhancement */}
        <div className="pt-3 border-t border-border">
          <ManusTelegramEnhancement />
        </div>
      </div>
    </div>
  );
}
