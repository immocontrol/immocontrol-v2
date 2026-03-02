/**
 * NOTIFY-1: Smart Notification System — local push notifications
 *
 * Checks for overdue payments, expiring contracts, open tickets
 * and sends browser notifications (no external service needed).
 * Uses the Notification API (free, built into every browser).
 */

import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

interface AppNotification {
  id: string;
  type: "overdue_payment" | "expiring_contract" | "open_ticket" | "maintenance_due" | "rent_increase_possible";
  title: string;
  message: string;
  severity: "high" | "medium" | "low";
  createdAt: string;
  read: boolean;
  link?: string;
}

interface NotificationState {
  notifications: AppNotification[];
  unreadCount: number;
  permissionGranted: boolean;
  loading: boolean;
}

const STORAGE_KEY = "immo-notifications-read";

function getReadIds(): Set<string> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? new Set(JSON.parse(raw) as string[]) : new Set();
  } catch {
    return new Set();
  }
}

function saveReadIds(ids: Set<string>) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify([...ids]));
}

export function useNotifications() {
  const { user } = useAuth();
  const [state, setState] = useState<NotificationState>({
    notifications: [],
    unreadCount: 0,
    permissionGranted: typeof Notification !== "undefined" && Notification.permission === "granted",
    loading: false,
  });
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const prevNotificationIdsRef = useRef<Set<string>>(new Set());

  const requestPermission = useCallback(async () => {
    if (typeof Notification === "undefined") return false;
    if (Notification.permission === "granted") {
      setState(prev => ({ ...prev, permissionGranted: true }));
      return true;
    }
    if (Notification.permission === "denied") return false;
    const result = await Notification.requestPermission();
    const granted = result === "granted";
    setState(prev => ({ ...prev, permissionGranted: granted }));
    return granted;
  }, []);

  const sendBrowserNotification = useCallback((title: string, body: string) => {
    if (typeof Notification !== "undefined" && Notification.permission === "granted") {
      try {
        new Notification(title, {
          body,
          icon: "/favicon.ico",
          badge: "/favicon.ico",
          tag: `immo-${Date.now()}`,
        });
      } catch {
        /* SW notification fallback not needed for desktop */
      }
    }
  }, []);

  const checkNotifications = useCallback(async () => {
    if (!user) return;
    setState(prev => ({ ...prev, loading: true }));

    const readIds = getReadIds();
    const notifications: AppNotification[] = [];
    const now = new Date();
    const today = now.toISOString().split("T")[0];

    try {
      /* Check overdue payments */
      const { data: overduePayments } = await supabase
        .from("rent_payments")
        .select("id, tenant_id, amount, due_date, status")
        .eq("status", "overdue")
        .order("due_date", { ascending: true })
        .limit(20);

      if (overduePayments) {
        for (const p of overduePayments) {
          const id = `overdue-${p.id}`;
          notifications.push({
            id,
            type: "overdue_payment",
            title: "Überfällige Zahlung",
            message: `Zahlung über ${Number(p.amount).toLocaleString("de-DE")} € fällig seit ${new Date(p.due_date).toLocaleDateString("de-DE")}`,
            severity: "high",
            createdAt: p.due_date,
            read: readIds.has(id),
            link: "/mietuebersicht",
          });
        }
      }

      /* Check expiring contracts (next 30 days) */
      const thirtyDaysLater = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
      const { data: expiringContracts } = await supabase
        .from("tenants")
        .select("id, first_name, last_name, lease_end")
        .not("lease_end", "is", null)
        .gte("lease_end", today)
        .lte("lease_end", thirtyDaysLater)
        .limit(20);

      if (expiringContracts) {
        for (const t of expiringContracts) {
          const id = `expiring-${t.id}`;
          const daysLeft = Math.ceil((new Date(t.lease_end).getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
          notifications.push({
            id,
            type: "expiring_contract",
            title: "Vertrag läuft aus",
            message: `${t.first_name} ${t.last_name}: Mietvertrag endet in ${daysLeft} Tagen (${new Date(t.lease_end).toLocaleDateString("de-DE")})`,
            severity: daysLeft <= 7 ? "high" : "medium",
            createdAt: today,
            read: readIds.has(id),
            link: "/vertraege",
          });
        }
      }

      /* Check open tickets */
      const { data: openTickets } = await supabase
        .from("tickets")
        .select("id, title, priority, created_at")
        .eq("status", "open")
        .order("created_at", { ascending: true })
        .limit(10);

      if (openTickets) {
        for (const t of openTickets) {
          const id = `ticket-${t.id}`;
          notifications.push({
            id,
            type: "open_ticket",
            title: "Offenes Ticket",
            message: `"${t.title}" — Priorität: ${t.priority || "normal"}`,
            severity: t.priority === "high" ? "high" : "low",
            createdAt: t.created_at,
            read: readIds.has(id),
          });
        }
      }
    } catch {
      /* Silently fail — notifications are best-effort */
    }

    /* Sort: unread first, then by severity, then by date */
    const severityOrder: Record<string, number> = { high: 0, medium: 1, low: 2 };
    notifications.sort((a, b) => {
      if (a.read !== b.read) return a.read ? 1 : -1;
      const sevDiff = (severityOrder[a.severity] || 2) - (severityOrder[b.severity] || 2);
      if (sevDiff !== 0) return sevDiff;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });

    const unreadCount = notifications.filter(n => !n.read).length;

    /* Send browser notification for new high-severity items */
    const previousIds = prevNotificationIdsRef.current;
    const newHighSeverity = notifications.filter(n => !n.read && n.severity === "high" && !previousIds.has(n.id));
    if (newHighSeverity.length > 0) {
      sendBrowserNotification(
        `${newHighSeverity.length} neue Benachrichtigung${newHighSeverity.length > 1 ? "en" : ""}`,
        newHighSeverity[0].message
      );
    }

    prevNotificationIdsRef.current = new Set(notifications.map(n => n.id));
    setState(prev => ({ ...prev, notifications, unreadCount, loading: false }));
  }, [user, sendBrowserNotification]);

  const markAsRead = useCallback((id: string) => {
    const readIds = getReadIds();
    readIds.add(id);
    saveReadIds(readIds);
    setState(prev => {
      const wasUnread = prev.notifications.some(n => n.id === id && !n.read);
      return {
        ...prev,
        notifications: prev.notifications.map(n => n.id === id ? { ...n, read: true } : n),
        unreadCount: wasUnread ? prev.unreadCount - 1 : prev.unreadCount,
      };
    });
  }, []);

  const markAllAsRead = useCallback(() => {
    const readIds = getReadIds();
    state.notifications.forEach(n => readIds.add(n.id));
    saveReadIds(readIds);
    setState(prev => ({
      ...prev,
      notifications: prev.notifications.map(n => ({ ...n, read: true })),
      unreadCount: 0,
    }));
  }, [state.notifications]);

  /* Poll every 5 minutes */
  useEffect(() => {
    if (!user) return;
    checkNotifications();
    intervalRef.current = setInterval(checkNotifications, 5 * 60 * 1000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [user, checkNotifications]);

  return {
    ...state,
    requestPermission,
    markAsRead,
    markAllAsRead,
    refresh: checkNotifications,
  };
}

export type { AppNotification };
