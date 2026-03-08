/**
 * FUND-25: Push notifications for document expiry, rent reminders,
 * loan milestones, and maintenance schedules.
 * Uses the Web Push API (service worker based).
 */
import { logger } from "@/lib/logger";
import { documentsWithId, loansWithId } from "@/lib/routes";

export interface AppNotification {
  id: string;
  title: string;
  body: string;
  icon?: string;
  tag?: string;
  /** URL to navigate to on click */
  url?: string;
  /** When the notification should be shown (ISO string) */
  scheduledAt?: string;
  /** Category for grouping */
  category: "document" | "rent" | "loan" | "maintenance" | "general";
  /** Has the user seen this? */
  read: boolean;
  createdAt: string;
}

const STORAGE_KEY = "immocontrol_notifications";

/**
 * FUND-25: Request notification permission from the browser.
 */
export async function requestNotificationPermission(): Promise<NotificationPermission> {
  if (!("Notification" in window)) {
    logger.warn("FUND-25: Browser does not support notifications");
    return "denied";
  }
  if (Notification.permission === "granted") return "granted";
  return await Notification.requestPermission();
}

/**
 * FUND-25: Show a browser notification immediately.
 */
export function showBrowserNotification(
  title: string,
  options?: NotificationOptions,
): Notification | null {
  if (!("Notification" in window) || Notification.permission !== "granted") {
    return null;
  }
  return new Notification(title, {
    icon: "/icons/icon-192x192.png",
    badge: "/icons/icon-192x192.png",
    ...options,
  });
}

/**
 * FUND-25: Store a notification in localStorage for the in-app notification center.
 */
export function storeNotification(notification: Omit<AppNotification, "id" | "read" | "createdAt">): AppNotification {
  const stored = getStoredNotifications();
  // Deduplicate by tag — if a notification with the same tag exists, don't create a new one
  if (notification.tag) {
    const existing = stored.find((n) => n.tag === notification.tag);
    if (existing) return existing;
  }
  const newNotification: AppNotification = {
    ...notification,
    id: crypto.randomUUID(),
    read: false,
    createdAt: new Date().toISOString(),
  };
  stored.unshift(newNotification);
  // Keep max 100 notifications
  const trimmed = stored.slice(0, 100);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
  return newNotification;
}

/**
 * FUND-25: Get all stored notifications.
 */
export function getStoredNotifications(): AppNotification[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

/**
 * FUND-25: Mark a notification as read.
 */
export function markNotificationRead(id: string): void {
  const stored = getStoredNotifications();
  const idx = stored.findIndex((n) => n.id === id);
  if (idx >= 0) {
    stored[idx].read = true;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(stored));
  }
}

/**
 * FUND-25: Mark all notifications as read.
 */
export function markAllNotificationsRead(): void {
  const stored = getStoredNotifications();
  stored.forEach((n) => { n.read = true; });
  localStorage.setItem(STORAGE_KEY, JSON.stringify(stored));
}

/**
 * FUND-25: Get count of unread notifications.
 */
export function getUnreadCount(): number {
  return getStoredNotifications().filter((n) => !n.read).length;
}

/**
 * FUND-25: Clear all notifications.
 */
export function clearNotifications(): void {
  localStorage.removeItem(STORAGE_KEY);
}

/**
 * FUND-25: Check documents for upcoming expiry and create notifications.
 */
export function checkDocumentExpiry(
  documents: Array<{ id: string; name: string; expiryDate?: string | null }>,
  daysBeforeExpiry = 30,
): AppNotification[] {
  const now = new Date();
  const threshold = new Date(now.getTime() + daysBeforeExpiry * 24 * 60 * 60 * 1000);
  const notifications: AppNotification[] = [];

  for (const doc of documents) {
    if (!doc.expiryDate) continue;
    const expiry = new Date(doc.expiryDate);
    if (expiry <= threshold && expiry > now) {
      const daysLeft = Math.ceil((expiry.getTime() - now.getTime()) / (24 * 60 * 60 * 1000));
      const notification = storeNotification({
        title: "Dokument läuft ab",
        body: `"${doc.name}" läuft in ${daysLeft} Tagen ab.`,
        category: "document",
        url: documentsWithId(doc.id),
        tag: `doc-expiry-${doc.id}`,
      });
      notifications.push(notification);
    }
  }

  return notifications;
}

const PUSH_SUB_KEY = "immocontrol_web_push_subscription";

/**
 * Web-Push: Subscribe to push notifications (requires VAPID public key).
 * VAPID public key via VITE_VAPID_PUBLIC_KEY.
 * Returns subscription JSON or null if unavailable.
 */
export async function subscribeToWebPush(): Promise<PushSubscription | null> {
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) return null;
  const vapidKey = import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined;
  if (!vapidKey || !vapidKey.startsWith("B")) {
    return null;
  }
  const perm = await requestNotificationPermission();
  if (perm !== "granted") return null;
  const reg = await navigator.serviceWorker.ready;
  const subscription = await reg.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(vapidKey),
  });
  const json = subscription.toJSON();
  try {
    localStorage.setItem(PUSH_SUB_KEY, JSON.stringify(json));
  } catch {
    /* ignore */
  }
  return subscription;
}

function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const b64 = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(b64);
  const arr = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
  return arr;
}

/** Check if Web Push is subscribed and supported */
export function getWebPushStatus(): {
  supported: boolean;
  subscribed: boolean;
  vapidConfigured: boolean;
} {
  const vapidKey = import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined;
  const vapidConfigured = !!(vapidKey && vapidKey.startsWith("B"));
  const supported = typeof navigator !== "undefined" && "serviceWorker" in navigator && "PushManager" in window;
  let subscribed = false;
  try {
    const raw = localStorage.getItem(PUSH_SUB_KEY);
    subscribed = !!(raw && raw.length > 20);
  } catch {
    /* ignore */
  }
  return { supported, subscribed, vapidConfigured };
}

/**
 * FUND-25: Check loans for upcoming Zinsbindung end.
 */
export function checkLoanMilestones(
  loans: Array<{ id: string; bankName?: string; fixedInterestEndDate?: string | null }>,
  daysBeforeMilestone = 90,
): AppNotification[] {
  const now = new Date();
  const threshold = new Date(now.getTime() + daysBeforeMilestone * 24 * 60 * 60 * 1000);
  const notifications: AppNotification[] = [];

  for (const loan of loans) {
    if (!loan.fixedInterestEndDate) continue;
    const endDate = new Date(loan.fixedInterestEndDate);
    if (endDate <= threshold && endDate > now) {
      const daysLeft = Math.ceil((endDate.getTime() - now.getTime()) / (24 * 60 * 60 * 1000));
      const notification = storeNotification({
        title: "Zinsbindung endet bald",
        body: `${loan.bankName ?? "Darlehen"}: Zinsbindung endet in ${daysLeft} Tagen.`,
        category: "loan",
        url: loansWithId(loan.id),
        tag: `loan-milestone-${loan.id}`,
      });
      notifications.push(notification);
    }
  }

  return notifications;
}
