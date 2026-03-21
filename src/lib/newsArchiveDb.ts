/**
 * IndexedDB storage for Newsticker-Archiv (replaces localStorage for larger capacity).
 * Automatically migrates existing localStorage data on first use.
 */
const DB_NAME = "immocontrol_news_archive";
const DB_VERSION = 1;
const STORE_NAME = "archive";
const MAX_ARCHIVED = 2000;

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onerror = () => reject(req.error);
    req.onsuccess = () => resolve(req.result);
    req.onupgradeneeded = (e) => {
      const db = (e.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: "id" });
        store.createIndex("archivedAt", "archivedAt", { unique: false });
      }
    };
  });
  return dbPromise;
}

export interface StoredArchiveItem {
  id: string;
  item: unknown;
  archivedAt: string;
  fullContent?: string;
  hasFullContent: boolean;
}

export async function loadFromIndexedDB(): Promise<StoredArchiveItem[]> {
  try {
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readonly");
      const store = tx.objectStore(STORE_NAME);
      const req = store.getAll();
      req.onsuccess = () => {
        const items = (req.result || []) as StoredArchiveItem[];
        items.sort((a, b) => new Date(b.archivedAt).getTime() - new Date(a.archivedAt).getTime());
        resolve(items.slice(0, MAX_ARCHIVED));
      };
      req.onerror = () => reject(req.error);
    });
  } catch {
    return [];
  }
}

export async function saveToIndexedDB(items: StoredArchiveItem[]): Promise<void> {
  try {
    const db = await openDb();
    const toSave = items.slice(-MAX_ARCHIVED);
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      const store = tx.objectStore(STORE_NAME);
      store.clear();
      toSave.forEach((item) => store.put(item));
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (e) {
    console.warn("IndexedDB save failed:", e);
  }
}

const LEGACY_KEY = "immocontrol_news_archive";

export function migrateFromLocalStorage(): StoredArchiveItem[] {
  try {
    const raw = localStorage.getItem(LEGACY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    const items = parsed as StoredArchiveItem[];
    localStorage.removeItem(LEGACY_KEY);
    return items;
  } catch {
    return [];
  }
}
