/**
 * MOB2-13: Mobile Mieter-Kommunikation
 * Chat-like interface for tenant communication on mobile.
 * Shows messages in WhatsApp-style bubbles with timestamps.
 */
import { memo, useState, useCallback, useRef, useEffect } from "react";
import { Send, Paperclip, Mic, Image, Check, CheckCheck } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";
import { useHaptic } from "@/hooks/useHaptic";
import { cn } from "@/lib/utils";

export interface ChatMessage {
  id: string;
  text: string;
  sender: "user" | "tenant";
  senderName?: string;
  timestamp: string;
  status?: "sent" | "delivered" | "read";
  attachmentUrl?: string;
  attachmentType?: "image" | "document";
}

interface MobileChatInterfaceProps {
  messages: ChatMessage[];
  onSendMessage: (text: string) => void;
  onAttach?: () => void;
  tenantName?: string;
  tenantAvatar?: string;
  /** Whether voice input is supported */
  voiceEnabled?: boolean;
  onVoiceInput?: () => void;
  className?: string;
}

const MessageBubble = memo(function MessageBubble({ message }: { message: ChatMessage }) {
  const isUser = message.sender === "user";
  const time = new Date(message.timestamp).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" });

  return (
    <div className={cn("flex", isUser ? "justify-end" : "justify-start")}>
      <div className={cn(
        "max-w-[80%] rounded-2xl px-3 py-2 space-y-0.5",
        isUser
          ? "bg-primary text-primary-foreground rounded-br-md"
          : "bg-secondary text-secondary-foreground rounded-bl-md",
      )}>
        {!isUser && message.senderName && (
          <p className="text-[10px] font-semibold opacity-70">{message.senderName}</p>
        )}
        {message.attachmentUrl && message.attachmentType === "image" && (
          <div className="rounded-lg overflow-hidden mb-1 -mx-1 -mt-0.5">
            <img src={message.attachmentUrl} alt="Anhang" className="w-full max-h-48 object-cover" />
          </div>
        )}
        <p className="text-sm whitespace-pre-wrap break-words">{message.text}</p>
        <div className={cn("flex items-center gap-1 justify-end", isUser ? "text-primary-foreground/60" : "text-muted-foreground")}>
          <span className="text-[10px]">{time}</span>
          {isUser && message.status && (
            message.status === "read" ? <CheckCheck className="h-3 w-3 text-blue-300" /> :
            message.status === "delivered" ? <CheckCheck className="h-3 w-3" /> :
            <Check className="h-3 w-3" />
          )}
        </div>
      </div>
    </div>
  );
});

export const MobileChatInterface = memo(function MobileChatInterface({
  messages, onSendMessage, onAttach, tenantName, voiceEnabled, onVoiceInput, className,
}: MobileChatInterfaceProps) {
  const isMobile = useIsMobile();
  const haptic = useHaptic();
  const [inputText, setInputText] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  const handleSend = useCallback(() => {
    const text = inputText.trim();
    if (!text) return;
    haptic.tap();
    onSendMessage(text);
    setInputText("");
    if (inputRef.current) {
      inputRef.current.style.height = "auto";
    }
  }, [inputText, onSendMessage, haptic]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }, [handleSend]);

  const handleInput = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInputText(e.target.value);
    // Auto-resize
    const el = e.target;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 120) + "px";
  }, []);

  if (!isMobile) return null;

  // Group messages by date
  const groupedByDate = messages.reduce<{ date: string; msgs: ChatMessage[] }[]>((acc, msg) => {
    const dateStr = new Date(msg.timestamp).toLocaleDateString("de-DE", {
      weekday: "short", day: "numeric", month: "short",
    });
    const lastGroup = acc[acc.length - 1];
    if (lastGroup && lastGroup.date === dateStr) {
      lastGroup.msgs.push(msg);
    } else {
      acc.push({ date: dateStr, msgs: [msg] });
    }
    return acc;
  }, []);

  return (
    <div className={cn("flex flex-col h-full", className)}>
      {/* Chat header */}
      {tenantName && (
        <div className="shrink-0 flex items-center gap-3 px-4 py-3 border-b border-border bg-background">
          <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center text-sm font-bold text-primary">
            {tenantName.charAt(0).toUpperCase()}
          </div>
          <div>
            <p className="text-sm font-semibold">{tenantName}</p>
            <p className="text-[10px] text-muted-foreground">Mieter</p>
          </div>
        </div>
      )}

      {/* Messages area */}
      <div className="flex-1 overflow-y-auto overscroll-contain px-3 py-3 space-y-1">
        {groupedByDate.map((group) => (
          <div key={group.date}>
            {/* Date separator */}
            <div className="flex items-center justify-center my-3">
              <span className="px-3 py-0.5 rounded-full bg-secondary text-[10px] text-muted-foreground">
                {group.date}
              </span>
            </div>
            {/* Messages */}
            <div className="space-y-1.5">
              {group.msgs.map((msg) => (
                <MessageBubble key={msg.id} message={msg} />
              ))}
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Input area */}
      <div
        className="shrink-0 flex items-end gap-2 px-3 py-2 border-t border-border bg-background"
        style={{ paddingBottom: "calc(0.5rem + env(safe-area-inset-bottom, 0px))" }}
      >
        {onAttach && (
          <button
            onClick={() => { haptic.tap(); onAttach(); }}
            className="shrink-0 p-2 rounded-full text-muted-foreground hover:bg-secondary"
            aria-label="Datei anhängen"
          >
            <Paperclip className="h-5 w-5" />
          </button>
        )}
        <textarea
          ref={inputRef}
          value={inputText}
          onChange={handleInput}
          onKeyDown={handleKeyDown}
          placeholder="Nachricht schreiben..."
          rows={1}
          className="flex-1 resize-none rounded-2xl border border-border bg-secondary/30 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 max-h-[120px]"
          style={{ minHeight: "40px" }}
        />
        {inputText.trim() ? (
          <button
            onClick={handleSend}
            className="shrink-0 p-2 rounded-full bg-primary text-primary-foreground active:scale-90 transition-transform"
            aria-label="Senden"
          >
            <Send className="h-5 w-5" />
          </button>
        ) : voiceEnabled ? (
          <button
            onClick={() => { haptic.tap(); onVoiceInput?.(); }}
            className="shrink-0 p-2 rounded-full text-muted-foreground hover:bg-secondary"
            aria-label="Sprachnachricht"
          >
            <Mic className="h-5 w-5" />
          </button>
        ) : null}
      </div>
    </div>
  );
});
