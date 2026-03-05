/**
 * MOB6-13: Mobile Adaptive Layout
 * Automatic layout adjustment based on screen size, orientation, and foldable devices.
 * Detects device capabilities and renders optimal layout.
 */
import { useState, useEffect, useCallback, useMemo, memo, createContext, useContext } from "react";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";

export interface DeviceInfo {
  type: "phone" | "tablet" | "desktop" | "foldable";
  orientation: "portrait" | "landscape";
  screenWidth: number;
  screenHeight: number;
  pixelRatio: number;
  hasTouchScreen: boolean;
  isStandalone: boolean; // PWA mode
  safeAreaInsets: {
    top: number;
    bottom: number;
    left: number;
    right: number;
  };
}

interface LayoutBreakpoints {
  compact: number;   // < 600px (phone portrait)
  medium: number;    // 600-900px (phone landscape, tablet portrait)
  expanded: number;  // > 900px (tablet landscape, desktop)
}

interface AdaptiveLayoutContextValue {
  device: DeviceInfo;
  layout: "compact" | "medium" | "expanded";
  isCompact: boolean;
  isMedium: boolean;
  isExpanded: boolean;
}

const defaultDevice: DeviceInfo = {
  type: "phone",
  orientation: "portrait",
  screenWidth: 375,
  screenHeight: 812,
  pixelRatio: 2,
  hasTouchScreen: true,
  isStandalone: false,
  safeAreaInsets: { top: 0, bottom: 0, left: 0, right: 0 },
};

const AdaptiveLayoutContext = createContext<AdaptiveLayoutContextValue>({
  device: defaultDevice,
  layout: "compact",
  isCompact: true,
  isMedium: false,
  isExpanded: false,
});

export function useAdaptiveLayout() {
  return useContext(AdaptiveLayoutContext);
}

function detectDevice(): DeviceInfo {
  const width = window.innerWidth;
  const height = window.innerHeight;
  const pixelRatio = window.devicePixelRatio || 1;
  const hasTouchScreen = "ontouchstart" in window || navigator.maxTouchPoints > 0;
  const isStandalone = window.matchMedia("(display-mode: standalone)").matches;

  let type: DeviceInfo["type"] = "phone";
  const minDim = Math.min(width, height);
  const maxDim = Math.max(width, height);

  if (minDim >= 600 && maxDim >= 900) {
    type = "tablet";
  } else if (!hasTouchScreen && width >= 1024) {
    type = "desktop";
  }

  // Detect foldable (experimental API)
  if ("windowSegments" in window || "getWindowSegments" in visualViewport!) {
    type = "foldable";
  }

  const orientation: DeviceInfo["orientation"] = width >= height ? "landscape" : "portrait";

  // Safe area insets from CSS env()
  const computedStyle = getComputedStyle(document.documentElement);
  const safeAreaInsets = {
    top: parseInt(computedStyle.getPropertyValue("--sat") || "0", 10) || 0,
    bottom: parseInt(computedStyle.getPropertyValue("--sab") || "0", 10) || 0,
    left: parseInt(computedStyle.getPropertyValue("--sal") || "0", 10) || 0,
    right: parseInt(computedStyle.getPropertyValue("--sar") || "0", 10) || 0,
  };

  return {
    type,
    orientation,
    screenWidth: width,
    screenHeight: height,
    pixelRatio,
    hasTouchScreen,
    isStandalone,
    safeAreaInsets,
  };
}

interface MobileAdaptiveLayoutProps {
  children: React.ReactNode;
  /** Custom breakpoints */
  breakpoints?: Partial<LayoutBreakpoints>;
  /** Render different content per layout */
  compact?: React.ReactNode;
  medium?: React.ReactNode;
  expanded?: React.ReactNode;
  /** Additional class */
  className?: string;
}

export const MobileAdaptiveLayout = memo(function MobileAdaptiveLayout({
  children,
  breakpoints: customBreakpoints,
  compact,
  medium,
  expanded,
  className,
}: MobileAdaptiveLayoutProps) {
  const [device, setDevice] = useState<DeviceInfo>(defaultDevice);

  const breakpoints: LayoutBreakpoints = useMemo(() => ({
    compact: customBreakpoints?.compact ?? 600,
    medium: customBreakpoints?.medium ?? 900,
    expanded: customBreakpoints?.expanded ?? 1200,
  }), [customBreakpoints]);

  useEffect(() => {
    const update = () => setDevice(detectDevice());
    update();

    window.addEventListener("resize", update);
    window.addEventListener("orientationchange", update);

    // Listen for screen fold changes
    const mql = window.matchMedia("(screen-spanning: single-fold-vertical)");
    const handleFold = () => update();
    if (mql.addEventListener) mql.addEventListener("change", handleFold);

    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("orientationchange", update);
      if (mql.removeEventListener) mql.removeEventListener("change", handleFold);
    };
  }, []);

  const layout = useMemo((): "compact" | "medium" | "expanded" => {
    if (device.screenWidth < breakpoints.compact) return "compact";
    if (device.screenWidth < breakpoints.medium) return "medium";
    return "expanded";
  }, [device.screenWidth, breakpoints]);

  const contextValue = useMemo((): AdaptiveLayoutContextValue => ({
    device,
    layout,
    isCompact: layout === "compact",
    isMedium: layout === "medium",
    isExpanded: layout === "expanded",
  }), [device, layout]);

  // Select content based on layout
  const content = useMemo(() => {
    if (layout === "compact" && compact) return compact;
    if (layout === "medium" && medium) return medium;
    if (layout === "expanded" && expanded) return expanded;
    return children;
  }, [layout, compact, medium, expanded, children]);

  return (
    <AdaptiveLayoutContext.Provider value={contextValue}>
      <div
        className={cn(
          "w-full transition-all",
          layout === "compact" && "max-w-full",
          layout === "medium" && "max-w-3xl mx-auto",
          layout === "expanded" && "max-w-6xl mx-auto",
          className
        )}
        style={{
          paddingTop: device.safeAreaInsets.top > 0 ? `${device.safeAreaInsets.top}px` : undefined,
          paddingBottom: device.safeAreaInsets.bottom > 0 ? `${device.safeAreaInsets.bottom}px` : undefined,
        }}
        data-layout={layout}
        data-device={device.type}
        data-orientation={device.orientation}
      >
        {content}
      </div>
    </AdaptiveLayoutContext.Provider>
  );
});

/** Utility component that renders children only in specified layouts */
interface ShowInLayoutProps {
  children: React.ReactNode;
  layouts: Array<"compact" | "medium" | "expanded">;
}

export const ShowInLayout = memo(function ShowInLayout({ children, layouts }: ShowInLayoutProps) {
  const { layout } = useAdaptiveLayout();
  if (!layouts.includes(layout)) return null;
  return <>{children}</>;
});
