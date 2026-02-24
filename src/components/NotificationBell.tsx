import { useState, useEffect } from "react";
import { Bell, AlertTriangle, Clock, MessageSquare, Wrench, ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

interface Notification {
  type: string;
  message: string;
  severity: "high" | "medium" | "low";
}

interface NotificationData {
  notifications: {
    overdue_payments: Notification[];
    upcoming_payments: Notification[];
    open_tickets: Notification[];
    unread_messages: Notification[];
  };
  total: number;
}

export const NotificationBell = () => {
  const { user } = useAuth();
  const [data, setData] = useState<NotificationData | null>(null);
  const [loading, setLoading] = useState(false);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);

  const fetchNotifications = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const { data: result, error } = await supabase.functions.invoke("notifications");
      if (!error && result) {
        setData(result as NotificationData);
        setLastRefresh(new Date());
      }
    } catch {}
    setLoading(false);
  };

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 5 * 60 * 1000); // refresh every 5 min
    return () => clearInterval(interval);
  }, [user]);

  const total = data?.total || 0;
  const allNotifications = data
    ? [
        ...data.notifications.overdue_payments,
        ...data.notifications.open_tickets,
        ...data.notifications.upcoming_payments,
        ...data.notifications.unread_messages,
      ]
    : [];

  const iconForType = (type: string) => {
    switch (type) {
      case "overdue_payment": return <AlertTriangle className="h-3.5 w-3.5 text-loss shrink-0" />;
      case "upcoming_payment": return <Clock className="h-3.5 w-3.5 text-gold shrink-0" />;
      case "open_ticket": return <Wrench className="h-3.5 w-3.5 text-primary shrink-0" />;
      case "unread_message": return <MessageSquare className="h-3.5 w-3.5 text-muted-foreground shrink-0" />;
      default: return <Bell className="h-3.5 w-3.5 shrink-0" />;
    }
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative h-8 w-8">
          <Bell className="h-4 w-4" />
          {total > 0 && (
            <span className="absolute -top-0.5 -right-0.5 h-4 min-w-4 px-1 rounded-full bg-loss text-[10px] text-destructive-foreground font-bold flex items-center justify-center pulse-notification">
              {total > 99 ? "99+" : total}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="end">
        <div className="p-3 border-b border-border">
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <Bell className="h-4 w-4" /> Benachrichtigungen
            {total > 0 && (
              <span className="text-[10px] bg-loss/10 text-loss px-1.5 py-0.5 rounded-full font-bold">{total}</span>
            )}
          </h3>
        </div>
        <div className="max-h-80 overflow-y-auto">
          {allNotifications.length === 0 ? (
            <div className="p-4 text-center text-xs text-muted-foreground">
              Keine Benachrichtigungen 🎉
            </div>
          ) : (
            <div className="divide-y divide-border/50">
              {allNotifications.slice(0, 20).map((n, i) => (
                <div
                  key={i}
                  className={`p-3 flex items-start gap-2 text-xs ${
                    n.severity === "high" ? "bg-loss/5" : ""
                  }`}
                >
                  {iconForType(n.type)}
                  <span className="leading-relaxed">{n.message}</span>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="p-2 border-t border-border space-y-1">
          <Button
            variant="ghost"
            size="sm"
            className="w-full text-xs text-muted-foreground"
            onClick={fetchNotifications}
            disabled={loading}
          >
            {loading ? "Aktualisiere…" : "Aktualisieren"}
          </Button>
          {lastRefresh && (
            <p className="text-[9px] text-muted-foreground text-center">
              Zuletzt: {lastRefresh.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" })}
            </p>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
};
