import { useState, useRef, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Bot, Send, Trash2, Sparkles, X, Minimize2 } from "lucide-react";
import { toast } from "sonner";
import ReactMarkdown from "react-markdown";
import { useAuth } from "@/hooks/useAuth";
import { logger } from "@/lib/logger";
import { rateLimiters } from "@/lib/rateLimiter";

type Msg = { role: "user" | "assistant"; content: string };

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/immo-ai-chat`;
const STORAGE_KEY = "immo-ai-chat-history";

const SUGGESTIONS = [
  "Wie ist meine Portfolio-Rendite?",
  "Welcher Mieter wohnt am längsten?",
  "Wann kann ich die Miete anpassen?",
  "Übersicht meiner Restschulden",
  "Erstelle eine Selbstauskunft-Zusammenfassung",
  "Welches Objekt hat den besten Cashflow?",
];

/* OPT-38: Chat bubble position constants */
const BUBBLE_POSITION = {
  bottom: "1.5rem",
  right: "1.5rem",
  mobileBottom: "5rem",
} as const;

/* OPT-39: Message limit for bubble chat */
const BUBBLE_MAX_MESSAGES = 50;

export default function ImmoAIBubble() {
  const { session } = useAuth();
  const [open, setOpen] = useState(false);
  const [disabled, setDisabled] = useState(() => {
    try { return localStorage.getItem("immocontrol_ai_chat_disabled") === "true"; } catch { return false; }
  });

  /* Listen for ai-chat-toggle events from Settings */
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
  }, []);

  const [messages, setMessages] = useState<Msg[]>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch { return []; }
  });
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  /* Smooth drag via rAF: direct DOM manipulation during drag for 60fps on mobile + desktop,
     only commit final position to React state on release */
  const [bubblePos, setBubblePos] = useState<{ x: number; y: number } | null>(null);
  const dragRef = useRef<{ startY: number; origY: number } | null>(null);
  const isDragging = useRef(false);
  const bubbleElRef = useRef<HTMLButtonElement>(null);
  const chatElRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef<number>(0);
  const bubblePosRef = useRef(bubblePos);
  bubblePosRef.current = bubblePos;
  const homePosRef = useRef<{ x: number; y: number } | null>(null); // Store "home" position before overlap adjustments

  const boundListenersRef = useRef<{
    mouseMove: (e: MouseEvent) => void;
    mouseUp: () => void;
    touchMove: (e: TouchEvent) => void;
    touchEnd: () => void;
  } | null>(null);

  const removeDragListeners = useCallback(() => {
    const b = boundListenersRef.current;
    if (!b) return;
    window.removeEventListener("mousemove", b.mouseMove);
    window.removeEventListener("mouseup", b.mouseUp);
    window.removeEventListener("touchmove", b.touchMove);
    window.removeEventListener("touchend", b.touchEnd);
    boundListenersRef.current = null;
  }, []);

  // Cleanup on unmount
  useEffect(() => () => {
    removeDragListeners();
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
  }, [removeDragListeners]);

  /* Live drag position update via requestAnimationFrame — bypasses React re-renders
     for 60fps smooth movement on both mobile (touch) and desktop (mouse) */
  const applyDragPosition = useCallback((newY: number) => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(() => {
      if (bubbleElRef.current) {
        bubbleElRef.current.style.top = `${newY}px`;
        bubbleElRef.current.style.bottom = "auto";
        bubbleElRef.current.style.transition = "none";
      }
      if (chatElRef.current) {
        chatElRef.current.style.top = `${Math.max(8, newY - 570)}px`;
        chatElRef.current.style.bottom = "auto";
        chatElRef.current.style.transition = "none";
      }
    });
  }, []);

  /* Commit final position to React state after drag ends */
  const commitPosition = useCallback(() => {
    const el = bubbleElRef.current;
    if (el) {
      const top = parseInt(el.style.top, 10);
      if (!isNaN(top)) {
        const newPos = { x: window.innerWidth - 72, y: top };
        setBubblePos(newPos);
        homePosRef.current = newPos; // Update home position when user drags
      }
      el.style.transition = "";
    }
    if (chatElRef.current) chatElRef.current.style.transition = "";
  }, []);

  const handleDragStart = useCallback((clientY: number) => {
    const currentY = bubblePos?.y ?? (window.innerHeight - 140);
    dragRef.current = { startY: clientY, origY: currentY };
    isDragging.current = false;

    if (boundListenersRef.current) return;

    const clampY = (y: number) => Math.max(8, Math.min(window.innerHeight - 64, y));

    const onMouseMove = (e: MouseEvent) => {
      if (!dragRef.current) return;
      const dy = e.clientY - dragRef.current.startY;
      if (Math.abs(dy) > 5) isDragging.current = true;
      applyDragPosition(clampY(dragRef.current.origY + dy));
    };
    const onMouseUp = () => {
      commitPosition();
      dragRef.current = null;
      removeDragListeners();
    };
    const onTouchMove = (e: TouchEvent) => {
      if (!dragRef.current) return;
      e.preventDefault();
      const dy = e.touches[0].clientY - dragRef.current.startY;
      if (Math.abs(dy) > 5) isDragging.current = true;
      /* Live update during touch — visible immediately, no waiting for touchEnd */
      applyDragPosition(clampY(dragRef.current.origY + dy));
    };
    const onTouchEnd = () => {
      commitPosition();
      dragRef.current = null;
      removeDragListeners();
    };

    boundListenersRef.current = { mouseMove: onMouseMove, mouseUp: onMouseUp, touchMove: onTouchMove, touchEnd: onTouchEnd };
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
    window.addEventListener("touchmove", onTouchMove, { passive: false });
    window.addEventListener("touchend", onTouchEnd);
  }, [bubblePos, removeDragListeners, applyDragPosition, commitPosition]);

  // Persist chat history
  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(messages.slice(-BUBBLE_MAX_MESSAGES))); } catch { /* localStorage may be unavailable */ }
  }, [messages]);

  // Alt+I keyboard shortcut
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.altKey && (e.key === "i" || e.key === "I")) {
        e.preventDefault();
        setOpen(prev => !prev);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  const scrollToBottom = useCallback(() => {
    setTimeout(() => {
      scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
    }, 50);
  }, []);

  useEffect(() => { scrollToBottom(); }, [messages, scrollToBottom]);

  const send = async (text: string) => {
    if (!text.trim() || isLoading) return;
    /* IMP-9: Rate limit AI chat requests */
    if (!rateLimiters.aiChat.canProceed()) {
      toast.error("Bitte warte kurz bevor du eine weitere Nachricht sendest.");
      return;
    }
    const userMsg: Msg = { role: "user", content: text.trim() };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setIsLoading(true);

    let assistantSoFar = "";
    const allMessages = [...messages, userMsg];

    try {
      const resp = await fetch(CHAT_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session?.access_token || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        },
        body: JSON.stringify({ messages: allMessages }),
      });

      if (!resp.ok) {
        const errData = await resp.json().catch(() => ({}));
        throw new Error(errData.error || `Fehler ${resp.status}`);
      }
      if (!resp.body) throw new Error("Kein Stream erhalten");

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let textBuffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        textBuffer += decoder.decode(value, { stream: true });

        let newlineIndex: number;
        while ((newlineIndex = textBuffer.indexOf("\n")) !== -1) {
          let line = textBuffer.slice(0, newlineIndex);
          textBuffer = textBuffer.slice(newlineIndex + 1);
          if (line.endsWith("\r")) line = line.slice(0, -1);
          if (line.startsWith(":") || line.trim() === "") continue;
          if (!line.startsWith("data: ")) continue;

          const jsonStr = line.slice(6).trim();
          if (jsonStr === "[DONE]") break;

          try {
            const parsed = JSON.parse(jsonStr);
            const content = parsed.choices?.[0]?.delta?.content as string | undefined;
            if (content) {
              assistantSoFar += content;
              setMessages((prev) => {
                const last = prev[prev.length - 1];
                if (last?.role === "assistant") {
                  return prev.map((m, i) => (i === prev.length - 1 ? { ...m, content: assistantSoFar } : m));
                }
                return [...prev, { role: "assistant", content: assistantSoFar }];
              });
            }
          } catch {
            textBuffer = line + "\n" + textBuffer;
            break;
          }
        }
      }
      rateLimiters.aiChat.recordSuccess();
    } catch (e: unknown) {
      logger.error("ImmoAI bubble request failed", "ImmoAI", e);
      rateLimiters.aiChat.recordFailure();
      toast.error(e instanceof Error ? e.message : "Fehler bei der AI-Anfrage");
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "Fehler aufgetreten. Bitte erneut versuchen." },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send(input);
    }
  };

  const clearChat = () => {
    setMessages([]);
    localStorage.removeItem(STORAGE_KEY);
  };

  /* Auto-minimize on outside click */
  useEffect(() => {
    if (!open) return;
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (chatElRef.current && !chatElRef.current.contains(target)) {
        setOpen(false);
      }
    };
    /* Delay to avoid triggering on the same click that opened the chat */
    const timer = setTimeout(() => {
      document.addEventListener("mousedown", handleClickOutside);
    }, 100);
    return () => {
      clearTimeout(timer);
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [open]);

  /* BUBBLE-FIX-1: Auto-reposition bubble when popups/menus/dialogs overlap.
     Observes DOM for new [role=dialog], [data-radix-popper-content-wrapper], .dropdown-menu, etc.
     and smoothly shifts the bubble out of the way. */
  useEffect(() => {
    if (open) return; // Only reposition the closed bubble, not the open chat window
    const checkOverlap = () => {
      const el = bubbleElRef.current;
      if (!el) return;
      const bubbleRect = el.getBoundingClientRect();
      // Find all visible popover/dialog/dropdown overlays
      const overlays = document.querySelectorAll(
        '[role="dialog"], [data-radix-popper-content-wrapper], [data-state="open"][role="menu"], .popover-content, [data-side]'
      );
      let needsMove = false;
      overlays.forEach(overlay => {
        const oRect = overlay.getBoundingClientRect();
        if (oRect.width === 0 || oRect.height === 0) return;
        // Check if rects overlap
        const overlap = !(
          bubbleRect.right < oRect.left ||
          bubbleRect.left > oRect.right ||
          bubbleRect.bottom < oRect.top ||
          bubbleRect.top > oRect.bottom
        );
        if (overlap) needsMove = true;
      });
      if (needsMove) {
        // Store home position before first overlap adjustment
        if (!homePosRef.current) {
          homePosRef.current = bubblePosRef.current ?? { x: window.innerWidth - 72, y: window.innerHeight - 140 };
        }
        // Move bubble above the overlap area with smooth transition
        const currentY = bubblePosRef.current?.y ?? (window.innerHeight - 140);
        const newY = Math.max(16, currentY - 80);
        // Only move if position actually changes (prevent infinite loop)
        if (Math.abs(newY - currentY) < 1) return;
        el.style.transition = "top 0.3s cubic-bezier(0.4, 0, 0.2, 1)";
        setBubblePos(prev => ({ x: prev?.x ?? window.innerWidth - 72, y: newY }));
      } else if (homePosRef.current) {
        // No overlaps — restore bubble to home position if it was displaced
        const currentY = bubblePosRef.current?.y ?? (window.innerHeight - 140);
        if (Math.abs(currentY - homePosRef.current.y) > 1) {
          el.style.transition = "top 0.3s cubic-bezier(0.4, 0, 0.2, 1)";
          setBubblePos({ ...homePosRef.current });
        }
        homePosRef.current = null; // Reset so we don't keep restoring
      }
    };
    // Use MutationObserver to detect new overlays
    const observer = new MutationObserver(() => {
      requestAnimationFrame(checkOverlap);
    });
    observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ["data-state", "role"] });
    return () => observer.disconnect();
  }, [open]); // removed bubblePos from deps to prevent infinite re-render loop

  /* Auto-minimize after 30s of inactivity */
  const inactivityRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (!open) return;
    const resetTimer = () => {
      if (inactivityRef.current) clearTimeout(inactivityRef.current);
      inactivityRef.current = setTimeout(() => {
        if (!isLoading) setOpen(false);
      }, 30000);
    };
    resetTimer();
    /* Reset on any user interaction within the chat */
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
  }, [open, isLoading]);

  const unreadCount = messages.length;

  /* If AI chat is disabled, don't render anything */
  if (disabled) return null;

  return (
    <>
      {/* Draggable Floating Bubble — pinned right, vertical-only, rAF-smooth drag */}
      {!open && (
        <button
          ref={bubbleElRef}
          onMouseDown={(e) => handleDragStart(e.clientY)}
          onTouchStart={(e) => handleDragStart(e.touches[0].clientY)}
          onClick={() => { if (!isDragging.current) setOpen(true); }}
          className="fixed z-[9999] w-14 h-14 rounded-full bg-primary text-primary-foreground shadow-lg hover:shadow-xl hover:scale-105 transition-shadow duration-200 flex items-center justify-center group cursor-grab active:cursor-grabbing select-none touch-none"
          style={bubblePos ? { right: "1rem", top: bubblePos.y } : { bottom: "5rem", right: "1rem" }}
          aria-label="Immo AI öffnen (Alt+I) — ziehen zum Verschieben"
        >
          <Sparkles className="h-6 w-6 group-hover:animate-pulse" />
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 min-w-[20px] h-5 bg-accent text-accent-foreground rounded-full text-[10px] font-bold flex items-center justify-center px-1 badge-pulse">
              {unreadCount > 99 ? "99+" : unreadCount}
            </span>
          )}
        </button>
      )}

      {/* Chat window positioned near bubble position */}
      {open && (
        <div
          ref={chatElRef}
          className="fixed z-[9999] w-[400px] max-w-[calc(100vw-2rem)] h-[560px] max-h-[calc(100vh-10rem)] sm:max-h-[calc(100vh-8rem)] bg-background border border-border rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-bottom-4 fade-in duration-200"
          style={bubblePos ? { right: "1rem", top: Math.max(8, bubblePos.y - 570) } : { bottom: "5rem", right: "1rem" }}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-background/95 backdrop-blur-sm">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                <Sparkles className="h-4 w-4 text-primary" />
              </div>
              <div>
                <p className="text-sm font-semibold">Immo AI</p>
                <p className="text-[10px] text-muted-foreground">
                  {isLoading ? "Denkt nach..." : messages.length > 0 ? `${messages.length} Nachrichten` : "Dein Portfolio-Assistent"}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              {messages.length > 0 && (
                // UI-UPDATE-23: Tooltip on "clear chat" action
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={clearChat}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Chat leeren</TooltipContent>
                </Tooltip>
              )}
              {/* UI-UPDATE-24: Tooltip on "close chat" action */}
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setOpen(false)}>
                    <X className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Schließen (Alt+I)</TooltipContent>
              </Tooltip>
            </div>
          </div>

          {/* Messages */}
          <div ref={scrollRef} className="flex-1 overflow-y-auto p-3 space-y-3 custom-scrollbar">
            {messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center space-y-4 px-2">
                <div className="bg-primary/10 rounded-full p-4">
                  <Bot className="h-8 w-8 text-primary" />
                </div>
                <div>
                  <p className="text-sm font-semibold">Hallo!</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Frag mich zu deinen Objekten, Mietern oder Finanzen.
                  </p>
                </div>
                <div className="grid grid-cols-1 gap-1.5 w-full">
                  {SUGGESTIONS.map((s) => (
                    <button
                      key={s}
                      onClick={() => send(s)}
                      className="text-xs text-left px-3 py-2 rounded-lg border border-border hover:bg-muted/50 transition-colors text-muted-foreground hover:text-foreground"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              messages.map((msg, i) => (
                <div key={i} className={`flex gap-2 ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                  {msg.role === "assistant" && (
                    <div className="shrink-0 bg-primary/10 rounded-full h-6 w-6 flex items-center justify-center mt-1">
                      <Bot className="h-3 w-3 text-primary" />
                    </div>
                  )}
                  <div className={`rounded-xl px-3 py-2 max-w-[85%] ${
                    msg.role === "user"
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted/50 border border-border/50"
                  }`}>
                    {msg.role === "assistant" ? (
                      <div className="prose prose-xs dark:prose-invert max-w-none text-xs [&_p]:my-0.5 [&_ul]:my-0.5 [&_ol]:my-0.5 [&_li]:my-0 [&_h3]:mt-2 [&_h3]:mb-0.5 [&_h3]:text-sm [&_table]:text-[10px]">
                        <ReactMarkdown>{msg.content}</ReactMarkdown>
                      </div>
                    ) : (
                      <p className="text-xs whitespace-pre-wrap">{msg.content}</p>
                    )}
                  </div>
                </div>
              ))
            )}
            {isLoading && messages[messages.length - 1]?.role === "user" && (
              <div className="flex gap-2">
                <div className="shrink-0 bg-primary/10 rounded-full h-6 w-6 flex items-center justify-center">
                  <Bot className="h-3 w-3 text-primary animate-pulse" />
                </div>
                <div className="bg-muted/50 border border-border/50 rounded-xl px-3 py-2">
                  <div className="flex gap-1">
                    <span className="w-1.5 h-1.5 bg-muted-foreground/50 rounded-full animate-bounce [animation-delay:0ms]" />
                    <span className="w-1.5 h-1.5 bg-muted-foreground/50 rounded-full animate-bounce [animation-delay:150ms]" />
                    <span className="w-1.5 h-1.5 bg-muted-foreground/50 rounded-full animate-bounce [animation-delay:300ms]" />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Input */}
          <div className="border-t border-border p-3">
            <div className="flex gap-2">
              <Textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Frage stellen... (Alt+I zum Öffnen/Schließen)"
                className="min-h-[36px] max-h-[80px] resize-none text-xs"
                rows={1}
                disabled={isLoading}
                maxLength={500}
                aria-label="AI Chat Nachricht"
              />
              {/* IMP-44-14: Show character count indicator near max length */}
              {input.length > 400 && (
                <span className="absolute bottom-1 right-12 text-[9px] text-muted-foreground">
                  {input.length}/500
                </span>
              )}
              {/* UI-UPDATE-25: Tooltip on "send" action */}
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button onClick={() => send(input)} disabled={!input.trim() || isLoading} size="icon" className="shrink-0 h-9 w-9">
                    <Send className="h-3.5 w-3.5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Senden</TooltipContent>
              </Tooltip>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
