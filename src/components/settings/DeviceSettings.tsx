/**
 * Settings Page-Splitting — Device Management section extracted from Settings.tsx
 */
import { useState, useEffect, useCallback } from "react";
import { MonitorSmartphone, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface DeviceSettingsProps {
  sectionRef: (el: HTMLElement | null) => void;
}

/** Parse user agent string into readable device name */
function parseDeviceName(ua: string): string {
  if (/iPhone/i.test(ua)) return "iPhone";
  if (/iPad/i.test(ua)) return "iPad";
  if (/Android/i.test(ua)) return "Android";
  if (/Mac/i.test(ua)) return "Mac";
  if (/Windows/i.test(ua)) return "Windows PC";
  if (/Linux/i.test(ua)) return "Linux";
  return "Unbekanntes Ger\u00e4t";
}

/** Parse browser from user agent */
function parseBrowser(ua: string): string {
  if (/Firefox/i.test(ua)) return "Firefox";
  if (/Edg/i.test(ua)) return "Edge";
  if (/Chrome/i.test(ua)) return "Chrome";
  if (/Safari/i.test(ua)) return "Safari";
  return "Browser";
}

export function DeviceSettings({ sectionRef }: DeviceSettingsProps) {
  const [devices, setDevices] = useState<Array<{ id: string; userAgent: string; lastActive: string; isCurrent: boolean }>>([]);
  const [devicesLoading, setDevicesLoading] = useState(false);

  const fetchDevices = useCallback(async () => {
    setDevicesLoading(true);
    try {
      const currentId = localStorage.getItem("immocontrol_device_id") || crypto.randomUUID();
      localStorage.setItem("immocontrol_device_id", currentId);
      const ua = navigator.userAgent;
      const { data: userData } = await supabase.auth.getUser();
      const storedDevices = (userData?.user?.user_metadata?.devices || []) as Array<{ id: string; userAgent: string; lastActive: string }>;
      const existingIdx = storedDevices.findIndex(d => d.id === currentId);
      if (existingIdx >= 0) {
        storedDevices[existingIdx] = { id: currentId, userAgent: ua, lastActive: new Date().toISOString() };
      } else {
        storedDevices.push({ id: currentId, userAgent: ua, lastActive: new Date().toISOString() });
      }
      await supabase.auth.updateUser({ data: { devices: storedDevices } });
      setDevices(storedDevices.map(d => ({ ...d, isCurrent: d.id === currentId })));
    } catch {
      setDevices([{ id: "current", userAgent: navigator.userAgent, lastActive: new Date().toISOString(), isCurrent: true }]);
    } finally {
      setDevicesLoading(false);
    }
  }, []);

  useEffect(() => { fetchDevices(); }, [fetchDevices]);

  const removeDevice = async (deviceId: string) => {
    try {
      const { data: userData } = await supabase.auth.getUser();
      const storedDevices = (userData?.user?.user_metadata?.devices || []) as Array<{ id: string; userAgent: string; lastActive: string }>;
      const updated = storedDevices.filter(d => d.id !== deviceId);
      await supabase.auth.updateUser({ data: { devices: updated } });
      setDevices(prev => prev.filter(d => d.id !== deviceId));
      toast.success("Ger\u00e4t aus Liste entfernt");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Fehler beim Entfernen des Ger\u00e4ts");
    }
  };

  const logoutAllOtherDevices = async () => {
    try {
      const currentId = localStorage.getItem("immocontrol_device_id");
      const { data: userData } = await supabase.auth.getUser();
      const storedDevices = (userData?.user?.user_metadata?.devices || []) as Array<{ id: string; userAgent: string; lastActive: string }>;
      const updated = storedDevices.filter(d => d.id === currentId);
      await supabase.auth.updateUser({ data: { devices: updated } });
      setDevices(prev => prev.filter(d => d.isCurrent));
      await supabase.auth.signOut({ scope: "others" });
      toast.success("Alle anderen Ger\u00e4te abgemeldet");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Fehler beim Abmelden");
    }
  };

  return (
    <div id="geraete" ref={sectionRef} className="gradient-card rounded-xl border border-border p-5 space-y-4 animate-fade-in [animation-delay:110ms] scroll-mt-20">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold flex items-center gap-2">
          <MonitorSmartphone className="h-4 w-4 text-muted-foreground" /> Angemeldete Ger&auml;te
        </h2>
        {devices.length > 1 && (
          <Button variant="ghost" size="sm" className="h-7 text-[10px] text-muted-foreground" onClick={logoutAllOtherDevices}>
            Alle anderen abmelden
          </Button>
        )}
      </div>
      <p className="text-xs text-muted-foreground">
        &Uuml;berblick &uuml;ber alle Ger&auml;te, die aktuell bei deinem Konto angemeldet sind.
      </p>
      {devicesLoading ? (
        <div className="text-xs text-muted-foreground animate-pulse">Lade Ger&auml;te...</div>
      ) : (
        <div className="space-y-2">
          {devices.map(device => (
            <div key={device.id} className={`flex items-center gap-3 p-3 rounded-xl border transition-all ${
              device.isCurrent ? "border-primary/30 bg-primary/5" : "border-border bg-secondary/30 hover:bg-secondary/50"
            }`}>
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                device.isCurrent ? "bg-primary/10 text-primary" : "bg-secondary text-muted-foreground"
              }`}>
                <MonitorSmartphone className="h-4 w-4" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-xs font-medium truncate">{parseDeviceName(device.userAgent)}</span>
                  <span className="text-[10px] text-muted-foreground">{parseBrowser(device.userAgent)}</span>
                  {device.isCurrent && (
                    <span className="text-[9px] bg-primary/10 text-primary px-1.5 py-0.5 rounded-full font-bold shrink-0">Dieses Ger&auml;t</span>
                  )}
                </div>
                <p className="text-[10px] text-muted-foreground truncate mt-0.5">
                  Zuletzt aktiv: {new Date(device.lastActive).toLocaleDateString("de-DE", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                </p>
              </div>
              {!device.isCurrent && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="ghost" size="sm" className="h-8 w-8 p-0 shrink-0 text-muted-foreground hover:text-destructive hover:bg-destructive/10" onClick={() => removeDevice(device.id)}>
                      <LogOut className="h-3.5 w-3.5" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Ger&auml;t aus Liste entfernen</TooltipContent>
                </Tooltip>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
