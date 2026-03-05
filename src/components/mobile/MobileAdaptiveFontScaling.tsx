/**
 * MOB4-12: Mobile Adaptive Font Scaling
 * Automatically adjusts font sizes based on screen width.
 * Small phones (< 375px) get smaller fonts, tablets get larger.
 * Uses CSS custom properties for easy cascading.
 */
import { useEffect, memo, useCallback } from "react";
import { useIsMobile } from "@/hooks/use-mobile";

interface FontScaleConfig {
  /** Base font size in px (default: 16) */
  baseFontSize?: number;
  /** Min screen width for scaling (default: 320) */
  minWidth?: number;
  /** Max screen width for scaling (default: 768) */
  maxWidth?: number;
  /** Min scale factor (default: 0.875 = 14px) */
  minScale?: number;
  /** Max scale factor (default: 1.125 = 18px) */
  maxScale?: number;
}

/**
 * Hook that sets CSS custom properties for adaptive font scaling.
 * Sets --mob4-font-scale, --mob4-font-xs through --mob4-font-2xl.
 */
export function useMobileAdaptiveFonts(config?: FontScaleConfig) {
  const isMobile = useIsMobile();
  const {
    baseFontSize = 16,
    minWidth = 320,
    maxWidth = 768,
    minScale = 0.875,
    maxScale = 1.125,
  } = config ?? {};

  const updateFontScale = useCallback(() => {
    if (!isMobile) {
      // Reset to defaults on desktop
      document.documentElement.style.removeProperty("--mob4-font-scale");
      document.documentElement.style.removeProperty("--mob4-font-xs");
      document.documentElement.style.removeProperty("--mob4-font-sm");
      document.documentElement.style.removeProperty("--mob4-font-base");
      document.documentElement.style.removeProperty("--mob4-font-lg");
      document.documentElement.style.removeProperty("--mob4-font-xl");
      document.documentElement.style.removeProperty("--mob4-font-2xl");
      return;
    }

    const width = window.innerWidth;
    const clampedWidth = Math.max(minWidth, Math.min(width, maxWidth));
    const ratio = (clampedWidth - minWidth) / (maxWidth - minWidth);
    const scale = minScale + ratio * (maxScale - minScale);

    const root = document.documentElement;
    root.style.setProperty("--mob4-font-scale", String(scale.toFixed(3)));
    root.style.setProperty("--mob4-font-xs", `${(baseFontSize * 0.75 * scale).toFixed(1)}px`);
    root.style.setProperty("--mob4-font-sm", `${(baseFontSize * 0.875 * scale).toFixed(1)}px`);
    root.style.setProperty("--mob4-font-base", `${(baseFontSize * scale).toFixed(1)}px`);
    root.style.setProperty("--mob4-font-lg", `${(baseFontSize * 1.125 * scale).toFixed(1)}px`);
    root.style.setProperty("--mob4-font-xl", `${(baseFontSize * 1.25 * scale).toFixed(1)}px`);
    root.style.setProperty("--mob4-font-2xl", `${(baseFontSize * 1.5 * scale).toFixed(1)}px`);
  }, [isMobile, baseFontSize, minWidth, maxWidth, minScale, maxScale]);

  useEffect(() => {
    updateFontScale();
    window.addEventListener("resize", updateFontScale);
    return () => window.removeEventListener("resize", updateFontScale);
  }, [updateFontScale]);
}

/**
 * Component wrapper that applies adaptive font scaling.
 * Place at the root of your app or layout.
 */
export const MobileAdaptiveFontScaling = memo(function MobileAdaptiveFontScaling({
  config,
}: {
  config?: FontScaleConfig;
}) {
  useMobileAdaptiveFonts(config);
  return null;
});
