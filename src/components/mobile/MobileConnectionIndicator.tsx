/**
 * MOB4-18: Mobile Connection Speed Indicator
 * Shows network quality (2G/3G/4G/WiFi) and adapts behavior.
 * Slow connection: suggest offline mode, compress data.
 */
import { useState, useEffect, useCallback, memo } from "react";
import { useIsMobile } from "@/hooks/use-mobile";
import { Wifi, WifiOff, Signal, SignalLow, SignalMedium, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";

type ConnectionType = "4g" | "3g" | "2g" | "slow-2g" | "wifi" | "offline" | "unknown";
type ConnectionQuality = "excellent" | "good" | "fair" | "poor" | "offline";

interface ConnectionInfo {
  type: ConnectionType;
  quality: ConnectionQuality;
  downlink: number; // Mbps
  rtt: number; // ms
  saveData: boolean;
  isOnline: boolean;
}

function getConnectionInfo(): ConnectionInfo {
  const isOnline = navigator.onLine;

  if (!isOnline) {
    return { type: "offline", quality: "offline", downlink: 0, rtt: 0, saveData: false, isOnline: false };
  }

  const conn = (navigator as Navigator & { connection?: {
    effectiveType?: string;
    downlink?: number;
    rtt?: number;
    saveData?: boolean;
    type?: string;
  } }).connection;

  if (!conn) {
    return { type: "unknown", quality: "good", downlink: 10, rtt: 50, saveData: false, isOnline: true };
  }

  const effectiveType = (conn.effectiveType ?? "4g") as ConnectionType;
  const downlink = conn.downlink ?? 10;
  const rtt = conn.rtt ?? 50;
  const saveData = conn.saveData ?? false;

  let quality: ConnectionQuality;
  if (effectiveType === "4g" && downlink > 5) quality = "excellent";
  else if (effectiveType === "4g" || effectiveType === "wifi") quality = "good";
  else if (effectiveType === "3g") quality = "fair";
  else quality = "poor";

  // Detect WiFi
  const type = conn.type === "wifi" ? "wifi" : effectiveType;

  return { type, quality, downlink, rtt, saveData, isOnline };
}

/**
 * Hook for connection speed monitoring.
 */
export function useConnectionSpeed() {
  const [info, setInfo] = useState<ConnectionInfo>(getConnectionInfo);

  useEffect(() => {
    const update = () => setInfo(getConnectionInfo());

    window.addEventListener("online", update);
    window.addEventListener("offline", update);

    const conn = (navigator as Navigator & { connection?: EventTarget }).connection;
    if (conn) {
      conn.addEventListener("change", update);
    }

    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
      if (conn) {
        conn.removeEventListener("change", update);
      }
    };
  }, []);

  return info;
}

const qualityConfig: Record<ConnectionQuality, { label: string; color: string; icon: typeof Wifi }> = {
  excellent: { label: "Hervorragend", color: "text-green-500", icon: Wifi },
  good: { label: "Gut", color: "text-green-500", icon: Wifi },
  fair: { label: "Mittel", color: "text-amber-500", icon: SignalMedium },
  poor: { label: "Schwach", color: "text-red-500", icon: SignalLow },
  offline: { label: "Offline", color: "text-red-500", icon: WifiOff },
};

interface MobileConnectionIndicatorProps {
  /** Always show or only when connection is poor */
  showAlways?: boolean;
  /** Position */
  position?: "top-right" | "top-left" | "inline";
  /** Additional class */
  className?: string;
  /** Show detailed info */
  showDetails?: boolean;
}

export const MobileConnectionIndicator = memo(function MobileConnectionIndicator({
  showAlways = false,
  position = "inline",
  className,
  showDetails = false,
}: MobileConnectionIndicatorProps) {
  const isMobile = useIsMobile();
  const info = useConnectionSpeed();
  const [expanded, setExpanded] = useState(false);

  const config = qualityConfig[info.quality];
  const Icon = config.icon;

  // Hide if good connection and showAlways is false
  if (!showAlways && info.quality === "excellent") return null;
  if (!showAlways && info.quality === "good") return null;

  const isFixed = position !== "inline";

  return (
    <div
      className={cn(
        "flex items-center gap-1.5",
        isFixed && "fixed z-40 px-2.5 py-1.5 rounded-full bg-background/95 backdrop-blur-sm border shadow-sm",
        position === "top-right" && "top-3 right-3",
        position === "top-left" && "top-3 left-3",
        className
      )}
      onClick={() => showDetails && setExpanded(!expanded)}
      role={showDetails ? "button" : undefined}
    >
      <Icon className={cn("w-3.5 h-3.5", config.color)} />
      <span className={cn("text-xs font-medium", config.color)}>
        {info.quality === "offline" ? "Offline" : info.type.toUpperCase()}
      </span>

      {/* Expanded details */}
      {expanded && showDetails && (
        <div className="absolute top-full mt-1 right-0 bg-background rounded-lg border shadow-lg p-3 min-w-[180px] z-50 animate-in fade-in zoom-in-95 duration-150">
          <div className="space-y-2 text-xs">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Qualität</span>
              <span className={cn("font-medium", config.color)}>{config.label}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Download</span>
              <span className="font-medium">{info.downlink.toFixed(1)} Mbps</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Latenz</span>
              <span className="font-medium">{info.rtt} ms</span>
            </div>
            {info.saveData && (
              <div className="flex items-center gap-1 text-amber-600">
                <AlertTriangle className="w-3 h-3" />
                <span>Datensparmodus aktiv</span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
});
