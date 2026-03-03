import { useState, useEffect, useRef } from "react";
import { toast } from "sonner";

/** Feature 4: Hook to track online/offline status (pure state, no side effects)
 *  IMP-41-18: Toast notifications moved to useOnlineStatusNotifications to avoid duplicates */
export const useOnlineStatus = () => {
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  return isOnline;
};

/** IMP-41-18: Separate hook for online/offline toast notifications — call exactly once in AppLayout */
export const useOnlineStatusNotifications = () => {
  const isOnline = useOnlineStatus();
  const wasOfflineRef = useRef(false);

  useEffect(() => {
    if (!isOnline) {
      wasOfflineRef.current = true;
      toast.error("Keine Internetverbindung", { duration: 5000 });
    } else if (wasOfflineRef.current) {
      toast.success("Verbindung wiederhergestellt", { duration: 3000 });
      wasOfflineRef.current = false;
    }
  }, [isOnline]);

  return isOnline;
};
