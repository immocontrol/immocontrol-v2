import { useState } from "react";
import { CreditCard, Wrench, MessageSquare, StickyNote, FileText, Clock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/lib/queryKeys";

interface TimelineEvent {
  id: string;
  type: "payment" | "ticket" | "message" | "note" | "document";
  title: string;
  subtitle?: string;
  date: string;
  status?: string;
}

const typeConfig = {
  payment: { icon: CreditCard, color: "text-profit bg-profit/10", label: "Zahlung" },
  ticket: { icon: Wrench, color: "text-gold bg-gold/10", label: "Ticket" },
  message: { icon: MessageSquare, color: "text-primary bg-primary/10", label: "Nachricht" },
  note: { icon: StickyNote, color: "text-muted-foreground bg-secondary", label: "Notiz" },
  document: { icon: FileText, color: "text-accent-foreground bg-accent/50", label: "Dokument" },
};

interface ActivityTimelineProps {
  propertyId: string;
}

const ActivityTimeline = ({ propertyId }: ActivityTimelineProps) => {
  const { user } = useAuth();
  const [showAll, setShowAll] = useState(false);
  // Improvement 5: Type filter for timeline
  const [typeFilter, setTypeFilter] = useState<"all" | "payment" | "ticket" | "message" | "note" | "document">("all");

  const { data: events = [], isLoading: loading } = useQuery({
    queryKey: queryKeys.timeline.byProperty(propertyId),
    queryFn: async () => {
      const [payments, tickets, messages, notes, docs] = await Promise.all([
        supabase.from("rent_payments").select("id, amount, due_date, status, created_at").eq("property_id", propertyId).order("created_at", { ascending: false }).limit(10),
        supabase.from("tickets").select("id, title, status, category, created_at, assigned_to_contact_id, handworker_note, landlord_note").eq("property_id", propertyId).order("created_at", { ascending: false }).limit(10),
        supabase.from("messages").select("id, content, sender_role, created_at").eq("property_id", propertyId).order("created_at", { ascending: false }).limit(10),
        supabase.from("property_notes").select("id, content, created_at").eq("property_id", propertyId).order("created_at", { ascending: false }).limit(10),
        supabase.from("property_documents").select("id, file_name, created_at").eq("property_id", propertyId).order("created_at", { ascending: false }).limit(10),
      ]);

      const allEvents: TimelineEvent[] = [
        ...(payments.data || []).map(p => ({
          id: `pay-${p.id}`, type: "payment" as const,
          title: `${Number(p.amount).toLocaleString("de-DE", { style: "currency", currency: "EUR" })}`,
          subtitle: p.status === "confirmed" ? "Bestätigt" : p.status === "overdue" ? "Überfällig" : "Ausstehend",
          date: p.created_at, status: p.status,
        })),
        ...(tickets.data || []).map(t => ({
          id: `tix-${t.id}`, type: "ticket" as const,
          title: t.title,
          subtitle: t.status === "open" ? "Offen" : t.status === "in_progress" ? (t.assigned_to_contact_id ? "→ Handwerker" : "In Bearbeitung") : "Erledigt",
          date: t.created_at, status: t.status,
        })),
        ...(messages.data || []).map(m => ({
          id: `msg-${m.id}`, type: "message" as const,
          title: m.content.substring(0, 60) + (m.content.length > 60 ? "…" : ""),
          subtitle: m.sender_role === "tenant" ? "Von Mieter" : m.sender_role === "handworker" ? "Von Handwerker" : "Von Vermieter",
          date: m.created_at,
        })),
        ...(notes.data || []).map(n => ({
          id: `note-${n.id}`, type: "note" as const,
          title: n.content.substring(0, 60) + (n.content.length > 60 ? "…" : ""),
          date: n.created_at,
        })),
        ...(docs.data || []).map(d => ({
          id: `doc-${d.id}`, type: "document" as const,
          title: d.file_name, date: d.created_at,
        })),
      ];

      allEvents.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      return allEvents;
    },
    enabled: !!user,
  });

  if (loading) {
    return (
      <div className="gradient-card rounded-xl border border-border p-5 animate-pulse">
        <div className="h-4 w-40 bg-secondary rounded mb-4" />
        <div className="space-y-3">
          {[...Array(4)].map((_, i) => <div key={i} className="h-10 bg-secondary rounded-lg" />)}
        </div>
      </div>
    );
  }

  if (events.length === 0) return null;

  // Improvement 5: Filter events by type
  const filteredEvents = typeFilter === "all" ? events : events.filter(e => e.type === typeFilter);
  const displayed = showAll ? filteredEvents : filteredEvents.slice(0, 8);

  // Improvement 6: Count per type
  const typeCounts = events.reduce<Record<string, number>>((acc, e) => {
    acc[e.type] = (acc[e.type] || 0) + 1;
    return acc;
  }, {});

  const grouped = displayed.reduce<Record<string, TimelineEvent[]>>((acc, event) => {
    const dateKey = new Date(event.date).toLocaleDateString("de-DE", { day: "2-digit", month: "short", year: "numeric" });
    if (!acc[dateKey]) acc[dateKey] = [];
    acc[dateKey].push(event);
    return acc;
  }, {});

  return (
    <div className="gradient-card rounded-xl border border-border p-5 animate-fade-in">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold flex items-center gap-2">
          <Clock className="h-4 w-4 text-muted-foreground" /> Aktivitäts-Timeline
        </h2>
        <span className="text-[10px] text-muted-foreground">{filteredEvents.length} Einträge</span>
      </div>

      {/* Improvement 5: Type filter tabs */}
      <div className="flex gap-1 mb-4 overflow-x-auto scrollbar-hide">
        {[
          { key: "all" as const, label: "Alle", count: events.length },
          ...Object.entries(typeConfig).filter(([k]) => typeCounts[k]).map(([k, v]) => ({
            key: k as TimelineEvent["type"], label: v.label, count: typeCounts[k] || 0,
          })),
        ].map(f => (
          <button
            key={f.key}
            onClick={() => setTypeFilter(f.key)}
            className={`text-[10px] px-2 py-1 rounded-md font-medium transition-colors whitespace-nowrap ${
              typeFilter === f.key ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-secondary"
            }`}
          >
            {f.label} ({f.count})
          </button>
        ))}
      </div>

      <div className="space-y-4">
        {Object.entries(grouped).map(([dateKey, dayEvents]) => (
          <div key={dateKey}>
            <div className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium mb-2 sticky top-0 bg-card/80 backdrop-blur-sm py-1">
              {dateKey}
            </div>
            <div className="space-y-1.5 ml-1 border-l-2 border-border pl-3">
              {dayEvents.map(event => {
                const config = typeConfig[event.type];
                const Icon = config.icon;
                return (
                  <div key={event.id} className="flex items-start gap-2 py-1.5">
                    <div className={`w-6 h-6 rounded-md flex items-center justify-center shrink-0 -ml-[17px] ${config.color}`}>
                      <Icon className="h-3 w-3" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-xs font-medium truncate">{event.title}</div>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] text-muted-foreground">{config.label}</span>
                        {event.subtitle && (
                          <span className={`text-[10px] font-medium ${
                            event.status === "overdue" ? "text-loss" :
                            event.status === "confirmed" || event.status === "resolved" ? "text-profit" :
                            "text-muted-foreground"
                          }`}>{event.subtitle}</span>
                        )}
                        <span className="text-[10px] text-muted-foreground">
                          {new Date(event.date).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" })}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {filteredEvents.length > 8 && (
        <button
          onClick={() => setShowAll(!showAll)}
          className="w-full text-center text-xs text-primary hover:text-primary/80 mt-3 py-2 transition-colors"
        >
          {showAll ? "Weniger anzeigen" : `Alle ${filteredEvents.length} Einträge anzeigen`}
        </button>
      )}
    </div>
  );
};

export default ActivityTimeline;
