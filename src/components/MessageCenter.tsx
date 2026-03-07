import { useState, useEffect, useRef } from "react";
import { MessageCircle, Send, CheckCheck, Check, Sparkles, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/queryKeys";
import { formatDate, formatTime } from "@/lib/formatters";
import { isDeepSeekConfigured, summarizeMessages } from "@/integrations/ai/extractors";
import { toast } from "sonner";
import { EmptyState } from "@/components/EmptyState";

interface Tenant {
  id: string;
  first_name: string;
  last_name: string;
}

interface Message {
  id: string;
  content: string;
  sender_id: string;
  sender_role: string;
  is_read: boolean;
  created_at: string;
}

const MessageCenter = ({ propertyId }: { propertyId: string }) => {
  const { user } = useAuth();
  const [selectedTenant, setSelectedTenant] = useState<string>("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [summaryOpen, setSummaryOpen] = useState(false);
  const [summaryText, setSummaryText] = useState("");
  const [summaryLoading, setSummaryLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const qc = useQueryClient();

  const { data: tenants = [] } = useQuery({
    queryKey: queryKeys.messages.tenantList(propertyId),
    queryFn: async () => {
      const { data } = await supabase
        .from("tenants")
        .select("id, first_name, last_name")
        .eq("property_id", propertyId)
        .eq("is_active", true);
      return (data || []) as Tenant[];
    },
  });

  // Synergy 18: Fetch ticket status per tenant for message context
  const { data: tenantTicketStatus = {} } = useQuery({
    queryKey: [...queryKeys.messages.tenantList(propertyId), "ticket-status"],
    queryFn: async () => {
      const { data } = await supabase
        .from("tickets")
        .select("tenant_id, status")
        .eq("property_id", propertyId)
        .in("status", ["open", "in_progress"]);
      const statuses: Record<string, number> = {};
      (data || []).forEach(t => { statuses[t.tenant_id] = (statuses[t.tenant_id] || 0) + 1; });
      return statuses;
    },
    enabled: !!user,
  });

  // Fetch unread counts per tenant for synergy indicator
  const { data: unreadCounts = {} } = useQuery({
    queryKey: [...queryKeys.messages.tenantList(propertyId), "unread"],
    queryFn: async () => {
      if (!user) return {};
      const { data } = await supabase
        .from("messages")
        .select("tenant_id")
        .eq("property_id", propertyId)
        .eq("is_read", false)
        .neq("sender_id", user.id);
      const counts: Record<string, number> = {};
      (data || []).forEach(m => { counts[m.tenant_id] = (counts[m.tenant_id] || 0) + 1; });
      return counts;
    },
    enabled: !!user,
  });

  const fetchMessages = async (tenantId: string) => {
    const { data } = await supabase
      .from("messages")
      .select("*")
      .eq("tenant_id", tenantId)
      .order("created_at", { ascending: true });
    if (data) setMessages(data as Message[]);

    if (user) {
      await supabase
        .from("messages")
        .update({ is_read: true })
        .eq("tenant_id", tenantId)
        .neq("sender_id", user.id);
    }
  };

  useEffect(() => {
    if (!selectedTenant || !user) return;
    fetchMessages(selectedTenant);

    const channel = supabase
      .channel(`messages-${selectedTenant}`)
      .on("postgres_changes", {
        event: "INSERT",
        schema: "public",
        table: "messages",
        filter: `tenant_id=eq.${selectedTenant}`,
      }, (payload) => {
        setMessages((prev) => [...prev, payload.new as Message]);
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [selectedTenant, user]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendMessage = async () => {
    if (!newMessage.trim() || !user || !selectedTenant) return;
    setSending(true);
    const { error } = await supabase.from("messages").insert({
      property_id: propertyId,
      tenant_id: selectedTenant,
      sender_id: user.id,
      sender_role: "landlord",
      content: newMessage.trim(),
    });
    setSending(false);
    if (!error) {
      setNewMessage("");
      qc.invalidateQueries({ queryKey: queryKeys.timeline.byProperty(propertyId) });
    }
  };

  const unreadCount = messages.filter((m) => !m.is_read && m.sender_id !== user?.id).length;

  const handleSummarize = async () => {
    if (messages.length === 0) {
      toast.info("Keine Nachrichten zum Zusammenfassen.");
      return;
    }
    setSummaryLoading(true);
    setSummaryOpen(true);
    setSummaryText("");
    try {
      const summary = await summarizeMessages(
        messages.map((m) => ({ content: m.content, sender_role: m.sender_role }))
      );
      setSummaryText(summary || "Keine Zusammenfassung möglich.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Zusammenfassung fehlgeschlagen.");
      setSummaryText("");
      setSummaryOpen(false);
    } finally {
      setSummaryLoading(false);
    }
  };

  // Improvement 18: Last message preview per tenant
  const getLastMessage = (tenantId: string) => {
    if (tenantId !== selectedTenant) return null;
    return messages.length > 0 ? messages[messages.length - 1] : null;
  };

  return (
    <div className="gradient-card rounded-xl border border-border p-5 animate-fade-in">
      <h2 className="text-sm font-semibold flex items-center gap-2 mb-4">
        <MessageCircle className="h-4 w-4 text-muted-foreground" /> Nachrichten
        {unreadCount > 0 && (
          <span className="text-[10px] bg-primary text-primary-foreground px-1.5 py-0.5 rounded-full font-bold min-w-[18px] text-center">
            {unreadCount}
          </span>
        )}
        {/* Improvement 19: Total unread across all tenants */}
        {Object.values(unreadCounts).reduce((s, c) => s + c, 0) > 0 && !selectedTenant && (
          <span className="text-[10px] text-muted-foreground ml-auto">
            {Object.values(unreadCounts).reduce((s, c) => s + c, 0)} ungelesen gesamt
          </span>
        )}
      </h2>

      {tenants.length === 0 ? (
        <p className="text-xs text-muted-foreground text-center py-6">
          Lege zuerst Mieter an, um Nachrichten zu senden
        </p>
      ) : (
        <>
          <Select value={selectedTenant} onValueChange={setSelectedTenant}>
            <SelectTrigger className="h-9 text-sm mb-3">
              <SelectValue placeholder="Mieter auswählen..." />
            </SelectTrigger>
            <SelectContent>
              {tenants.map((t) => (
                <SelectItem key={t.id} value={t.id}>
                  <div className="flex items-center gap-2">
                    <span>{t.first_name} {t.last_name}</span>
                    {unreadCounts[t.id] > 0 && (
                      <span className="text-[10px] bg-primary text-primary-foreground px-1.5 py-0.5 rounded-full font-bold">
                        {unreadCounts[t.id]}
                      </span>
                    )}
                    {/* Synergy 18: Show open ticket count in message tenant selector */}
                    {tenantTicketStatus[t.id] > 0 && (
                      <span className="text-[10px] bg-gold/15 text-gold px-1.5 py-0.5 rounded-full font-bold">
                        🔧 {tenantTicketStatus[t.id]}
                      </span>
                    )}
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {selectedTenant && (
            <>
              {isDeepSeekConfigured() && messages.length > 0 && (
                <div className="flex justify-end mb-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={summaryLoading}
                    onClick={handleSummarize}
                    aria-label="Nachrichten mit KI zusammenfassen"
                    className="touch-target min-h-[44px]"
                  >
                    {summaryLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <Sparkles className="h-3.5 w-3.5 mr-1" />}
                    KI zusammenfassen
                  </Button>
                </div>
              )}
              <Dialog open={summaryOpen} onOpenChange={setSummaryOpen}>
                <DialogContent className="max-w-md">
                  <DialogHeader>
                    <DialogTitle>Zusammenfassung der Nachrichten</DialogTitle>
                  </DialogHeader>
                  {summaryLoading ? (
                    <p className="text-sm text-muted-foreground flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" /> KI wertet aus…
                    </p>
                  ) : (
                    <p className="text-sm whitespace-pre-wrap">{summaryText}</p>
                  )}
                </DialogContent>
              </Dialog>
              <div className="bg-secondary/30 rounded-lg p-3 h-64 overflow-y-auto space-y-2 mb-3">
                {messages.length === 0 ? (
                  <EmptyState
                    icon={MessageCircle}
                    title="Noch keine Nachrichten"
                    description="Wähle einen Mieter und starte die Konversation"
                  />
                ) : (
                  messages.map((msg, idx) => {
                    const isMine = msg.sender_id === user?.id;
                    const msgDate = formatDate(msg.created_at);
                    const prevDate = idx > 0 ? formatDate(messages[idx - 1].created_at) : null;
                    const showDateSep = idx === 0 || msgDate !== prevDate;

                    return (
                      <div key={msg.id}>
                        {showDateSep && (
                          <div className="flex items-center gap-2 my-2">
                            <div className="flex-1 h-px bg-border" />
                            <span className="text-[10px] text-muted-foreground">{msgDate}</span>
                            <div className="flex-1 h-px bg-border" />
                          </div>
                        )}
                        <div className={`flex ${isMine ? "justify-end" : "justify-start"}`}>
                          <div className={`max-w-[75%] rounded-xl px-3 py-2 text-sm ${
                            isMine
                              ? "bg-primary text-primary-foreground rounded-br-sm"
                              : "bg-secondary text-foreground rounded-bl-sm"
                          }`}>
                            <p>{msg.content}</p>
                            <span className={`text-[10px] mt-1 flex items-center gap-1 ${isMine ? "text-primary-foreground/70" : "text-muted-foreground"}`}>
                              {formatTime(msg.created_at)}
                              {isMine && (
                                msg.is_read
                                  ? <CheckCheck className="h-3 w-3 text-blue-400" />
                                  : <Check className="h-3 w-3" />
                              )}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
                <div ref={messagesEndRef} />
              </div>

              <div className="flex gap-2">
                <Input
                  placeholder="Nachricht schreiben..."
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
                  className="h-9 text-sm"
                />
                {/* UI-UPDATE-42: Tooltip on send message action */}
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button size="icon" className="h-9 w-9 shrink-0" onClick={sendMessage} disabled={sending || !newMessage.trim()} aria-label="Nachricht senden">
                      <Send className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Senden</TooltipContent>
                </Tooltip>
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
};

export default MessageCenter;
