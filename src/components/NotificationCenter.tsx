/** UX-2: Toast Notification Center with History
 * Tracks all toast notifications in a persistent history panel.
 * Accessible via a bell icon in the header. */
import { useState, useCallback, useMemo, memo, useEffect } from "react";
import { Bell, X, Check, AlertTriangle, Info, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

export interface NotificationEntry {
  id: string;
  type: "success" | "error" | "info" | "warning";
  title: string;
  timestamp: Date;
  read: boolean;
}

// Global notification store
let notificationListeners: Array<() => void> = [];
let notifications: NotificationEntry[] = [];

function emitChange() {
  notificationListeners.forEach(fn => fn());
}

export function addNotification(type: NotificationEntry["type"], title: string) {
  notifications = [
    { id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, type, title, timestamp: new Date(), read: false },
    ...notifications,
  ].slice(0, 50); // Keep last 50
  emitChange();
}

export function clearNotifications() {
  notifications = [];
  emitChange();
}

export function markAllRead() {
  notifications = notifications.map(n => ({ ...n, read: true }));
  emitChange();
}

function useNotifications() {
  const [, forceUpdate] = useState(0);
  useEffect(() => {
    const listener = () => forceUpdate(c => c + 1);
    notificationListeners.push(listener);
    return () => {
      notificationListeners = notificationListeners.filter(l => l !== listener);
    };
  }, []);
  return notifications;
}

const iconMap = {
  success: Check,
  error: AlertTriangle,
  info: Info,
  warning: AlertTriangle,
};

const colorMap = {
  success: "text-profit bg-profit/10",
  error: "text-loss bg-loss/10",
  info: "text-primary bg-primary/10",
  warning: "text-gold bg-gold/10",
};

const NotificationCenter = memo(() => {
  const items = useNotifications();
  const [open, setOpen] = useState(false);

  const unreadCount = useMemo(() => items.filter(n => !n.read).length, [items]);

  const handleOpen = useCallback((isOpen: boolean) => {
    setOpen(isOpen);
    if (isOpen) markAllRead();
  }, []);

  return (
    <Popover open={open} onOpenChange={handleOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative h-8 w-8" aria-label="Benachrichtigungen">
          <Bell className="h-4 w-4" />
          {unreadCount > 0 && (
            <Badge className="absolute -top-1 -right-1 h-4 min-w-[16px] px-1 text-[9px] bg-primary text-primary-foreground">
              {unreadCount > 9 ? "9+" : unreadCount}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="end">
        <div className="flex items-center justify-between px-3 py-2 border-b border-border">
          <span className="text-sm font-semibold">Benachrichtigungen</span>
          {items.length > 0 && (
            <Button variant="ghost" size="sm" className="h-6 text-xs gap-1" onClick={clearNotifications}>
              <Trash2 className="h-3 w-3" /> Leeren
            </Button>
          )}
        </div>
        <ScrollArea className="max-h-[300px]">
          {items.length === 0 ? (
            <div className="py-8 text-center text-sm text-muted-foreground">
              Keine Benachrichtigungen
            </div>
          ) : (
            <div className="divide-y divide-border">
              {items.map(n => {
                const Icon = iconMap[n.type];
                return (
                  <div key={n.id} className="flex items-start gap-2 px-3 py-2 hover:bg-secondary/50 transition-colors">
                    <div className={`mt-0.5 p-1 rounded-md ${colorMap[n.type]}`}>
                      <Icon className="h-3 w-3" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs leading-snug">{n.title}</p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">
                        {n.timestamp.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" })}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
});
NotificationCenter.displayName = "NotificationCenter";

export { NotificationCenter };
