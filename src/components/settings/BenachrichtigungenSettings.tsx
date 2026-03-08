/**
 * Settings Page-Splitting — Benachrichtigungen section
 * Central hub for notification channels (In-App, Browser, Web-Push, Telegram).
 * See docs/BENACHRICHTIGUNGEN.md for full documentation.
 */
import { useState, useEffect } from "react";
import { Bell, MessageSquare, Monitor, Inbox, Smartphone, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { subscribeToWebPush, getWebPushStatus } from "@/lib/pushNotifications";
import { useNotificationPreferences } from "@/context/NotificationPreferencesContext";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface BenachrichtigungenSettingsProps {
  sectionRef: (el: HTMLElement | null) => void;
}

const DIGEST_KEY = "immo_digest_frequency";
const DIGEST_OPTIONS = [
  { value: "off", label: "Aus" },
  { value: "daily", label: "Täglich (Empfehlung)" },
  { value: "weekly", label: "Wöchentlich" },
];

const TOPICS: { key: "overdue" | "contract_expiry" | "tickets" | "loan_milestone"; label: string }[] = [
  { key: "overdue", label: "Überfällige Mieten" },
  { key: "contract_expiry", label: "Vertragsende" },
  { key: "tickets", label: "Offene Tickets" },
  { key: "loan_milestone", label: "Zinsbindung endet" },
];

export function BenachrichtigungenSettings({ sectionRef }: BenachrichtigungenSettingsProps) {
  const [pushStatus, setPushStatus] = useState(() => getWebPushStatus());
  const [digestFreq, setDigestFreq] = useState<string>(() => {
    try { return localStorage.getItem(DIGEST_KEY) ?? "off"; } catch { return "off"; }
  });

  useEffect(() => {
    try { localStorage.setItem(DIGEST_KEY, digestFreq); } catch { /* noop */ }
  }, [digestFreq]);
  const [pushLoading, setPushLoading] = useState(false);
  const { prefs, setInApp } = useNotificationPreferences();

  useEffect(() => {
    setPushStatus(getWebPushStatus());
  }, []);

  const handleWebPushEnable = async () => {
    if (!pushStatus.supported) return;
    setPushLoading(true);
    try {
      const sub = await subscribeToWebPush();
      setPushStatus(getWebPushStatus());
      if (sub) {
        toast.success("Web-Push aktiviert. Abonnements-Daten lokal gespeichert.");
      } else if (!pushStatus.vapidConfigured) {
        toast.info("Web-Push erfordert VAPID-Konfiguration (VITE_VAPID_PUBLIC_KEY).");
      } else {
        toast.error("Berechtigung verweigert oder Browser unterstützt Web-Push nicht.");
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Web-Push Aktivierung fehlgeschlagen");
    } finally {
      setPushLoading(false);
    }
  };

  return (
    <div id="benachrichtigungen" ref={sectionRef} className="gradient-card rounded-xl border border-border p-5 space-y-4 animate-fade-in [animation-delay:125ms] scroll-mt-20">
      <h2 className="text-sm font-semibold flex items-center gap-2">
        <Bell className="h-4 w-4 text-muted-foreground" /> Benachrichtigungen
      </h2>
      <p className="text-xs text-muted-foreground">
        Verwalte die Benachrichtigungskanäle: In-App-Hinweise, Browser-Benachrichtigungen, Web-Push und Telegram.
      </p>
      <div className="space-y-3">
        <div className="flex flex-col gap-2 p-3 rounded-lg bg-secondary/30 border border-border">
          <div className="flex items-center gap-3">
            <Inbox className="h-5 w-5 text-primary shrink-0" />
            <div>
              <p className="text-xs font-medium">In-App</p>
              <p className="text-[11px] text-muted-foreground">Hinweise im Dashboard pro Thema ein-/ausschaltbar</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-x-4 gap-y-2 pl-8">
            {TOPICS.map((t) => (
              <label key={t.key} className="flex items-center gap-2 text-xs cursor-pointer">
                <Switch
                  checked={prefs.inApp[t.key]}
                  onCheckedChange={(v) => setInApp(t.key, !!v)}
                />
                <span>{t.label}</span>
              </label>
            ))}
          </div>
        </div>
        <div className="flex flex-col gap-2 p-3 rounded-lg bg-secondary/30 border border-border">
          <div className="flex items-center gap-3">
            <Mail className="h-5 w-5 text-primary shrink-0" />
            <div>
              <p className="text-xs font-medium">E-Mail/Telegram-Digest</p>
              <p className="text-[11px] text-muted-foreground">Zusammenfassung: Fristen, offene Mieten, Zinsbindung</p>
            </div>
          </div>
          <Select value={digestFreq} onValueChange={setDigestFreq}>
            <SelectTrigger className="h-8 w-[160px] text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {DIGEST_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value} className="text-xs">{o.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-3 p-3 rounded-lg bg-secondary/30 border border-border">
          <Monitor className="h-5 w-5 text-primary shrink-0" />
          <div>
            <p className="text-xs font-medium">Browser</p>
            <p className="text-[11px] text-muted-foreground">Browser-Notification-API — optional nach Berechtigung. Einstellbar über den Browser.</p>
          </div>
        </div>
        <div className="flex items-center gap-3 p-3 rounded-lg bg-secondary/30 border border-border">
          <Smartphone className="h-5 w-5 text-primary shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium">Web-Push</p>
            <p className="text-[11px] text-muted-foreground">
              Push-Benachrichtigungen auch bei geschlossener App. Erfordert VAPID-Konfiguration und Server-Integration.
            </p>
            {pushStatus.supported && (
              <Button
                variant="outline"
                size="sm"
                className="mt-2 h-7 text-xs"
                onClick={handleWebPushEnable}
                disabled={pushLoading || pushStatus.subscribed || !pushStatus.vapidConfigured}
              >
                {pushStatus.subscribed
                  ? "Web-Push aktiv"
                  : !pushStatus.vapidConfigured
                    ? "VAPID nicht konfiguriert"
                    : pushLoading
                      ? "Aktivieren…"
                      : "Web-Push aktivieren"}
              </Button>
            )}
          </div>
        </div>
        <div className="flex items-center gap-3 p-3 rounded-lg bg-secondary/30 border border-border">
          <MessageSquare className="h-5 w-5 text-[#0088cc] shrink-0" />
          <div>
            <p className="text-xs font-medium">Telegram</p>
            <p className="text-[11px] text-muted-foreground">Telegram-Bot verknüpfen für Deal-Nachrichten. Einstellbar im Bereich „Telegram“.</p>
          </div>
        </div>
      </div>
      <p className="text-[11px] text-muted-foreground">
        Einstellungen werden lokal gespeichert. Details siehe{" "}
        <code className="text-[10px] bg-secondary px-1 py-0.5 rounded">docs/BENACHRICHTIGUNGEN.md</code>.
      </p>
    </div>
  );
}
