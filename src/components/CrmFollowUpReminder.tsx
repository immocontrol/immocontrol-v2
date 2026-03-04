/**
 * IMP20-14: CRM Follow-Up Erinnerungen
 * If CRM contact not contacted for X days → auto-create todo.
 * Configurable per contact category.
 */
import { memo, useMemo, useState } from "react";
import { Users, Clock, Bell, Plus, Check } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

interface CrmContact {
  id: string;
  name: string;
  category: string;
  last_contact_date: string | null;
  email: string | null;
  phone: string | null;
}

const FOLLOW_UP_DAYS: Record<string, number> = {
  "Makler": 14,
  "Handwerker": 30,
  "Verwalter": 21,
  "Mieter": 30,
  "Bank": 30,
  "Steuerberater": 60,
  "default": 30,
};

const CrmFollowUpReminder = memo(() => {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [createdIds, setCreatedIds] = useState<Set<string>>(new Set());

  const { data: contacts = [] } = useQuery({
    queryKey: ["crm_followup_contacts"],
    queryFn: async () => {
      const { data } = await supabase
        .from("crm_contacts")
        .select("id, name, category, last_contact_date, email, phone")
        .order("last_contact_date", { ascending: true, nullsFirst: true });
      return (data || []) as CrmContact[];
    },
    enabled: !!user,
  });

  const overdueContacts = useMemo(() => {
    const now = Date.now();
    return contacts
      .filter(c => {
        if (!c.last_contact_date) return true; // Never contacted
        const daysSince = Math.floor((now - new Date(c.last_contact_date).getTime()) / 86400000);
        const threshold = FOLLOW_UP_DAYS[c.category] || FOLLOW_UP_DAYS["default"];
        return daysSince >= threshold;
      })
      .map(c => {
        const daysSince = c.last_contact_date
          ? Math.floor((now - new Date(c.last_contact_date).getTime()) / 86400000)
          : 999;
        return { ...c, daysSince };
      })
      .sort((a, b) => b.daysSince - a.daysSince)
      .slice(0, 10);
  }, [contacts]);

  const createFollowUpTodo = useMutation({
    mutationFn: async (contact: CrmContact & { daysSince: number }) => {
      if (!user) throw new Error("Not authenticated");
      const { error } = await supabase.from("todos").insert({
        user_id: user.id,
        title: `Follow-Up: ${contact.name} kontaktieren`,
        due_date: new Date().toISOString().slice(0, 10),
        priority: contact.daysSince > 60 ? "high" : "medium",
        status: "open",
        category: "CRM",
      });
      if (error) throw error;
    },
    onSuccess: (_data, contact) => {
      qc.invalidateQueries({ queryKey: ["todos"] });
      setCreatedIds(prev => new Set([...prev, contact.id]));
      toast.success(`Todo erstellt: ${contact.name} kontaktieren`);
    },
    onError: () => toast.error("Fehler beim Erstellen"),
  });

  if (overdueContacts.length === 0) return null;

  return (
    <div className="gradient-card rounded-xl border border-border p-4 animate-fade-in">
      <div className="flex items-center gap-2 mb-3">
        <Users className="h-4 w-4 text-primary" />
        <h3 className="text-sm font-semibold">CRM Follow-Up</h3>
        <Badge variant="outline" className="text-[10px] h-5">{overdueContacts.length} überfällig</Badge>
      </div>

      <div className="space-y-1.5 max-h-[200px] overflow-y-auto">
        {overdueContacts.map(c => (
          <div key={c.id} className="flex items-center gap-2 p-2 rounded-lg bg-background/50 text-xs">
            <Clock className={`h-3 w-3 shrink-0 ${c.daysSince > 60 ? "text-loss" : c.daysSince > 30 ? "text-gold" : "text-muted-foreground"}`} />
            <div className="flex-1 min-w-0">
              <span className="font-medium truncate block">{c.name}</span>
              <span className="text-[10px] text-muted-foreground">
                {c.category} · {c.daysSince === 999 ? "Nie kontaktiert" : `${c.daysSince}d her`}
              </span>
            </div>
            {createdIds.has(c.id) ? (
              <Check className="h-3.5 w-3.5 text-profit shrink-0" />
            ) : (
              <Button
                variant="ghost"
                size="icon"
                className="h-5 w-5 shrink-0"
                onClick={() => createFollowUpTodo.mutate(c)}
              >
                <Bell className="h-3 w-3" />
              </Button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
});
CrmFollowUpReminder.displayName = "CrmFollowUpReminder";

export { CrmFollowUpReminder };
