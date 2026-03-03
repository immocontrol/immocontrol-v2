/**
 * Settings Page-Splitting — Telegram Integration section extracted from Settings.tsx
 */
import { useState } from "react";
import { MessageSquare, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { toast } from "sonner";

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

  return (
    <div id="telegram" ref={sectionRef} className="gradient-card rounded-xl border border-border p-5 space-y-4 animate-fade-in [animation-delay:135ms] scroll-mt-20">
      <h2 className="text-sm font-semibold flex items-center gap-2">
        <MessageSquare className="h-4 w-4 text-[#0088cc]" /> Telegram Integration
      </h2>
      <p className="text-xs text-muted-foreground">
        Verbinde deinen Telegram Bot, um Deal-Nachrichten direkt in ImmoControl zu importieren.
        Kopiere dazu die Nachrichten aus deinem Telegram-Channel und nutze den &quot;Telegram Import&quot; Button auf der Deals-Seite.
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
            <li>F&uuml;ge den Bot zu deinem Deal-Channel hinzu</li>
            <li>Gehe zur <span className="font-medium text-foreground">Deals</span>-Seite und nutze den &quot;Telegram Import&quot; Button</li>
          </ol>
        </div>
      </div>
    </div>
  );
}
