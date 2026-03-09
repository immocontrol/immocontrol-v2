import { useState, useEffect, useRef } from "react";
import { toast } from "sonner";

const REACHABILITY_TIMEOUT_MS = 6000;
const REACHABILITY_DELAY_AFTER_OFFLINE_MS = 1500;

/** Ping app origin to confirm reachability (navigator.onLine can be wrong, e.g. on Railway/proxies). */
async function checkReachability(): Promise<boolean> {
  try {
    const c = new AbortController();
    const t = setTimeout(() => c.abort(), REACHABILITY_TIMEOUT_MS);
    await fetch(`${window.location.origin}/?reachability=${Date.now()}`, {
      method: "HEAD",
      cache: "no-store",
      signal: c.signal,
    });
    clearTimeout(t);
    return true;
  } catch {
    return false;
  }
}

/** Feature 4: Hook to track online/offline status.
 *  Uses navigator.onLine plus reachability check so "offline" is not shown when the app is reachable (e.g. deployed on Railway). */
export const useOnlineStatus = () => {
  const [isOnline, setIsOnline] = useState(() => typeof navigator !== "undefined" && navigator.onLine);
  const reachabilityChecked = useRef(false);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);

    const handleOffline = async () => {
      setIsOnline(false);
      /* navigator.onLine is often wrong (e.g. Railway, strict browsers). Confirm with a real request. */
      await new Promise((r) => setTimeout(r, REACHABILITY_DELAY_AFTER_OFFLINE_MS));
      if (await checkReachability()) setIsOnline(true);
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    /* On mount: if browser says offline but we can reach the app, show online. */
    if (!navigator.onLine && !reachabilityChecked.current) {
      reachabilityChecked.current = true;
      checkReachability().then((ok) => {
        if (ok) setIsOnline(true);
      });
    }

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  return isOnline;
};

/** IMP-41-18: Separate hook for online/offline toast notifications — call exactly once in AppLayout.
 *  Skips the first "offline" toast so reachability check can correct navigator.onLine (e.g. on Railway). */
export const useOnlineStatusNotifications = () => {
  const isOnline = useOnlineStatus();
  const wasOfflineRef = useRef(false);
  const initialRunRef = useRef(true);

  useEffect(() => {
    if (initialRunRef.current) {
      initialRunRef.current = false;
      if (!isOnline) wasOfflineRef.current = true;
      return;
    }
    if (!isOnline) {
      wasOfflineRef.current = true;
      /* Kein Toast — Banner oben in AppLayout reicht. */
    } else if (wasOfflineRef.current) {
      toast.success("Verbindung wiederhergestellt", { duration: 3000 });
      wasOfflineRef.current = false;
    }
  }, [isOnline]);

  return isOnline;
};
