import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { queryKeys } from "@/lib/queryKeys";
import { toast } from "sonner";

/**
 * REALTIME-1: Multi-Device Sync with Supabase Realtime
 *
 * Subscribes to Supabase Realtime channels for live updates
 * across multiple devices. When data changes on one device,
 * all other devices automatically refresh their React Query cache.
 */

/** Tables to watch for changes. Use filterColumn when table uses landlord_id instead of user_id. */
const WATCHED_TABLES = [
  { table: "properties", queryKey: queryKeys.properties.all, label: "Objekt", filterColumn: "user_id" },
  { table: "tenants", queryKey: ["tenants"], label: "Mieter", filterColumn: "landlord_id" },
  { table: "loans", queryKey: queryKeys.loans.all, label: "Darlehen", filterColumn: "user_id" },
  { table: "todos", queryKey: ["todos"], label: "Aufgabe", filterColumn: "user_id" },
  { table: "tickets", queryKey: ["tickets"], label: "Ticket", filterColumn: "landlord_id" },
  { table: "deals", queryKey: queryKeys.deals.all, label: "Deal", filterColumn: "user_id" },
  { table: "contacts", queryKey: queryKeys.contacts.all, label: "Kontakt", filterColumn: "user_id" },
  { table: "rent_payments", queryKey: ["mietuebersicht_payments"], label: "Mietzahlung", filterColumn: "landlord_id" },
  { table: "messages", queryKey: ["messages"], label: "Nachricht", filterColumn: "sender_id" },
  { table: "documents", queryKey: ["documents"], label: "Dokument", filterColumn: "user_id" },
  { table: "maintenance_items", queryKey: queryKeys.maintenance.all, label: "Wartung", filterColumn: "user_id" },
  { table: "contracts", queryKey: ["vertraege_stats"], label: "Vertrag", filterColumn: "user_id" },
  { table: "service_contracts", queryKey: queryKeys.serviceContracts.all, label: "Dienstleister", filterColumn: "user_id" },
  { table: "invoices", queryKey: queryKeys.invoices.all, label: "Rechnung", filterColumn: "user_id" },
] as const;

interface RealtimeEvent {
  eventType: "INSERT" | "UPDATE" | "DELETE";
  table: string;
}

export function useRealtimeSync(showToasts = false) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const isSubscribed = useRef(false);

  useEffect(() => {
    if (!user || isSubscribed.current) return;

    /* REALTIME-2: Create a single channel for all table subscriptions */
    const channel = supabase.channel("immocontrol-realtime", {
      config: { broadcast: { self: false } },
    });

    /* REALTIME-3: Subscribe to each watched table (landlord_id for tenants, rent_payments, tickets) */
    for (const { table, queryKey, label, filterColumn } of WATCHED_TABLES) {
      channel.on(
        "postgres_changes" as "system",
        {
          event: "*",
          schema: "public",
          table,
          filter: `${filterColumn}=eq.${user.id}`,
        } as Record<string, string>,
        (payload: RealtimeEvent) => {
          /* REALTIME-4: Invalidate React Query cache for the affected table */
          qc.invalidateQueries({ queryKey });

          /* REALTIME-5: Show toast notification for changes from other devices */
          if (showToasts) {
            const action = payload.eventType === "INSERT"
              ? "hinzugefügt"
              : payload.eventType === "UPDATE"
                ? "aktualisiert"
                : "gelöscht";
            toast.info(`${label} ${action} (anderes Gerät)`, {
              duration: 3000,
              position: "bottom-right",
            });
          }
        },
      );
    }

    /* REALTIME-6: Subscribe to the channel */
    channel.subscribe((status) => {
      if (status === "SUBSCRIBED") {
        isSubscribed.current = true;
        channelRef.current = channel;
      }
    });

    /* Cleanup on unmount */
    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
        isSubscribed.current = false;
      }
    };
  }, [user, qc, showToasts]);

  return { isSubscribed: isSubscribed.current };
}
