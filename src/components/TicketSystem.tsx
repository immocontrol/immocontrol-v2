import { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import { Wrench, Plus, Clock, CheckCircle2, XCircle, ChevronDown, ChevronUp, MessageSquare, UserPlus, ExternalLink, Euro, Sparkles, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";
import { isDeepSeekConfigured, suggestTicketDescription } from "@/integrations/ai/extractors";
import { handleError } from "@/lib/handleError";
import { toastErrorWithRetry } from "@/lib/toastMessages";
import { ROUTES } from "@/lib/routes";
import { getCallUrl } from "@/integrations/voice";

type TicketStatus = "open" | "in_progress" | "resolved" | "closed";
type TicketPriority = "low" | "medium" | "high" | "urgent";
type TicketCategory = "repair" | "damage" | "maintenance" | "question" | "documents" | "other";

interface Ticket {
  id: string;
  tenant_id: string;
  property_id: string;
  landlord_id: string;
  title: string;
  description: string;
  category: TicketCategory;
  priority: TicketPriority;
  status: TicketStatus;
  landlord_note: string | null;
  handworker_note: string | null;
  assigned_to_contact_id: string | null;
  assigned_to_user_id: string | null;
  estimated_cost: number;
  actual_cost: number;
  cost_note: string | null;
  created_at: string;
  updated_at: string;
}

interface ContactItem {
  id: string;
  name: string;
  company: string | null;
  email: string | null;
  phone: string | null;
}

export const statusConfig: Record<TicketStatus, { label: string; icon: typeof Clock; color: string }> = {
  open: { label: "Offen", icon: Clock, color: "text-gold bg-gold/10" },
  in_progress: { label: "In Bearbeitung", icon: Wrench, color: "text-primary bg-primary/10" },
  resolved: { label: "Erledigt", icon: CheckCircle2, color: "text-profit bg-profit/10" },
  closed: { label: "Geschlossen", icon: XCircle, color: "text-muted-foreground bg-secondary" },
};

// Synergy 17: Ticket urgency helper
const getUrgencyLevel = (ticket: Ticket): "normal" | "aging" | "critical" => {
  const days = Math.floor((Date.now() - new Date(ticket.created_at).getTime()) / (1000 * 60 * 60 * 24));
  if (ticket.priority === "urgent" || days > 14) return "critical";
  if (ticket.priority === "high" || days > 7) return "aging";
  return "normal";
};

export const priorityConfig: Record<TicketPriority, { label: string; color: string }> = {
  low: { label: "Niedrig", color: "bg-secondary text-muted-foreground" },
  medium: { label: "Mittel", color: "bg-gold/15 text-gold" },
  high: { label: "Hoch", color: "bg-destructive/15 text-destructive" },
  urgent: { label: "Dringend", color: "bg-loss/20 text-loss" },
};

export const categoryConfig: Record<TicketCategory, { label: string; icon: string }> = {
  repair: { label: "Reparatur", icon: "🔧" },
  damage: { label: "Schaden", icon: "⚠️" },
  maintenance: { label: "Wartung", icon: "🛠️" },
  documents: { label: "Dokumente", icon: "📄" },
  question: { label: "Frage", icon: "❓" },
  other: { label: "Sonstiges", icon: "📋" },
};

const TICKET_PAGE_SIZE = 20;

// ─── Shared Ticket Row ─────────────────────────────────────
const TicketRow = ({
  ticket,
  isExpanded,
  onToggle,
  children,
  subtitle,
}: {
  ticket: Ticket;
  isExpanded: boolean;
  onToggle: () => void;
  children?: React.ReactNode;
  subtitle?: React.ReactNode;
}) => {
  const status = statusConfig[ticket.status];
  const priority = priorityConfig[ticket.priority];
  const category = categoryConfig[ticket.category];
  const StatusIcon = status.icon;

  // Calculate ticket age
  const ticketAge = (() => {
    const created = new Date(ticket.created_at).getTime();
    const now = Date.now();
    const days = Math.floor((now - created) / (1000 * 60 * 60 * 24));
    if (days === 0) return "Heute";
    if (days === 1) return "Gestern";
    if (days < 7) return `vor ${days} Tagen`;
    if (days < 30) return `vor ${Math.floor(days / 7)} Wo.`;
    return `vor ${Math.floor(days / 30)} Mon.`;
  })();

  const urgency = (ticket.status === "open" || ticket.status === "in_progress") ? getUrgencyLevel(ticket) : "normal";
  
  return (
    <div className={`bg-secondary/50 rounded-lg overflow-hidden ${urgency === "critical" ? "ring-1 ring-loss/30" : urgency === "aging" ? "ring-1 ring-gold/20" : ""}`}>
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-3 p-3 text-left hover:bg-secondary/80 transition-colors"
      >
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${status.color}`}>
          <StatusIcon className="h-4 w-4" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium truncate">{category.icon} {ticket.title}</span>
          </div>
          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
            {subtitle}
            <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${priority.color}`}>
              {priority.label}
            </span>
            <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${status.color}`}>
              {status.label}
            </span>
            <span className="text-[10px] text-muted-foreground">
              {ticketAge}
            </span>
            {/* Synergy: Show if handworker is assigned */}
            {ticket.assigned_to_contact_id && !subtitle && (
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-primary/10 text-primary font-medium flex items-center gap-0.5">
                <Wrench className="h-2.5 w-2.5" /> Handwerker zugewiesen
              </span>
            )}
          </div>
        </div>
        {isExpanded ? <ChevronUp className="h-4 w-4 text-muted-foreground shrink-0" /> : <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />}
      </button>
      {isExpanded && (
        <div className="px-3 pb-3 space-y-2">
          <div className="bg-background rounded-lg p-3 text-sm">
            <p className="text-muted-foreground whitespace-pre-wrap">{ticket.description}</p>
          </div>
          {children}
          <div className="text-[10px] text-muted-foreground flex items-center gap-2 flex-wrap">
            <span>Erstellt: {new Date(ticket.created_at).toLocaleString("de-DE")}</span>
            <span>·</span>
            <span>Aktualisiert: {new Date(ticket.updated_at).toLocaleString("de-DE")}</span>
            {ticket.estimated_cost > 0 && (
              <>
                <span>·</span>
                <span className="flex items-center gap-0.5">
                  <Euro className="h-2.5 w-2.5" />
                  Geschätzt: {Number(ticket.estimated_cost).toLocaleString("de-DE", { style: "currency", currency: "EUR" })}
                </span>
              </>
            )}
            {ticket.actual_cost > 0 && (
              <>
                <span>·</span>
                <span className={`flex items-center gap-0.5 font-medium ${ticket.actual_cost > ticket.estimated_cost ? "text-loss" : "text-profit"}`}>
                  Tatsächlich: {Number(ticket.actual_cost).toLocaleString("de-DE", { style: "currency", currency: "EUR" })}
                </span>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

// ─── Tenant Tickets ─────────────────────────────────────────
interface TenantTicketsProps {
  tenantId: string;
  propertyId: string;
  landlordId: string;
}

export const TenantTickets = ({ tenantId, propertyId, landlordId }: TenantTicketsProps) => {
  const { user } = useAuth();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [open, setOpen] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [form, setForm] = useState({ title: "", description: "", category: "repair" as TicketCategory, priority: "medium" as TicketPriority });
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [suggestLoading, setSuggestLoading] = useState(false);

  const suggestDescription = async () => {
    if (!form.title.trim() || !isDeepSeekConfigured()) return;
    setSuggestLoading(true);
    try {
      const desc = await suggestTicketDescription(form.title, categoryConfig[form.category]?.label ?? form.category);
      setForm(f => ({ ...f, description: desc }));
      toast.success("Beschreibung vorgeschlagen");
    } catch (e: unknown) {
      handleError(e, { context: "general", showToast: false });
      toastErrorWithRetry("Vorschlag fehlgeschlagen", suggestDescription);
    } finally {
      setSuggestLoading(false);
    }
  };

  const fetchTickets = useCallback(async (offset = 0, append = false) => {
    if (offset > 0) setLoadingMore(true);
    const { data } = await supabase
      .from("tickets")
      .select("*")
      .eq("tenant_id", tenantId)
      .order("created_at", { ascending: false })
      .range(offset, offset + TICKET_PAGE_SIZE - 1);
    if (data) {
      setTickets(prev => append ? [...prev, ...(data as unknown as Ticket[])] : (data as unknown as Ticket[]));
      setHasMore(data.length === TICKET_PAGE_SIZE);
    }
    setLoadingMore(false);
  }, [tenantId]);

  useEffect(() => {
    fetchTickets();
    const channel = supabase
      .channel(`tickets-tenant-${tenantId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "tickets", filter: `tenant_id=eq.${tenantId}` }, () => fetchTickets())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [tenantId, fetchTickets]);

  const createTicket = async () => {
    if (!form.title.trim() || !form.description.trim()) {
      toast.error("Titel und Beschreibung sind erforderlich");
      return;
    }
    const { error } = await supabase.from("tickets").insert({
      tenant_id: tenantId,
      property_id: propertyId,
      landlord_id: landlordId,
      title: form.title.trim(),
      description: form.description.trim(),
      category: form.category,
      priority: form.priority,
    });
    if (error) {
      handleError(error, { context: "supabase", showToast: false });
      toastErrorWithRetry("Fehler beim Erstellen", createTicket);
      return;
    }
    toast.success("Ticket erstellt!");
    setForm({ title: "", description: "", category: "repair", priority: "medium" });
    setOpen(false);
    fetchTickets();
  };

  const openCount = tickets.filter(t => t.status === "open" || t.status === "in_progress").length;

  return (
    <div className="space-y-4">
      <div className="gradient-card rounded-xl border border-border p-5 animate-fade-in">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold flex items-center gap-2">
            <Wrench className="h-4 w-4 text-muted-foreground" /> Meine Anfragen
            {openCount > 0 && (
              <span className="text-[10px] bg-gold/15 text-gold px-1.5 py-0.5 rounded-full font-bold">{openCount}</span>
            )}
          </h2>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="gap-1.5">
                <Plus className="h-3.5 w-3.5" /> Neue Anfrage
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Neue Anfrage erstellen</DialogTitle>
              </DialogHeader>
              <div className="space-y-3">
                <div className="space-y-1">
                  <Label className="text-xs">Kategorie</Label>
                  <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v as TicketCategory })}>
                    <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {Object.entries(categoryConfig).map(([k, v]) => (
                        <SelectItem key={k} value={k}>{v.icon} {v.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Priorität</Label>
                  <Select value={form.priority} onValueChange={(v) => setForm({ ...form, priority: v as TicketPriority })}>
                    <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {Object.entries(priorityConfig).map(([k, v]) => (
                        <SelectItem key={k} value={k}>{v.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Titel *</Label>
                  <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="z.B. Wasserhahn tropft" className="h-9 text-sm" maxLength={100} />
                </div>
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs">Beschreibung *</Label>
                    {isDeepSeekConfigured() && form.title.trim() && (
                      <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs touch-target min-h-[32px]" onClick={suggestDescription} disabled={suggestLoading} type="button" aria-label="KI-Beschreibung vorschlagen">
                        {suggestLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
                        Vorschlag
                      </Button>
                    )}
                  </div>
                  <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Beschreibe das Problem genauer..." className="text-sm min-h-[100px]" maxLength={1000} />
                </div>
                <Button onClick={createTicket} className="w-full">Anfrage senden</Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {tickets.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-8">
            Noch keine Anfragen. Erstelle eine neue Anfrage bei Reparaturbedarf oder Schadensmeldung.
          </p>
        ) : (
          <div className="space-y-2">
            {tickets.map((ticket) => (
              <TicketRow
                key={ticket.id}
                ticket={ticket}
                isExpanded={expandedId === ticket.id}
                onToggle={() => setExpandedId(expandedId === ticket.id ? null : ticket.id)}
              >
                {ticket.landlord_note && (
                  <div className="bg-primary/5 border border-primary/20 rounded-lg p-3">
                    <div className="text-xs font-semibold text-primary mb-1 flex items-center gap-1">
                      <MessageSquare className="h-3 w-3" /> Antwort vom Vermieter
                    </div>
                    <p className="text-sm whitespace-pre-wrap">{ticket.landlord_note}</p>
                  </div>
                )}
                {ticket.assigned_to_contact_id && (
                  <div className="bg-accent/50 border border-accent rounded-lg p-2">
                    <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                      <UserPlus className="h-3 w-3" /> An Handwerker weitergeleitet
                    </span>
                  </div>
                )}
                {ticket.handworker_note && (
                  <div className="bg-profit/5 border border-profit/20 rounded-lg p-3">
                    <div className="text-xs font-semibold text-profit mb-1 flex items-center gap-1">
                      <Wrench className="h-3 w-3" /> Nachricht vom Handwerker
                    </div>
                    <p className="text-sm whitespace-pre-wrap">{ticket.handworker_note}</p>
                  </div>
                )}
              </TicketRow>
            ))}
          </div>
        )}
        {hasMore && (
          <Button
            variant="ghost"
            size="sm"
            className="w-full mt-2 text-xs text-muted-foreground"
            onClick={() => fetchTickets(tickets.length, true)}
            disabled={loadingMore}
          >
            {loadingMore ? "Laden…" : "Mehr laden"}
          </Button>
        )}
      </div>
    </div>
  );
};

// ─── Landlord Tickets ───────────────────────────────────────
interface LandlordTicketsProps {
  propertyId: string;
}

export const LandlordTickets = ({ propertyId }: LandlordTicketsProps) => {
  const { user } = useAuth();
  const [tickets, setTickets] = useState<(Ticket & { tenants?: { first_name: string; last_name: string; unit_label: string } })[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editingNote, setEditingNote] = useState<string | null>(null);
  const [noteText, setNoteText] = useState("");
  const [handworkerContacts, setHandworkerContacts] = useState<ContactItem[]>([]);
  const [assigningId, setAssigningId] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "open" | "assigned">("all");
  const [editingCost, setEditingCost] = useState<string | null>(null);
  const [costForm, setCostForm] = useState({ estimated: "", actual: "", note: "" });
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  const fetchTickets = useCallback(async (offset = 0, append = false) => {
    if (offset > 0) setLoadingMore(true);
    const { data } = await supabase
      .from("tickets")
      .select("*, tenants(first_name, last_name, unit_label)")
      .eq("property_id", propertyId)
      .order("created_at", { ascending: false })
      .range(offset, offset + TICKET_PAGE_SIZE - 1);
    if (data) {
      /* FIX-1: Replace `as any` with proper typed cast for landlord tickets */
      const typed = data as unknown as (Ticket & { tenants?: { first_name: string; last_name: string; unit_label: string } })[];
      setTickets(prev => append ? [...prev, ...typed] : typed);
      setHasMore(data.length === TICKET_PAGE_SIZE);
    }
    setLoadingMore(false);
  }, [propertyId]);

  const fetchHandworkers = async () => {
    const { data } = await supabase
      .from("contacts")
      .select("id, name, company, email, phone")
      .eq("category", "Handwerker")
      .order("name");
    if (data) setHandworkerContacts(data);
  };

  useEffect(() => {
    fetchTickets();
    fetchHandworkers();
    const channel = supabase
      .channel(`tickets-landlord-${propertyId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "tickets", filter: `property_id=eq.${propertyId}` }, () => fetchTickets())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [propertyId]);

  const updateStatus = async (ticketId: string, newStatus: TicketStatus) => {
    const { error } = await supabase.from("tickets").update({ status: newStatus }).eq("id", ticketId);
    if (error) { toast.error("Fehler beim Aktualisieren"); return; }
    toast.success("Status aktualisiert");
    fetchTickets();
  };

  const saveNote = async (ticketId: string) => {
    const { error } = await supabase.from("tickets").update({ landlord_note: noteText.trim() || null }).eq("id", ticketId);
    if (error) { toast.error("Fehler beim Speichern"); return; }
    toast.success("Notiz gespeichert");
    setEditingNote(null);
    setNoteText("");
    fetchTickets();
  };

  const assignHandworker = async (ticketId: string, contactId: string) => {
    const contact = handworkerContacts.find(c => c.id === contactId);
    const { error } = await supabase.from("tickets").update({
      assigned_to_contact_id: contactId,
      status: "in_progress",
    }).eq("id", ticketId);
    if (error) { toast.error("Fehler beim Zuweisen"); return; }

    // Send email notification
    if (contact?.email) {
      const ticket = tickets.find(t => t.id === ticketId);
      try {
        await supabase.functions.invoke("notify-handworker", {
          body: {
            contact_email: contact.email,
            contact_name: contact.name,
            ticket_title: ticket?.title || "",
            ticket_description: ticket?.description || "",
            ticket_category: ticket?.category || "",
            ticket_priority: ticket?.priority || "",
            property_id: propertyId,
          },
        });
        toast.success(`Ticket an ${contact.name} zugewiesen & E-Mail gesendet`);
      } catch {
        toast.success(`Ticket an ${contact.name} zugewiesen (E-Mail konnte nicht gesendet werden)`);
      }
    } else {
      toast.success(`Ticket an ${contact?.name} zugewiesen`);
    }
    setAssigningId(null);
    fetchTickets();
  };

  const unassignHandworker = async (ticketId: string) => {
    const { error } = await supabase.from("tickets").update({
      assigned_to_contact_id: null,
      assigned_to_user_id: null,
    }).eq("id", ticketId);
    if (error) { toast.error("Fehler"); return; }
    toast.success("Zuweisung entfernt");
    fetchTickets();
  };

  const saveCost = async (ticketId: string) => {
    const { error } = await supabase.from("tickets").update({
      estimated_cost: parseFloat(costForm.estimated) || 0,
      actual_cost: parseFloat(costForm.actual) || 0,
      cost_note: costForm.note.trim() || null,
    }).eq("id", ticketId);
    if (error) { toast.error("Fehler beim Speichern"); return; }
    toast.success("Kosten gespeichert");
    setEditingCost(null);
    fetchTickets();
  };

  const openCount = tickets.filter(t => t.status === "open" || t.status === "in_progress").length;
  const assignedCount = tickets.filter(t => t.assigned_to_contact_id).length;

  const filteredTickets = tickets.filter(t => {
    if (filter === "open") return t.status === "open" || t.status === "in_progress";
    if (filter === "assigned") return !!t.assigned_to_contact_id;
    return true;
  });

  return (
    <div className="gradient-card rounded-xl border border-border p-5 animate-fade-in">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-semibold flex items-center gap-2">
          <Wrench className="h-4 w-4 text-muted-foreground" /> Mieteranfragen
          {openCount > 0 && (
            <span className="text-[10px] bg-gold/15 text-gold px-1.5 py-0.5 rounded-full font-bold">{openCount} offen</span>
          )}
        </h2>
      </div>

      {/* Filter tabs */}
      {tickets.length > 0 && (
        <div className="flex gap-1 mb-3">
          {([
            { key: "all" as const, label: "Alle", count: tickets.length },
            { key: "open" as const, label: "Offen", count: openCount },
            { key: "assigned" as const, label: "Zugewiesen", count: assignedCount },
          ]).map(f => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={`text-[10px] px-2.5 py-1 rounded-md font-medium transition-colors ${
                filter === f.key ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-secondary"
              }`}
            >
              {f.label} ({f.count})
            </button>
          ))}
        </div>
      )}

      {filteredTickets.length === 0 ? (
        <p className="text-xs text-muted-foreground text-center py-6">
          {tickets.length === 0 ? "Keine Anfragen von Mietern" : "Keine Tickets in dieser Ansicht"}
        </p>
      ) : (
        <div className="space-y-2">
          {filteredTickets.map((ticket) => {
            const tenantName = ticket.tenants ? `${ticket.tenants.first_name} ${ticket.tenants.last_name}` : "Mieter";
            const assignedContact = handworkerContacts.find(c => c.id === ticket.assigned_to_contact_id);

            return (
              <TicketRow
                key={ticket.id}
                ticket={ticket}
                isExpanded={expandedId === ticket.id}
                onToggle={() => setExpandedId(expandedId === ticket.id ? null : ticket.id)}
                subtitle={
                  <>
                    <span className="text-[10px] text-muted-foreground">{tenantName}</span>
                    {ticket.tenants?.unit_label && (
                      <span className="text-[10px] bg-secondary px-1 rounded">{ticket.tenants.unit_label}</span>
                    )}
                    {assignedContact && (
                      <span className="text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded font-medium flex items-center gap-0.5">
                        <Wrench className="h-2.5 w-2.5" /> {assignedContact.name}
                      </span>
                    )}
                  </>
                }
              >
                {/* Status update */}
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs text-muted-foreground">Status:</span>
                  {(["open", "in_progress", "resolved", "closed"] as TicketStatus[]).map((s) => {
                    const sc = statusConfig[s];
                    return (
                      <button
                        key={s}
                        onClick={() => updateStatus(ticket.id, s)}
                        className={`text-[10px] px-2 py-1 rounded-md font-medium transition-colors ${
                          ticket.status === s ? sc.color + " ring-1 ring-current" : "bg-secondary text-muted-foreground hover:bg-secondary/80"
                        }`}
                      >
                        {sc.label}
                      </button>
                    );
                  })}
                </div>

                {/* Handworker assignment */}
                <div className="bg-accent/30 rounded-lg p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold flex items-center gap-1">
                      <UserPlus className="h-3 w-3" /> Handwerker zuweisen
                    </span>
                    {assignedContact && (
                      <Button size="sm" variant="ghost" className="h-6 text-[10px] text-muted-foreground" onClick={() => unassignHandworker(ticket.id)}>
                        Entfernen
                      </Button>
                    )}
                  </div>
                  {assignedContact ? (
                    <div className="flex items-center gap-2 text-sm">
                      <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center">
                        <Wrench className="h-3.5 w-3.5 text-primary" />
                      </div>
                      <div>
                        <div className="font-medium text-xs">{assignedContact.name}</div>
                        {assignedContact.company && <div className="text-[10px] text-muted-foreground">{assignedContact.company}</div>}
                      </div>
                      {assignedContact.phone && (
                        <a href={getCallUrl(assignedContact.phone)} className="ml-auto text-[10px] text-primary hover:underline">{assignedContact.phone}</a>
                      )}
                    </div>
                  ) : assigningId === ticket.id ? (
                    <div className="space-y-1.5">
                      {handworkerContacts.length === 0 ? (
                        <p className="text-[10px] text-muted-foreground">
                          Keine Handwerker in Kontakten.{" "}
                          <Link to={ROUTES.CONTACTS} className="text-primary hover:underline">Zu Kontakten →</Link>
                        </p>
                      ) : (
                        handworkerContacts.map(c => (
                          <button
                            key={c.id}
                            onClick={() => assignHandworker(ticket.id, c.id)}
                            className="w-full flex items-center gap-2 p-2 rounded-md hover:bg-secondary text-left transition-colors"
                          >
                            <div className="w-6 h-6 rounded bg-primary/10 flex items-center justify-center">
                              <Wrench className="h-3 w-3 text-primary" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="text-xs font-medium truncate">{c.name}</div>
                              {c.company && <div className="text-[10px] text-muted-foreground truncate">{c.company}</div>}
                            </div>
                            {c.email && <Badge variant="secondary" className="text-[8px] px-1">✉️</Badge>}
                          </button>
                        ))
                      )}
                      <Button size="sm" variant="ghost" className="text-xs w-full" onClick={() => setAssigningId(null)}>Abbrechen</Button>
                    </div>
                  ) : (
                    <Button size="sm" variant="outline" className="text-xs gap-1 w-full" onClick={() => setAssigningId(ticket.id)}>
                      <UserPlus className="h-3 w-3" /> Handwerker auswählen
                    </Button>
                  )}
                </div>

                {/* Cost Tracking */}
                <div className="bg-accent/20 rounded-lg p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold flex items-center gap-1">
                      <Euro className="h-3 w-3" /> Kosten-Tracking
                    </span>
                    {editingCost !== ticket.id && (ticket.estimated_cost > 0 || ticket.actual_cost > 0) && (
                      <button onClick={() => { setEditingCost(ticket.id); setCostForm({ estimated: String(ticket.estimated_cost || ""), actual: String(ticket.actual_cost || ""), note: ticket.cost_note || "" }); }} className="text-[10px] text-primary hover:underline">Bearbeiten</button>
                    )}
                  </div>
                  {editingCost === ticket.id ? (
                    <div className="space-y-2">
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <Label className="text-[10px]">Geschätzte Kosten (€)</Label>
                          <Input type="number" value={costForm.estimated} onChange={e => setCostForm({ ...costForm, estimated: e.target.value })} className="h-8 text-xs" placeholder="0" />
                        </div>
                        <div>
                          <Label className="text-[10px]">Tatsächliche Kosten (€)</Label>
                          <Input type="number" value={costForm.actual} onChange={e => setCostForm({ ...costForm, actual: e.target.value })} className="h-8 text-xs" placeholder="0" />
                        </div>
                      </div>
                      <div>
                        <Label className="text-[10px]">Kostennotiz</Label>
                        <Input value={costForm.note} onChange={e => setCostForm({ ...costForm, note: e.target.value })} className="h-8 text-xs" placeholder="z.B. Material + Arbeit" maxLength={200} />
                      </div>
                      <div className="flex gap-2">
                        <Button size="sm" className="text-xs" onClick={() => saveCost(ticket.id)}>Speichern</Button>
                        <Button size="sm" variant="ghost" className="text-xs" onClick={() => setEditingCost(null)}>Abbrechen</Button>
                      </div>
                    </div>
                  ) : (ticket.estimated_cost > 0 || ticket.actual_cost > 0) ? (
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div>
                        <span className="text-muted-foreground">Geschätzt:</span>{" "}
                        <span className="font-medium">{Number(ticket.estimated_cost).toLocaleString("de-DE", { style: "currency", currency: "EUR" })}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Tatsächlich:</span>{" "}
                        <span className={`font-medium ${ticket.actual_cost > ticket.estimated_cost ? "text-loss" : "text-profit"}`}>
                          {Number(ticket.actual_cost).toLocaleString("de-DE", { style: "currency", currency: "EUR" })}
                        </span>
                      </div>
                      {ticket.cost_note && <div className="col-span-2 text-[10px] text-muted-foreground">{ticket.cost_note}</div>}
                    </div>
                  ) : (
                    <Button size="sm" variant="outline" className="text-xs gap-1 w-full" onClick={() => { setEditingCost(ticket.id); setCostForm({ estimated: "", actual: "", note: "" }); }}>
                      <Euro className="h-3 w-3" /> Kosten erfassen
                    </Button>
                  )}
                </div>

                {/* Handworker note */}
                {ticket.handworker_note && (
                  <div className="bg-profit/5 border border-profit/20 rounded-lg p-3">
                    <div className="text-xs font-semibold text-profit mb-1 flex items-center gap-1">
                      <Wrench className="h-3 w-3" /> Nachricht vom Handwerker
                    </div>
                    <p className="text-sm whitespace-pre-wrap">{ticket.handworker_note}</p>
                  </div>
                )}

                {/* Landlord note */}
                {editingNote === ticket.id ? (
                  <div className="space-y-2">
                    <Textarea
                      value={noteText}
                      onChange={(e) => setNoteText(e.target.value)}
                      placeholder="Antwort an den Mieter..."
                      className="text-sm min-h-[80px]"
                      maxLength={500}
                    />
                    <div className="flex gap-2">
                      <Button size="sm" onClick={() => saveNote(ticket.id)}>Speichern</Button>
                      <Button size="sm" variant="ghost" onClick={() => setEditingNote(null)}>Abbrechen</Button>
                    </div>
                  </div>
                ) : (
                  <div>
                    {ticket.landlord_note && (
                      <div className="bg-primary/5 border border-primary/20 rounded-lg p-3 mb-2">
                        <div className="text-xs font-semibold text-primary mb-1">Deine Antwort</div>
                        <p className="text-sm whitespace-pre-wrap">{ticket.landlord_note}</p>
                      </div>
                    )}
                    <Button
                      size="sm"
                      variant="outline"
                      className="gap-1 text-xs"
                      onClick={() => { setEditingNote(ticket.id); setNoteText(ticket.landlord_note || ""); }}
                    >
                      <MessageSquare className="h-3 w-3" /> {ticket.landlord_note ? "Antwort bearbeiten" : "Antworten"}
                    </Button>
                  </div>
                )}
              </TicketRow>
            );
          })}
        </div>
      )}
      {hasMore && (
        <Button
          variant="ghost"
          size="sm"
          className="w-full mt-2 text-xs text-muted-foreground"
          onClick={() => fetchTickets(tickets.length, true)}
          disabled={loadingMore}
        >
          {loadingMore ? "Laden…" : "Mehr laden"}
        </Button>
      )}
    </div>
  );
};

// ─── Handworker Tickets ─────────────────────────────────────
export const HandworkerTickets = () => {
  const { user } = useAuth();
  const [tickets, setTickets] = useState<(Ticket & { tenants?: { first_name: string; last_name: string; unit_label: string }; properties?: { name: string; address: string } })[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editingNote, setEditingNote] = useState<string | null>(null);
  const [noteText, setNoteText] = useState("");
  const [filter, setFilter] = useState<"all" | "open">("open");
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  const fetchTickets = useCallback(async (offset = 0, append = false) => {
    if (!user) return;
    if (offset > 0) setLoadingMore(true);
    const { data } = await supabase
      .from("tickets")
      .select("*, tenants(first_name, last_name, unit_label), properties:property_id(name, address)")
      .eq("assigned_to_user_id", user.id)
      .order("created_at", { ascending: false })
      .range(offset, offset + TICKET_PAGE_SIZE - 1);
    if (data) {
      /* FIX-2: Replace `as any` with proper typed cast for handworker tickets */
      const typed = data as unknown as (Ticket & { tenants?: { first_name: string; last_name: string; unit_label: string }; properties?: { name: string; address: string } })[];
      setTickets(prev => append ? [...prev, ...typed] : typed);
      setHasMore(data.length === TICKET_PAGE_SIZE);
    }
    setLoadingMore(false);
  }, [user]);

  useEffect(() => {
    fetchTickets();
    if (!user) return;
    const channel = supabase
      .channel(`tickets-handworker-${user.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "tickets", filter: `assigned_to_user_id=eq.${user.id}` }, () => fetchTickets())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user]);

  const updateStatus = async (ticketId: string, newStatus: TicketStatus) => {
    const { error } = await supabase.from("tickets").update({ status: newStatus }).eq("id", ticketId);
    if (error) { toast.error("Fehler beim Aktualisieren"); return; }
    toast.success("Status aktualisiert");
    fetchTickets();
  };

  const saveNote = async (ticketId: string) => {
    const { error } = await supabase.from("tickets").update({ handworker_note: noteText.trim() || null }).eq("id", ticketId);
    if (error) { toast.error("Fehler beim Speichern"); return; }
    toast.success("Nachricht gespeichert");
    setEditingNote(null);
    setNoteText("");
    fetchTickets();
  };

  const openCount = tickets.filter(t => t.status === "open" || t.status === "in_progress").length;
  const filteredTickets = filter === "open" ? tickets.filter(t => t.status === "open" || t.status === "in_progress") : tickets;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold flex items-center gap-2">
          <Wrench className="h-5 w-5 text-primary" /> Meine Aufträge
          {openCount > 0 && (
            <span className="text-xs bg-gold/15 text-gold px-2 py-0.5 rounded-full font-bold">{openCount} offen</span>
          )}
        </h2>
      </div>

      <div className="flex gap-1">
        {([
          { key: "open" as const, label: "Offene", count: openCount },
          { key: "all" as const, label: "Alle", count: tickets.length },
        ]).map(f => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-colors ${
              filter === f.key ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-secondary"
            }`}
          >
            {f.label} ({f.count})
          </button>
        ))}
      </div>

      {filteredTickets.length === 0 ? (
        <div className="gradient-card rounded-xl border border-border p-8 text-center">
          <Wrench className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">
            {tickets.length === 0 ? "Noch keine Aufträge zugewiesen" : "Keine offenen Aufträge"}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {filteredTickets.map((ticket) => {
            /* FIX-3: Remove `as any` — ticket already typed with properties */
            const propertyName = ticket.properties?.name || "Objekt";
            const propertyAddress = ticket.properties?.address || "";

            return (
              <div key={ticket.id} className="gradient-card rounded-xl border border-border overflow-hidden">
                <TicketRow
                  ticket={ticket}
                  isExpanded={expandedId === ticket.id}
                  onToggle={() => setExpandedId(expandedId === ticket.id ? null : ticket.id)}
                  subtitle={
                    <>
                      <span className="text-[10px] text-muted-foreground">{propertyName}</span>
                      <span className="text-[10px] text-muted-foreground">{propertyAddress}</span>
                      {/* Synergy 15: Show tenant name to handworker */}
                      {/* FIX-4: Remove `as any` — ticket already typed with tenants */}
                      {ticket.tenants && (
                        <span className="text-[10px] bg-secondary px-1.5 py-0.5 rounded">
                          👤 {ticket.tenants.first_name} {ticket.tenants.last_name}
                        </span>
                      )}
                      {/* Synergy 16: Show cost inline */}
                      {(ticket.estimated_cost > 0 || ticket.actual_cost > 0) && (
                        <span className="text-[10px] text-muted-foreground font-medium">
                          💰 {Number(ticket.actual_cost || ticket.estimated_cost).toLocaleString("de-DE", { style: "currency", currency: "EUR" })}
                        </span>
                      )}
                    </>
                  }
                >
                  {/* Status update */}
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs text-muted-foreground">Status:</span>
                    {(["in_progress", "resolved"] as TicketStatus[]).map((s) => {
                      const sc = statusConfig[s];
                      return (
                        <button
                          key={s}
                          onClick={() => updateStatus(ticket.id, s)}
                          className={`text-[10px] px-2 py-1 rounded-md font-medium transition-colors ${
                            ticket.status === s ? sc.color + " ring-1 ring-current" : "bg-secondary text-muted-foreground hover:bg-secondary/80"
                          }`}
                        >
                          {sc.label}
                        </button>
                      );
                    })}
                  </div>

                  {/* Landlord note */}
                  {ticket.landlord_note && (
                    <div className="bg-primary/5 border border-primary/20 rounded-lg p-3">
                      <div className="text-xs font-semibold text-primary mb-1">Nachricht vom Vermieter</div>
                      <p className="text-sm whitespace-pre-wrap">{ticket.landlord_note}</p>
                    </div>
                  )}

                  {/* Handworker note */}
                  {editingNote === ticket.id ? (
                    <div className="space-y-2">
                      <Textarea
                        value={noteText}
                        onChange={(e) => setNoteText(e.target.value)}
                        placeholder="Rückmeldung zum Auftrag..."
                        className="text-sm min-h-[80px]"
                        maxLength={500}
                      />
                      <div className="flex gap-2">
                        <Button size="sm" onClick={() => saveNote(ticket.id)}>Speichern</Button>
                        <Button size="sm" variant="ghost" onClick={() => setEditingNote(null)}>Abbrechen</Button>
                      </div>
                    </div>
                  ) : (
                    <div>
                      {ticket.handworker_note && (
                        <div className="bg-profit/5 border border-profit/20 rounded-lg p-3 mb-2">
                          <div className="text-xs font-semibold text-profit mb-1">Deine Rückmeldung</div>
                          <p className="text-sm whitespace-pre-wrap">{ticket.handworker_note}</p>
                        </div>
                      )}
                      <Button
                        size="sm"
                        variant="outline"
                        className="gap-1 text-xs"
                        onClick={() => { setEditingNote(ticket.id); setNoteText(ticket.handworker_note || ""); }}
                      >
                        <MessageSquare className="h-3 w-3" /> {ticket.handworker_note ? "Rückmeldung bearbeiten" : "Rückmeldung schreiben"}
                      </Button>
                    </div>
                  )}
                </TicketRow>
              </div>
            );
          })}
        </div>
      )}
      {hasMore && (
        <Button
          variant="ghost"
          size="sm"
          className="w-full mt-2 text-xs text-muted-foreground"
          onClick={() => fetchTickets(tickets.length, true)}
          disabled={loadingMore}
        >
          {loadingMore ? "Laden…" : "Mehr laden"}
        </Button>
      )}
    </div>
  );
};
