import { useState, useEffect, useRef } from "react";
import { toast } from "sonner";

/** Feature 4: Hook to track online/offline status
 *  IMP-41-18: Added reconnection toast notification so users know when connectivity is restored */
export const useOnlineStatus = () => {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const wasOfflineRef = useRef(false);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      /* IMP-41-18: Notify user when connection is restored after being offline */
      if (wasOfflineRef.current) {
        toast.success("Verbindung wiederhergestellt", { duration: 3000 });
        wasOfflineRef.current = false;
      }
    };
    const handleOffline = () => {
      setIsOnline(false);
      wasOfflineRef.current = true;
      toast.error("Keine Internetverbindung", { duration: 5000 });
    };
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  return isOnline;
};
