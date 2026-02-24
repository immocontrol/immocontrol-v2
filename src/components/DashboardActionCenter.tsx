import { useState, useEffect } from "react";
import { Wrench, CreditCard, MessageSquare, AlertTriangle, CheckCircle2, Clock, ArrowRight, Euro, Users, Building2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/queryKeys";
import { Link } from "react-router-dom";
import { formatCurrency } from "@/lib/formatters";

interface ActionStats {
  openTickets: number;
  overduePayments: number;
  unreadMessages: number;
  inProgressTickets: number;
  totalRepairCosts: number;
  activeTenants: number;
  handworkerContacts: number;
}

const DashboardActionCenter = () => {
  const { user } = useAuth();
  const qc = useQueryClient();

  const { data, isLoading: loading } = useQuery({
    queryKey: queryKeys.dashboard.actions(user?.id ?? ""),
    queryFn: async () => {
      const [ticketsRes, paymentsRes, messagesRes, tenantsRes, contactsRes] = await Promise.all([
        supabase.from("tickets").select("id, status, title, property_id, created_at, category, priority, assigned_to_contact_id, assigned_to_user_id, actual_cost, estimated_cost").eq("landlord_id", user!.id).in("status", ["open", "in_progress"]).order("created_at", { ascending: false }).limit(10),
        supabase.from("rent_payments").select("id, status, amount").eq("landlord_id", user!.id).eq("status", "overdue"),
        supabase.from("messages").select("id, is_read, sender_id").eq("is_read", false).neq("sender_id", user!.id).limit(100),
        supabase.from("tenants").select("id").eq("landlord_id", user!.id).eq("is_active", true),
        supabase.from("contacts").select("id").eq("category", "Handwerker"),
      ]);
      const tickets = ticketsRes.data || [];
      const assignedTickets = tickets.filter(t => t.assigned_to_contact_id || t.assigned_to_user_id);
      const unassignedTickets = tickets.filter(t => !t.assigned_to_contact_id && !t.assigned_to_user_id);
      
      // Synergy 1: Calculate total repair costs from all tickets
      const totalRepairCosts = tickets.reduce((s, t) => s + Number(t.actual_cost || t.estimated_cost || 0), 0);
      // Synergy 2: Total overdue amount
      const overdueAmount = (paymentsRes.data || []).reduce((s, p) => s + Number(p.amount || 0), 0);
      
      return {
        recentTickets: tickets.slice(0, 5),
        overdueAmount,
        stats: {
          openTickets: tickets.filter(t => t.status === "open").length,
          inProgressTickets: tickets.filter(t => t.status === "in_progress").length,
          overduePayments: paymentsRes.data?.length || 0,
          unreadMessages: messagesRes.data?.length || 0,
          assignedToHandworker: assignedTickets.length,
          unassigned: unassignedTickets.length,
          totalRepairCosts,
          activeTenants: tenantsRes.data?.length || 0,
          handworkerContacts: contactsRes.data?.length || 0,
        },
      };
    },
    enabled: !!user,
    refetchInterval: 60_000,
  });

  // Realtime invalidation
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel("dashboard-actions")
      .on("postgres_changes", { event: "*", schema: "public", table: "tickets" }, () => qc.invalidateQueries({ queryKey: queryKeys.dashboard.actions(user.id) }))
      .on("postgres_changes", { event: "*", schema: "public", table: "rent_payments" }, () => qc.invalidateQueries({ queryKey: queryKeys.dashboard.actions(user.id) }))
      .on("postgres_changes", { event: "*", schema: "public", table: "messages" }, () => qc.invalidateQueries({ queryKey: queryKeys.dashboard.actions(user.id) }))
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user, qc]);

  const stats = data?.stats ?? { openTickets: 0, overduePayments: 0, unreadMessages: 0, inProgressTickets: 0, assignedToHandworker: 0, unassigned: 0, totalRepairCosts: 0, activeTenants: 0, handworkerContacts: 0 };
  const recentTickets = data?.recentTickets ?? [];
  const overdueAmount = data?.overdueAmount ?? 0;
  const totalActions = stats.openTickets + stats.overduePayments + stats.unreadMessages;

  if (loading) {
    return (
      <div className="gradient-card rounded-xl border border-border p-5">
        <div className="h-4 w-32 shimmer rounded mb-4" />
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[...Array(4)].map((_, i) => <div key={i} className="h-16 shimmer rounded-lg" />)}
        </div>
      </div>
    );
  }

  if (totalActions === 0 && recentTickets.length === 0) return null;

  const categoryIcons: Record<string, string> = {
    repair: "🔧", damage: "⚠️", maintenance: "🛠️", question: "❓", other: "📋",
  };

  return (
    <div className="gradient-card rounded-xl border border-border p-5 animate-fade-in" style={{ animationDelay: "250ms" }}>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-semibold flex items-center gap-2">
          ⚡ Handlungsbedarf
          {totalActions > 0 && (
            <span className="text-[10px] bg-loss/15 text-loss px-2 py-0.5 rounded-full font-bold">{totalActions}</span>
          )}
        </h2>
        {/* Synergy 3: Quick context stats */}
        <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
          <span className="flex items-center gap-0.5"><Users className="h-3 w-3" /> {stats.activeTenants} Mieter</span>
          <span className="flex items-center gap-0.5"><Wrench className="h-3 w-3" /> {stats.handworkerContacts} Handwerker</span>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
        <div className={`rounded-lg p-3 text-center transition-colors ${stats.openTickets > 0 ? "bg-gold/10 border border-gold/20" : "bg-secondary/50"}`}>
          <Wrench className={`h-4 w-4 mx-auto mb-1 ${stats.openTickets > 0 ? "text-gold" : "text-muted-foreground"}`} />
          <div className={`text-lg font-bold ${stats.openTickets > 0 ? "text-gold" : "text-muted-foreground"}`}>{stats.openTickets}</div>
          <div className="text-[10px] text-muted-foreground">Offene Tickets</div>
        </div>
        <div className={`rounded-lg p-3 text-center transition-colors ${stats.overduePayments > 0 ? "bg-loss/10 border border-loss/20" : "bg-secondary/50"}`}>
          <CreditCard className={`h-4 w-4 mx-auto mb-1 ${stats.overduePayments > 0 ? "text-loss" : "text-muted-foreground"}`} />
          <div className={`text-lg font-bold ${stats.overduePayments > 0 ? "text-loss" : "text-muted-foreground"}`}>{stats.overduePayments}</div>
          <div className="text-[10px] text-muted-foreground">Überfällig</div>
          {/* Synergy 4: Show overdue amount */}
          {overdueAmount > 0 && (
            <div className="text-[9px] text-loss font-medium mt-0.5">{formatCurrency(overdueAmount)}</div>
          )}
        </div>
        <div className={`rounded-lg p-3 text-center transition-colors ${stats.unreadMessages > 0 ? "bg-primary/10 border border-primary/20" : "bg-secondary/50"}`}>
          <MessageSquare className={`h-4 w-4 mx-auto mb-1 ${stats.unreadMessages > 0 ? "text-primary" : "text-muted-foreground"}`} />
          <div className={`text-lg font-bold ${stats.unreadMessages > 0 ? "text-primary" : "text-muted-foreground"}`}>{stats.unreadMessages}</div>
          <div className="text-[10px] text-muted-foreground">Ungelesen</div>
        </div>
        {/* Synergy 5: Handworker assignment + repair cost */}
        <div className={`rounded-lg p-3 text-center transition-colors ${stats.unassigned > 0 ? "bg-gold/10 border border-gold/20" : "bg-profit/10 border border-profit/20"}`}>
          <Wrench className={`h-4 w-4 mx-auto mb-1 ${stats.unassigned > 0 ? "text-gold" : "text-profit"}`} />
          <div className={`text-lg font-bold ${stats.unassigned > 0 ? "text-gold" : "text-profit"}`}>
            {stats.assignedToHandworker}/{stats.assignedToHandworker + stats.unassigned}
          </div>
          <div className="text-[10px] text-muted-foreground">An Handwerker</div>
          {stats.totalRepairCosts > 0 && (
            <div className="text-[9px] text-muted-foreground font-medium mt-0.5">{formatCurrency(stats.totalRepairCosts)} Kosten</div>
          )}
        </div>
      </div>

      {recentTickets.length > 0 && (
        <div className="space-y-1.5">
          <div className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium mb-2">Neueste Tickets</div>
          {recentTickets.map(ticket => (
            <Link
              key={ticket.id}
              to={`/objekt/${ticket.property_id}`}
              className="flex items-center gap-2 p-2 rounded-lg hover:bg-secondary/80 transition-colors group"
            >
              <span className="text-sm">{categoryIcons[ticket.category] || "📋"}</span>
              <span className="text-xs font-medium truncate flex-1">{ticket.title}</span>
              {/* Synergy 6: Show estimated cost inline on tickets */}
              {(ticket.estimated_cost > 0 || ticket.actual_cost > 0) && (
                <span className="text-[9px] text-muted-foreground font-medium">
                  {formatCurrency(Number(ticket.actual_cost || ticket.estimated_cost))}
                </span>
              )}
              {(ticket.assigned_to_contact_id || ticket.assigned_to_user_id) ? (
                <span className="text-[10px] px-1.5 py-0.5 rounded font-medium text-primary bg-primary/10 flex items-center gap-0.5">
                  <Wrench className="h-2.5 w-2.5" /> Zugewiesen
                </span>
              ) : (
                <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
                  ticket.status === "open" ? "text-gold bg-gold/10" : "text-primary bg-primary/10"
                }`}>
                  {ticket.status === "open" ? "Offen" : "In Bearbeitung"}
                </span>
              )}
              <ArrowRight className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
            </Link>
          ))}
        </div>
      )}
    </div>
  );
};

export default DashboardActionCenter;
