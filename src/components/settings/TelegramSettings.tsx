/**
 * Settings Page-Splitting — Telegram Integration section.
 * Konfigurierbar in der App: Bot-Token, Webhook, Auto-Import, Kanal-Filter.
 * Nutzt useSupabaseStorage für Sync mit Deals-Seite und anderen Geräten.
 */
import { useState, useCallback } from "react";
import { MessageSquare, Copy, Zap, Loader2, CheckCircle2, Wifi, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { SettingsToggleRow } from "@/components/ui/settings-toggle-row";
import { toast } from "sonner";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useSupabaseStorage } from "@/hooks/useSupabaseStorage";
import { useTelegramBot } from "@/hooks/useTelegramBot";
import { getManusApiKey } from "@/lib/manusAgent";
import { ManusTelegramEnhancement } from "@/components/manus/ManusTelegramEnhancement";

interface TelegramSettingsProps {
  sectionRef: (el: HTMLElement | null) => void;
}

export function TelegramSettings({ sectionRef }: TelegramSettingsProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [telegramToken, setTelegramToken] = useSupabaseStorage<string>("immo-telegram-bot-token", "");
  const [telegramBotName, setTelegramBotName] = useSupabaseStorage<string>("immo-telegram-bot-name", "");
  const [chatTitleIncludes, setChatTitleIncludes] = useSupabaseStorage<string>("immo-telegram-deal-chat-title", "ImmoMetrica");
  const [autoImportEnabled, setAutoImportEnabled] = useSupabaseStorage<boolean>("immo-telegram-auto-import-enabled", true);
  const [webhookLoading, setWebhookLoading] = useState(false);
  const [webhookDisableLoading, setWebhookDisableLoading] = useState(false);
  const [testLoading, setTestLoading] = useState(false);

  const { data: webhookConfig } = useQuery({
    queryKey: ["telegram_webhook_config", user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data } = await supabase
        .from("telegram_webhook_config")
        .select("id, updated_at, chat_title_includes, manus_replies_enabled")
        .eq("user_id", user.id)
        .maybeSingle();
      return data;
    },
    enabled: !!user?.id,
  });
  const webhookActive = !!webhookConfig?.id;
  const manusRepliesEnabled = !!webhookConfig?.manus_replies_enabled;
  const invalidateWebhook = () => queryClient.invalidateQueries({ queryKey: ["telegram_webhook_config", user?.id] });

  const telegram = useTelegramBot();

  const enableWebhook = useCallback(async () => {
    if (!telegramToken.trim()) {
      toast.error("Bitte zuerst den Bot-Token eintragen");
      return;
    }
    setWebhookLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        toast.error("Bitte erneut anmelden.");
        setWebhookLoading(false);
        return;
      }
      const { data, error } = await supabase.functions.invoke("telegram-set-webhook", {
        body: {
          bot_token: telegramToken.trim(),
          chat_title_includes: chatTitleIncludes.trim() || undefined,
        },
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (error) {
        toast.error(error.message || "Webhook konnte nicht gesetzt werden");
        return;
      }
      if (data?.success) {
        toast.success(data.message || "Webhook aktiviert");
        invalidateWebhook();
      } else {
        toast.error(data?.error || "Webhook fehlgeschlagen");
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Fehler beim Aktivieren des Webhooks");
    } finally {
      setWebhookLoading(false);
    }
  }, [telegramToken, chatTitleIncludes, invalidateWebhook]);

  const disableWebhook = useCallback(async () => {
    setWebhookDisableLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        toast.error("Bitte erneut anmelden.");
        setWebhookDisableLoading(false);
        return;
      }
      const { data, error } = await supabase.functions.invoke("telegram-set-webhook", {
        body: { disable: true },
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (error) {
        toast.error(error.message || "Webhook konnte nicht deaktiviert werden");
        return;
      }
      if (data?.success) {
        toast.success(data.message || "Webhook deaktiviert");
        invalidateWebhook();
      } else {
        toast.error(data?.error || "Deaktivieren fehlgeschlagen");
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Fehler");
    } finally {
      setWebhookDisableLoading(false);
    }
  }, [invalidateWebhook]);

  const [manusLoading, setManusLoading] = useState(false);
  const setManusReplies = useCallback(async (enabled: boolean) => {
    setManusLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        toast.error("Bitte erneut anmelden.");
        setManusLoading(false);
        return;
      }
      const { data, error } = await supabase.functions.invoke("telegram-set-webhook", {
        body: {
          update_manus_only: true,
          manus_replies_enabled: enabled,
          manus_api_key: enabled ? getManusApiKey() || undefined : undefined,
        },
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (error) {
        toast.error(error.message || "Einstellung konnte nicht gespeichert werden");
        return;
      }
      if (data?.success) {
        toast.success(data.message || (enabled ? "Manus-Antworten aktiviert" : "Manus-Antworten deaktiviert"));
        invalidateWebhook();
      } else {
        toast.error(data?.error || "Fehlgeschlagen");
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Fehler");
    } finally {
      setManusLoading(false);
    }
  }, [invalidateWebhook]);

  const testConnection = useCallback(async () => {
    if (!telegramToken.trim()) {
      toast.error("Bitte zuerst den Bot-Token eintragen");
      return;
    }
    setTestLoading(true);
    try {
      const ok = await telegram.validateToken(telegramToken.trim());
      if (ok) toast.success("Verbindung erfolgreich.");
      else toast.error(telegram.error || "Token ungültig.");
    } finally {
      setTestLoading(false);
    }
  }, [telegramToken, telegram]);

  return (
    <div id="telegram" ref={sectionRef} className="gradient-card rounded-xl border border-border p-5 space-y-4 animate-fade-in [animation-delay:135ms] scroll-mt-20">
      <h2 className="text-sm font-semibold flex items-center gap-2">
        <MessageSquare className="h-4 w-4 text-[#0088cc]" /> Telegram Integration
      </h2>
      <p className="text-xs text-muted-foreground">
        Bot mit ImmoControl verknüpfen: Deals aus ImmoMetrica oder z. B. von @immometrica_bot importieren. Nachrichten von @immometrica_bot einfach an deinen Bot weiterleiten – sie landen automatisch als Deals in der App.
      </p>
      <div className="space-y-3">
        <div className="space-y-1.5">
          <Label className="text-xs">Bot Token</Label>
          <div className="flex gap-2">
            <Input
              type="password"
              value={telegramToken}
              onChange={(e) => setTelegramToken(e.target.value)}
              placeholder="123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11"
              className="h-9 text-sm font-mono flex-1 min-w-0"
            />
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="outline" size="sm" className="h-9 shrink-0" onClick={() => { if (telegramToken) navigator.clipboard.writeText(telegramToken).then(() => toast.success("Token kopiert"), () => toast.error("Kopieren fehlgeschlagen")); }}>
                  <Copy className="h-3.5 w-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Token kopieren</TooltipContent>
            </Tooltip>
            <Button variant="outline" size="sm" className="h-9 gap-1.5 shrink-0" onClick={testConnection} disabled={testLoading || !telegramToken.trim()}>
              {testLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Wifi className="h-3.5 w-3.5" />}
              {testLoading ? "Prüfe…" : "Test"}
            </Button>
          </div>
          {telegram.error && (
            <p className="text-[11px] text-destructive flex items-center gap-1"><AlertCircle className="h-3 w-3" /> {telegram.error}</p>
          )}
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Bot Name (optional)</Label>
          <Input
            value={telegramBotName}
            onChange={(e) => setTelegramBotName(e.target.value)}
            placeholder="z.B. ImmoControl_bot"
            className="h-9 text-sm"
          />
        </div>

        <SettingsToggleRow
          label="Auto-Import Deals"
          description="Beim Öffnen der Deals-Seite: neue Nachrichten aus dem Kanal abrufen und als Deals anlegen."
          checked={autoImportEnabled}
          onCheckedChange={(v) => setAutoImportEnabled(!!v)}
          ariaLabel="Auto-Import Deals ein oder aus"
        />

        <div className="p-3 rounded-lg bg-[#0088cc]/5 border border-[#0088cc]/10 space-y-2">
          <p className="text-xs font-medium text-[#0088cc]">Einrichtung (z. B. ImmoMetrica / immometrica):</p>
          <ol className="text-[11px] text-muted-foreground space-y-1 list-decimal list-inside">
            <li>Bot bei <span className="font-mono text-[10px]">@BotFather</span> erstellen und Token kopieren</li>
            <li>Bot als Admin in deinen Deal-Kanal oder deine Gruppe einladen (Kanal-Filter unten auf den Kanalnamen setzen, z. B. „ImmoMetrica“)</li>
            <li>Webhook aktivieren = Deals auch bei geschlossener App automatisch in der App sehen</li>
          </ol>
          <p className="text-[10px] text-muted-foreground pt-0.5">
            Bei öffentlichen Kanälen wie ImmoMetrica, die du nicht leitest: eigenen Kanal oder Gruppe anlegen, Posts dorthin weiterleiten und deinen Bot dort als Admin hinzufügen — dann landen die Deals trotzdem in der App.
          </p>
        </div>

        <div className="space-y-3 p-3 rounded-lg bg-emerald-500/5 border border-emerald-500/20">
          <h3 className="text-xs font-semibold flex items-center gap-1.5">
            <Zap className="h-3.5 w-3.5 text-emerald-600" />
            ImmoMetrica Direktimport (Webhook)
          </h3>
          <p className="text-[11px] text-muted-foreground">
            Nachrichten aus dem Kanal werden serverseitig verarbeitet und als Deals gespeichert — auch wenn die App geschlossen ist.
          </p>
          {webhookActive && (
            <p className="text-[11px] text-emerald-700 font-medium">
              Aktiv{webhookConfig?.chat_title_includes ? ` · Kanal-Filter: „${webhookConfig.chat_title_includes}"` : ""}
            </p>
          )}
          <div className="space-y-1.5">
            <Label className="text-xs">Kanal-Filter (Chat-Titel enthält)</Label>
            <Input
              value={chatTitleIncludes}
              onChange={(e) => setChatTitleIncludes(e.target.value)}
              placeholder="z.B. ImmoMetrica"
              className="h-9 text-sm"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              className="gap-1.5"
              onClick={enableWebhook}
              disabled={webhookLoading || webhookDisableLoading || !telegramToken.trim()}
            >
              {webhookLoading ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : webhookActive ? (
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
              ) : (
                <Zap className="h-3.5 w-3.5" />
              )}
              {webhookLoading ? "Aktiviere…" : webhookActive ? "Einstellungen aktualisieren" : "Webhook aktivieren"}
            </Button>
            {webhookActive && (
              <Button
                size="sm"
                variant="outline"
                className="gap-1.5"
                onClick={disableWebhook}
                disabled={webhookLoading || webhookDisableLoading}
              >
                {webhookDisableLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                {webhookDisableLoading ? "Deaktiviere…" : "Webhook deaktivieren"}
              </Button>
            )}
          </div>
          <p className="text-[10px] text-muted-foreground">
            Bot muss Admin im Kanal sein. Einstellungen werden pro Nutzer gespeichert.
          </p>
        </div>

        <div className="pt-3 border-t border-border">
          <ManusTelegramEnhancement
            webhookActive={webhookActive}
            manusRepliesEnabled={manusRepliesEnabled}
            onManusRepliesChange={setManusReplies}
            manusLoading={manusLoading}
          />
        </div>
      </div>
    </div>
  );
}
