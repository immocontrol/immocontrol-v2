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

/** Tables to watch for changes */
const WATCHED_TABLES = [
  { table: "properties", queryKey: queryKeys.properties.all, label: "Objekt" },
  { table: "tenants", queryKey: ["tenants"], label: "Mieter" },
  { table: "loans", queryKey: ["loans"], label: "Darlehen" },
  { table: "todos", queryKey: ["todos"], label: "Aufgabe" },
  { table: "tickets", queryKey: ["tickets"], label: "Ticket" },
  { table: "deals", queryKey: ["deals"], label: "Deal" },
  { table: "contacts", queryKey: ["contacts"], label: "Kontakt" },
  { table: "rent_payments", queryKey: ["rent_payments"], label: "Mietzahlung" },
  { table: "messages", queryKey: ["messages"], label: "Nachricht" },
  { table: "documents", queryKey: ["documents"], label: "Dokument" },
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

    /* REALTIME-3: Subscribe to each watched table */
    for (const { table, queryKey, label } of WATCHED_TABLES) {
      channel.on(
        "postgres_changes" as "system",
        {
          event: "*",
          schema: "public",
          table,
          filter: `user_id=eq.${user.id}`,
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
