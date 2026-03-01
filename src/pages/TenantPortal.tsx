import { useState, useEffect, useRef } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import {
  Building2, MessageCircle, Send, LogOut, Home, FileText, CreditCard,
  Wrench, Settings, Bell, Calendar, Euro, ChevronRight, Phone, Mail,
  ClipboardList, User, Download, AlertTriangle, CheckCircle2, Clock
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { TenantTickets } from "@/components/TicketSystem";
import { TenantPayments } from "@/components/PaymentTracking";
import { DamageReport } from "@/components/DamageReport";
import { formatCurrency, formatFileSize } from "@/lib/formatters";

interface TenantInfo {
  id: string;
  first_name: string;
  last_name: string;
  email: string | null;
  phone: string | null;
  property_id: string;
  unit_label: string;
  monthly_rent: number;
  deposit: number;
  move_in_date: string | null;
  landlord_id: string;
  properties: { name: string; address: string } | null;
}

interface Message {
  id: string;
  content: string;
  sender_id: string;
  sender_role: string;
  is_read: boolean;
  created_at: string;
}

// ─── Tenant Documents Component ─────────────────────────────
const TenantDocuments = ({ propertyId }: { propertyId: string }) => {
  const [documents, setDocuments] = useState<{ id: string; file_name: string; file_path: string; file_size: number; file_type: string | null; category: string; created_at: string }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetch = async () => {
      const { data } = await supabase
        .from("property_documents")
        .select("id, file_name, file_path, file_size, file_type, category, created_at")
        .eq("property_id", propertyId)
        .order("created_at", { ascending: false });
      if (data) setDocuments(data);
      setLoading(false);
    };
    fetch();
  }, [propertyId]);

  const handleDownload = async (doc: { file_name: string; file_path: string }) => {
    const { data, error } = await supabase.storage
      .from("property-documents")
      .download(doc.file_path);
    if (error || !data) { toast.error("Download fehlgeschlagen"); return; }
    const url = URL.createObjectURL(data);
    const a = document.createElement("a");
    a.href = url;
    a.download = doc.file_name;
    a.click();
    URL.revokeObjectURL(url);
  };

  const getIcon = (fileType: string | null, fileName: string) => {
    if (fileType?.includes("pdf") || fileName.match(/\.pdf$/i)) return "📄";
    if (fileType?.startsWith("image/")) return "🖼️";
    if (fileType?.includes("spreadsheet") || fileName.match(/\.(xlsx?|csv)$/i)) return "📊";
    return "📎";
  };

  return (
    <div className="space-y-4">
      <div className="gradient-card rounded-xl border border-border p-5 animate-fade-in">
        <h2 className="text-sm font-semibold mb-4 flex items-center gap-2">
          <FileText className="h-4 w-4 text-muted-foreground" /> Meine Dokumente
          {documents.length > 0 && (
            <span className="text-[10px] bg-secondary px-1.5 py-0.5 rounded-full text-muted-foreground">{documents.length}</span>
          )}
        </h2>
        {loading ? (
          <div className="text-xs text-muted-foreground text-center py-8 animate-pulse">Laden...</div>
        ) : documents.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-8">
            Noch keine Dokumente vorhanden. Der Vermieter kann hier Unterlagen bereitstellen.
          </p>
        ) : (
          <div className="space-y-2">
            {documents.map((doc) => (
              <div key={doc.id} className="flex items-center gap-3 p-3 bg-secondary/50 rounded-lg group">
                <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 text-base">
                  {getIcon(doc.file_type, doc.file_name)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">{doc.file_name}</div>
                  <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                    <span>{doc.category}</span>
                    <span>·</span>
                    <span>{formatFileSize(doc.file_size)}</span>
                    <span>·</span>
                    <span>{new Date(doc.created_at).toLocaleDateString("de-DE")}</span>
                  </div>
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-8 w-8 p-0 opacity-70 group-hover:opacity-100"
                  onClick={() => handleDownload(doc)}
                >
                  <Download className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

// ─── Tenant Dashboard Component ─────────────────────────────
const TenantDashboard = ({
  tenantInfo,
  unreadCount,
  moveInDate,
  monthsSinceMoveIn,
  setActiveTab,
  userId,
}: {
  tenantInfo: TenantInfo;
  unreadCount: number;
  moveInDate: Date | null;
  monthsSinceMoveIn: number;
  setActiveTab: (tab: Tab) => void;
  userId?: string;
}) => {
  const [ticketStats, setTicketStats] = useState({ open: 0, inProgress: 0, resolved: 0 });
  const [upcomingPayment, setUpcomingPayment] = useState<{ due_date: string; amount: number; status: string } | null>(null);
  const [unreadLandlordNotes, setUnreadLandlordNotes] = useState(0);
  const [totalPaidAmount, setTotalPaidAmount] = useState(0);
  const [assignedHandworkerCount, setAssignedHandworkerCount] = useState(0);

  useEffect(() => {
    // Fetch ticket stats for this tenant
    supabase
      .from("tickets")
      .select("id, status, landlord_note, handworker_note, assigned_to_contact_id")
      .eq("tenant_id", tenantInfo.id)
      .then(({ data }) => {
        if (data) {
          setTicketStats({
            open: data.filter(t => t.status === "open").length,
            inProgress: data.filter(t => t.status === "in_progress").length,
            resolved: data.filter(t => t.status === "resolved" || t.status === "closed").length,
          });
          setUnreadLandlordNotes(data.filter(t => t.landlord_note && (t.status === "open" || t.status === "in_progress")).length);
          // Synergy 11: Count tickets with handworker assigned
          setAssignedHandworkerCount(data.filter(t => t.assigned_to_contact_id && (t.status === "open" || t.status === "in_progress")).length);
        }
      });

    // Fetch next upcoming payment
    supabase
      .from("rent_payments")
      .select("due_date, amount, status")
      .eq("tenant_id", tenantInfo.id)
      .in("status", ["pending", "overdue"])
      .order("due_date", { ascending: true })
      .limit(1)
      .then(({ data }) => {
        if (data && data.length > 0) setUpcomingPayment(data[0] as { due_date: string; amount: number; status: string });
      });

    // Synergy 12: Fetch total paid amount
    supabase
      .from("rent_payments")
      .select("amount")
      .eq("tenant_id", tenantInfo.id)
      .eq("status", "confirmed")
      .then(({ data }) => {
        if (data) setTotalPaidAmount(data.reduce((s, p) => s + Number(p.amount), 0));
      });
  }, [tenantInfo.id]);

  const totalTickets = ticketStats.open + ticketStats.inProgress + ticketStats.resolved;

  return (
    <div className="space-y-4">
      {/* Welcome */}
      <div className="gradient-card rounded-xl border border-border p-5 animate-fade-in">
        <h2 className="text-lg font-bold mb-1">
          Willkommen, {tenantInfo.first_name}! 👋
        </h2>
        <p className="text-sm text-muted-foreground">
          Hier siehst du alles zu deiner Wohnung auf einen Blick.
        </p>
      </div>

      {/* Alerts: Overdue payment or landlord response */}
      {upcomingPayment?.status === "overdue" && (
        <div className="bg-loss/10 border border-loss/20 rounded-xl p-4 flex items-center gap-3 animate-fade-in" style={{ animationDelay: "25ms" }}>
          <AlertTriangle className="h-5 w-5 text-loss shrink-0" />
          <div className="flex-1">
            <div className="text-sm font-semibold text-loss">Überfällige Zahlung</div>
            <div className="text-xs text-loss/80">
              {formatCurrency(Number(upcomingPayment.amount))} – fällig seit {new Date(upcomingPayment.due_date).toLocaleDateString("de-DE")}
            </div>
          </div>
          <Button size="sm" variant="outline" className="shrink-0 text-xs border-loss/30 text-loss hover:bg-loss/10" onClick={() => setActiveTab("payments")}>
            Ansehen
          </Button>
        </div>
      )}

      {unreadLandlordNotes > 0 && (
        <div className="bg-primary/10 border border-primary/20 rounded-xl p-4 flex items-center gap-3 animate-fade-in" style={{ animationDelay: "50ms" }}>
          <MessageCircle className="h-5 w-5 text-primary shrink-0" />
          <div className="flex-1">
            <div className="text-sm font-semibold">Antwort vom Vermieter</div>
            <div className="text-xs text-muted-foreground">{unreadLandlordNotes} Ticket(s) mit neuer Antwort</div>
          </div>
          <Button size="sm" variant="outline" className="shrink-0 text-xs" onClick={() => setActiveTab("tickets")}>
            Ansehen
          </Button>
        </div>
      )}

      {/* Property card - Improvement 10: Show deposit */}
      <div className="gradient-card rounded-xl border border-border p-5 animate-fade-in" style={{ animationDelay: "50ms" }}>
        <div className="flex items-start gap-3">
          <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
            <Building2 className="h-6 w-6 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold">{tenantInfo.properties?.name}</h3>
            <p className="text-sm text-muted-foreground">{tenantInfo.properties?.address}</p>
            <div className="flex items-center gap-2 mt-1.5">
              {tenantInfo.unit_label && (
                <Badge variant="secondary" className="text-xs">{tenantInfo.unit_label}</Badge>
              )}
              {tenantInfo.deposit > 0 && (
                <span className="text-[10px] bg-secondary px-1.5 py-0.5 rounded text-muted-foreground">
                  Kaution: {formatCurrency(tenantInfo.deposit)}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Key figures */}
      <div className="grid grid-cols-3 gap-3">
        <div className="gradient-card rounded-xl border border-border p-4 animate-fade-in" style={{ animationDelay: "100ms" }}>
          <div className="flex items-center gap-2 mb-1">
            <Euro className="h-4 w-4 text-muted-foreground" />
            <span className="text-xs text-muted-foreground">Kaltmiete</span>
          </div>
          <div className="text-xl font-bold">{formatCurrency(tenantInfo.monthly_rent || 0)}</div>
          <div className="text-xs text-muted-foreground">pro Monat</div>
        </div>
        <div className="gradient-card rounded-xl border border-border p-4 animate-fade-in" style={{ animationDelay: "150ms" }}>
          <div className="flex items-center gap-2 mb-1">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            <span className="text-xs text-muted-foreground">Einzug</span>
          </div>
          <div className="text-lg font-bold">
            {moveInDate ? moveInDate.toLocaleDateString("de-DE", { day: "2-digit", month: "short", year: "numeric" }) : "–"}
          </div>
          {monthsSinceMoveIn > 0 && (
            <div className="text-xs text-muted-foreground">vor {monthsSinceMoveIn} Monaten</div>
          )}
        </div>
        {/* Synergy 12: Total paid */}
        <div className="gradient-card rounded-xl border border-border p-4 animate-fade-in" style={{ animationDelay: "175ms" }}>
          <div className="flex items-center gap-2 mb-1">
            <CheckCircle2 className="h-4 w-4 text-profit" />
            <span className="text-xs text-muted-foreground">Bezahlt gesamt</span>
          </div>
          <div className="text-lg font-bold text-profit">{formatCurrency(totalPaidAmount)}</div>
          <div className="text-xs text-muted-foreground">{totalPaidAmount > 0 ? `${Math.round(totalPaidAmount / (tenantInfo.monthly_rent || 1))} Monate` : "–"}</div>
        </div>
      </div>

      {/* Synergy: Ticket flow status */}
      {totalTickets > 0 && (
        <div className="gradient-card rounded-xl border border-border p-5 animate-fade-in" style={{ animationDelay: "200ms" }}>
          <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
            <Wrench className="h-4 w-4 text-muted-foreground" /> Meine Anfragen
            {/* Synergy 11: Show assigned handworker count */}
            {assignedHandworkerCount > 0 && (
              <span className="text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded-full font-medium">
                {assignedHandworkerCount} an Handwerker
              </span>
            )}
          </h3>
          <div className="grid grid-cols-3 gap-2">
            <button onClick={() => setActiveTab("tickets")} className="p-3 bg-gold/10 rounded-lg text-center hover:bg-gold/15 transition-colors">
              <Clock className="h-4 w-4 mx-auto mb-1 text-gold" />
              <div className="text-lg font-bold text-gold">{ticketStats.open}</div>
              <div className="text-[10px] text-muted-foreground">Offen</div>
            </button>
            <button onClick={() => setActiveTab("tickets")} className="p-3 bg-primary/10 rounded-lg text-center hover:bg-primary/15 transition-colors">
              <Wrench className="h-4 w-4 mx-auto mb-1 text-primary" />
              <div className="text-lg font-bold text-primary">{ticketStats.inProgress}</div>
              <div className="text-[10px] text-muted-foreground">In Arbeit</div>
            </button>
            <button onClick={() => setActiveTab("tickets")} className="p-3 bg-profit/10 rounded-lg text-center hover:bg-profit/15 transition-colors">
              <CheckCircle2 className="h-4 w-4 mx-auto mb-1 text-profit" />
              <div className="text-lg font-bold text-profit">{ticketStats.resolved}</div>
              <div className="text-[10px] text-muted-foreground">Erledigt</div>
            </button>
          </div>
        </div>
      )}

      {/* Upcoming payment reminder */}
      {upcomingPayment && upcomingPayment.status === "pending" && (
        <div className="gradient-card rounded-xl border border-border p-5 animate-fade-in" style={{ animationDelay: "250ms" }}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-gold/10 flex items-center justify-center shrink-0">
              <CreditCard className="h-5 w-5 text-gold" />
            </div>
            <div className="flex-1">
              <div className="text-sm font-semibold">Nächste Zahlung</div>
              <div className="text-xs text-muted-foreground">
                {formatCurrency(Number(upcomingPayment.amount))} – fällig am {new Date(upcomingPayment.due_date).toLocaleDateString("de-DE")}
              </div>
            </div>
            <Button size="sm" variant="ghost" className="text-xs" onClick={() => setActiveTab("payments")}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Quick actions */}
      <div className="gradient-card rounded-xl border border-border p-5 animate-fade-in" style={{ animationDelay: "300ms" }}>
        <h3 className="text-sm font-semibold mb-3">Schnellzugriff</h3>
        <div className="space-y-1">
          {[
            { label: "Schaden melden", icon: AlertTriangle, tab: "tickets" as Tab, highlight: true },
            { label: "Nachricht an Vermieter", icon: Send, tab: "messages" as Tab },
            { label: "Meine Dokumente", icon: FileText, tab: "documents" as Tab },
            { label: "Zahlungsübersicht", icon: CreditCard, tab: "payments" as Tab },
          ].map((action) => (
            <button
              key={action.label}
              onClick={() => setActiveTab(action.tab)}
              className={`w-full flex items-center gap-3 p-3 rounded-lg hover:bg-secondary transition-colors text-left ${
                action.highlight ? "bg-primary/5 border border-primary/10" : ""
              }`}
            >
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                action.highlight ? "bg-primary/15" : "bg-primary/10"
              }`}>
                <action.icon className={`h-4 w-4 ${action.highlight ? "text-primary" : "text-primary"}`} />
              </div>
              <span className="text-sm font-medium flex-1">{action.label}</span>
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </button>
          ))}
        </div>
      </div>

      {/* Unread messages shortcut */}
      {unreadCount > 0 && (
        <button
          onClick={() => setActiveTab("messages")}
          className="w-full gradient-card rounded-xl border border-primary/20 p-4 flex items-center gap-3 animate-fade-in hover:border-primary/40 transition-colors"
          style={{ animationDelay: "350ms" }}
        >
          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
            <MessageCircle className="h-5 w-5 text-primary" />
          </div>
          <div className="flex-1 text-left">
            <div className="text-sm font-semibold">{unreadCount} ungelesene Nachricht(en)</div>
            <div className="text-xs text-muted-foreground">Vom Vermieter</div>
          </div>
          <ChevronRight className="h-4 w-4 text-primary" />
        </button>
      )}
    </div>
  );
};

type Tab = "dashboard" | "messages" | "tickets" | "documents" | "payments" | "profile";

const TenantPortal = () => {
  const { user, signOut } = useAuth();
  const [tenantInfo, setTenantInfo] = useState<TenantInfo | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<Tab>("dashboard");
  const [unreadCount, setUnreadCount] = useState(0);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fetchTenantInfo = async () => {
      if (!user) return;
      const { data } = await supabase
        .from("tenants")
        .select("id, first_name, last_name, email, phone, property_id, unit_label, monthly_rent, deposit, move_in_date, landlord_id, properties:property_id(name, address)")
        .eq("user_id", user.id)
        .eq("is_active", true)
        .single();
      if (data) setTenantInfo(data as unknown as TenantInfo);
      setLoading(false);
    };
    fetchTenantInfo();
  }, [user]);

  const fetchMessages = async () => {
    if (!tenantInfo) return;
    const { data } = await supabase
      .from("messages")
      .select("*")
      .eq("tenant_id", tenantInfo.id)
      .order("created_at", { ascending: true });
    if (data) {
      setMessages(data as Message[]);
      setUnreadCount((data as Message[]).filter(m => !m.is_read && m.sender_id !== user?.id).length);
    }
    if (user) {
      await supabase.from("messages").update({ is_read: true }).eq("tenant_id", tenantInfo.id).neq("sender_id", user.id);
    }
  };

  useEffect(() => {
    if (!tenantInfo) return;
    fetchMessages();
    const channel = supabase
      .channel(`tenant-messages-${tenantInfo.id}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages", filter: `tenant_id=eq.${tenantInfo.id}` }, (payload) => {
        const msg = payload.new as Message;
        setMessages(prev => [...prev, msg]);
        if (msg.sender_id !== user?.id) setUnreadCount(prev => prev + 1);
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [tenantInfo]);

  useEffect(() => {
    if (activeTab === "messages") messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, activeTab]);

  const sendMessage = async () => {
    if (!newMessage.trim() || !user || !tenantInfo) return;
    setSending(true);
    const { error } = await supabase.from("messages").insert({
      property_id: tenantInfo.property_id,
      tenant_id: tenantInfo.id,
      sender_id: user.id,
      sender_role: "tenant",
      content: newMessage.trim(),
    });
    setSending(false);
    if (!error) setNewMessage("");
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Laden...</div>
      </div>
    );
  }

  if (!tenantInfo) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="text-center space-y-4">
          <Building2 className="h-12 w-12 text-muted-foreground mx-auto" />
          <h1 className="text-xl font-bold">Kein Mieterkonto gefunden</h1>
          <p className="text-sm text-muted-foreground max-w-sm">
            Dein Konto ist keiner Wohnung zugeordnet. Bitte kontaktiere deinen Vermieter.
          </p>
          <Button variant="outline" onClick={() => { signOut(); toast.success("Abgemeldet"); }}>
            <LogOut className="h-4 w-4 mr-2" /> Abmelden
          </Button>
        </div>
      </div>
    );
  }

  const tabs: { key: Tab; label: string; icon: typeof Home; badge?: number }[] = [
    { key: "dashboard", label: "Übersicht", icon: Home },
    { key: "messages", label: "Nachrichten", icon: MessageCircle, badge: unreadCount },
    { key: "tickets", label: "Anfragen", icon: Wrench },
    { key: "documents", label: "Dokumente", icon: FileText },
    { key: "payments", label: "Zahlungen", icon: CreditCard },
    { key: "profile", label: "Profil", icon: User },
  ];

  const moveInDate = tenantInfo.move_in_date ? new Date(tenantInfo.move_in_date) : null;
  const monthsSinceMoveIn = moveInDate ? Math.floor((Date.now() - moveInDate.getTime()) / (1000 * 60 * 60 * 24 * 30)) : 0;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-border bg-background/80 backdrop-blur-xl">
        <div className="container flex h-14 items-center justify-between">
          <div className="flex items-center gap-2">
            <Building2 className="h-6 w-6 text-primary" />
            <span className="text-lg font-bold tracking-tight">Mieterportal</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm text-muted-foreground hidden sm:block">
              {tenantInfo.first_name} {tenantInfo.last_name}
            </span>
            <Button variant="ghost" size="icon" onClick={() => { signOut(); toast.success("Abgemeldet"); }}>
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>

      {/* Tab Navigation */}
      <div className="border-b border-border bg-background/50">
        <div className="container">
          <nav className="flex gap-1 overflow-x-auto py-1 scrollbar-hide">
            {tabs.map(t => (
              <button
                key={t.key}
                onClick={() => setActiveTab(t.key)}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap relative ${
                  activeTab === t.key ? "bg-primary/10 text-primary" : "text-muted-foreground hover:text-foreground hover:bg-secondary"
                }`}
              >
                <t.icon className="h-4 w-4" />
                {t.label}
                {t.badge && t.badge > 0 ? (
                  <span className="text-[10px] bg-primary text-primary-foreground px-1.5 py-0.5 rounded-full font-bold min-w-[18px] text-center">
                    {t.badge}
                  </span>
                ) : null}
              </button>
            ))}
          </nav>
        </div>
      </div>

      <main className="flex-1 container py-6 max-w-3xl pb-24 md:pb-6">
        {/* DASHBOARD TAB */}
        {activeTab === "dashboard" && (
          <TenantDashboard
            tenantInfo={tenantInfo}
            unreadCount={unreadCount}
            moveInDate={moveInDate}
            monthsSinceMoveIn={monthsSinceMoveIn}
            setActiveTab={setActiveTab}
            userId={user?.id}
          />
        )}

        {/* MESSAGES TAB */}
        {activeTab === "messages" && (
          <div className="space-y-4">
            <div className="gradient-card rounded-xl border border-border p-5 animate-fade-in">
              <h2 className="text-sm font-semibold mb-4 flex items-center gap-2">
                <MessageCircle className="h-4 w-4 text-muted-foreground" /> Nachrichten an Vermieter
              </h2>
              <div className="bg-secondary/30 rounded-lg p-3 h-96 overflow-y-auto space-y-2 mb-3">
                {messages.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-16">
                    Noch keine Nachrichten. Schreibe deinem Vermieter!
                  </p>
                ) : (
                  messages.map((msg, idx) => {
                    const isMine = msg.sender_id === user?.id;
                    const msgDate = new Date(msg.created_at).toLocaleDateString("de-DE");
                    const prevDate = idx > 0 ? new Date(messages[idx - 1].created_at).toLocaleDateString("de-DE") : null;
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
                            isMine ? "bg-primary text-primary-foreground rounded-br-sm" : "bg-secondary text-foreground rounded-bl-sm"
                          }`}>
                            <p>{msg.content}</p>
                            <span className={`text-[10px] mt-1 block ${isMine ? "text-primary-foreground/70" : "text-muted-foreground"}`}>
                              {new Date(msg.created_at).toLocaleString("de-DE", { hour: "2-digit", minute: "2-digit" })}
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
                <Button size="icon" className="h-9 w-9 shrink-0" onClick={sendMessage} disabled={sending || !newMessage.trim()}>
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* TICKETS TAB — Feature 5: Enhanced with DamageReport */}
        {activeTab === "tickets" && tenantInfo && (
          <div className="space-y-4">
            <DamageReport
              tenantId={tenantInfo.id}
              propertyId={tenantInfo.property_id}
              landlordId={tenantInfo.landlord_id}
              unitLabel={tenantInfo.unit_label}
            />
            <TenantTickets
              tenantId={tenantInfo.id}
              propertyId={tenantInfo.property_id}
              landlordId={tenantInfo.landlord_id}
            />
          </div>
        )}

        {/* DOCUMENTS TAB */}
        {activeTab === "documents" && tenantInfo && (
          <TenantDocuments propertyId={tenantInfo.property_id} />
        )}

        {/* PAYMENTS TAB */}
        {activeTab === "payments" && tenantInfo && (
          <TenantPayments
            tenantId={tenantInfo.id}
            monthlyRent={tenantInfo.monthly_rent || 0}
            deposit={tenantInfo.deposit || 0}
          />
        )}

        {/* PROFILE TAB */}
        {activeTab === "profile" && (
          <div className="space-y-4">
            <div className="gradient-card rounded-xl border border-border p-5 animate-fade-in">
              <h2 className="text-sm font-semibold mb-4 flex items-center gap-2">
                <User className="h-4 w-4 text-muted-foreground" /> Mein Profil
              </h2>
              <div className="flex items-center gap-4 mb-4">
                <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center text-xl font-bold text-primary">
                  {tenantInfo.first_name[0]}{tenantInfo.last_name[0]}
                </div>
                <div>
                  <h3 className="text-lg font-bold">{tenantInfo.first_name} {tenantInfo.last_name}</h3>
                  <p className="text-sm text-muted-foreground">Mieter</p>
                </div>
              </div>
              <div className="space-y-3">
                {tenantInfo.email && (
                  <div className="flex items-center gap-2 text-sm">
                    <Mail className="h-4 w-4 text-muted-foreground" />
                    <span>{tenantInfo.email}</span>
                  </div>
                )}
                {tenantInfo.phone && (
                  <div className="flex items-center gap-2 text-sm">
                    <Phone className="h-4 w-4 text-muted-foreground" />
                    <span>{tenantInfo.phone}</span>
                  </div>
                )}
                <div className="flex items-center gap-2 text-sm">
                  <Building2 className="h-4 w-4 text-muted-foreground" />
                  <span>{tenantInfo.properties?.name} – {tenantInfo.unit_label || "Keine Einheit"}</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <span>Einzug: {moveInDate ? moveInDate.toLocaleDateString("de-DE") : "–"}</span>
                </div>
              </div>
            </div>

            <div className="gradient-card rounded-xl border border-border p-5 animate-fade-in" style={{ animationDelay: "100ms" }}>
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-sm font-semibold">Abmelden</h2>
                  <p className="text-xs text-muted-foreground mt-0.5">Vom Mieterportal abmelden</p>
                </div>
                <Button variant="destructive" size="sm" onClick={() => { signOut(); toast.success("Abgemeldet"); }}>
                  <LogOut className="h-4 w-4 mr-1.5" /> Abmelden
                </Button>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Mobile bottom nav */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-background/90 backdrop-blur-xl md:hidden safe-area-bottom">
        <div className="flex items-center justify-around py-2 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
          {tabs.map((t) => (
            <button
              key={t.key}
              onClick={() => setActiveTab(t.key)}
              className={`flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors relative ${
                activeTab === t.key ? "text-primary" : "text-muted-foreground"
              }`}
            >
              <t.icon className="h-5 w-5" />
              <span className="text-[10px]">{t.label}</span>
              {t.badge && t.badge > 0 ? (
                <span className="absolute -top-0.5 right-0.5 text-[8px] bg-primary text-primary-foreground px-1 py-0.5 rounded-full font-bold min-w-[14px] text-center">
                  {t.badge}
                </span>
              ) : null}
            </button>
          ))}
        </div>
      </nav>
    </div>
  );
};

export default TenantPortal;
