/**
 * FUND-25: Push notifications for document expiry, rent reminders,
 * loan milestones, and maintenance schedules.
 * Uses the Web Push API (service worker based).
 */

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
    console.warn("FUND-25: Browser does not support notifications");
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
        url: `/dokumente?id=${doc.id}`,
        tag: `doc-expiry-${doc.id}`,
      });
      notifications.push(notification);
    }
  }

  return notifications;
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
        url: `/darlehen?id=${loan.id}`,
        tag: `loan-milestone-${loan.id}`,
      });
      notifications.push(notification);
    }
  }

  return notifications;
}
