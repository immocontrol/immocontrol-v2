/**
 * FUND-17: Keyboard navigation improvements — provides hooks for
 * arrow-key navigation in lists, Escape-to-close, and focus trapping.
 */
import { useCallback, useEffect, useRef } from "react";

/**
 * FUND-17: Arrow-key navigation for list items.
 * Manages focus between items using Up/Down arrows and Enter to select.
 */
export function useArrowNavigation<T>(
  items: T[],
  onSelect: (item: T, index: number) => void,
  options?: { loop?: boolean; orientation?: "vertical" | "horizontal" },
) {
  const activeIndex = useRef(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const { loop = true, orientation = "vertical" } = options ?? {};

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      const prevKey = orientation === "vertical" ? "ArrowUp" : "ArrowLeft";
      const nextKey = orientation === "vertical" ? "ArrowDown" : "ArrowRight";

      if (e.key === nextKey) {
        e.preventDefault();
        if (items.length === 0) return;
        const next = activeIndex.current + 1;
        activeIndex.current = loop ? next % items.length : Math.min(next, items.length - 1);
        focusItem(activeIndex.current);
      } else if (e.key === prevKey) {
        e.preventDefault();
        if (items.length === 0) return;
        const prev = activeIndex.current - 1;
        activeIndex.current = loop
          ? prev < 0 ? items.length - 1 : prev
          : Math.max(prev, 0);
        focusItem(activeIndex.current);
      } else if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        if (activeIndex.current >= 0 && activeIndex.current < items.length) {
          onSelect(items[activeIndex.current], activeIndex.current);
        }
      } else if (e.key === "Home") {
        e.preventDefault();
        activeIndex.current = 0;
        focusItem(0);
      } else if (e.key === "End") {
        e.preventDefault();
        activeIndex.current = items.length - 1;
        focusItem(items.length - 1);
      }
    },
    [items, onSelect, loop, orientation],
  );

  function focusItem(index: number) {
    const container = containerRef.current;
    if (!container) return;
    const focusable = container.querySelectorAll<HTMLElement>("[data-nav-item]");
    focusable[index]?.focus();
  }

  return { containerRef, handleKeyDown, activeIndex };
}

/**
 * FUND-17: Escape-to-close hook for dialogs, dropdowns, and panels.
 */
export function useEscapeClose(onClose: () => void, enabled = true) {
  useEffect(() => {
    if (!enabled) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose, enabled]);
}

/**
 * FUND-17: Focus trap hook — keeps focus within a container.
 * Useful for modal dialogs and drawers.
 */
export function useFocusTrap(containerRef: React.RefObject<HTMLElement | null>, enabled = true) {
  useEffect(() => {
    if (!enabled) return;
    const container = containerRef.current;
    if (!container) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Tab") return;

      const focusable = container.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      );
      if (focusable.length === 0) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };

    container.addEventListener("keydown", handleKeyDown);
    return () => container.removeEventListener("keydown", handleKeyDown);
  }, [containerRef, enabled]);
}

/**
 * FUND-17: Skip-to-content link for screen reader users.
 */
export function SkipToContent({ targetId = "main-content" }: { targetId?: string }) {
  return (
    <a
      href={`#${targetId}`}
      className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[9999] focus:px-4 focus:py-2 focus:bg-primary focus:text-primary-foreground focus:rounded-md focus:outline-none"
    >
      Zum Inhalt springen
    </a>
  );
}
