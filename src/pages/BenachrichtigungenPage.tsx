/**
 * Benachrichtigungen / Alarm-System — Fristen, Zahlungen,
 * Darlehen, offene Aufgaben.
 */
import { useEffect, useCallback } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Bell, Calendar, Landmark, FileText, ShieldAlert, Receipt, CheckCheck } from "lucide-react";
import FristenZentrale from "@/components/FristenZentrale";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { ROUTES } from "@/lib/routes";
import { formatDate } from "@/lib/formatters";
import { queryKeys } from "@/lib/queryKeys";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/EmptyState";

type NotificationRow = {
  id: string;
  title: string;
  body: string | null;
  link: string | null;
  read_at: string | null;
  created_at: string;
};

const BenachrichtigungenPage = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: notifications = [], isLoading } = useQuery({
    queryKey: queryKeys.userNotifications.all(user?.id ?? ""),
    queryFn: async () => {
      try {
        const { data, error } = await supabase
          .from("user_notifications")
          .select("*")
          .eq("user_id", user!.id)
          .order("created_at", { ascending: false })
          .limit(50);
        if (error) return [];
        return (data || []) as NotificationRow[];
      } catch {
        return [];
      }
    },
    enabled: !!user,
  });

  const markReadMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("user_notifications")
        .update({ read_at: new Date().toISOString() })
        .eq("id", id)
        .eq("user_id", user!.id);
      if (error) throw error;
    },
    onSuccess: (_, id) => {
      queryClient.setQueryData<NotificationRow[]>(
        queryKeys.userNotifications.all(user?.id ?? ""),
        (prev) => (prev || []).map((n) => (n.id === id ? { ...n, read_at: new Date().toISOString() } : n))
      );
    },
  });

  const markAllReadMutation = useMutation({
    mutationFn: async () => {
      const unreadIds = notifications.filter((n) => !n.read_at).map((n) => n.id);
      if (unreadIds.length === 0) return;
      const { error } = await supabase
        .from("user_notifications")
        .update({ read_at: new Date().toISOString() })
        .in("id", unreadIds)
        .eq("user_id", user!.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.setQueryData<NotificationRow[]>(
        queryKeys.userNotifications.all(user?.id ?? ""),
        (prev) => (prev || []).map((n) => ({ ...n, read_at: n.read_at ?? new Date().toISOString() }))
      );
    },
  });

  const handleNotificationClick = useCallback(
    (n: NotificationRow) => {
      if (!n.read_at) markReadMutation.mutate(n.id);
      if (n.link) navigate(n.link);
    },
    [markReadMutation, navigate]
  );

  const unreadCount = notifications.filter((n) => !n.read_at).length;

  useEffect(() => {
    document.title = "Benachrichtigungen – ImmoControl";
  }, []);

  return (
    <div className="space-y-6 max-w-3xl mx-auto px-4 py-6 min-w-0" role="main" aria-label="Benachrichtigungen">
      <div className="min-w-0">
        <h1 className="text-xl sm:text-2xl font-bold tracking-tight flex items-center gap-2">
          <Bell className="h-5 w-5 sm:h-6 sm:w-6 text-primary shrink-0" /> Benachrichtigungen
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Fristen, Zahlungen, Darlehen — alles im Blick
        </p>
      </div>

      <section aria-label="Fristen-Zentrale" className="min-w-0">
        <h2 className="text-sm font-semibold flex items-center gap-2 mb-3">
          <Calendar className="h-4 w-4 shrink-0" /> Fristen
        </h2>
        <FristenZentrale />
      </section>

      <section aria-label="Mitteilungen" className="min-w-0">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
          <h2 className="text-sm font-semibold flex items-center gap-2">
            <Bell className="h-4 w-4 shrink-0" />
            Mitteilungen
            {unreadCount > 0 && (
              <span className="text-xs bg-primary text-primary-foreground px-1.5 py-0.5 rounded-full" aria-live="polite">
                {unreadCount}
              </span>
            )}
          </h2>
          {unreadCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="gap-1.5 touch-target min-h-[36px] text-muted-foreground"
              onClick={() => markAllReadMutation.mutate()}
              disabled={markAllReadMutation.isPending}
              aria-label="Alle als gelesen markieren"
            >
              <CheckCheck className="h-3.5 w-3.5" /> Alle gelesen
            </Button>
          )}
        </div>

        {isLoading ? (
          <div className="rounded-xl border border-border divide-y divide-border" role="status" aria-label="Mitteilungen werden geladen">
            <div className="p-3 h-14 bg-muted/30 animate-pulse rounded-t-xl" />
            <div className="p-3 h-14 bg-muted/20 animate-pulse" />
            <div className="p-3 h-14 bg-muted/20 animate-pulse rounded-b-xl" />
          </div>
        ) : notifications.length === 0 ? (
          <EmptyState
            icon={Bell}
            title="Keine Mitteilungen"
            description="Fristen und Erinnerungen erscheinen hier. Verwalte Benachrichtigungskanäle in den Einstellungen."
            action={
              <Button variant="outline" size="sm" asChild className="touch-target min-h-[44px]">
                <Link to={ROUTES.SETTINGS}>Einstellungen</Link>
              </Button>
            }
          />
        ) : (
          <div className="rounded-xl border border-border divide-y divide-border">
            {notifications.map((n) => (
              <button
                type="button"
                key={n.id}
                onClick={() => handleNotificationClick(n)}
                className={`w-full text-left p-3 text-sm transition-colors hover:bg-muted/30 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring ${!n.read_at ? "bg-primary/5" : ""}`}
                aria-label={n.read_at ? n.title : `${n.title}, ungelesen`}
              >
                <p className="font-medium text-wrap-safe break-words">{n.title}</p>
                {n.body && <p className="text-muted-foreground text-xs mt-0.5 text-wrap-safe break-words">{n.body}</p>}
                <p className="text-[10px] text-muted-foreground mt-1">{formatDate(n.created_at)}</p>
              </button>
            ))}
          </div>
        )}
      </section>

      <div className="flex flex-wrap gap-2 min-w-0">
        <Button variant="outline" size="sm" asChild>
          <Link to={ROUTES.LOANS} className="gap-1.5 touch-target min-h-[36px]">
            <Landmark className="h-3.5 w-3.5 shrink-0" /> Darlehen
          </Link>
        </Button>
        <Button variant="outline" size="sm" asChild>
          <Link to={ROUTES.CONTRACTS} className="gap-1.5 touch-target min-h-[36px]" aria-label="Verträge">
            <Calendar className="h-3.5 w-3.5 shrink-0" /> Verträge
          </Link>
        </Button>
        <Button variant="outline" size="sm" asChild>
          <Link to={ROUTES.DOKUMENTE} className="gap-1.5 touch-target min-h-[36px]">
            <FileText className="h-3.5 w-3.5 shrink-0" /> Dokumente
          </Link>
        </Button>
        <Button variant="outline" size="sm" asChild>
          <Link to={ROUTES.STRESS_TEST} className="gap-1.5 touch-target min-h-[36px]" aria-label="Stress-Test">
            <ShieldAlert className="h-3.5 w-3.5 shrink-0" /> Stress-Test
          </Link>
        </Button>
        <Button variant="outline" size="sm" asChild>
          <Link to={ROUTES.STEUER_COCKPIT} className="gap-1.5 touch-target min-h-[36px]" aria-label="Steuer-Cockpit">
            <Receipt className="h-3.5 w-3.5 shrink-0" /> Steuer-Cockpit
          </Link>
        </Button>
      </div>
    </div>
  );
};

export default BenachrichtigungenPage;
