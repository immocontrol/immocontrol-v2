/**
 * UX-1: Responsive Dialog → Bottom Sheet on mobile
 * Returns whether to use a Sheet (bottom) on mobile vs Dialog on desktop.
 */
import { useMediaQuery } from "@/hooks/useMediaQuery";

export function useResponsiveDialog() {
  const isMobile = useMediaQuery("(max-width: 768px)");
  return { isMobile };
}
