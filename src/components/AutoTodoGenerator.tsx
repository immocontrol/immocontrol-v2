/**
 * IMP20-13: Automatische Todo-Generierung
 * From DocumentExpiryTracker, MaintenancePlanner, ContractLifecycle.
 * Auto-create todos in Todo system.
 */
import { memo, useMemo } from "react";
import { ListTodo, FileWarning, Wrench, FileText, Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

interface GeneratedTodo {
  title: string;
  source: "document" | "maintenance" | "contract";
  sourceId: string;
  priority: "high" | "medium" | "low";
  dueDate: string;
}

const AutoTodoGenerator = memo(() => {
  const { user } = useAuth();
  const qc = useQueryClient();

  // Fetch expiring documents
  const { data: expiringDocs = [] } = useQuery({
    queryKey: ["auto_todo_docs"],
    queryFn: async () => {
      const in30Days = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);
      const { data } = await supabase
        .from("document_expiries")
        .select("*")
        .lte("expiry_date", in30Days)
        .gte("expiry_date", new Date().toISOString().slice(0, 10));
      return (data || []) as Array<{ id: string; document_name: string; expiry_date: string; property_id: string }>;
    },
    enabled: !!user,
  });

  // Fetch due maintenance
  const { data: dueMaintenance = [] } = useQuery({
    queryKey: ["auto_todo_maintenance"],
    queryFn: async () => {
      const in30Days = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);
      const { data } = await supabase
        .from("maintenance_items")
        .select("*")
        .lte("next_due_date", in30Days)
        .eq("status", "pending");
      return (data || []) as Array<{ id: string; title: string; next_due_date: string; estimated_cost: number }>;
    },
    enabled: !!user,
  });

  const suggestedTodos = useMemo((): GeneratedTodo[] => {
    const todos: GeneratedTodo[] = [];

    expiringDocs.forEach(doc => {
      const daysLeft = Math.ceil((new Date(doc.expiry_date).getTime() - Date.now()) / 86400000);
      todos.push({
        title: `Dokument erneuern: ${doc.document_name}`,
        source: "document",
        sourceId: doc.id,
        priority: daysLeft <= 7 ? "high" : daysLeft <= 14 ? "medium" : "low",
        dueDate: doc.expiry_date,
      });
    });

    dueMaintenance.forEach(m => {
      const daysLeft = Math.ceil((new Date(m.next_due_date).getTime() - Date.now()) / 86400000);
      todos.push({
        title: `Wartung durchführen: ${m.title}`,
        source: "maintenance",
        sourceId: m.id,
        priority: daysLeft <= 7 ? "high" : "medium",
        dueDate: m.next_due_date,
      });
    });

    return todos.sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());
  }, [expiringDocs, dueMaintenance]);

  const createTodoMutation = useMutation({
    mutationFn: async (todo: GeneratedTodo) => {
      if (!user) throw new Error("Not authenticated");
      const { error } = await supabase.from("todos").insert({
        user_id: user.id,
        title: todo.title,
        due_date: todo.dueDate,
        priority: todo.priority,
        status: "open",
        category: todo.source === "document" ? "Dokumente" : todo.source === "maintenance" ? "Wartung" : "Verträge",
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["todos"] });
      toast.success("Todo erstellt");
    },
    onError: () => toast.error("Fehler beim Erstellen"),
  });

  const createAllTodos = async () => {
    let count = 0;
    for (const todo of suggestedTodos) {
      try {
        if (!user) throw new Error("Not authenticated");
        const { error } = await supabase.from("todos").insert({
          user_id: user.id,
          title: todo.title,
          due_date: todo.dueDate,
          priority: todo.priority,
          status: "open",
          category: todo.source === "document" ? "Dokumente" : todo.source === "maintenance" ? "Wartung" : "Verträge",
        });
        if (!error) count++;
      } catch { /* skip */ }
    }
    if (count > 0) {
      qc.invalidateQueries({ queryKey: ["todos"] });
      toast.success(`${count} Todos automatisch erstellt`);
    }
  };

  if (suggestedTodos.length === 0) return null;

  const sourceIcon = (source: string) => {
    switch (source) {
      case "document": return <FileWarning className="h-3 w-3 text-gold" />;
      case "maintenance": return <Wrench className="h-3 w-3 text-primary" />;
      case "contract": return <FileText className="h-3 w-3 text-blue-500" />;
      default: return <ListTodo className="h-3 w-3" />;
    }
  };

  return (
    <div className="gradient-card rounded-xl border border-border p-4 animate-fade-in">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <ListTodo className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-semibold">Auto-Todo Vorschläge</h3>
          <Badge variant="outline" className="text-[10px] h-5">{suggestedTodos.length}</Badge>
        </div>
        <Button variant="outline" size="sm" className="text-xs h-7 gap-1" onClick={createAllTodos}>
          <Plus className="h-3 w-3" /> Alle erstellen
        </Button>
      </div>

      <div className="space-y-1.5 max-h-[200px] overflow-y-auto">
        {suggestedTodos.map((todo, i) => {
          const daysLeft = Math.ceil((new Date(todo.dueDate).getTime() - Date.now()) / 86400000);
          return (
            <div key={i} className="flex items-center gap-2 p-2 rounded-lg bg-background/50 text-xs">
              {sourceIcon(todo.source)}
              <span className="flex-1 truncate">{todo.title}</span>
              <Badge
                variant={todo.priority === "high" ? "destructive" : "outline"}
                className="text-[9px] h-4"
              >
                {daysLeft}d
              </Badge>
              <Button
                variant="ghost"
                size="icon"
                className="h-5 w-5"
                onClick={() => createTodoMutation.mutate(todo)}
              >
                <Plus className="h-3 w-3" />
              </Button>
            </div>
          );
        })}
      </div>
    </div>
  );
});
AutoTodoGenerator.displayName = "AutoTodoGenerator";

export { AutoTodoGenerator };
