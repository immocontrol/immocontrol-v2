/**
 * Settings Page-Splitting — Benachrichtigungen section
 * Central hub for notification channels (In-App, Browser, Web-Push, Telegram).
 * See docs/BENACHRICHTIGUNGEN.md for full documentation.
 */
import { useState, useEffect } from "react";
import { Bell, MessageSquare, Monitor, Inbox, Smartphone, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { subscribeToWebPush, unsubscribeFromWebPush, getWebPushStatus, requestNotificationPermission } from "@/lib/pushNotifications";
import { useNotificationPreferences } from "@/context/NotificationPreferencesContext";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
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
  const [browserPermission, setBrowserPermission] = useState<NotificationPermission>(() =>
    typeof window !== "undefined" && "Notification" in window ? Notification.permission : "denied"
  );
  const [browserRequesting, setBrowserRequesting] = useState(false);

  useEffect(() => {
    try { localStorage.setItem(DIGEST_KEY, digestFreq); } catch { /* noop */ }
  }, [digestFreq]);
  const [pushLoading, setPushLoading] = useState(false);
  const [testPushLoading, setTestPushLoading] = useState(false);
  const { user } = useAuth();
  const { prefs, setInApp, setBrowser, setWebPush } = useNotificationPreferences();

  useEffect(() => {
    setPushStatus(getWebPushStatus());
  }, []);
  useEffect(() => {
    if (typeof window !== "undefined" && "Notification" in window) {
      setBrowserPermission(Notification.permission);
    }
  }, []);

  const handleWebPushToggle = async (enabled: boolean) => {
    if (!pushStatus.supported || !user?.id) return;
    setPushLoading(true);
    try {
      if (enabled) {
        const sub = await subscribeToWebPush(user.id);
        setPushStatus(getWebPushStatus());
        if (sub) {
          setWebPush(true);
          toast.success("Web-Push aktiviert. Du erhältst Benachrichtigungen auch bei geschlossener App.");
        } else if (!pushStatus.vapidConfigured) {
          toast.info("Web-Push erfordert VAPID-Konfiguration (VITE_VAPID_PUBLIC_KEY).");
        } else {
          toast.error("Berechtigung verweigert oder Browser unterstützt Web-Push nicht.");
        }
      } else {
        await unsubscribeFromWebPush(user.id);
        setWebPush(false);
        setPushStatus(getWebPushStatus());
        toast.success("Web-Push deaktiviert.");
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : (enabled ? "Web-Push Aktivierung fehlgeschlagen" : "Web-Push Deaktivierung fehlgeschlagen"));
    } finally {
      setPushLoading(false);
    }
  };

  const handleTestPush = async () => {
    if (!user) return;
    setTestPushLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        toast.error("Nicht angemeldet.");
        return;
      }
      const { data, error } = await supabase.functions.invoke("send-push", {
        body: { payload: { title: "ImmoControl Test", body: "Web-Push funktioniert – auch bei geschlossener App.", url: "/", tag: "test" } },
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (error) throw error;
      const sent = (data as { sent?: number })?.sent ?? 0;
      if (sent > 0) toast.success(`Test-Push gesendet (${sent} Gerät${sent > 1 ? "e" : ""}).`);
      else toast.info("Kein Abo für diesen Nutzer oder Edge Function nicht konfiguriert (VAPID_KEYS_JSON).");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Test-Push fehlgeschlagen");
    } finally {
      setTestPushLoading(false);
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
            <div className="min-w-0">
              <p className="text-xs font-medium">In-App</p>
              <p className="text-[11px] text-muted-foreground">Hinweise im Dashboard pro Thema ein-/ausschaltbar</p>
            </div>
          </div>
          {TOPICS.map((t) => (
            <div key={t.key} className="flex items-center justify-between gap-3 py-1.5">
              <span className="text-xs font-medium">{t.label}</span>
              <Switch
                checked={prefs.inApp[t.key]}
                onCheckedChange={(v) => setInApp(t.key, !!v)}
                aria-label={`${t.label} ein oder aus`}
              />
            </div>
          ))}
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
        <div className="flex flex-col gap-2 p-3 rounded-lg bg-secondary/30 border border-border">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs font-medium">Browser-Benachrichtigungen</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                Pop-up-Hinweise des Betriebssystems (z. B. Dokument läuft ab, Zinsbindung endet). Nur bei erteilter Berechtigung.
              </p>
            </div>
            <Switch
              checked={prefs.browser}
              onCheckedChange={async (checked) => {
                setBrowser(!!checked);
                if (!!checked && typeof window !== "undefined" && "Notification" in window && Notification.permission === "default") {
                  setBrowserRequesting(true);
                  const perm = await requestNotificationPermission();
                  setBrowserPermission(perm);
                  setBrowserRequesting(false);
                  if (perm !== "granted") {
                    toast.error("Berechtigung verweigert. Browser-Benachrichtigungen sind in den Browser-Einstellungen aktivierbar.");
                    setBrowser(false);
                  } else {
                    toast.success("Browser-Benachrichtigungen aktiviert.");
                  }
                }
              }}
              aria-label="Browser-Benachrichtigungen ein oder aus"
            />
          </div>
          {prefs.browser && (
            <p className="text-[11px] text-muted-foreground">
              Status: {browserPermission === "granted" ? "Berechtigung erteilt" : browserPermission === "denied" ? "Berechtigung verweigert" : "Noch nicht angefragt"}.
              {browserPermission !== "granted" && " "}
              {browserPermission !== "granted" && (
                <button
                  type="button"
                  className="text-primary hover:underline"
                  onClick={async () => {
                    setBrowserRequesting(true);
                    const perm = await requestNotificationPermission();
                    setBrowserPermission(perm);
                    setBrowserRequesting(false);
                    if (perm === "granted") toast.success("Berechtigung erteilt.");
                    else toast.error("Berechtigung verweigert. In den Browser-Einstellungen für diese Seite erlauben.");
                  }}
                  disabled={browserRequesting}
                >
                  {browserRequesting ? "Prüfe…" : "Jetzt Berechtigung anfordern"}
                </button>
              )}
            </p>
          )}
        </div>
        <div className="flex flex-col gap-2 p-3 rounded-lg bg-secondary/30 border border-border">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs font-medium">Web-Push</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                Push auch bei geschlossener App (VAPID). Abo wird auf dem Server gespeichert.
              </p>
            </div>
            {pushStatus.supported && (
              <Switch
                checked={pushStatus.subscribed}
                onCheckedChange={handleWebPushToggle}
                disabled={pushLoading || !pushStatus.vapidConfigured}
                aria-label="Web-Push ein oder aus"
              />
            )}
          </div>
          {pushStatus.supported && !pushStatus.vapidConfigured && (
            <p className="text-[11px] text-muted-foreground">VAPID nicht konfiguriert (VITE_VAPID_PUBLIC_KEY).</p>
          )}
          {pushStatus.supported && (
            <p className="text-[11px] text-muted-foreground">
              <strong>iPhone:</strong> PWA zuerst „Zum Home-Bildschirm“ hinzufügen (Safari → Teilen), iOS 16.4+. Dann erscheinen Push-Meldungen auch auf Sperrbildschirm und in der Mitteilungszentrale.
            </p>
          )}
          {pushStatus.supported && pushStatus.subscribed && (
            <p className="text-[11px] text-muted-foreground">
              Abo auf Server gespeichert — Benachrichtigungen können bei geschlossener App zugestellt werden.{" "}
              <Button type="button" variant="ghost" size="sm" className="h-6 text-xs p-0 inline" onClick={handleTestPush} disabled={testPushLoading}>
                {testPushLoading ? "Sende…" : "Test-Push senden"}
              </Button>
            </p>
          )}
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
