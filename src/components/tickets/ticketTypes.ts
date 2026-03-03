/**
 * Shared types and config for the TicketSystem components.
 * Extracted from TicketSystem.tsx for reuse across TenantTickets, LandlordTickets, HandworkerTickets.
 */
import { Clock, Wrench, CheckCircle2, XCircle } from "lucide-react";

export type TicketStatus = "open" | "in_progress" | "resolved" | "closed";
export type TicketPriority = "low" | "medium" | "high" | "urgent";
export type TicketCategory = "repair" | "damage" | "maintenance" | "question" | "documents" | "other";

export interface Ticket {
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

export interface ContactItem {
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

export const priorityConfig: Record<TicketPriority, { label: string; color: string }> = {
  low: { label: "Niedrig", color: "bg-secondary text-muted-foreground" },
  medium: { label: "Mittel", color: "bg-gold/15 text-gold" },
  high: { label: "Hoch", color: "bg-destructive/15 text-destructive" },
  urgent: { label: "Dringend", color: "bg-loss/20 text-loss" },
};

export const categoryConfig: Record<TicketCategory, { label: string; icon: string }> = {
  repair: { label: "Reparatur", icon: "\u{1f527}" },
  damage: { label: "Schaden", icon: "\u26a0\ufe0f" },
  maintenance: { label: "Wartung", icon: "\u{1f6e0}\ufe0f" },
  documents: { label: "Dokumente", icon: "\u{1f4c4}" },
  question: { label: "Frage", icon: "\u2753" },
  other: { label: "Sonstiges", icon: "\u{1f4cb}" },
};

export const TICKET_PAGE_SIZE = 20;

/** Calculate ticket urgency based on age and priority */
export const getUrgencyLevel = (ticket: Ticket): "normal" | "aging" | "critical" => {
  const days = Math.floor((Date.now() - new Date(ticket.created_at).getTime()) / (1000 * 60 * 60 * 24));
  if (ticket.priority === "urgent" || days > 14) return "critical";
  if (ticket.priority === "high" || days > 7) return "aging";
  return "normal";
};
