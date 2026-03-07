import { useState, useMemo, useCallback, useEffect, useRef, memo } from "react";
import { useNavigate } from "react-router-dom";
import { SquareCheck as CheckSquare, Plus, Trash2, Circle, CircleCheck as CheckCircle2, Flag, Calendar, Tag, ChevronDown, ChevronRight, Inbox, Star, AlignLeft, X, Clock, Search, LayoutList, CalendarDays, MoveHorizontal as MoreHorizontal, CreditCard as Edit2, CheckCheck, Trash, Target, Briefcase, FileBarChart, Store } from "lucide-react";
import { ROUTES } from "@/lib/routes";
import TodoStats from "@/components/TodoStats";
import TodoCalendarSync from "@/components/TodoCalendarSync";
import { RecurringTodos } from "@/components/RecurringTodos";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { fromTable } from "@/lib/typedSupabase";
import { useAuth } from "@/hooks/useAuth";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useOptimisticMutation } from "@/hooks/useOptimisticMutation";
import { queryKeys } from "@/lib/queryKeys";
import { createDebounce, groupBy, sortByKey, truncate, pluralDE, parseNaturalDateDE } from "@/lib/formatters";
import { toast } from "sonner";
import { ListSkeleton } from "@/components/ListSkeleton";
import { useSwipeAction } from "@/hooks/useSwipeAction";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { TodoEditDialog } from "@/components/todos/TodoEditDialog";
import { useSuccessAnimation, SuccessAnimation } from "@/components/SuccessAnimation";
import { useHaptic } from "@/hooks/useHaptic";
import { FloatingActionButton } from "@/components/FloatingActionButton";

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
  const navigate = useNavigate();
  const { user } = useAuth();
  const qc = useQueryClient();
  const haptic = useHaptic();
  const { visible: successVisible, trigger: triggerSuccess } = useSuccessAnimation();
  const [view, setView] = useState<ViewType>("inbox");
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");

  /* OPT-43: createDebounce for search input */
  const debouncedSetSearch = useMemo(
    () => createDebounce((value: string) => setSearch(value), 250),
    [setSearch]
  );
  useEffect(() => () => { debouncedSetSearch.cancel(); }, [debouncedSetSearch]);
  const [expandedProjects, setExpandedProjects] = useState<Record<string, boolean>>({});
  const [quickInput, setQuickInput] = useState("");
  const [editTodo, setEditTodo] = useState<Todo | null>(null);
  const [editForm, setEditForm] = useState(emptyForm);
  const [showCompleted, setShowCompleted] = useState(false);
  const [priorityFilter, setPriorityFilter] = useState<PriorityFilter>("all");
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [visibleTodoCount, setVisibleTodoCount] = useState(50);
  const quickInputRef = useRef<HTMLInputElement>(null);

  const TODOS_PAGE_SIZE = 50;
  useEffect(() => {
    setVisibleTodoCount(TODOS_PAGE_SIZE);
  }, [view, search, priorityFilter]);

  /* FUND-12: Removed stray double blank line — consistent code formatting */
  const { data: todos = [], isLoading } = useQuery<Todo[]>({
    queryKey: queryKeys.todos.all(user?.id ?? ""),
    queryFn: async () => {
      const { data, error } = await fromTable("todos")
        .select("id, user_id, title, description, due_date, due_time, priority, completed, completed_at, project, labels, sort_order, created_at, updated_at")
        .order("priority", { ascending: true })
        .order("sort_order", { ascending: true })
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as Todo[];
    },
    enabled: !!user,
  });

  /* Fix 8: Optimistic mutations — instant UI feedback with automatic rollback on error */
  const todoQueryKey = queryKeys.todos.all(user?.id ?? "");

  const addMutation = useOptimisticMutation<Todo, { title: string; due_date?: string }>({
    queryKey: todoQueryKey,
    mutationFn: async (input) => {
      if (!user) throw new Error("Not authenticated");
      const { data, error } = await fromTable("todos").insert({
        user_id: user.id,
        title: input.title.trim(),
        priority: 4,
        ...(input.due_date ? { due_date: input.due_date } : {}),
      }).select().single();
      if (error) throw error;
      return data as unknown as Todo;
    },
    optimisticUpdate: (old, input) => [
      ...(old || []),
      {
        id: `temp-${Date.now()}`,
        user_id: user?.id ?? "",
        title: input.title.trim(),
        description: "",
        due_date: input.due_date ?? null,
        due_time: null,
        priority: 4,
        completed: false,
        completed_at: null,
        project: "",
        labels: [],
        sort_order: (old?.length ?? 0) + 1,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ],
    successMessage: "Aufgabe erstellt",
    errorMessage: "Fehler beim Anlegen",
  });

  const updateMutation = useOptimisticMutation<Todo, { id: string; updates: Partial<Todo> }>({
    queryKey: todoQueryKey,
    mutationFn: async ({ id, updates }) => {
      const { data, error } = await fromTable("todos").update({ ...updates, updated_at: new Date().toISOString() }).eq("id", id).select().single();
      if (error) throw error;
      return data as unknown as Todo;
    },
    optimisticUpdate: (old, { id, updates }) =>
      (old || []).map((t) => (t.id === id ? { ...t, ...updates, updated_at: new Date().toISOString() } : t)),
    errorMessage: "Fehler beim Aktualisieren",
  });

  const deleteMutation = useOptimisticMutation<Todo, string>({
    queryKey: todoQueryKey,
    mutationFn: async (id) => {
      const { error } = await fromTable("todos").delete().eq("id", id);
      if (error) throw error;
      return { id, user_id: "", title: "", description: "", due_date: null, due_time: null, priority: 0, completed: false, completed_at: null, project: "", labels: [], sort_order: 0, created_at: "", updated_at: "" } satisfies Todo;
    },
    optimisticUpdate: (old, id) => (old || []).filter((t) => t.id !== id),
    successMessage: "Aufgabe gelöscht",
    errorMessage: "Fehler beim Löschen",
  });

  const toggleComplete = useCallback((todo: Todo) => {
    /* UX-4: Haptic feedback on toggle */
    haptic.tap();
    updateMutation.mutate({
      id: todo.id,
      updates: {
        completed: !todo.completed,
        completed_at: todo.completed ? null : new Date().toISOString(),
      },
    });
  }, [updateMutation, haptic]);

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
    /* UX-4: Haptic + UX-15: Success animation on save */
    haptic.success();
    triggerSuccess();
    toast.success("Aufgabe gespeichert");
  }, [editTodo, editForm, updateMutation, haptic, triggerSuccess]);

  /* IMP-41-7: Smart quick-add with natural language date parsing
     Supports: "Aufgabe morgen", "Aufgabe heute", "Aufgabe nächste woche", "Aufgabe in 3d" */
  const handleQuickAdd = useCallback((e: React.KeyboardEvent) => {
    if (e.key === "Enter" && quickInput.trim()) {
      const words = quickInput.trim().split(/\s+/);
      /* Try to parse the last 1-2 words as a date */
      let title = quickInput.trim();
      let dueDate: string | undefined;
      for (let len = 1; len <= Math.min(3, words.length - 1); len++) {
        const candidate = words.slice(-len).join(" ");
        const parsed = parseNaturalDateDE(candidate);
        if (parsed) {
          dueDate = parsed;
          title = words.slice(0, -len).join(" ");
          break;
        }
      }
      addMutation.mutate({ title, due_date: dueDate });
      setQuickInput("");
    }
  }, [quickInput, addMutation]);

  const projects = useMemo(() => {
    const set = new Set(todos.filter(t => t.project).map(t => t.project));
    return Array.from(set).sort();
  }, [todos]);

  /* STRONG-7: Removed stray double blank line — consistent code formatting */
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

  /* IMP20-8: Show overdue count in document title for urgency awareness */
  useEffect(() => {
    const title = overdueCount > 0
      ? `Aufgaben (${inboxCount}) · ${overdueCount} überfällig – ImmoControl`
      : `Aufgaben (${inboxCount}) – ImmoControl`;
    document.title = title;
  }, [inboxCount, overdueCount]);

  /* FUNC-8: Todo completion rate tracking */
  const completionRate = useMemo(() => {
    const total = todos.length;
    const done = todos.filter(t => t.completed).length;
    return total > 0 ? Math.round((done / total) * 100) : 0;
  }, [todos]);

  /* FUNC-9: Average time to complete tasks */
  /* STRONG-14: NaN guard on date arithmetic — prevents NaN display if created_at/completed_at is invalid */
  const avgCompletionDays = useMemo(() => {
    const completedWithDates = todos.filter(t => t.completed && t.completed_at && t.created_at);
    if (completedWithDates.length === 0) return 0;
    const totalDays = completedWithDates.reduce((s, t) => {
      const created = new Date(t.created_at).getTime();
      const completed = new Date(t.completed_at!).getTime();
      const diff = (completed - created) / (1000 * 60 * 60 * 24);
      return s + (Number.isFinite(diff) ? diff : 0);
    }, 0);
    const raw = totalDays / completedWithDates.length;
    return Number.isFinite(raw) ? Math.round(raw * 10) / 10 : 0;
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
    const rows = projects.map(p => ({
      name: p,
      total: todos.filter(t => t.project === p).length,
      open: todos.filter(t => t.project === p && !t.completed).length,
    }));
    /* OPT-49: sortByKey for consistent sorting */
    return sortByKey(rows, "open", true);
  }, [projects, todos]);


  const displayFiltered = useMemo(() => {
    if (filtered.length <= TODOS_PAGE_SIZE) return filtered;
    return filtered.slice(0, visibleTodoCount);
  }, [filtered, visibleTodoCount]);

  const groupedByProject = useMemo(() => {
    if (view !== "inbox") return null;
    const groups = groupBy(displayFiltered, (t) => t.project || "");
    if (!groups[""]) groups[""] = [];
    return groups;
  }, [displayFiltered, view]);

  /* #10: Skeleton loading state */
  if (isLoading) {
    return (
      <div className="flex flex-col md:flex-row gap-4 sm:gap-6 h-[calc(100vh-8rem)]">
        <div className="hidden md:block w-56 shrink-0 space-y-2">
          {[1, 2, 3, 4].map(i => <div key={i} className="h-9 skeleton-wave rounded-lg" />)}
        </div>
        <div className="flex-1">
          <ListSkeleton rows={6} />
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
          {/* IMPROVE-32: Show completion rate below heading */}
          {todos.length > 0 && (
            <p className="text-xs text-muted-foreground mt-1">{completionRate}% erledigt · {pluralDE(overdueCount, "überfällig", "überfällige")}</p>
          )}
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
            {projectsWithCounts.map((proj) => (
              <button
                key={proj.name}
                onClick={() => setView("inbox")}
                className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
              >
                <LayoutList className="h-4 w-4 shrink-0" />
                {/* OPT-47: truncate for long project names */}
                <span className="flex-1 text-left truncate">{truncate(proj.name, 26)}</span>
                <span className="text-xs text-muted-foreground">
                  {proj.open}
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
                /* IMPROVE-33: More specific search placeholder */
                placeholder="Aufgabe suchen..."
                aria-label="Aufgaben durchsuchen"
                value={searchInput}
                onChange={e => {
                  const v = e.target.value;
                  setSearchInput(v);
                  debouncedSetSearch(v);
                }}
                className="h-8 pl-8 w-32 sm:w-48 text-sm input-focus-glow focus-ring-animated"
              />
            </div>
          </div>
        </div>

        <TodoStats todos={todos} />

        {/* FUNC-8/9/10: Completion rate, avg days, upcoming deadlines */}
        {/* UPD-11: Add stagger animation to todo stats */}
        {todos.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 card-stagger-enter">
            <div className="glass-card rounded-lg border border-border p-2.5 text-center">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Erledigt</p>
              <p className={`text-base font-bold ${completionRate >= 70 ? "text-profit" : completionRate >= 40 ? "text-gold" : "text-loss"}`}>{completionRate}%</p>
              <div className="h-1 bg-secondary rounded-full mt-1 overflow-hidden progress-bar-animated">
                <div className="h-full bg-primary rounded-full" style={{ width: `${completionRate}%` }} />
              </div>
            </div>
            <div className="glass-card rounded-lg border border-border p-2.5 text-center">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Ø Dauer</p>
              <p className="text-base font-bold">{avgCompletionDays}d</p>
            </div>
            {upcomingDeadlines.length > 0 && (
              <div className="glass-card rounded-lg border border-border p-2.5 text-center">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Bald fällig</p>
                <p className="text-base font-bold text-gold">{upcomingDeadlines.length}</p>
              </div>
            )}
          </div>
        )}

        {/* Item 4: Improved quick-add — always-visible + Button, focus on click */}
        {view !== "completed" && (
          <div className="flex items-center gap-2 gradient-card border border-border rounded-xl px-4 py-2.5">
            <Plus className="h-4 w-4 text-primary shrink-0" />
            <Input
              ref={quickInputRef}
              data-todo-input
              placeholder="Neue Aufgabe… (z.B. 'Anruf morgen', 'Meeting nächste woche')"
              value={quickInput}
              onChange={e => setQuickInput(e.target.value)}
              onKeyDown={handleQuickAdd}
              className="h-7 border-0 bg-transparent shadow-none focus-visible:ring-0 text-sm px-0 placeholder:text-muted-foreground"
            />
            <Button
              size="sm"
              className="h-7 px-3 text-xs shrink-0 gap-1"
              onClick={() => {
                if (quickInput.trim()) {
                  /* IMP-41-7: Button uses same natural language date parsing as Enter key */
                  const words = quickInput.trim().split(/\s+/);
                  let title = quickInput.trim();
                  let dueDate: string | undefined;
                  for (let len = 1; len <= Math.min(3, words.length - 1); len++) {
                    const candidate = words.slice(-len).join(" ");
                    const parsed = parseNaturalDateDE(candidate);
                    if (parsed) { dueDate = parsed; title = words.slice(0, -len).join(" "); break; }
                  }
                  addMutation.mutate({ title, due_date: dueDate });
                } else {
                  quickInputRef.current?.focus();
                }
              }}
              disabled={addMutation.isPending}
              variant={quickInput.trim() ? "default" : "outline"}
            >
              <Plus className="h-3 w-3" />
              {quickInput.trim() ? "Hinzufügen" : "Neu"}
            </Button>
          </div>
        )}

        {filtered.length === 0 ? (
          <div className="text-center py-16">
            <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4 empty-state-float">
              <CheckSquare className="h-8 w-8 text-primary" />
            </div>
            <h3 className="text-base font-semibold mb-1">
              {view === "completed" ? "Keine erledigten Aufgaben" : "Keine Aufgaben"}
            </h3>
            <p className="text-sm text-muted-foreground mb-4">
              {view === "today" ? "Heute nichts geplant — genieße den freien Tag!" : view === "upcoming" ? "Keine bevorstehenden Aufgaben" : view === "completed" ? "Erledigte Aufgaben erscheinen hier." : "Erstelle deine erste Aufgabe, um den Überblick zu behalten."}
            </p>
            {(view === "inbox" || view === "today") && (
              <div className="flex flex-wrap items-center justify-center gap-2">
                <Button
                  size="sm"
                  className="gap-1.5 touch-target min-h-[44px]"
                  onClick={() => {
                    const input = document.querySelector<HTMLInputElement>("[data-todo-input]");
                    input?.focus();
                  }}
                >
                  <Plus className="h-3.5 w-3.5" /> Aufgabe hinzufügen
                </Button>
                <Button variant="outline" size="sm" onClick={() => navigate(ROUTES.CRM)} className="gap-1.5 touch-target min-h-[44px]" aria-label="Zu CRM">
                  <Target className="h-3.5 w-3.5" /> Zu CRM
                </Button>
                <Button variant="outline" size="sm" onClick={() => navigate(ROUTES.DEALS)} className="gap-1.5 touch-target min-h-[44px]" aria-label="Zu Deals">
                  <Briefcase className="h-3.5 w-3.5" /> Zu Deals
                </Button>
                <Button variant="outline" size="sm" onClick={() => navigate(ROUTES.REPORTS)} className="gap-1.5 touch-target min-h-[44px]" aria-label="Zu Berichte">
                  <FileBarChart className="h-3.5 w-3.5" /> Berichte
                </Button>
                <Button variant="outline" size="sm" onClick={() => navigate(ROUTES.CRM_SCOUT)} className="gap-1.5 touch-target min-h-[44px]" aria-label="WGH-Scout">
                  <Store className="h-3.5 w-3.5" /> WGH finden
                </Button>
              </div>
            )}
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
                        <TodoRow key={todo.id} todo={todo} onToggle={toggleComplete} onEdit={openEdit} onDelete={id => setDeleteTarget(id)} />
                      ))}
                    </div>
                  );
                })
              : displayFiltered.map(todo => (
                  <TodoRow key={todo.id} todo={todo} onToggle={toggleComplete} onEdit={openEdit} onDelete={id => setDeleteTarget(id)} />
                ))
            }

            {filtered.length > visibleTodoCount && (
              <div className="flex justify-center pt-3">
                <Button variant="outline" size="sm" className="touch-target min-h-[44px]" onClick={() => setVisibleTodoCount((n) => n + TODOS_PAGE_SIZE)}>
                  {filtered.length - visibleTodoCount <= TODOS_PAGE_SIZE ? `Alle ${filtered.length} anzeigen` : `${TODOS_PAGE_SIZE} weitere anzeigen`}
                </Button>
              </div>
            )}
          </div>
        )}

        {/* IMP-44-16: Use memoized completedCount instead of inline filter() recalculation */}
        {view === "inbox" && !search && completedTodos.length > 0 && (
          <button
            onClick={() => setShowCompleted(!showCompleted)}
            className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors pt-2"
            aria-expanded={showCompleted}
          >
            {showCompleted ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            Erledigte anzeigen ({completedTodos.length})
          </button>
        )}
        {showCompleted && view === "inbox" && (
          <div className="space-y-1 opacity-60">
            {completedTodos.map(todo => (
              <TodoRow key={todo.id} todo={todo} onToggle={toggleComplete} onEdit={openEdit} onDelete={id => setDeleteTarget(id)} />
            ))}
          </div>
        )}
      </main>

      {/* UX: Bestätigung vor Löschen */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Aufgabe löschen?</AlertDialogTitle>
            <AlertDialogDescription>Die Aufgabe wird unwiderruflich gelöscht.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => { if (deleteTarget) { deleteMutation.mutate(deleteTarget); setDeleteTarget(null); } }}
            >
              Löschen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Fix 3c: Extracted to TodoEditDialog component */}
      <TodoEditDialog
        open={!!editTodo}
        onClose={() => setEditTodo(null)}
        form={editForm}
        onFormChange={setEditForm}
        onSave={saveEdit}
        isSaving={updateMutation.isPending}
      />

      {/* Wiederkehrende Aufgaben — moved from Dashboard */}
      <RecurringTodos onCreateTodo={(title, dueDate) => {
        if (user) {
          addMutation.mutate({ title, due_date: dueDate });
        }
      }} />

      {/* UX-15: Success animation overlay */}
      <SuccessAnimation visible={successVisible} />

      {/* UX-5: Floating Action Button on mobile */}
      <FloatingActionButton onClick={() => quickInputRef.current?.focus()} />
    </div>
  );
};

interface TodoRowProps {
  todo: Todo;
  onToggle: (todo: Todo) => void;
  onEdit: (todo: Todo) => void;
  onDelete: (id: string) => void;
}

/* IMPROVE-4: Memoize TodoRow to prevent unnecessary re-renders when sibling todos change */
const TodoRow = memo(({ todo, onToggle, onEdit, onDelete }: TodoRowProps) => {
  const pConfig = PRIORITY_CONFIG[todo.priority] ?? PRIORITY_CONFIG[4];
  const isOver = todo.due_date && !todo.completed && isOverdue(todo.due_date);

  return (
    /* IMP-44-17: Add data-priority attribute for potential CSS targeting and testing */
    <div data-priority={todo.priority} className={cn(
      "group flex items-start gap-3 gradient-card border border-border rounded-xl px-4 py-3 hover:border-primary/20 transition-all hover-lift min-w-0",
      todo.completed && "opacity-50",
      isOver && "border-loss/30 bg-loss/5"
    )} role="listitem" aria-label={`Aufgabe: ${todo.title}${todo.completed ? ' (erledigt)' : ''}`}>
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
        {/* IMP-42: Truncate long todo titles on mobile to prevent overflow */}
        <p className={cn("text-sm font-medium leading-tight truncate sm:whitespace-normal", todo.completed && "line-through text-muted-foreground")}>
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
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onEdit(todo)} aria-label="Aufgabe bearbeiten">
          <Edit2 className="h-3 w-3" />
        </Button>
        <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive" onClick={() => onDelete(todo.id)} aria-label="Aufgabe löschen">
          <Trash2 className="h-3 w-3" />
        </Button>
      </div>
    </div>
  );
});
TodoRow.displayName = "TodoRow";

export default Todos;
