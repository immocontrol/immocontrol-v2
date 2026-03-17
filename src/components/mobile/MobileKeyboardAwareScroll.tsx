/**
 * MOB4-16: Mobile Keyboard Aware Scroll
 * Automatically scrolls to the active input when the virtual keyboard appears.
 * Prevents inputs from being hidden behind the keyboard on long forms.
 */
import { useEffect, useCallback, useRef, memo, type ReactNode } from "react";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";

interface MobileKeyboardAwareScrollProps {
  children: ReactNode;
  /** Extra offset above the focused input in px */
  offset?: number;
  /** Whether to enable keyboard-aware scrolling */
  enabled?: boolean;
  /** Additional class */
  className?: string;
}

/**
 * Hook that handles keyboard-aware scrolling.
 * Scrolls focused inputs into view when keyboard opens.
 */
export function useKeyboardAwareScroll(options?: {
  offset?: number;
  enabled?: boolean;
}) {
  const { offset = 120, enabled = true } = options ?? {};
  const isMobile = useIsMobile();
  const lastFocusedElement = useRef<HTMLElement | null>(null);

  const scrollToFocused = useCallback((element: HTMLElement) => {
    requestAnimationFrame(() => {
      setTimeout(() => {
        const rect = element.getBoundingClientRect();
        const viewportHeight = window.visualViewport?.height ?? window.innerHeight;
        const inDialog = element.closest("[role='dialog']");

        if (inDialog) {
          // In Modal/Dialog: scrollIntoView scrolls the dialog body
          element.scrollIntoView({ behavior: "smooth", block: "center" });
          return;
        }
        if (rect.bottom > viewportHeight - 20) {
          const scrollAmount = rect.bottom - viewportHeight + offset;
          window.scrollBy({ top: scrollAmount, behavior: "smooth" });
        } else if (rect.top < 0) {
          window.scrollBy({ top: rect.top - offset, behavior: "smooth" });
        }
      }, 300);
    });
  }, [offset]);

  useEffect(() => {
    if (!isMobile || !enabled) return;

    const handleFocusIn = (e: FocusEvent) => {
      const target = e.target as HTMLElement;
      if (
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.tagName === "SELECT" ||
        target.isContentEditable
      ) {
        lastFocusedElement.current = target;
        scrollToFocused(target);
      }
    };

    // Also handle viewport resize (keyboard open/close)
    const handleResize = () => {
      if (lastFocusedElement.current && document.activeElement === lastFocusedElement.current) {
        scrollToFocused(lastFocusedElement.current);
      }
    };

    document.addEventListener("focusin", handleFocusIn);

    const vv = window.visualViewport;
    if (vv) {
      vv.addEventListener("resize", handleResize);
    }

    return () => {
      document.removeEventListener("focusin", handleFocusIn);
      if (vv) {
        vv.removeEventListener("resize", handleResize);
      }
    };
  }, [isMobile, enabled, scrollToFocused]);
}

/**
 * Wrapper component that applies keyboard-aware scrolling to its children.
 */
export const MobileKeyboardAwareScroll = memo(function MobileKeyboardAwareScroll({
  children,
  offset = 120,
  enabled = true,
  className,
}: MobileKeyboardAwareScrollProps) {
  useKeyboardAwareScroll({ offset, enabled });

  return (
    <div className={cn("mob4-keyboard-aware", className)}>
      {children}
    </div>
  );
});
