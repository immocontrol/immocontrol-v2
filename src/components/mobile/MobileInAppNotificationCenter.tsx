/**
 * MOB6-8: Mobile In-App Notification Center
 * Central notification center with categories (tenants, payments, maintenance),
 * read/unread state, and swipe-to-archive.
 */
import { useState, useCallback, useMemo, memo } from "react";
import { useIsMobile } from "@/hooks/use-mobile";
import {
  Bell, BellOff, Check, CheckCheck, Archive, Trash2,
  Users, CreditCard, Wrench, MessageSquare, AlertTriangle,
  Filter, X, ChevronDown,
} from "lucide-react";
import { cn } from "@/lib/utils";

export interface AppNotification {
  id: string;
  title: string;
  message: string;
  category: "mieter" | "zahlung" | "wartung" | "dokument" | "system";
  /** ISO date string */
  timestamp: string;
  isRead: boolean;
  isArchived?: boolean;
  /** Optional action URL */
  actionUrl?: string;
  /** Optional action label */
  actionLabel?: string;
  /** Priority level */
  priority?: "low" | "normal" | "high";
}

interface MobileInAppNotificationCenterProps {
  /** Notifications list */
  notifications: AppNotification[];
  /** Mark notification as read */
  onMarkRead?: (id: string) => void;
  /** Mark all as read */
  onMarkAllRead?: () => void;
  /** Archive notification */
  onArchive?: (id: string) => void;
  /** Delete notification */
  onDelete?: (id: string) => void;
  /** Notification click handler */
  onClick?: (notification: AppNotification) => void;
  /** Show archived */
  showArchived?: boolean;
  /** Additional class */
  className?: string;
}

const categoryIcons: Record<AppNotification["category"], React.ReactNode> = {
  mieter: <Users className="w-4 h-4" />,
  zahlung: <CreditCard className="w-4 h-4" />,
  wartung: <Wrench className="w-4 h-4" />,
  dokument: <MessageSquare className="w-4 h-4" />,
  system: <AlertTriangle className="w-4 h-4" />,
};

const categoryLabels: Record<AppNotification["category"], string> = {
  mieter: "Mieter",
  zahlung: "Zahlungen",
  wartung: "Wartung",
  dokument: "Dokumente",
  system: "System",
};

const categoryColors: Record<AppNotification["category"], string> = {
  mieter: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  zahlung: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  wartung: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400",
  dokument: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
  system: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
};

function formatRelativeTime(isoDate: string): string {
  const now = Date.now();
  const date = new Date(isoDate).getTime();
  const diffMs = now - date;
  const diffMin = Math.floor(diffMs / 60000);
  const diffHr = Math.floor(diffMs / 3600000);
  const diffDay = Math.floor(diffMs / 86400000);

  if (diffMin < 1) return "Gerade eben";
  if (diffMin < 60) return `Vor ${diffMin} Min.`;
  if (diffHr < 24) return `Vor ${diffHr} Std.`;
  if (diffDay < 7) return `Vor ${diffDay} ${diffDay === 1 ? "Tag" : "Tagen"}`;
  return new Date(isoDate).toLocaleDateString("de-DE", { day: "numeric", month: "short" });
}

export const MobileInAppNotificationCenter = memo(function MobileInAppNotificationCenter({
  notifications,
  onMarkRead,
  onMarkAllRead,
  onArchive,
  onDelete,
  onClick,
  showArchived = false,
  className,
}: MobileInAppNotificationCenterProps) {
  const isMobile = useIsMobile();
  const [activeFilter, setActiveFilter] = useState<AppNotification["category"] | "all">("all");
  const [swipedId, setSwipedId] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(false);

  const filteredNotifications = useMemo(() => {
    return notifications.filter(n => {
      if (!showArchived && n.isArchived) return false;
      if (activeFilter !== "all" && n.category !== activeFilter) return false;
      return true;
    }).sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }, [notifications, activeFilter, showArchived]);

  const unreadCount = useMemo(
    () => notifications.filter(n => !n.isRead && !n.isArchived).length,
    [notifications]
  );

  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = { all: 0 };
    for (const n of notifications) {
      if (n.isArchived) continue;
      if (!n.isRead) {
        counts.all = (counts.all || 0) + 1;
        counts[n.category] = (counts[n.category] || 0) + 1;
      }
    }
    return counts;
  }, [notifications]);

  const handleNotificationClick = useCallback((notification: AppNotification) => {
    if (!notification.isRead) {
      onMarkRead?.(notification.id);
    }
    onClick?.(notification);
  }, [onMarkRead, onClick]);

  const handleSwipeStart = useCallback((id: string) => {
    setSwipedId(prev => prev === id ? null : id);
  }, []);

  return (
    <div className={cn("w-full", className)}>
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Bell className="w-5 h-5" />
          <h2 className="text-sm font-semibold">Benachrichtigungen</h2>
          {unreadCount > 0 && (
            <span className="px-1.5 py-0.5 rounded-full bg-primary text-primary-foreground text-[10px] font-medium">
              {unreadCount}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          {unreadCount > 0 && onMarkAllRead && (
            <button
              onClick={onMarkAllRead}
              className={cn(
                "p-2 rounded-lg hover:bg-muted transition-colors",
                isMobile && "min-w-[44px] min-h-[44px] flex items-center justify-center"
              )}
              aria-label="Alle als gelesen markieren"
            >
              <CheckCheck className="w-4 h-4" />
            </button>
          )}
          <button
            onClick={() => setShowFilters(prev => !prev)}
            className={cn(
              "p-2 rounded-lg hover:bg-muted transition-colors",
              showFilters && "bg-muted",
              isMobile && "min-w-[44px] min-h-[44px] flex items-center justify-center"
            )}
            aria-label="Filter"
          >
            <Filter className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Category filters */}
      {showFilters && (
        <div className="flex flex-wrap gap-1.5 mb-3 animate-in slide-in-from-top-2 duration-200">
          <button
            onClick={() => setActiveFilter("all")}
            className={cn(
              "px-2.5 py-1 rounded-full text-[10px] font-medium border transition-colors",
              activeFilter === "all" ? "bg-primary text-primary-foreground border-primary" : "hover:bg-muted"
            )}
          >
            Alle {categoryCounts.all > 0 && `(${categoryCounts.all})`}
          </button>
          {(Object.keys(categoryLabels) as AppNotification["category"][]).map(cat => (
            <button
              key={cat}
              onClick={() => setActiveFilter(cat)}
              className={cn(
                "px-2.5 py-1 rounded-full text-[10px] font-medium border transition-colors",
                activeFilter === cat ? "bg-primary text-primary-foreground border-primary" : "hover:bg-muted"
              )}
            >
              {categoryLabels[cat]} {categoryCounts[cat] > 0 && `(${categoryCounts[cat]})`}
            </button>
          ))}
        </div>
      )}

      {/* Notification list */}
      {filteredNotifications.length === 0 ? (
        <div className="text-center py-8">
          <BellOff className="w-8 h-8 mx-auto text-muted-foreground mb-2" />
          <p className="text-xs text-muted-foreground">Keine Benachrichtigungen</p>
        </div>
      ) : (
        <div className="space-y-1">
          {filteredNotifications.map(notification => (
            <div
              key={notification.id}
              className={cn(
                "relative overflow-hidden rounded-lg border transition-all",
                !notification.isRead && "bg-primary/3 border-primary/20",
                notification.priority === "high" && !notification.isRead && "border-l-2 border-l-red-500"
              )}
            >
              {/* Main content */}
              <button
                onClick={() => handleNotificationClick(notification)}
                onContextMenu={(e) => {
                  e.preventDefault();
                  handleSwipeStart(notification.id);
                }}
                className={cn(
                  "w-full text-left p-3 flex gap-2.5",
                  "hover:bg-muted/50 active:bg-muted transition-colors",
                  isMobile && "min-h-[56px]"
                )}
              >
                {/* Category icon */}
                <div className={cn(
                  "w-8 h-8 rounded-full flex items-center justify-center shrink-0",
                  categoryColors[notification.category]
                )}>
                  {categoryIcons[notification.category]}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <p className={cn(
                      "text-xs truncate",
                      !notification.isRead ? "font-semibold" : "font-medium"
                    )}>
                      {notification.title}
                    </p>
                    <span className="text-[9px] text-muted-foreground shrink-0">
                      {formatRelativeTime(notification.timestamp)}
                    </span>
                  </div>
                  <p className="text-[10px] text-muted-foreground line-clamp-2 mt-0.5">
                    {notification.message}
                  </p>
                  {notification.actionLabel && (
                    <span className="text-[10px] text-primary font-medium mt-1 inline-block">
                      {notification.actionLabel}
                    </span>
                  )}
                </div>

                {/* Unread indicator */}
                {!notification.isRead && (
                  <div className="w-2 h-2 rounded-full bg-primary shrink-0 mt-1" />
                )}
              </button>

              {/* Swipe actions */}
              {swipedId === notification.id && (
                <div className="absolute inset-y-0 right-0 flex items-center animate-in slide-in-from-right-4 duration-200">
                  {!notification.isRead && (
                    <button
                      onClick={() => { onMarkRead?.(notification.id); setSwipedId(null); }}
                      className="h-full px-3 bg-blue-500 text-white flex items-center"
                      aria-label="Als gelesen markieren"
                    >
                      <Check className="w-4 h-4" />
                    </button>
                  )}
                  <button
                    onClick={() => { onArchive?.(notification.id); setSwipedId(null); }}
                    className="h-full px-3 bg-amber-500 text-white flex items-center"
                    aria-label="Archivieren"
                  >
                    <Archive className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => { onDelete?.(notification.id); setSwipedId(null); }}
                    className="h-full px-3 bg-red-500 text-white flex items-center"
                    aria-label="Löschen"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
});
