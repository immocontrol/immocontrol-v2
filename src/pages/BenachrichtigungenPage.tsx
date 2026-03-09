/**
 * Benachrichtigungen / Alarm-System — Fristen, Zahlungen,
 * Darlehen, offene Aufgaben.
 */
import { useEffect } from "react";
import { Link } from "react-router-dom";
import { Bell, Calendar, Landmark, FileText, ShieldAlert, Receipt } from "lucide-react";
import FristenZentrale from "@/components/FristenZentrale";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { ROUTES } from "@/lib/routes";
import { formatDate } from "@/lib/formatters";
import { queryKeys } from "@/lib/queryKeys";
import { Button } from "@/components/ui/button";

const BenachrichtigungenPage = () => {
  const { user } = useAuth();

  const { data: notifications = [] } = useQuery({
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
        return data || [];
      } catch {
        return [];
      }
    },
    enabled: !!user,
  });

  const unreadCount = notifications.filter((n) => !n.read_at).length;

  useEffect(() => {
    document.title = "Benachrichtigungen – ImmoControl";
  }, []);

  return (
    <div className="space-y-6 max-w-3xl mx-auto px-4 py-6" role="main" aria-label="Benachrichtigungen">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold tracking-tight flex items-center gap-2">
          <Bell className="h-5 w-5 sm:h-6 sm:w-6 text-primary" /> Benachrichtigungen
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Fristen, Zahlungen, Darlehen — alles im Blick
        </p>
      </div>

      <section aria-label="Fristen-Zentrale">
        <h2 className="text-sm font-semibold flex items-center gap-2 mb-3">
          <Calendar className="h-4 w-4" /> Fristen
        </h2>
        <FristenZentrale />
      </section>

      {notifications.length > 0 && (
        <section aria-label="System-Benachrichtigungen">
          <h2 className="text-sm font-semibold flex items-center gap-2 mb-3">
            <Bell className="h-4 w-4" />
            Mitteilungen
            {unreadCount > 0 && (
              <span className="text-xs bg-primary text-primary-foreground px-1.5 py-0.5 rounded-full">
                {unreadCount}
              </span>
            )}
          </h2>
          <div className="space-y-2 rounded-xl border border-border divide-y divide-border">
            {notifications.map((n) => (
              <div
                key={n.id}
                className={`p-3 text-sm ${!n.read_at ? "bg-primary/5" : ""}`}
              >
                <p className="font-medium">{n.title}</p>
                {n.body && <p className="text-muted-foreground text-xs mt-0.5">{n.body}</p>}
                <p className="text-[10px] text-muted-foreground mt-1">{formatDate(n.created_at)}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      <div className="flex flex-wrap gap-2">
        <Button variant="outline" size="sm" asChild>
          <Link to={ROUTES.LOANS} className="gap-1.5 touch-target min-h-[36px]">
            <Landmark className="h-3.5 w-3.5" /> Darlehen
          </Link>
        </Button>
        <Button variant="outline" size="sm" asChild>
          <Link to={ROUTES.CONTRACTS} className="gap-1.5 touch-target min-h-[36px]" aria-label="Verträge">
            <Calendar className="h-3.5 w-3.5" /> Verträge
          </Link>
        </Button>
        <Button variant="outline" size="sm" asChild>
          <Link to={ROUTES.DOKUMENTE} className="gap-1.5 touch-target min-h-[36px]">
            <FileText className="h-3.5 w-3.5" /> Dokumente
          </Link>
        </Button>
        <Button variant="outline" size="sm" asChild>
          <Link to={ROUTES.STRESS_TEST} className="gap-1.5 touch-target min-h-[36px]" aria-label="Stress-Test">
            <ShieldAlert className="h-3.5 w-3.5" /> Stress-Test
          </Link>
        </Button>
        <Button variant="outline" size="sm" asChild>
          <Link to={ROUTES.STEUER_COCKPIT} className="gap-1.5 touch-target min-h-[36px]" aria-label="Steuer-Cockpit">
            <Receipt className="h-3.5 w-3.5" /> Steuer-Cockpit
          </Link>
        </Button>
      </div>
    </div>
  );
};

export default BenachrichtigungenPage;
