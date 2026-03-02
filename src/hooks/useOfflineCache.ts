/**
 * OFFLINE-1: Offline Cache Hook — caches Supabase data in IndexedDB
 *
 * Provides transparent offline support:
 * - Caches query results in IndexedDB
 * - Returns cached data when offline
 * - Syncs pending mutations when back online
 * - Shows online/offline status
 */

import { useState, useEffect, useCallback, useRef } from "react";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";

const DB_NAME = "immocontrol-offline";
const DB_VERSION = 1;
const STORE_NAME = "cache";
const PENDING_STORE = "pending_mutations";

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
      if (!db.objectStoreNames.contains(PENDING_STORE)) {
        db.createObjectStore(PENDING_STORE, { autoIncrement: true });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function getCached<T>(key: string): Promise<{ data: T; timestamp: number } | null> {
  try {
    const db = await openDB();
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, "readonly");
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(key);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => resolve(null);
    });
  } catch {
    return null;
  }
}

async function setCached<T>(key: string, data: T): Promise<void> {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    store.put({ data, timestamp: Date.now() }, key);
    await new Promise<void>((resolve) => {
      tx.oncomplete = () => resolve();
    });
  } catch {
    /* Silently fail — cache is best-effort */
  }
}

interface PendingMutation {
  table: string;
  type: "insert" | "update" | "delete";
  data: Record<string, unknown>;
  id?: string;
  createdAt: number;
}

async function addPendingMutation(mutation: PendingMutation): Promise<void> {
  try {
    const db = await openDB();
    const tx = db.transaction(PENDING_STORE, "readwrite");
    tx.objectStore(PENDING_STORE).add(mutation);
    await new Promise<void>((resolve) => {
      tx.oncomplete = () => resolve();
    });
  } catch {
    /* Silently fail */
  }
}

async function getPendingMutations(): Promise<PendingMutation[]> {
  try {
    const db = await openDB();
    return new Promise((resolve) => {
      const tx = db.transaction(PENDING_STORE, "readonly");
      const store = tx.objectStore(PENDING_STORE);
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => resolve([]);
    });
  } catch {
    return [];
  }
}

async function clearPendingMutations(): Promise<void> {
  try {
    const db = await openDB();
    const tx = db.transaction(PENDING_STORE, "readwrite");
    tx.objectStore(PENDING_STORE).clear();
    await new Promise<void>((resolve) => {
      tx.oncomplete = () => resolve();
    });
  } catch {
    /* Silently fail */
  }
}

/**
 * Delete the first N entries from the pending_mutations store (autoIncrement keys).
 * Used after partial sync to remove only successfully synced mutations.
 */
async function clearFirstNPendingMutations(count: number): Promise<void> {
  try {
    const db = await openDB();
    const tx = db.transaction(PENDING_STORE, "readwrite");
    const store = tx.objectStore(PENDING_STORE);
    const req = store.openCursor();
    let deleted = 0;
    await new Promise<void>((resolve) => {
      req.onsuccess = () => {
        const cursor = req.result;
        if (!cursor || deleted >= count) { resolve(); return; }
        cursor.delete();
        deleted++;
        cursor.continue();
      };
      req.onerror = () => resolve();
    });
  } catch {
    /* Silently fail */
  }
}

const MAX_CACHE_AGE = 24 * 60 * 60 * 1000; // 24 hours

/** Concurrency guard — prevents duplicate sync when SW message + online event fire simultaneously */
let syncInProgress: Promise<number> | null = null;

/**
 * OFFLINE-4: Sync pending mutations when coming back online
 * Replays stored mutations against Supabase and clears them on success.
 */
async function syncPendingToServerImpl(): Promise<number> {
  const pending = await getPendingMutations();
  if (pending.length === 0) return 0;

  let synced = 0;
  for (const mutation of pending) {
    try {
      // Dynamic import to avoid circular dependency
      const { supabase } = await import("@/integrations/supabase/client");
      if (mutation.type === "insert") {
        const { error } = await supabase.from(mutation.table).insert(mutation.data);
        if (error) throw error;
      } else if (mutation.type === "update" && mutation.id) {
        const { error } = await supabase.from(mutation.table).update(mutation.data).eq("id", mutation.id);
        if (error) throw error;
      } else if (mutation.type === "delete" && mutation.id) {
        const { error } = await supabase.from(mutation.table).delete().eq("id", mutation.id);
        if (error) throw error;
      }
      synced++;
    } catch {
      /* Stop on first failure — remaining mutations stay pending */
      break;
    }
  }
  /* Only clear the mutations that were actually synced, not all of them */
  if (synced === pending.length) {
    await clearPendingMutations();
  } else if (synced > 0) {
    await clearFirstNPendingMutations(synced);
  }
  return synced;
}

/** Public entry point with concurrency guard */
async function syncPendingToServer(): Promise<number> {
  if (syncInProgress) return syncInProgress;
  syncInProgress = syncPendingToServerImpl();
  try {
    return await syncInProgress;
  } finally {
    syncInProgress = null;
  }
}

/**
 * OFFLINE-5: Hook to listen for service worker sync messages
 * Automatically triggers sync when SW sends SYNC_PENDING_MUTATIONS
 */
export function useBackgroundSync() {
  const isOnline = useOnlineStatus();

  useEffect(() => {
    const handler = (event: MessageEvent) => {
      if (event.data?.type === "SYNC_PENDING_MUTATIONS" && isOnline) {
        syncPendingToServer().then((count) => {
          if (count > 0) console.log(`[OfflineSync] ${count} pending mutations synced`);
        });
      }
    };
    navigator.serviceWorker?.addEventListener("message", handler);
    return () => navigator.serviceWorker?.removeEventListener("message", handler);
  }, [isOnline]);

  /* Auto-sync when coming back online */
  useEffect(() => {
    if (isOnline) {
      syncPendingToServer().then((count) => {
        if (count > 0) console.log(`[OfflineSync] ${count} pending mutations synced on reconnect`);
      });
    }
  }, [isOnline]);
}

export function useOfflineCache<T>(key: string, fetchFn: () => Promise<T>) {
  const isOnline = useOnlineStatus();
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [fromCache, setFromCache] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  const mountedRef = useRef(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      if (isOnline) {
        const fresh = await fetchFn();
        if (mountedRef.current) {
          setData(fresh);
          setFromCache(false);
        }
        await setCached(key, fresh);
      } else {
        const cached = await getCached<T>(key);
        if (cached && Date.now() - cached.timestamp < MAX_CACHE_AGE) {
          if (mountedRef.current) {
            setData(cached.data);
            setFromCache(true);
          }
        }
      }
    } catch {
      /* Try cache as fallback */
      const cached = await getCached<T>(key);
      if (cached && mountedRef.current) {
        setData(cached.data);
        setFromCache(true);
      }
    } finally {
      if (mountedRef.current) setLoading(false);
    }
    /* Update pending count */
    const pending = await getPendingMutations();
    if (mountedRef.current) setPendingCount(pending.length);
  }, [key, fetchFn, isOnline]);

  useEffect(() => {
    mountedRef.current = true;
    refresh();
    return () => { mountedRef.current = false; };
  }, [refresh]);

  return { data, loading, fromCache, isOnline, refresh, pendingCount };
}

export { addPendingMutation, getPendingMutations, clearPendingMutations };
export type { PendingMutation };
