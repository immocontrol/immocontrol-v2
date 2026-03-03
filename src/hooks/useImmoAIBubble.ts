/**
 * Improvement 4: Consolidated ImmoAIBubble useEffects into custom hooks.
 * Reduces 9 useEffects to organized, reusable hooks.
 */
import { useEffect, useCallback, useRef } from "react";

/**
 * Hook: Listen for ai-chat-toggle events from Settings
 */
export function useAIChatToggle(
  setDisabled: (v: boolean) => void,
  setOpen: (v: boolean) => void,
) {
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail && typeof detail.enabled === "boolean") {
        setDisabled(!detail.enabled);
        if (!detail.enabled) setOpen(false);
      }
    };
    window.addEventListener("ai-chat-toggle", handler);
    return () => window.removeEventListener("ai-chat-toggle", handler);
  }, [setDisabled, setOpen]);
}

/**
 * Hook: Persist chat history to localStorage
 */
export function useChatPersistence(
  messages: { role: string; content: string }[],
  storageKey: string,
  maxMessages: number,
) {
  useEffect(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(messages.slice(-maxMessages)));
    } catch {
      /* localStorage may be unavailable */
    }
  }, [messages, storageKey, maxMessages]);
}

/**
 * Hook: Alt+I keyboard shortcut to toggle chat
 */
export function useAIKeyboardShortcut(setOpen: React.Dispatch<React.SetStateAction<boolean>>) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.altKey && (e.key === "i" || e.key === "I")) {
        e.preventDefault();
        setOpen(prev => !prev);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [setOpen]);
}

/**
 * Hook: Auto-scroll to bottom when messages change
 */
export function useAutoScroll(
  scrollRef: React.RefObject<HTMLDivElement>,
  deps: unknown[],
) {
  const scrollToBottom = useCallback(() => {
    setTimeout(() => {
      scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
    }, 50);
  }, [scrollRef]);

  useEffect(() => {
    scrollToBottom();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return scrollToBottom;
}

/**
 * Hook: Auto-minimize chat on outside click
 */
export function useClickOutside(
  open: boolean,
  chatElRef: React.RefObject<HTMLDivElement>,
  setOpen: (v: boolean) => void,
) {
  useEffect(() => {
    if (!open) return;
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (chatElRef.current && !chatElRef.current.contains(target)) {
        setOpen(false);
      }
    };
    const timer = setTimeout(() => {
      document.addEventListener("mousedown", handleClickOutside);
    }, 100);
    return () => {
      clearTimeout(timer);
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [open, chatElRef, setOpen]);
}

/**
 * Hook: Auto-minimize after inactivity timeout
 */
export function useInactivityTimeout(
  open: boolean,
  isLoading: boolean,
  chatElRef: React.RefObject<HTMLDivElement>,
  setOpen: (v: boolean) => void,
  timeoutMs = 30000,
) {
  const inactivityRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!open) return;
    const resetTimer = () => {
      if (inactivityRef.current) clearTimeout(inactivityRef.current);
      inactivityRef.current = setTimeout(() => {
        if (!isLoading) setOpen(false);
      }, timeoutMs);
    };
    resetTimer();
    const chatEl = chatElRef.current;
    if (chatEl) {
      chatEl.addEventListener("mousemove", resetTimer);
      chatEl.addEventListener("keydown", resetTimer);
      chatEl.addEventListener("touchstart", resetTimer);
    }
    return () => {
      if (inactivityRef.current) clearTimeout(inactivityRef.current);
      if (chatEl) {
        chatEl.removeEventListener("mousemove", resetTimer);
        chatEl.removeEventListener("keydown", resetTimer);
        chatEl.removeEventListener("touchstart", resetTimer);
      }
    };
  }, [open, isLoading, chatElRef, setOpen, timeoutMs]);
}

/**
 * Hook: Auto-reposition bubble when popups/menus overlap
 */
export function useOverlapDetection(
  open: boolean,
  bubbleElRef: React.RefObject<HTMLButtonElement>,
  bubblePosRef: React.MutableRefObject<{ x: number; y: number } | null>,
  homePosRef: React.MutableRefObject<{ x: number; y: number } | null>,
  setBubblePos: React.Dispatch<React.SetStateAction<{ x: number; y: number } | null>>,
) {
  useEffect(() => {
    if (open) return;
    const checkOverlap = () => {
      const el = bubbleElRef.current;
      if (!el) return;
      const bubbleRect = el.getBoundingClientRect();
      const overlays = document.querySelectorAll(
        '[role="dialog"], [data-radix-popper-content-wrapper], [data-state="open"][role="menu"], .popover-content, [data-side]'
      );
      let needsMove = false;
      overlays.forEach(overlay => {
        const oRect = overlay.getBoundingClientRect();
        if (oRect.width === 0 || oRect.height === 0) return;
        const overlap = !(
          bubbleRect.right < oRect.left ||
          bubbleRect.left > oRect.right ||
          bubbleRect.bottom < oRect.top ||
          bubbleRect.top > oRect.bottom
        );
        if (overlap) needsMove = true;
      });
      if (needsMove) {
        if (!homePosRef.current) {
          homePosRef.current = bubblePosRef.current ?? { x: window.innerWidth - 72, y: window.innerHeight - 140 };
        }
        const currentY = bubblePosRef.current?.y ?? (window.innerHeight - 140);
        const newY = Math.max(16, currentY - 80);
        if (Math.abs(newY - currentY) < 1) return;
        el.style.transition = "top 0.3s cubic-bezier(0.4, 0, 0.2, 1)";
        setBubblePos(prev => ({ x: prev?.x ?? window.innerWidth - 72, y: newY }));
      } else if (homePosRef.current) {
        const currentY = bubblePosRef.current?.y ?? (window.innerHeight - 140);
        if (Math.abs(currentY - homePosRef.current.y) > 1) {
          el.style.transition = "top 0.3s cubic-bezier(0.4, 0, 0.2, 1)";
          setBubblePos({ ...homePosRef.current });
        }
        homePosRef.current = null;
      }
    };
    const observer = new MutationObserver(() => {
      requestAnimationFrame(checkOverlap);
    });
    observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ["data-state", "role"] });
    return () => observer.disconnect();
  }, [open, bubbleElRef, bubblePosRef, homePosRef, setBubblePos]);
}
