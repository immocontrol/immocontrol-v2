/**
 * Deduplizierung von News-Artikeln: gleiche Story über Google-Redirect und Original,
 * sowie sehr ähnliche Überschriften.
 */
import type { NewsItem } from "./newsUtils";

function publishedMs(iso: string): number {
  const t = new Date(iso).getTime();
  return Number.isNaN(t) ? 0 : t;
}

/** Host + Pfad ohne Tracking; Google-News-Redirects auf Ziel-URL auflösen */
export function canonicalUrlForDedup(url: string): string {
  try {
    const u = new URL(url);
    const inner = u.searchParams.get("url") || u.searchParams.get("q");
    if (inner) {
      try {
        const t = new URL(decodeURIComponent(inner));
        const h = t.hostname.replace(/^www\./, "").toLowerCase();
        return `${h}${t.pathname.replace(/\/$/, "")}`;
      } catch {
        /* ignore */
      }
    }
    const h = u.hostname.replace(/^www\./, "").toLowerCase();
    return `${h}${u.pathname.replace(/\/$/, "")}`;
  } catch {
    return url.slice(0, 160).toLowerCase();
  }
}

function normalizeTitleForDedup(title: string): string {
  return title
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/^(news|breaking|live|exklusiv|update|video|podcast)\s*[:\-–]\s*/i, "")
    .replace(/[^a-z0-9äöüß\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function wordSet(title: string): Set<string> {
  const words = normalizeTitleForDedup(title).split(/\s+/).filter((w) => w.length > 2);
  return new Set(words);
}

function jaccardSimilarity(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let inter = 0;
  for (const x of a) if (b.has(x)) inter++;
  const union = a.size + b.size - inter;
  return union === 0 ? 0 : inter / union;
}

/**
 * Entfernt Dubletten (neueste behalten): exakter Titel-Key, gleiche kanonische URL,
 * sehr ähnliche Überschriften (Jaccard ≥ Schwellwert).
 */
export function dedupeNewsItems(items: NewsItem[], options?: { titleJaccardMin?: number }): NewsItem[] {
  const jMin = options?.titleJaccardMin ?? 0.72;
  const sorted = [...items].sort((a, b) => publishedMs(b.publishedAt) - publishedMs(a.publishedAt));
  const kept: NewsItem[] = [];
  const seenTitleKeys = new Set<string>();
  const seenCanonUrls = new Set<string>();

  for (const item of sorted) {
    const tKey = normalizeTitleForDedup(item.title).replace(/\s/g, "").slice(0, 72);
    if (tKey.length >= 8 && seenTitleKeys.has(tKey)) continue;

    const canon = canonicalUrlForDedup(item.url);
    if (canon.length > 12 && seenCanonUrls.has(canon)) continue;

    const ws = wordSet(item.title);
    let similar = false;
    for (const k of kept) {
      if (jaccardSimilarity(ws, wordSet(k.title)) >= jMin) {
        similar = true;
        break;
      }
    }
    if (similar) continue;

    if (tKey.length >= 8) seenTitleKeys.add(tKey);
    if (canon.length > 12) seenCanonUrls.add(canon);
    kept.push(item);
  }
  return kept;
}
