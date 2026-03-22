/**
 * Offline-/Fallback-Cache für Newsticker-Feed (localStorage, best effort).
 */
import type { NewsItem } from "./newsUtils";

const CACHE_KEY = "immocontrol_newsticker_feed_cache_v1";
const MAX_CACHE_AGE_MS = 48 * 60 * 60 * 1000;

interface CachePayload {
  savedAt: number;
  items: NewsItem[];
}

export function saveNewsFeedCache(items: NewsItem[]): void {
  try {
    const payload: CachePayload = { savedAt: Date.now(), items };
    localStorage.setItem(CACHE_KEY, JSON.stringify(payload));
  } catch {
    /* Quota / private mode */
  }
}

export function loadNewsFeedCache(): NewsItem[] | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CachePayload;
    if (!parsed || !Array.isArray(parsed.items) || typeof parsed.savedAt !== "number") return null;
    if (Date.now() - parsed.savedAt > MAX_CACHE_AGE_MS) return null;
    return parsed.items;
  } catch {
    return null;
  }
}
