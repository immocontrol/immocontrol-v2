/**
 * UX: Zuletzt angesehene Objekte für Schnellzugriff.
 * Nutzt CustomEvent, damit AppLayout die Liste aktualisiert, wenn PropertyDetail add() aufruft.
 */
import { useState, useCallback, useEffect } from "react";

const STORAGE_KEY = "immocontrol_recent_properties";
const MAX = 5;
export const RECENT_PROPERTIES_UPDATED = "immocontrol_recent_properties_updated";

export interface RecentProperty {
  id: string;
  name: string;
}

export function loadRecentProperties(): RecentProperty[] {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as unknown;
      if (Array.isArray(parsed)) {
        return parsed
          .filter((x): x is RecentProperty => x && typeof x.id === "string" && typeof x.name === "string")
          .slice(0, MAX);
      }
    }
  } catch { /* ignore */ }
  return [];
}

function save(items: RecentProperty[]) {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(items.slice(0, MAX)));
  } catch { /* ignore */ }
}

export function useRecentProperties() {
  const [recent, setRecent] = useState<RecentProperty[]>(loadRecentProperties);

  const add = useCallback((id: string, name: string) => {
    const next = [{ id, name }, ...loadRecentProperties().filter((p) => p.id !== id)].slice(0, MAX);
    save(next);
    setRecent(next);
    window.dispatchEvent(new CustomEvent(RECENT_PROPERTIES_UPDATED));
  }, []);

  useEffect(() => {
    const handler = () => setRecent(loadRecentProperties());
    window.addEventListener(RECENT_PROPERTIES_UPDATED, handler);
    window.addEventListener("storage", handler);
    return () => {
      window.removeEventListener(RECENT_PROPERTIES_UPDATED, handler);
      window.removeEventListener("storage", handler);
    };
  }, []);

  return { recent, add };
}
