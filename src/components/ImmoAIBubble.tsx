import { useState, useRef, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Bot, Send, Trash2, Sparkles, User, X, MessageSquare, GripVertical } from "lucide-react";
import { toast } from "sonner";
import ReactMarkdown from "react-markdown";
import { useAuth } from "@/hooks/useAuth";

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
  const [messages, setMessages] = useState<Msg[]>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch { return []; }
  });
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  /* BUG-8: Draggable AI chat bubble — works on both mobile (touch) and desktop (mouse) */
  const [bubblePos, setBubblePos] = useState<{ x: number; y: number } | null>(null);
  const dragRef = useRef<{ startX: number; startY: number; origX: number; origY: number } | null>(null);
  const isDragging = useRef(false);

  /* BUG-8: Only register global drag listeners while actively dragging to avoid
     permanent non-passive touchmove that degrades mobile scroll performance */
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
  useEffect(() => removeDragListeners, [removeDragListeners]);

  const handleDragStart = useCallback((clientX: number, clientY: number) => {
    const currentX = bubblePos?.x ?? (window.innerWidth - 72);
    const currentY = bubblePos?.y ?? (window.innerHeight - 140);
    dragRef.current = { startX: clientX, startY: clientY, origX: currentX, origY: currentY };
    isDragging.current = false;

    // Only add listeners if not already active
    if (boundListenersRef.current) return;

    const onMouseMove = (e: MouseEvent) => {
      if (!dragRef.current) return;
      const dx = e.clientX - dragRef.current.startX;
      const dy = e.clientY - dragRef.current.startY;
      if (Math.abs(dx) > 5 || Math.abs(dy) > 5) isDragging.current = true;
      const newX = Math.max(8, Math.min(window.innerWidth - 64, dragRef.current.origX + dx));
      const newY = Math.max(8, Math.min(window.innerHeight - 64, dragRef.current.origY + dy));
      setBubblePos({ x: newX, y: newY });
    };
    const onMouseUp = () => { dragRef.current = null; removeDragListeners(); };
    const onTouchMove = (e: TouchEvent) => {
      if (!dragRef.current) return;
      e.preventDefault();
      const dx = e.touches[0].clientX - dragRef.current.startX;
      const dy = e.touches[0].clientY - dragRef.current.startY;
      if (Math.abs(dx) > 5 || Math.abs(dy) > 5) isDragging.current = true;
      const newX = Math.max(8, Math.min(window.innerWidth - 64, dragRef.current.origX + dx));
      const newY = Math.max(8, Math.min(window.innerHeight - 64, dragRef.current.origY + dy));
      setBubblePos({ x: newX, y: newY });
    };
    const onTouchEnd = () => { dragRef.current = null; removeDragListeners(); };

    boundListenersRef.current = { mouseMove: onMouseMove, mouseUp: onMouseUp, touchMove: onTouchMove, touchEnd: onTouchEnd };
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
    window.addEventListener("touchmove", onTouchMove, { passive: false });
    window.addEventListener("touchend", onTouchEnd);
  }, [bubblePos, removeDragListeners]);

  // Improvement 1: Persist chat history
  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(messages.slice(-BUBBLE_MAX_MESSAGES))); } catch { /* localStorage may be unavailable */ }
  }, [messages]);

  // Improvement 2: Alt+I keyboard shortcut
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
    } catch (e: unknown) {
      console.error("ImmoAI error:", e);
      toast.error(e instanceof Error ? e.message : "Fehler bei der AI-Anfrage");
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "❌ Fehler aufgetreten. Bitte erneut versuchen." },
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

  const unreadCount = messages.length;

  return (
    <>
      {/* BUG-8: Draggable Floating Bubble — supports mouse drag + touch drag */}
      {!open && (
        <button
          onMouseDown={(e) => handleDragStart(e.clientX, e.clientY)}
          onTouchStart={(e) => handleDragStart(e.touches[0].clientX, e.touches[0].clientY)}
          onClick={() => { if (!isDragging.current) setOpen(true); }}
          /* IMPROVE-42: Drag-affordance cursor (grab/grabbing) and touch-none to prevent scroll interference */
          className="fixed z-50 w-14 h-14 rounded-full bg-primary text-primary-foreground shadow-lg hover:shadow-xl hover:scale-105 transition-shadow duration-200 flex items-center justify-center group cursor-grab active:cursor-grabbing select-none touch-none"
          style={bubblePos ? { left: bubblePos.x, top: bubblePos.y } : { bottom: "5rem", right: "1rem" }}
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

      {/* BUG-8: Chat window positioned near bubble position */}
      {open && (
        <div
          className="fixed z-50 w-[400px] max-w-[calc(100vw-2rem)] h-[560px] max-h-[calc(100vh-10rem)] sm:max-h-[calc(100vh-8rem)] bg-background border border-border rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-bottom-4 fade-in duration-200"
          style={bubblePos ? { left: Math.min(bubblePos.x, window.innerWidth - 416), top: Math.max(8, bubblePos.y - 570) } : { bottom: "5rem", right: "1rem" }}
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
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={clearChat} title="Chat leeren">
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              )}
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setOpen(false)} title="Schließen (Alt+I)">
                <X className="h-4 w-4" />
              </Button>
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
                  <p className="text-sm font-semibold">Hallo! 👋</p>
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
              />
              <Button onClick={() => send(input)} disabled={!input.trim() || isLoading} size="icon" className="shrink-0 h-9 w-9">
                <Send className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
