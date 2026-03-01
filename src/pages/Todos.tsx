import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import {
  CheckSquare, Plus, Trash2, Circle, CheckCircle2, Flag, Calendar, Tag,
  ChevronDown, ChevronRight, Inbox, Star, AlignLeft, X, Clock, Search,
  LayoutList, CalendarDays, MoreHorizontal, Edit2, CheckCheck, Trash,
} from "lucide-react";
import TodoStats from "@/components/TodoStats";
import TodoCalendarSync from "@/components/TodoCalendarSync";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/queryKeys";
import { toast } from "sonner";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

interface Todo {
  id: string;
  user_id: string;
  title: string;
  description: string;
  due_date: string | null;
  due_time: string | null;
  priority: number;
  completed: boolean;
  completed_at: string | null;
  project: string;
  labels: string[];
  sort_order: number;
  created_at: string;
  updated_at: string;
}

type ViewType = "inbox" | "today" | "upcoming" | "completed";
type PriorityFilter = "all" | 1 | 2 | 3 | 4;

const PRIORITY_CONFIG: Record<number, { label: string; color: string; icon: string }> = {
  1: { label: "Dringend", color: "text-red-500", icon: "🔴" },
  2: { label: "Hoch", color: "text-orange-500", icon: "🟠" },
  3: { label: "Mittel", color: "text-yellow-500", icon: "🟡" },
  4: { label: "Normal", color: "text-muted-foreground", icon: "⚪" },
};

const isToday = (dateStr: string) => {
  const today = new Date().toISOString().split("T")[0];
  return dateStr === today;
};

const isUpcoming = (dateStr: string) => {
  const today = new Date().toISOString().split("T")[0];
  return dateStr > today;
};

const isOverdue = (dateStr: string) => {
  const today = new Date().toISOString().split("T")[0];
  return dateStr < today;
};

// Feature: Due date countdown
const getDaysUntil = (dateStr: string): number => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(dateStr);
  return Math.ceil((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
};

const formatDueDate = (dateStr: string) => {
  const today = new Date().toISOString().split("T")[0];
  const tomorrow = new Date(Date.now() + 86400000).toISOString().split("T")[0];
  if (dateStr === today) return "Heute";
  if (dateStr === tomorrow) return "Morgen";
  const days = getDaysUntil(dateStr);
  if (days < 0) return `${Math.abs(days)}d überfällig`;
  if (days <= 7) return `in ${days}d`;
  return new Date(dateStr).toLocaleDateString("de-DE", { day: "2-digit", month: "short" });
};

const emptyForm = {
  title: "",
  description: "",
  due_date: "",
  due_time: "",
  priority: 4,
  project: "",
  labels: [] as string[],
};

const Todos = () => {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [view, setView] = useState<ViewType>("inbox");
  const [search, setSearch] = useState("");
  const [expandedProjects, setExpandedProjects] = useState<Record<string, boolean>>({});
  const [quickInput, setQuickInput] = useState("");
  const [editTodo, setEditTodo] = useState<Todo | null>(null);
  const [editForm, setEditForm] = useState(emptyForm);
  const [showCompleted, setShowCompleted] = useState(false);
  const [priorityFilter, setPriorityFilter] = useState<PriorityFilter>("all");
  const quickInputRef = useRef<HTMLInputElement>(null);

  // Document title
  useEffect(() => { document.title = "Aufgaben – ImmoControl"; }, []);

  const { data: todos = [], isLoading } = useQuery<Todo[]>({
    queryKey: queryKeys.todos.all(user?.id ?? ""),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("todos" as any)
        .select("id, user_id, title, description, due_date, due_time, priority, completed, completed_at, project, labels, sort_order, created_at, updated_at")
        .order("priority", { ascending: true })
        .order("sort_order", { ascending: true })
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as Todo[];
    },
    enabled: !!user,
  });

  const addMutation = useMutation({
    mutationFn: async (title: string) => {
      if (!user) throw new Error("Not authenticated");
      const { error } = await supabase.from("todos" as any).insert({
        user_id: user.id,
        title: title.trim(),
        priority: 4,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.todos.all(user?.id ?? "") });
      setQuickInput("");
    },
    onError: () => toast.error("Fehler beim Anlegen"),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<Todo> }) => {
      const { error } = await supabase.from("todos" as any).update({ ...updates, updated_at: new Date().toISOString() } as any).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.todos.all(user?.id ?? "") }),
    onError: () => toast.error("Fehler beim Aktualisieren"),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("todos" as any).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.todos.all(user?.id ?? "") });
      toast.success("Aufgabe gelöscht");
    },
    onError: () => toast.error("Fehler beim Löschen"),
  });

  const toggleComplete = useCallback((todo: Todo) => {
    updateMutation.mutate({
      id: todo.id,
      updates: {
        completed: !todo.completed,
        completed_at: todo.completed ? null : new Date().toISOString(),
      },
    });
  }, [updateMutation]);

  const openEdit = useCallback((todo: Todo) => {
    setEditTodo(todo);
    setEditForm({
      title: todo.title,
      description: todo.description ?? "",
      due_date: todo.due_date ?? "",
      due_time: todo.due_time ?? "",
      priority: todo.priority,
      project: todo.project ?? "",
      labels: todo.labels ?? [],
    });
  }, []);

  const saveEdit = useCallback(async () => {
    if (!editTodo || !editForm.title.trim()) return;
    await updateMutation.mutateAsync({
      id: editTodo.id,
      updates: {
        title: editForm.title.trim(),
        description: editForm.description,
        due_date: editForm.due_date || null,
        due_time: editForm.due_time || null,
        priority: editForm.priority,
        project: editForm.project,
        labels: editForm.labels,
      },
    });
    setEditTodo(null);
    toast.success("Gespeichert");
  }, [editTodo, editForm, updateMutation]);

  const handleQuickAdd = useCallback((e: React.KeyboardEvent) => {
    if (e.key === "Enter" && quickInput.trim()) {
      addMutation.mutate(quickInput);
    }
  }, [quickInput, addMutation]);

  const projects = useMemo(() => {
    const set = new Set(todos.filter(t => t.project).map(t => t.project));
    return Array.from(set).sort();
  }, [todos]);

  const projectCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    todos.forEach(t => {
      if (!t.completed && t.project) counts[t.project] = (counts[t.project] || 0) + 1;
    });
    return counts;
  }, [todos]);

  const filtered = useMemo(() => {
    let result = todos.filter(t => !t.completed);

    if (search) {
      const q = search.toLowerCase();
      result = result.filter(t => t.title.toLowerCase().includes(q) || t.description?.toLowerCase().includes(q));
    }

    // Feature: Priority filter
    if (priorityFilter !== "all") {
      result = result.filter(t => t.priority === priorityFilter);
    }

    switch (view) {
      case "today":
        return result.filter(t => t.due_date && isToday(t.due_date));
      case "upcoming":
        return result.filter(t => t.due_date && (isToday(t.due_date) || isUpcoming(t.due_date)));
      case "completed":
        return todos.filter(t => t.completed);
      default:
        return result;
    }
  }, [todos, view, search, priorityFilter]);

  const completedTodos = useMemo(() => todos.filter(t => t.completed).slice(0, 20), [todos]);

  const overdueCount = useMemo(
    () => todos.filter(t => !t.completed && t.due_date && isOverdue(t.due_date)).length,
    [todos]
  );

  const todayCount = useMemo(
    () => todos.filter(t => !t.completed && t.due_date && isToday(t.due_date)).length,
    [todos]
  );

  const inboxCount = useMemo(() => todos.filter(t => !t.completed).length, [todos]);

  /* FUNC-8: Todo completion rate tracking */
  const completionRate = useMemo(() => {
    const total = todos.length;
    const done = todos.filter(t => t.completed).length;
    return total > 0 ? Math.round((done / total) * 100) : 0;
  }, [todos]);

  /* FUNC-9: Average time to complete tasks */
  const avgCompletionDays = useMemo(() => {
    const completedWithDates = todos.filter(t => t.completed && t.completed_at && t.created_at);
    if (completedWithDates.length === 0) return 0;
    const totalDays = completedWithDates.reduce((s, t) => {
      const created = new Date(t.created_at).getTime();
      const completed = new Date(t.completed_at!).getTime();
      return s + (completed - created) / (1000 * 60 * 60 * 24);
    }, 0);
    return Math.round(totalDays / completedWithDates.length * 10) / 10;
  }, [todos]);

  /* FUNC-10: Upcoming deadlines (next 3 days) */
  const upcomingDeadlines = useMemo(() => {
    const threeDaysFromNow = new Date();
    threeDaysFromNow.setDate(threeDaysFromNow.getDate() + 3);
    const todayStr = new Date().toISOString().split("T")[0];
    const futureStr = threeDaysFromNow.toISOString().split("T")[0];
    return todos.filter(t => !t.completed && t.due_date && t.due_date >= todayStr && t.due_date <= futureStr);
  }, [todos]);

  /* OPT-13: Memoized project list with counts for sidebar */
  const projectsWithCounts = useMemo(() => {
    return projects.map(p => ({
      name: p,
      total: todos.filter(t => t.project === p).length,
      open: todos.filter(t => t.project === p && !t.completed).length,
    }));
  }, [projects, todos]);


  const groupedByProject = useMemo(() => {
    if (view !== "inbox") return null;
    const groups: Record<string, Todo[]> = { "": [] };
    filtered.forEach(t => {
      const key = t.project || "";
      if (!groups[key]) groups[key] = [];
      groups[key].push(t);
    });
    return groups;
  }, [filtered, view]);

  if (isLoading) {
    return (
      <div className="flex flex-col md:flex-row gap-4 sm:gap-6 h-[calc(100vh-8rem)]">
        <div className="hidden md:block w-56 shrink-0 space-y-2">
          {[1, 2, 3, 4].map(i => <div key={i} className="h-9 shimmer rounded-lg" />)}
        </div>
        <div className="flex-1 space-y-3">
          {[1, 2, 3, 4, 5].map(i => <div key={i} className="h-14 shimmer rounded-xl" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="flex gap-4 sm:gap-6 min-h-[calc(100vh-8rem)]">
      <aside className="hidden md:block w-56 shrink-0 space-y-1">
        <div className="mb-4">
          <h1 className="text-xl font-bold tracking-tight flex items-center gap-2">
            <CheckSquare className="h-5 w-5 text-primary" /> Aufgaben
          </h1>
        </div>

        {([
          { key: "inbox" as ViewType, label: "Eingang", icon: Inbox, count: inboxCount },
          { key: "today" as ViewType, label: "Heute", icon: Star, count: todayCount },
          { key: "upcoming" as ViewType, label: "Geplant", icon: CalendarDays, count: 0 },
          { key: "completed" as ViewType, label: "Erledigt", icon: CheckCircle2, count: completedTodos.length },
        ] as const).map(({ key, label, icon: Icon, count }) => (
          <button
            key={key}
            onClick={() => setView(key)}
            className={cn(
              "w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
              view === key
                ? "bg-primary/10 text-primary"
                : "text-muted-foreground hover:bg-secondary hover:text-foreground"
            )}
          >
            <Icon className="h-4 w-4 shrink-0" />
            <span className="flex-1 text-left">{label}</span>
            {count > 0 && (
              <span className={cn(
                "text-xs font-bold px-1.5 py-0.5 rounded-full min-w-[20px] text-center",
                key === "today" && count > 0 ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground"
              )}>
                {count}
              </span>
            )}
          </button>
        ))}

        {projects.length > 0 && (
          <div className="pt-4">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground px-3 mb-1">Projekte</p>
            {projects.map(proj => (
              <button
                key={proj}
                onClick={() => setView("inbox")}
                className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
              >
                <LayoutList className="h-4 w-4 shrink-0" />
                <span className="flex-1 text-left truncate">{proj}</span>
                <span className="text-xs text-muted-foreground">
                  {projectCounts[proj] || 0}
                </span>
              </button>
            ))}
          </div>
        )}
      </aside>

      <main className="flex-1 min-w-0 space-y-4">
        {/* Mobile view tabs */}
        <div className="flex md:hidden gap-1 bg-secondary/50 p-1 rounded-lg overflow-x-auto scrollbar-hide">
          {([
            { key: "inbox" as ViewType, label: "Eingang", count: inboxCount },
            { key: "today" as ViewType, label: "Heute", count: todayCount },
            { key: "upcoming" as ViewType, label: "Geplant", count: 0 },
            { key: "completed" as ViewType, label: "Erledigt", count: completedTodos.length },
          ]).map(({ key, label, count }) => (
            <button
              key={key}
              onClick={() => setView(key)}
              className={cn(
                "flex items-center gap-1 px-3 py-1.5 rounded-md text-xs font-medium transition-all whitespace-nowrap",
                view === key
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground"
              )}
            >
              {label}
              {count > 0 && <span className="text-[10px] bg-primary/10 text-primary px-1 rounded-full">{count}</span>}
            </button>
          ))}
        </div>

        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold hidden md:block">
              {view === "inbox" ? "Eingang" : view === "today" ? "Heute" : view === "upcoming" ? "Geplant" : "Erledigt"}
            </h2>
            {overdueCount > 0 && view !== "completed" && (
              <p className="text-xs text-red-500 mt-0.5 flex items-center gap-1"><Clock className="h-3 w-3" /> {overdueCount} überfällig</p>
            )}
          </div>
          <div className="flex items-center gap-2">
            <TodoCalendarSync todos={todos} />
            {/* Bulk actions */}
            {view === "inbox" && filtered.length > 0 && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="h-8 gap-1 text-xs">
                    <MoreHorizontal className="h-3.5 w-3.5" /> Aktionen
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => {
                    const uncompleted = filtered.filter(t => !t.completed);
                    uncompleted.forEach(t => updateMutation.mutate({ id: t.id, updates: { completed: true, completed_at: new Date().toISOString() } }));
                    toast.success(`${uncompleted.length} Aufgaben erledigt`);
                  }}>
                    <CheckCheck className="h-3.5 w-3.5 mr-2" /> Alle erledigen
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => {
                    const completed = todos.filter(t => t.completed);
                    completed.forEach(t => deleteMutation.mutate(t.id));
                    toast.success(`${completed.length} erledigte gelöscht`);
                  }} className="text-destructive">
                    <Trash className="h-3.5 w-3.5 mr-2" /> Erledigte löschen
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
            {/* Feature: Priority filter */}
            <div className="flex gap-1 mr-2">
              {([
                { key: "all" as PriorityFilter, label: "Alle" },
                { key: 1 as PriorityFilter, label: "🔴" },
                { key: 2 as PriorityFilter, label: "🟠" },
                { key: 3 as PriorityFilter, label: "🟡" },
              ]).map(f => (
                <button
                  key={String(f.key)}
                  onClick={() => setPriorityFilter(f.key)}
                  className={cn(
                    "text-[10px] px-2 py-1 rounded font-medium transition-colors",
                    priorityFilter === f.key ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-secondary"
                  )}
                >
                  {f.label}
                </button>
              ))}
            </div>
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder="Suchen..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="h-8 pl-8 w-32 sm:w-48 text-sm"
              />
            </div>
          </div>
        </div>

        <TodoStats todos={todos} />

        {view !== "completed" && (
          <div className="flex items-center gap-2 gradient-card border border-border rounded-xl px-4 py-2.5">
            <Plus className="h-4 w-4 text-muted-foreground shrink-0" />
            <Input
              ref={quickInputRef}
              placeholder="Aufgabe hinzufügen… (Enter)"
              value={quickInput}
              onChange={e => setQuickInput(e.target.value)}
              onKeyDown={handleQuickAdd}
              className="h-7 border-0 bg-transparent shadow-none focus-visible:ring-0 text-sm px-0 placeholder:text-muted-foreground"
            />
            {quickInput && (
              <Button
                size="sm"
                className="h-7 px-3 text-xs shrink-0"
                onClick={() => addMutation.mutate(quickInput)}
                disabled={addMutation.isPending}
              >
                Hinzufügen
              </Button>
            )}
          </div>
        )}

        {filtered.length === 0 && view !== "completed" ? (
          <div className="text-center py-16">
            <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
              <CheckSquare className="h-8 w-8 text-primary" />
            </div>
            <h3 className="text-base font-semibold mb-1">Keine Aufgaben</h3>
            <p className="text-sm text-muted-foreground">
              {view === "today" ? "Heute nichts geplant" : view === "upcoming" ? "Keine bevorstehenden Aufgaben" : "Alle Aufgaben erledigt!"}
            </p>
          </div>
        ) : (
          <div className="space-y-1">
            {view === "inbox" && groupedByProject
              ? Object.entries(groupedByProject).map(([project, items]) => {
                  if (items.length === 0) return null;
                  const isExpanded = expandedProjects[project] !== false;
                  return (
                    <div key={project || "__inbox__"} className="space-y-1">
                      {project && (
                        <button
                          onClick={() => setExpandedProjects(prev => ({ ...prev, [project]: !isExpanded }))}
                          className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider py-2 px-1 hover:text-foreground transition-colors"
                        >
                          {isExpanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                          {project}
                          <span className="normal-case font-normal ml-1">({items.length})</span>
                        </button>
                      )}
                      {isExpanded && items.map(todo => (
                        <TodoRow key={todo.id} todo={todo} onToggle={toggleComplete} onEdit={openEdit} onDelete={id => deleteMutation.mutate(id)} />
                      ))}
                    </div>
                  );
                })
              : filtered.map(todo => (
                  <TodoRow key={todo.id} todo={todo} onToggle={toggleComplete} onEdit={openEdit} onDelete={id => deleteMutation.mutate(id)} />
                ))
            }

            {view === "completed" && (
              <div className="space-y-1">
                {completedTodos.map(todo => (
                  <TodoRow key={todo.id} todo={todo} onToggle={toggleComplete} onEdit={openEdit} onDelete={id => deleteMutation.mutate(id)} />
                ))}
              </div>
            )}
          </div>
        )}

        {view === "inbox" && !search && todos.filter(t => t.completed).length > 0 && (
          <button
            onClick={() => setShowCompleted(!showCompleted)}
            className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors pt-2"
          >
            {showCompleted ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            Erledigte anzeigen ({todos.filter(t => t.completed).length})
          </button>
        )}
        {showCompleted && view === "inbox" && (
          <div className="space-y-1 opacity-60">
            {completedTodos.map(todo => (
              <TodoRow key={todo.id} todo={todo} onToggle={toggleComplete} onEdit={openEdit} onDelete={id => deleteMutation.mutate(id)} />
            ))}
          </div>
        )}
      </main>

      <Dialog open={!!editTodo} onOpenChange={open => !open && setEditTodo(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Aufgabe bearbeiten</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Input
              value={editForm.title}
              onChange={e => setEditForm(f => ({ ...f, title: e.target.value }))}
              placeholder="Titel"
              className="h-9 text-sm font-medium"
              autoFocus
            />
            <Textarea
              value={editForm.description}
              onChange={e => setEditForm(f => ({ ...f, description: e.target.value }))}
              placeholder="Beschreibung (optional)"
              className="text-sm min-h-[80px] resize-none"
            />
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">Fälligkeitsdatum</label>
                <Input
                  type="date"
                  value={editForm.due_date}
                  onChange={e => setEditForm(f => ({ ...f, due_date: e.target.value }))}
                  className="h-9 text-sm"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">Uhrzeit</label>
                <Input
                  type="time"
                  value={editForm.due_time}
                  onChange={e => setEditForm(f => ({ ...f, due_time: e.target.value }))}
                  className="h-9 text-sm"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">Priorität</label>
                <Select value={String(editForm.priority)} onValueChange={v => setEditForm(f => ({ ...f, priority: Number(v) }))}>
                  <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(PRIORITY_CONFIG).map(([k, v]) => (
                      <SelectItem key={k} value={k}>{v.icon} {v.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">Projekt</label>
                <Input
                  value={editForm.project}
                  onChange={e => setEditForm(f => ({ ...f, project: e.target.value }))}
                  placeholder="z.B. Arbeit"
                  className="h-9 text-sm"
                />
              </div>
            </div>
            <div className="flex gap-2 pt-1">
              <Button onClick={saveEdit} className="flex-1" disabled={!editForm.title.trim() || updateMutation.isPending}>
                Speichern
              </Button>
              <Button variant="outline" onClick={() => setEditTodo(null)}>Abbrechen</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

interface TodoRowProps {
  todo: Todo;
  onToggle: (todo: Todo) => void;
  onEdit: (todo: Todo) => void;
  onDelete: (id: string) => void;
}

const TodoRow = ({ todo, onToggle, onEdit, onDelete }: TodoRowProps) => {
  const pConfig = PRIORITY_CONFIG[todo.priority] ?? PRIORITY_CONFIG[4];
  const isOver = todo.due_date && !todo.completed && isOverdue(todo.due_date);

  return (
    <div className={cn(
      "group flex items-start gap-3 gradient-card border border-border rounded-xl px-4 py-3 hover:border-primary/20 transition-all hover-lift",
      todo.completed && "opacity-50",
      isOver && "border-loss/30 bg-loss/5"
    )}>
      <button
        onClick={() => onToggle(todo)}
        className={cn(
          "mt-0.5 shrink-0 transition-colors",
          todo.completed ? "text-primary" : "text-muted-foreground hover:text-primary"
        )}
      >
        {todo.completed
          ? <CheckCircle2 className="h-5 w-5" />
          : <Circle className="h-5 w-5" />
        }
      </button>

      <div className="flex-1 min-w-0 cursor-pointer" onClick={() => onEdit(todo)}>
        <p className={cn("text-sm font-medium leading-tight", todo.completed && "line-through text-muted-foreground")}>
          {todo.title}
        </p>
        {todo.description && (
          <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{todo.description}</p>
        )}
        <div className="flex items-center gap-2 mt-1.5 flex-wrap">
          {todo.priority < 4 && (
            <span className={cn("text-[10px] font-medium flex items-center gap-0.5", pConfig.color)}>
              <Flag className="h-2.5 w-2.5" /> {pConfig.label}
            </span>
          )}
          {todo.due_date && (
            <span className={cn(
              "text-[10px] flex items-center gap-0.5",
              isOver ? "text-red-500 font-medium" : "text-muted-foreground"
            )}>
              <Calendar className="h-2.5 w-2.5" />
              {formatDueDate(todo.due_date)}
              {todo.due_time && ` · ${todo.due_time.slice(0, 5)}`}
            </span>
          )}
          {todo.project && (
            <Badge variant="secondary" className="text-[10px] h-4 px-1.5 font-normal">{todo.project}</Badge>
          )}
        </div>
      </div>

      <div className="flex items-center gap-1 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity shrink-0">
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onEdit(todo)}>
          <Edit2 className="h-3 w-3" />
        </Button>
        <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive" onClick={() => onDelete(todo.id)}>
          <Trash2 className="h-3 w-3" />
        </Button>
      </div>
    </div>
  );
};

export default Todos;
