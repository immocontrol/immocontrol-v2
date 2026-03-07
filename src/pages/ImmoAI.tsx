import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Bot, Send, Trash2, Sparkles, User, Copy, Check } from "lucide-react";
import { toast } from "sonner";
import ReactMarkdown from "react-markdown";
import rehypeSanitize from "rehype-sanitize";
import { useAuth } from "@/hooks/useAuth";
import { logger } from "@/lib/logger";
import { rateLimiters } from "@/lib/rateLimiter";
import { streamImmoChat } from "@/integrations/ai/client";
import { PdfWithAI } from "@/components/PdfWithAI";
import { PropertyDescriptionGenerator } from "@/components/PropertyDescriptionGenerator";
import { BerichteInProsa } from "@/components/BerichteInProsa";

type Msg = { role: "user" | "assistant"; content: string };

const SUGGESTIONS = [
  "Wie ist meine aktuelle Portfolio-Rendite?",
  "Welcher Mieter wohnt am längsten in meinen Objekten?",
  "Wann kann ich bei welchem Mieter die Miete anpassen?",
  "Erstelle mir eine Übersicht meiner Restschulden",
  "Wie hoch ist mein monatlicher Gesamt-Cashflow?",
  "Welches Objekt hat die beste Rendite?",
  "Wie viele Deals habe ich in Besichtigung?",
  "Fasse meine letzten Besichtigungen kurz zusammen",
];

export default function ImmoAI() {
  const { session } = useAuth();
  // Improvement 6: Persist chat in localStorage
  const [messages, setMessages] = useState<Msg[]>(() => {
    try {
      const saved = localStorage.getItem("immoai_chat");
      return saved ? JSON.parse(saved) : [];
    } catch { return []; }
  });
  const [input, setInput] = useState("");

  /* OPT-16: Limit stored messages to prevent localStorage overflow */
  const MAX_STORED_MESSAGES = 50;

  // Persist messages to localStorage on change
  useEffect(() => {
    if (messages.length > 0) {
      /* OPT-17: Use constant for message limit */ localStorage.setItem("immoai_chat", JSON.stringify(messages.slice(-MAX_STORED_MESSAGES)));
    }
  }, [messages]);
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const scrollToBottom = useCallback(() => {
    setTimeout(() => {
      scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
    }, 50);
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

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
      await streamImmoChat({
        messages: allMessages,
        onChunk: (content) => {
          assistantSoFar += content;
          setMessages((prev) => {
            const last = prev[prev.length - 1];
            if (last?.role === "assistant") {
              return prev.map((m, i) => (i === prev.length - 1 ? { ...m, content: assistantSoFar } : m));
            }
            return [...prev, { role: "assistant", content: assistantSoFar }];
          });
        },
        getAccessToken: () => session?.access_token,
      });
      rateLimiters.aiChat.recordSuccess();
    } catch (e: unknown) {
      rateLimiters.aiChat.recordFailure();
      logger.error("ImmoAI request failed", "ImmoAI", e);
      toast.error(e instanceof Error ? e.message : "Fehler bei der AI-Anfrage");
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "❌ Es ist ein Fehler aufgetreten. Bitte versuche es erneut." },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

    /* FUNC-19: Message count tracking */
  const messageStats = useMemo(() => {
    const userMsgs = messages.filter(m => m.role === "user").length;
    const aiMsgs = messages.filter(m => m.role === "assistant").length;
    return { userMsgs, aiMsgs, total: messages.length };
  }, [messages]);

  /* FUNC-20: Word count for AI responses */
  const totalAIWords = useMemo(() => {
    return messages
      .filter(m => m.role === "assistant")
      .reduce((s, m) => s + m.content.split(/\s+/).length, 0);
  }, [messages]);

  /* FUNC-21: Session duration tracking */
  const [sessionStart] = useState(() => Date.now());

  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);

  const copyMessage = useCallback((content: string, idx: number) => {
    navigator.clipboard.writeText(content).then(
      () => {
        setCopiedIdx(idx);
        toast.success("Kopiert!");
        setTimeout(() => setCopiedIdx(null), 2000);
      },
      () => toast.error("Kopieren fehlgeschlagen")
    );
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send(input);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Sparkles className="h-6 w-6 text-primary" />
            Immo AI
          </h1>
          <p className="text-muted-foreground text-sm">
            Chat, PDF auswerten und mehr – mit DeepSeek
          </p>
        </div>
        <div className="flex items-center gap-2">
          {messages.length > 0 && (
            <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
              <span>{messageStats.userMsgs} Fragen</span>
              <span>·</span>
              <span>{messageStats.aiMsgs} Antworten</span>
              <span>·</span>
              <span>{totalAIWords} Wörter</span>
              <span>·</span>
              <span>{Math.round((Date.now() - sessionStart) / 60000)} Min.</span>
            </div>
          )}
          {messages.length > 0 && (
            <Button variant="outline" size="sm" onClick={() => { setMessages([]); localStorage.removeItem("immoai_chat"); }}>
              <Trash2 className="h-4 w-4 mr-1" /> Neuer Chat
            </Button>
          )}
        </div>
      </div>

      <Tabs defaultValue="chat" className="w-full">
        <TabsList className="grid w-full max-w-[280px] grid-cols-2">
          <TabsTrigger value="chat">Chat</TabsTrigger>
          <TabsTrigger value="pdf">PDF auswerten</TabsTrigger>
        </TabsList>
        <TabsContent value="pdf" className="mt-4">
          <PdfWithAI />
          <PropertyDescriptionGenerator />
          <BerichteInProsa />
        </TabsContent>
        <TabsContent value="chat" className="mt-0">
      <Card className="border-border/50">
        <CardContent className="p-0">
          {/* Improvement 7: Mobile-optimized chat height */}
          <div ref={scrollRef} className="h-[calc(100vh-280px)] sm:h-[calc(100vh-320px)] overflow-y-auto p-3 sm:p-4 space-y-4">
            {messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center space-y-6">
                <div className="bg-primary/10 rounded-full p-6">
                  <Bot className="h-12 w-12 text-primary" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold">Hallo! Ich bin dein Immo AI Assistent</h2>
                  <p className="text-muted-foreground text-sm mt-1">
                    Stelle mir Fragen zu deinen Objekten, Mietern, Darlehen und mehr.
                  </p>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 w-full max-w-lg">
                  {SUGGESTIONS.map((s) => (
                    <Button
                      key={s}
                      variant="outline"
                      size="sm"
                      className="text-xs text-left h-auto py-2 px-3 whitespace-normal justify-start"
                      onClick={() => send(s)}
                    >
                      {s}
                    </Button>
                  ))}
                </div>
              </div>
            ) : (
              messages.map((msg, i) => (
                <div
                  key={i}
                  className={`flex gap-3 ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                >
                  {msg.role === "assistant" && (
                    <div className="shrink-0 bg-primary/10 rounded-full h-8 w-8 flex items-center justify-center mt-1">
                      <Bot className="h-4 w-4 text-primary" />
                    </div>
                  )}
                  <div
                    className={`rounded-lg px-4 py-3 max-w-[80%] ${
                      msg.role === "user"
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted/50 border border-border/50"
                    }`}
                  >
                    {msg.role === "assistant" ? (
                      <div className="relative group">
                        <div className="prose prose-sm dark:prose-invert max-w-none [&_p]:my-1 [&_ul]:my-1 [&_ol]:my-1 [&_li]:my-0.5 [&_h3]:mt-3 [&_h3]:mb-1 [&_table]:text-xs">
                          <ReactMarkdown rehypePlugins={[rehypeSanitize]}>{msg.content}</ReactMarkdown>
                        </div>
                        {/* UI-UPDATE-47: Tooltip on copy AI message action */}
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <button
                              onClick={(e) => { e.stopPropagation(); copyMessage(msg.content, i); }}
                              className="absolute -top-2 -right-2 opacity-0 group-hover:opacity-100 transition-opacity bg-background border border-border rounded-md p-1 shadow-sm hover:bg-secondary"
                            >
                              {copiedIdx === i ? <Check className="h-3 w-3 text-profit" /> : <Copy className="h-3 w-3 text-muted-foreground" />}
                            </button>
                          </TooltipTrigger>
                          <TooltipContent>Kopieren</TooltipContent>
                        </Tooltip>
                      </div>
                    ) : (
                      <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                    )}
                  </div>
                  {msg.role === "user" && (
                    <div className="shrink-0 bg-primary rounded-full h-8 w-8 flex items-center justify-center mt-1">
                      <User className="h-4 w-4 text-primary-foreground" />
                    </div>
                  )}
                </div>
              ))
            )}
            {isLoading && messages[messages.length - 1]?.role === "user" && (
              <div className="flex gap-3">
                <div className="shrink-0 bg-primary/10 rounded-full h-8 w-8 flex items-center justify-center">
                  <Bot className="h-4 w-4 text-primary animate-pulse" />
                </div>
                <div className="bg-muted/50 border border-border/50 rounded-lg px-4 py-3">
                  <div className="flex gap-1">
                    <span className="w-2 h-2 bg-muted-foreground/50 rounded-full animate-bounce [animation-delay:0ms]" />
                    <span className="w-2 h-2 bg-muted-foreground/50 rounded-full animate-bounce [animation-delay:150ms]" />
                    <span className="w-2 h-2 bg-muted-foreground/50 rounded-full animate-bounce [animation-delay:300ms]" />
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="border-t border-border/50 p-4">
            <div className="flex gap-2">
              <Textarea
                ref={textareaRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Frage stellen... (Enter zum Senden, Shift+Enter für neue Zeile)"
                className="min-h-[44px] max-h-[120px] resize-none"
                rows={1}
                disabled={isLoading}
              />
              {/* UI-UPDATE-48: Tooltip on send AI message action */}
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button onClick={() => send(input)} disabled={!input.trim() || isLoading} size="icon" className="shrink-0 h-[44px] w-[44px]">
                    <Send className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Senden</TooltipContent>
              </Tooltip>
            </div>
          </div>
        </CardContent>
      </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
