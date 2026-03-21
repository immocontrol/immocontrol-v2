/**
 * Keyword-Benachrichtigungen für Newsticker.
 * Bei neuen Artikeln, die Schlagwörter enthalten, wird eine Benachrichtigung erstellt.
 */
import { storeNotification } from "@/lib/pushNotifications";
import { ROUTES } from "@/lib/routes";

const KEYWORDS_KEY = "immocontrol_news_notify_keywords";
const LAST_NOTIFIED_KEY = "immocontrol_news_last_notified";

export function getNewsNotificationKeywords(): string[] {
  try {
    const raw = localStorage.getItem(KEYWORDS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? (parsed as string[]).filter((k) => typeof k === "string" && k.trim()) : [];
  } catch {
    return [];
  }
}

export function setNewsNotificationKeywords(keywords: string[]): void {
  try {
    localStorage.setItem(KEYWORDS_KEY, JSON.stringify(keywords.filter((k) => k.trim())));
  } catch (e) {
    console.warn("Keywords konnten nicht gespeichert werden:", e);
  }
}

export function checkAndNotifyNewsKeywords(
  news: Array<{ id: string; title: string; description: string }>
): void {
  const keywords = getNewsNotificationKeywords();
  if (keywords.length === 0) return;

  const today = new Date().toISOString().slice(0, 10);
  const lastNotified = localStorage.getItem(LAST_NOTIFIED_KEY);
  if (lastNotified === today) return;

  const matches = news.filter((item) => {
    const text = `${item.title} ${item.description}`.toLowerCase();
    return keywords.some((kw) => text.includes(kw.toLowerCase()));
  });

  if (matches.length > 0) {
    localStorage.setItem(LAST_NOTIFIED_KEY, today);
    const kwList = keywords.slice(0, 3).join(", ");
    storeNotification({
      title: "Newsticker: Neue Artikel zu deinen Schlagwörtern",
      body: `${matches.length} Artikel enthalten „${kwList}"${keywords.length > 3 ? " …" : ""}`,
      category: "general",
      tag: `newsticker-keywords-${today}`,
      url: ROUTES.NEWSTICKER,
    });
  }
}
