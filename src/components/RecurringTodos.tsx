/**
 * #13: Wiederkehrende Aufgaben — Todos die sich automatisch wiederholen
 */
import { useState, useCallback, useMemo } from "react";
import { Repeat, Plus, Trash2, Calendar, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

interface RecurringTask {
  id: string;
  title: string;
  interval: "daily" | "weekly" | "monthly" | "quarterly" | "yearly";
  nextDue: string;
  lastCreated: string | null;
  active: boolean;
}

const STORAGE_KEY = "immo-recurring-todos";
const INTERVAL_LABELS: Record<string, string> = {
  daily: "Täglich",
  weekly: "Wöchentlich",
  monthly: "Monatlich",
  quarterly: "Quartalsweise",
  yearly: "Jährlich",
};

function loadRecurring(): RecurringTask[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch { return []; }
}

function saveRecurring(tasks: RecurringTask[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
}

function getNextDate(interval: RecurringTask["interval"], from: string): string {
  const d = new Date(from);
  switch (interval) {
    case "daily": d.setDate(d.getDate() + 1); break;
    case "weekly": d.setDate(d.getDate() + 7); break;
    case "monthly": d.setMonth(d.getMonth() + 1); break;
    case "quarterly": d.setMonth(d.getMonth() + 3); break;
    case "yearly": d.setFullYear(d.getFullYear() + 1); break;
  }
  return d.toISOString().split("T")[0];
}

interface RecurringTodosProps {
  onCreateTodo?: (title: string, dueDate: string) => void;
}

export function RecurringTodos({ onCreateTodo }: RecurringTodosProps) {
  const [tasks, setTasks] = useState<RecurringTask[]>(loadRecurring);
  const [showAdd, setShowAdd] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newInterval, setNewInterval] = useState<RecurringTask["interval"]>("monthly");

  const today = new Date().toISOString().split("T")[0];

  const dueTasks = useMemo(
    () => tasks.filter(t => t.active && t.nextDue <= today),
    [tasks, today]
  );

  const addTask = useCallback(() => {
    if (!newTitle.trim()) return;
    const task: RecurringTask = {
      id: `rec_${Date.now()}`,
      title: newTitle.trim(),
      interval: newInterval,
      nextDue: today,
      lastCreated: null,
      active: true,
    };
    const next = [...tasks, task];
    setTasks(next);
    saveRecurring(next);
    setNewTitle("");
    setShowAdd(false);
    toast.success("Wiederkehrende Aufgabe angelegt");
  }, [newTitle, newInterval, tasks, today]);

  const triggerTask = useCallback((taskId: string) => {
    setTasks(prev => {
      const next = prev.map(t => {
        if (t.id !== taskId) return t;
        const nextDue = getNextDate(t.interval, today);
        onCreateTodo?.(t.title, today);
        return { ...t, nextDue, lastCreated: today };
      });
      saveRecurring(next);
      return next;
    });
    toast.success("Aufgabe erstellt — nächste am neuen Datum");
  }, [today, onCreateTodo]);

  const deleteTask = useCallback((id: string) => {
    const next = tasks.filter(t => t.id !== id);
    setTasks(next);
    saveRecurring(next);
    toast.success("Wiederkehrende Aufgabe gelöscht");
  }, [tasks]);

  const toggleActive = useCallback((id: string) => {
    setTasks(prev => {
      const next = prev.map(t => t.id === id ? { ...t, active: !t.active } : t);
      saveRecurring(next);
      return next;
    });
  }, []);

  return (
    <div className="gradient-card rounded-xl border border-border p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold flex items-center gap-2">
          <Repeat className="h-4 w-4 text-primary" />
          Wiederkehrende Aufgaben
        </h3>
        <span className="text-[10px] px-2 py-0.5 rounded-full bg-secondary text-muted-foreground">
          {tasks.filter(t => t.active).length} aktiv
        </span>
      </div>

      {/* Due tasks alert */}
      {dueTasks.length > 0 && (
        <div className="mb-3 p-2.5 rounded-lg bg-gold/10 border border-gold/20">
          <p className="text-xs font-medium text-gold flex items-center gap-1.5">
            <Clock className="h-3.5 w-3.5" />
            {dueTasks.length} Aufgabe{dueTasks.length > 1 ? "n" : ""} fällig
          </p>
          <div className="space-y-1 mt-2">
            {dueTasks.map(t => (
              <div key={t.id} className="flex items-center justify-between text-xs">
                <span className="truncate">{t.title}</span>
                <Button size="sm" variant="outline" className="h-6 text-[10px]" onClick={() => triggerTask(t.id)}>
                  Erstellen
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Task list */}
      <div className="space-y-1.5">
        {tasks.map(t => (
          <div key={t.id} className={`flex items-center gap-2 p-2 rounded-lg ${t.active ? "bg-secondary/30" : "bg-secondary/10 opacity-60"}`}>
            <button onClick={() => toggleActive(t.id)} className="shrink-0">
              <div className={`w-3 h-3 rounded-full border-2 ${t.active ? "border-primary bg-primary" : "border-border"}`} />
            </button>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium truncate">{t.title}</p>
              <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                {INTERVAL_LABELS[t.interval]} · Nächste: {new Date(t.nextDue).toLocaleDateString("de-DE")}
              </p>
            </div>
            <button onClick={() => deleteTask(t.id)} className="p-1 rounded hover:bg-secondary shrink-0">
              <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
            </button>
          </div>
        ))}
      </div>

      {/* Add new */}
      {showAdd ? (
        <div className="mt-3 space-y-2">
          <Input
            value={newTitle}
            onChange={e => setNewTitle(e.target.value)}
            placeholder="Aufgabe..."
            className="text-xs h-8"
            onKeyDown={e => e.key === "Enter" && addTask()}
            autoFocus
          />
          <div className="flex gap-2">
            <Select value={newInterval} onValueChange={(v) => setNewInterval(v as RecurringTask["interval"])}>
              <SelectTrigger className="h-8 text-xs flex-1 min-w-0">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(INTERVAL_LABELS).map(([k, v]) => (
                  <SelectItem key={k} value={k}>{v}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button size="sm" onClick={addTask} className="text-xs h-7">Anlegen</Button>
            <Button size="sm" variant="outline" onClick={() => setShowAdd(false)} className="text-xs h-7">Abbrechen</Button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setShowAdd(true)}
          className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors w-full justify-center py-2 rounded-lg border border-dashed border-border hover:border-primary/30"
        >
          <Plus className="h-3.5 w-3.5" />
          Neue wiederkehrende Aufgabe
        </button>
      )}
    </div>
  );
}

export default RecurringTodos;
