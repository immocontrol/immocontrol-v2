/**
 * Newsticker-Archiv: Lokale Speicherung von Nachrichten.
 * Ermöglicht Archivieren von Artikeln inkl. optionalem Volltext (PDF + HTML)
 * für paywall-freie Inhalte.
 * Uses IndexedDB for larger capacity; falls back to localStorage.
 */
import type { NewsItem } from "./newsUtils";
import { loadFromIndexedDB, saveToIndexedDB, migrateFromLocalStorage } from "@/lib/newsArchiveDb";
import { sanitizeForPdf } from "@/lib/formatters";

export interface ArchivedNewsItem {
  id: string;
  item: NewsItem;
  archivedAt: string;
  fullContent?: string;
  hasFullContent: boolean;
}

const ARCHIVE_KEY = "immocontrol_news_archive";
const MAX_ARCHIVED = 2000;
let useIndexedDB = true;
let cachedSync: ArchivedNewsItem[] = [];
let migrationDone = false;

async function migrateOnce(): Promise<void> {
  if (migrationDone) return;
  migrationDone = true;
  const legacy = migrateFromLocalStorage();
  if (legacy.length > 0) {
    await saveToIndexedDB(legacy);
  }
}

function loadRawSync(): ArchivedNewsItem[] {
  try {
    const raw = localStorage.getItem(ARCHIVE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed as ArchivedNewsItem[];
  } catch {
    return [];
  }
}

export async function loadArchivedAsync(): Promise<ArchivedNewsItem[]> {
  if (typeof indexedDB === "undefined") {
    useIndexedDB = false;
    return loadRawSync();
  }
  try {
    await migrateOnce();
    const items = await loadFromIndexedDB();
    cachedSync = items;
    return items;
  } catch {
    useIndexedDB = false;
    return loadRawSync();
  }
}

export function loadArchived(): ArchivedNewsItem[] {
  return cachedSync.length > 0 ? cachedSync : loadRawSync();
}

export function isArchived(id: string): boolean {
  const items = cachedSync.length > 0 ? cachedSync : loadRawSync();
  return items.some((a) => a.id === id);
}

async function persistItems(items: ArchivedNewsItem[]): Promise<void> {
  const next = items.slice(-MAX_ARCHIVED);
  cachedSync = next;
  if (useIndexedDB && typeof indexedDB !== "undefined") {
    try {
      await saveToIndexedDB(next);
    } catch {
      try {
        localStorage.setItem(ARCHIVE_KEY, JSON.stringify(next));
      } catch (e) {
        console.warn("Archiv konnte nicht gespeichert werden:", e);
      }
    }
  } else {
    try {
      localStorage.setItem(ARCHIVE_KEY, JSON.stringify(next));
    } catch (e) {
      console.warn("Archiv konnte nicht gespeichert werden:", e);
    }
  }
}

export function archiveItem(
  item: NewsItem,
  options?: { fullContent?: string }
): ArchivedNewsItem {
  const existing = cachedSync.length > 0 ? cachedSync : loadRawSync();
  const found = existing.find((a) => a.id === item.id);
  if (found) return found;

  const archived: ArchivedNewsItem = {
    id: item.id,
    item,
    archivedAt: new Date().toISOString(),
    fullContent: options?.fullContent,
    hasFullContent: !!(options?.fullContent && options.fullContent.length > 200),
  };

  const next = [...existing.filter((a) => a.id !== item.id), archived];
  persistItems(next);
  return archived;
}

export function removeFromArchive(id: string): void {
  const existing = cachedSync.length > 0 ? cachedSync : loadRawSync();
  const next = existing.filter((a) => a.id !== id);
  persistItems(next);
}

/** Fetch article HTML via CORS proxy and extract main text content */
async function fetchArticleContent(url: string): Promise<string | null> {
  try {
    const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`;
    const resp = await fetch(proxyUrl, { signal: AbortSignal.timeout(12000) });
    if (!resp.ok) return null;
    const html = await resp.text();
    if (!html || html.length < 500) return null;

    const parser = new DOMParser();
    const doc = parser.parseFromString(html, "text/html");

    const paywallKeywords = [
      "jetzt lesen",
      "artikel lesen",
      "registrieren",
      "anmelden",
      "abo",
      "abonnieren",
      "paywall",
      "plus artikel",
      "premium",
      "mitglied werden",
      "kostenpflichtig",
      "zeige mir den artikel",
      "weiterlesen mit",
    ];
    const lowerHtml = html.toLowerCase();
    if (paywallKeywords.some((kw) => lowerHtml.includes(kw))) {
      const bodyText = doc.body?.innerText?.trim() || "";
      if (bodyText.length < 800) return null;
    }

    const selectors = [
      "article",
      "[role='article']",
      "main article",
      ".article-body",
      ".article__body",
      ".post-content",
      ".entry-content",
      ".content-body",
      ".story-body",
      ".article-content",
      "#article-body",
      ".richtext",
      "[data-article-body]",
      "main",
    ];

    let mainEl: Element | null = null;
    for (const sel of selectors) {
      mainEl = doc.querySelector(sel);
      if (mainEl) {
        const text = mainEl.textContent?.trim() || "";
        if (text.length > 400) break;
        mainEl = null;
      }
    }

    const text = mainEl
      ? (mainEl.textContent || "").replace(/\s+/g, " ").trim()
      : (doc.body?.innerText || "").replace(/\s+/g, " ").trim();

    if (text.length < 200) return null;
    return text.slice(0, 50_000);
  } catch {
    return null;
  }
}

/** Generate PDF blob from article content */
async function generatePdfBlob(
  item: NewsItem,
  fullContent: string
): Promise<Blob> {
  const { default: jsPDF } = await import("jspdf");
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const margin = 20;
  const maxW = 210 - 2 * margin;
  const lineHeight = 6;
  let y = 20;

  doc.setFontSize(14);
  const titleLines = doc.splitTextToSize(sanitizeForPdf(item.title), maxW);
  doc.text(titleLines, margin, y);
  y += titleLines.length * lineHeight + 4;

  doc.setFontSize(9);
  doc.setTextColor(128, 128, 128);
  doc.text(sanitizeForPdf(`${item.source} · ${new Date(item.publishedAt).toLocaleDateString("de-DE")}`), margin, y);
  y += 6;
  doc.text(sanitizeForPdf(`Quelle: ${item.url}`), margin, y);
  y += 8;
  doc.setTextColor(0, 0, 0);

  if (item.description) {
    doc.setFontSize(10);
    const descLines = doc.splitTextToSize(sanitizeForPdf(item.description), maxW);
    descLines.forEach((line: string) => {
      if (y > 270) {
        doc.addPage();
        y = 20;
      }
      doc.text(line, margin, y);
      y += lineHeight;
    });
    y += 4;
  }

  doc.setFontSize(10);
  const bodyLines = doc.splitTextToSize(sanitizeForPdf(fullContent), maxW);
  bodyLines.forEach((line: string) => {
    if (y > 275) {
      doc.addPage();
      y = 20;
    }
    doc.text(line, margin, y);
    y += lineHeight;
  });

  return doc.output("blob");
}

/** Generate reader-friendly HTML for download (with Dark-Mode + Schema.org) */
function generateReaderHtml(item: NewsItem, fullContent: string, prefersDark?: boolean): string {
  const date = new Date(item.publishedAt).toLocaleDateString("de-DE", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
  const escapedTitle = item.title
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
  const escapedDesc = (item.description || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
  const escapedContent = fullContent
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\n/g, "<br>");

  const isDark = prefersDark ?? (typeof window !== "undefined" && window.matchMedia?.("(prefers-color-scheme: dark)")?.matches);
  const schemaJson = JSON.stringify({
    "@context": "https://schema.org",
    "@type": "NewsArticle",
    headline: item.title,
    datePublished: item.publishedAt,
    publisher: { "@type": "Organization", name: item.source },
    url: item.url,
    description: item.description,
  });
  return `<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapedTitle}</title>
  <meta name="author" content="${item.source}">
  <meta name="description" content="${escapedDesc.slice(0, 160)}">
  <script type="application/ld+json">${schemaJson}</script>
  <style>
    :root { --bg: #fafafa; --fg: #1a1a1a; --muted: #666; --link: #0066cc; --border: #ddd; }
    @media (prefers-color-scheme: dark) { :root { --bg: #1a1a1a; --fg: #e5e5e5; --muted: #a3a3a3; --link: #60a5fa; --border: #404040; } }
    ${isDark ? "body { --bg: #1a1a1a; --fg: #e5e5e5; --muted: #a3a3a3; --link: #60a5fa; --border: #404040; }" : ""}
    body { font-family: Georgia, "Times New Roman", serif; max-width: 42rem; margin: 0 auto; padding: 2rem 1rem; line-height: 1.7; color: var(--fg); background: var(--bg); }
    h1 { font-size: 1.5rem; margin-bottom: 0.5rem; line-height: 1.3; }
    .meta { font-size: 0.875rem; color: var(--muted); margin-bottom: 1.5rem; }
    .description { font-size: 1rem; color: var(--muted); margin-bottom: 1.5rem; padding-left: 1rem; border-left: 3px solid var(--border); }
    .content { font-size: 1rem; }
    a { color: var(--link); }
  </style>
</head>
<body>
  <article>
    <h1>${escapedTitle}</h1>
    <p class="meta">${item.source} · ${date} · <a href="${item.url}">Originalartikel</a></p>
    ${item.description ? `<p class="description">${escapedDesc}</p>` : ""}
    <div class="content">${escapedContent}</div>
  </article>
</body>
</html>`;
}

/** Archive with optional full-text fetch; returns created archive entry and files to save */
export async function archiveWithFullText(item: NewsItem): Promise<{
  archived: ArchivedNewsItem;
  pdfBlob?: Blob;
  htmlContent?: string;
}> {
  const fullContent = await fetchArticleContent(item.url);
  const hasFull = !!(fullContent && fullContent.length > 200);

  const archived = archiveItem(item, { fullContent: fullContent || undefined });

  let pdfBlob: Blob | undefined;
  let htmlContent: string | undefined;

  if (hasFull && fullContent) {
    pdfBlob = await generatePdfBlob(item, fullContent);
    const prefersDark = typeof window !== "undefined" && window.matchMedia?.("(prefers-color-scheme: dark)")?.matches;
    htmlContent = generateReaderHtml(item, fullContent, prefersDark);
  }

  return { archived, pdfBlob, htmlContent };
}

/** Export archive as JSON */
export function exportArchiveAsJson(): void {
  const items = cachedSync.length > 0 ? cachedSync : loadRawSync();
  const data = JSON.stringify(items, null, 2);
  const blob = new Blob([data], { type: "application/json" });
  downloadBlob(blob, `Newsticker-Archiv_${new Date().toISOString().split("T")[0]}.json`);
}

/** Export archive as CSV */
export function exportArchiveAsCsv(): void {
  const items = cachedSync.length > 0 ? cachedSync : loadRawSync();
  const header = "Titel;Quelle;URL;Datum;Archiviert am;Volltext\n";
  const rows = items.map((a) => {
    const i = a.item;
    const title = (i.title || "").replace(/;/g, ",").replace(/\n/g, " ");
    const source = (i.source || "").replace(/;/g, ",");
    const url = i.url || "";
    const date = i.publishedAt ? new Date(i.publishedAt).toLocaleDateString("de-DE") : "";
    const archivedAt = a.archivedAt ? new Date(a.archivedAt).toLocaleDateString("de-DE") : "";
    const hasFull = a.hasFullContent ? "ja" : "nein";
    return `"${title}";"${source}";"${url}";"${date}";"${archivedAt}";"${hasFull}"`;
  });
  const csv = "\uFEFF" + header + rows.join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  downloadBlob(blob, `Newsticker-Archiv_${new Date().toISOString().split("T")[0]}.csv`);
}

/** Trigger download of a blob with given filename */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
