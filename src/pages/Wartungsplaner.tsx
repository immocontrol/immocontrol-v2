import { useState, useMemo, useCallback, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Wrench, Plus, TriangleAlert as AlertTriangle, Clock, Check, Trash2, Bell, RefreshCw, Calendar, Filter, Building2, ChevronDown, ChevronRight, X, FileBarChart, Store, CalendarCheck, Sparkles, Loader2 } from "lucide-react";
import { ROUTES } from "@/lib/routes";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NumberInput } from "@/components/NumberInput";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useProperties } from "@/context/PropertyContext";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/queryKeys";
import { formatCurrency, formatDate } from "@/lib/formatters";
import MaintenanceCalendar from "@/components/MaintenanceCalendar";
import { handleError } from "@/lib/handleError";
import { toastErrorWithRetry } from "@/lib/toastMessages";
import { isDeepSeekConfigured, suggestMaintenanceNotes } from "@/integrations/ai/extractors";

interface MaintenanceItem {
  id: string;
  property_id: string;
  title: string;
  category: string;
  priority: "low" | "medium" | "high";
  estimated_cost: number;
  planned_date: string | null;
  completed: boolean;
  notes: string | null;
  recurring_interval?: string | null;
  last_completed_date?: string | null;
}

/* IMP-60: Mark as readonly tuple */
const CATEGORIES = ["Heizung", "Dach", "Elektrik", "Sanitär", "Fassade", "Fenster", "Keller", "Aufzug", "Brandschutz", "Wasser", "Garten", "Sonstiges"];

const PRIORITIES = [
  { value: "high", label: "Dringend", color: "bg-loss/10 text-loss", dotColor: "bg-loss" },
  { value: "medium", label: "Mittel", color: "bg-gold/10 text-gold", dotColor: "bg-gold" },
  { value: "low", label: "Geplant", color: "bg-secondary text-muted-foreground", dotColor: "bg-muted-foreground" },
];

/** Feature 7: Recurring maintenance intervals */
const RECURRING_INTERVALS = [
  { value: "none", label: "Einmalig" },
  { value: "monthly", label: "Monatlich" },
  { value: "quarterly", label: "Vierteljährlich" },
  { value: "semi-annual", label: "Halbjährlich" },
  { value: "annual", label: "Jährlich" },
  { value: "2-years", label: "Alle 2 Jahre" },
  { value: "3-years", label: "Alle 3 Jahre" },
  { value: "5-years", label: "Alle 5 Jahre" },
  { value: "10-years", label: "Alle 10 Jahre" },
];

/** Feature 7: Pre-defined maintenance templates with legal requirements */
const MAINTENANCE_TEMPLATES = [
  { title: "Heizungswartung", category: "Heizung", priority: "high" as const, interval: "annual", cost: 200, notes: "Jährliche Pflicht gem. GEG/EnEV. Brenner, Abgaswerte, Dichtigkeit prüfen." },
  { title: "Legionellenprüfung", category: "Wasser", priority: "high" as const, interval: "3-years", cost: 300, notes: "Pflicht bei >400L Warmwasserspeicher oder >3L Leitungsinhalt (TrinkwV §14)." },
  { title: "Rauchwarnmelder prüfen", category: "Brandschutz", priority: "high" as const, interval: "annual", cost: 50, notes: "Jährliche Funktionsprüfung Pflicht in allen Bundesländern." },
  { title: "Dachinspektion", category: "Dach", priority: "medium" as const, interval: "2-years", cost: 500, notes: "Ziegel, Rinnen, Fallrohre, Anschlüsse prüfen. Nach Stürmen zusätzlich." },
  { title: "Schornsteinfeger", category: "Heizung", priority: "high" as const, interval: "annual", cost: 80, notes: "Kehr- und Überprüfungspflicht gem. SchfHwG." },
  { title: "Aufzugsprüfung (TÜV)", category: "Aufzug", priority: "high" as const, interval: "2-years", cost: 800, notes: "Pflichtprüfung gem. BetrSichV durch zugelassene Überwachungsstelle." },
  { title: "Elektroprüfung (E-Check)", category: "Elektrik", priority: "medium" as const, interval: "5-years", cost: 400, notes: "Empfohlen: Alle 4 Jahre in Mietwohnungen. DGUV V3." },
  { title: "Fassadenanstrich", category: "Fassade", priority: "low" as const, interval: "10-years", cost: 15000, notes: "Werterhalt. Risse, Abplatzungen, Feuchtigkeitsschäden prüfen." },
  { title: "Dachrinnen reinigen", category: "Dach", priority: "medium" as const, interval: "annual", cost: 150, notes: "Vor dem Winter reinigen. Verstopfung kann Wasserschäden verursachen." },
  { title: "Gartenpflege / Baumschnitt", category: "Garten", priority: "low" as const, interval: "annual", cost: 300, notes: "Verkehrssicherungspflicht beachten. Totholz entfernen." },
];

/** Calculate next due date based on interval and last completion */
const getNextDueDate = (item: MaintenanceItem): Date | null => {
  if (!item.recurring_interval || item.recurring_interval === "none") return item.planned_date ? new Date(item.planned_date) : null;
  const base = item.last_completed_date ? new Date(item.last_completed_date) : item.planned_date ? new Date(item.planned_date) : new Date();
  const next = new Date(base);
  switch (item.recurring_interval) {
    case "monthly": next.setMonth(next.getMonth() + 1); break;
    case "quarterly": next.setMonth(next.getMonth() + 3); break;
    case "semi-annual": next.setMonth(next.getMonth() + 6); break;
    case "annual": next.setFullYear(next.getFullYear() + 1); break;
    case "2-years": next.setFullYear(next.getFullYear() + 2); break;
    case "3-years": next.setFullYear(next.getFullYear() + 3); break;
    case "5-years": next.setFullYear(next.getFullYear() + 5); break;
    case "10-years": next.setFullYear(next.getFullYear() + 10); break;
  }
  return next;
};

/** Check if a maintenance item is overdue or due soon */
const getDueStatus = (item: MaintenanceItem): "overdue" | "due-soon" | "ok" | "completed" => {
  if (item.completed && (!item.recurring_interval || item.recurring_interval === "none")) return "completed";
  const nextDue = getNextDueDate(item);
  if (!nextDue) return "ok";
  const now = new Date();
  const diffDays = Math.floor((nextDue.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  if (diffDays < 0) return "overdue";
  if (diffDays <= 30) return "due-soon";
  return "ok";
};

const Wartungsplaner = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { properties } = useProperties();
  const qc = useQueryClient();

  const [open, setOpen] = useState(false);
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
  const [filterProperty, setFilterProperty] = useState("all");
  const [filterCategory, setFilterCategory] = useState("all");
  const [searchText, setSearchText] = useState("");
  const [filterPriority, setFilterPriority] = useState("all");
  const [showCompleted, setShowCompleted] = useState(false);
  const [overdueOpen, setOverdueOpen] = useState(true);
  const [upcomingOpen, setUpcomingOpen] = useState(true);
  const [suggestNotesLoading, setSuggestNotesLoading] = useState(false);
  const [form, setForm] = useState({
    title: "", category: "Sonstiges", priority: "medium" as MaintenanceItem["priority"],
    estimated_cost: 0, planned_date: "", notes: "", property_id: "",
    recurring_interval: "none",
  });

  const { data: allItems = [], isLoading } = useQuery<MaintenanceItem[]>({
    queryKey: queryKeys.maintenance.allList,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("maintenance_items")
        .select("*")
        .order("planned_date", { ascending: true });
      if (error) throw error;
      return (data || []) as MaintenanceItem[];
    },
    enabled: !!user,
  });

  /* IMP20-9: Show overdue count in document title for urgency awareness */
  const overdueItemCount = useMemo(() => allItems.filter(i => getDueStatus(i) === "overdue").length, [allItems]);
  useEffect(() => {
    const title = overdueItemCount > 0
      ? `Wartungsplaner (${allItems.length}) · ${overdueItemCount} überfällig – ImmoControl`
      : `Wartungsplaner (${allItems.length}) – ImmoControl`;
    document.title = title;
  }, [allItems.length, overdueItemCount]);

  const propMap = useMemo(() => new Map(properties.map(p => [p.id, p.name])), [properties]);

  const filteredItems = useMemo(() => {
    let items = allItems;
    if (filterProperty !== "all") items = items.filter(i => i.property_id === filterProperty);
    if (filterCategory !== "all") items = items.filter(i => i.category === filterCategory);
    if (filterPriority !== "all") items = items.filter(i => i.priority === filterPriority);
    if (searchText.trim()) {
      const q = searchText.toLowerCase();
      items = items.filter(i =>
        i.title.toLowerCase().includes(q) ||
        i.category.toLowerCase().includes(q) ||
        (i.notes && i.notes.toLowerCase().includes(q)) ||
        (propMap.get(i.property_id) || "").toLowerCase().includes(q)
      );
    }
    if (!showCompleted) items = items.filter(i => !i.completed || (i.recurring_interval && i.recurring_interval !== "none"));
    return items;
  }, [allItems, filterProperty, filterCategory, filterPriority, searchText, showCompleted, propMap]);

  const overdueItems = useMemo(() => filteredItems.filter(i => getDueStatus(i) === "overdue"), [filteredItems]);
  const dueSoonItems = useMemo(() => filteredItems.filter(i => getDueStatus(i) === "due-soon"), [filteredItems]);
  const okItems = useMemo(() => filteredItems.filter(i => getDueStatus(i) === "ok"), [filteredItems]);
  const completedItems = useMemo(() => filteredItems.filter(i => getDueStatus(i) === "completed"), [filteredItems]);

  const totalEstimated = useMemo(() => filteredItems.filter(i => !i.completed).reduce((s, i) => s + (i.estimated_cost || 0), 0), [filteredItems]);
  const totalRecurring = useMemo(() => filteredItems.filter(i => i.recurring_interval && i.recurring_interval !== "none").length, [filteredItems]);

  const addMutation = useMutation({
    mutationFn: async () => {
      if (!user || !form.title.trim() || !form.property_id) throw new Error("Pflichtfelder");
      const insertData: Record<string, unknown> = {
        property_id: form.property_id,
        user_id: user.id,
        title: form.title.trim(),
        category: form.category,
        priority: form.priority,
        estimated_cost: form.estimated_cost,
        planned_date: form.planned_date || null,
        notes: form.notes || null,
        completed: false,
      };
      // Try to include recurring_interval if the column exists
      if (form.recurring_interval && form.recurring_interval !== "none") {
        insertData.recurring_interval = form.recurring_interval;
      }
      const { error } = await supabase.from("maintenance_items").insert(insertData as Record<string, unknown>);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Wartung geplant");
      setForm({ title: "", category: "Sonstiges", priority: "medium", estimated_cost: 0, planned_date: "", notes: "", property_id: "", recurring_interval: "none" });
      setOpen(false);
      qc.invalidateQueries({ queryKey: queryKeys.maintenance.allList });
    },
    onError: (err) => {
      handleError(err, { context: "supabase", showToast: false });
      toastErrorWithRetry("Fehler beim Anlegen", () => addMutation.mutate());
    },
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ id, completed }: { id: string; completed: boolean }) => {
      const updateData: Record<string, unknown> = { completed };
      if (completed) {
        updateData.last_completed_date = new Date().toISOString().slice(0, 10);
      }
      const { error } = await supabase.from("maintenance_items").update(updateData as Record<string, unknown>).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.maintenance.allList });
      toast.success("Status aktualisiert");
    },
    onError: (err, variables) => {
      handleError(err, { context: "supabase", details: "maintenance_items.toggle", showToast: false });
      toastErrorWithRetry("Fehler beim Aktualisieren", () => toggleMutation.mutate(variables));
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("maintenance_items").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.maintenance.allList });
      toast.success("Gelöscht");
      setDeleteTargetId(null);
    },
    onError: (err, id) => {
      handleError(err, { context: "supabase", details: "maintenance_items.delete", showToast: false });
      toastErrorWithRetry("Fehler beim Löschen", () => deleteMutation.mutate(id));
    },
  });

  const addTemplate = useCallback((template: typeof MAINTENANCE_TEMPLATES[0]) => {
    if (properties.length === 0) {
      toast.error("Bitte erst ein Objekt anlegen");
      return;
    }
    setForm({
      title: template.title,
      category: template.category,
      priority: template.priority,
      estimated_cost: template.cost,
      planned_date: new Date().toISOString().slice(0, 10),
      notes: template.notes,
      property_id: properties[0].id,
      recurring_interval: template.interval,
    });
    setOpen(true);
  }, [properties]);

  const renderItem = (item: MaintenanceItem) => {
    const priorityCfg = PRIORITIES.find(p => p.value === item.priority);
    const status = getDueStatus(item);
    const nextDue = getNextDueDate(item);
    const intervalLabel = RECURRING_INTERVALS.find(r => r.value === item.recurring_interval)?.label;

    /* IMP-29: Add min-w-0 to prevent maintenance items from overflowing on mobile */
    return (
      <div key={item.id} className={`flex items-center gap-3 p-3 rounded-xl bg-secondary/30 hover:bg-secondary/50 transition-colors group min-w-0 ${item.completed && !item.recurring_interval ? "opacity-40" : ""}`}>
        {/* IMP-20: ARIA label for toggle */}
        <button onClick={() => toggleMutation.mutate({ id: item.id, completed: !item.completed })} className="shrink-0" aria-label={item.completed ? "Als offen markieren" : "Als erledigt markieren"}>
          {item.completed && !item.recurring_interval ? (
            <Check className="h-4 w-4 text-profit" />
          ) : status === "overdue" ? (
            <AlertTriangle className="h-4 w-4 text-loss" />
          ) : status === "due-soon" ? (
            <Bell className="h-4 w-4 text-gold animate-pulse" />
          ) : (
            <Clock className="h-4 w-4 text-muted-foreground" />
          )}
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className={`text-sm font-medium ${item.completed && !item.recurring_interval ? "line-through" : ""} truncate`}>{item.title}</span>
            <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${priorityCfg?.color}`}>{priorityCfg?.label}</span>
            <span className="text-[10px] bg-secondary px-1.5 py-0.5 rounded text-muted-foreground">{item.category}</span>
            {item.recurring_interval && (
              <Badge variant="outline" className="text-[10px] h-4 gap-0.5">
                <RefreshCw className="h-2.5 w-2.5" /> {intervalLabel}
              </Badge>
            )}
          </div>
          {/* IMP-30: Ensure maintenance item details wrap on small screens */}
          <div className="flex items-center gap-2 sm:gap-3 text-[10px] text-muted-foreground mt-0.5 flex-wrap min-w-0">
            <span>{propMap.get(item.property_id) || "–"}</span>
            {item.estimated_cost > 0 && <span>~{formatCurrency(item.estimated_cost)}</span>}
            {nextDue && (
              <span className={status === "overdue" ? "text-loss font-medium" : status === "due-soon" ? "text-gold font-medium" : ""}>
                Fällig: {nextDue.toLocaleDateString("de-DE", { day: "2-digit", month: "short", year: "numeric" })}
              </span>
            )}
            {item.last_completed_date && <span>Zuletzt: {formatDate(item.last_completed_date)}</span>}
          </div>
        </div>
        {/* UI-UPDATE-41: Tooltips on maintenance item actions + mobile visible */}
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0 mobile-action-row">
          <Tooltip>
            <TooltipTrigger asChild>
              <button onClick={() => toggleMutation.mutate({ id: item.id, completed: !item.completed })} className="p-1.5 rounded-md hover:bg-secondary">
                <Check className="h-3.5 w-3.5" />
              </button>
            </TooltipTrigger>
            <TooltipContent>{item.completed ? "Als offen markieren" : "Als erledigt markieren"}</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <button onClick={() => setDeleteTargetId(item.id)} className="p-1.5 rounded-md hover:bg-secondary text-muted-foreground hover:text-loss" aria-label="Maßnahme löschen">
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </TooltipTrigger>
            <TooltipContent>Löschen</TooltipContent>
          </Tooltip>
        </div>
      </div>
    );
  };

  return (
    /* IMP-15: ARIA landmark for Wartungsplaner page */
    <div className="space-y-6 animate-fade-in" role="main" aria-label="Wartungsplaner">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Wrench className="h-6 w-6 text-primary" /> Wartungsplaner
          </h1>
          <p className="text-sm text-muted-foreground">
            {allItems.length} Einträge · {totalRecurring} wiederkehrend · ~{formatCurrency(totalEstimated)} geplant
          </p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="gap-1.5">
              <Plus className="h-4 w-4" /> Wartung planen
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Wartung planen</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <div className="space-y-1">
                <Label className="text-xs">Objekt *</Label>
                <Select value={form.property_id} onValueChange={v => setForm(f => ({ ...f, property_id: v }))}>
                  <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Objekt wählen" /></SelectTrigger>
                  <SelectContent>
                    {properties.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Titel *</Label>
                <Input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} className="h-9 text-sm" placeholder="z.B. Heizungswartung" autoFocus />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Kategorie</Label>
                  <Select value={form.category} onValueChange={v => setForm(f => ({ ...f, category: v }))}>
                    <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                    <SelectContent>{CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Priorität</Label>
                  <Select value={form.priority} onValueChange={v => setForm(f => ({ ...f, priority: v as MaintenanceItem["priority"] }))}>
                    <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                    <SelectContent>{PRIORITIES.map(p => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Schätzkosten €</Label>
                  <NumberInput value={form.estimated_cost} onChange={v => setForm(f => ({ ...f, estimated_cost: v }))} className="h-9 text-sm" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Geplant für</Label>
                  <input type="date" value={form.planned_date} onChange={e => setForm(f => ({ ...f, planned_date: e.target.value }))} className="h-9 text-sm w-full rounded-md border border-input bg-background px-3 py-1" aria-label="Geplantes Datum" />
                </div>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Wiederholung</Label>
                <Select value={form.recurring_interval} onValueChange={v => setForm(f => ({ ...f, recurring_interval: v }))}>
                  <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Einmalig" /></SelectTrigger>
                  <SelectContent>{RECURRING_INTERVALS.map(r => <SelectItem key={r.value || "none"} value={r.value || "none"}>{r.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <div className="flex items-center justify-between gap-2">
                  <Label className="text-xs">Notiz</Label>
                  {isDeepSeekConfigured() && (form.title.trim() || form.category !== "Sonstiges") && (
                    <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs touch-target min-h-[32px]" onClick={async () => {
                      setSuggestNotesLoading(true);
                      try {
                        const text = await suggestMaintenanceNotes(form.title.trim() || form.category, form.category);
                        if (text) setForm(f => ({ ...f, notes: text }));
                      } catch (e) {
                        handleError(e, { context: "ai", details: "suggestMaintenanceNotes", showToast: true });
                      } finally {
                        setSuggestNotesLoading(false);
                      }
                    }} disabled={suggestNotesLoading} type="button" aria-label="KI Notiz-Vorschlag">
                      {suggestNotesLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
                      KI Notiz
                    </Button>
                  )}
                </div>
                <Input value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} className="h-9 text-sm" placeholder="Optional" />
              </div>
              <Button onClick={() => addMutation.mutate()} className="w-full" disabled={addMutation.isPending || !form.title.trim() || !form.property_id}>
                Wartung planen
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Stats */}
      {/* UPD-3: Add stagger animation to maintenance stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 card-stagger-enter">
        <div className="gradient-card rounded-xl border border-border p-4">
          <div className="text-[10px] text-muted-foreground uppercase">Überfällig</div>
          {/* UPD-40: Smoother stat card number transition */}
          <div className={`text-xl font-bold stat-number-transition ${overdueItems.length > 0 ? "text-loss" : ""}`}>{overdueItems.length}</div>
        </div>
        <div className="gradient-card rounded-xl border border-border p-4">
          <div className="text-[10px] text-muted-foreground uppercase">Bald fällig</div>
          <div className={`text-xl font-bold ${dueSoonItems.length > 0 ? "text-gold" : ""}`}>{dueSoonItems.length}</div>
        </div>
        <div className="gradient-card rounded-xl border border-border p-4">
          <div className="text-[10px] text-muted-foreground uppercase">Wiederkehrend</div>
          <div className="text-xl font-bold">{totalRecurring}</div>
        </div>
        <div className="gradient-card rounded-xl border border-border p-4">
          <div className="text-[10px] text-muted-foreground uppercase">Geplante Kosten</div>
          <div className="text-xl font-bold">{formatCurrency(totalEstimated)}</div>
        </div>
      </div>

      {/* Templates */}
      <div className="gradient-card rounded-xl border border-border p-5">
        <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
          <Calendar className="h-4 w-4 text-muted-foreground" /> Pflicht-Wartungen (Vorlagen)
        </h3>
        <p className="text-xs text-muted-foreground mb-3">
          Klicke auf eine Vorlage, um sie als wiederkehrende Wartung für ein Objekt anzulegen.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {MAINTENANCE_TEMPLATES.map((t, i) => (
            <button
              key={i}
              onClick={() => addTemplate(t)}
              className="flex items-start gap-3 p-3 rounded-lg bg-secondary/40 hover:bg-secondary/60 transition-colors text-left"
            >
              <div className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${PRIORITIES.find(p => p.value === t.priority)?.dotColor}`} />
              <div className="flex-1 min-w-0">
                <div className="text-xs font-medium">{t.title}</div>
                <div className="text-[10px] text-muted-foreground mt-0.5">{t.notes.slice(0, 60)}...</div>
                <div className="flex items-center gap-2 mt-1">
                  <Badge variant="outline" className="text-[10px] h-4">{t.category}</Badge>
                  <span className="text-[10px] text-muted-foreground">~{formatCurrency(t.cost)}</span>
                  <span className="text-[10px] text-muted-foreground">{RECURRING_INTERVALS.find(r => r.value === t.interval)?.label}</span>
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* FEATURE-6: Calendar View */}
      <MaintenanceCalendar
        items={filteredItems.map(item => ({
          ...item,
          planned_date: item.planned_date || "",
          property_name: propMap.get(item.property_id) || "–",
        }))}
      />

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative">
          <Filter className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
          <Input
            placeholder="z. B. Heizung oder Objekt"
            value={searchText}
            onChange={e => setSearchText(e.target.value)}
            className="h-9 pl-8 w-[160px] text-sm"
          />
        </div>
        <Select value={filterProperty} onValueChange={setFilterProperty}>
          <SelectTrigger className="w-[160px] h-9 text-sm">
            <Building2 className="h-3.5 w-3.5 mr-1.5" />
            <SelectValue placeholder="Alle Objekte" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Alle Objekte</SelectItem>
            {properties.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterCategory} onValueChange={setFilterCategory}>
          <SelectTrigger className="w-[140px] h-9 text-sm">
            <Filter className="h-3.5 w-3.5 mr-1.5" />
            <SelectValue placeholder="Kategorie" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Alle Kategorien</SelectItem>
            {CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterPriority} onValueChange={setFilterPriority}>
          <SelectTrigger className="w-[130px] h-9 text-sm">
            <SelectValue placeholder="Priorität" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Alle Prioritäten</SelectItem>
            {PRIORITIES.map(p => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
          </SelectContent>
        </Select>
        <Button variant={showCompleted ? "secondary" : "outline"} size="sm" onClick={() => setShowCompleted(!showCompleted)} className="h-9 text-xs gap-1.5">
          <Check className="h-3.5 w-3.5" /> Erledigte {showCompleted ? "ausblenden" : "anzeigen"}
        </Button>
        {(searchText || filterProperty !== "all" || filterCategory !== "all" || filterPriority !== "all") && (
          <Button variant="ghost" size="sm" className="h-9 text-xs gap-1" onClick={() => { setSearchText(""); setFilterProperty("all"); setFilterCategory("all"); setFilterPriority("all"); }}>
            <X className="h-3 w-3" /> Zurücksetzen
          </Button>
        )}
      </div>

      {/* Maintenance Lists */}
      {isLoading ? (
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-20 rounded-xl border border-border bg-muted/20 animate-pulse" />
          ))}
        </div>
      ) : filteredItems.length === 0 ? (
        <div className="text-center py-12">
          <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4 empty-state-float">
            <Wrench className="h-8 w-8 text-primary" />
          </div>
          <h3 className="text-base font-semibold mb-1">
            {allItems.length === 0 ? "Noch keine Wartungseinträge" : "Keine Ergebnisse"}
          </h3>
          <p className="text-sm text-muted-foreground mb-4 max-w-xs mx-auto">
            {allItems.length === 0 ? "Plane Wartungsarbeiten und behalte Fristen, Kosten und Pflichtprüfungen im Blick." : "Keine Einträge für diese Filterauswahl gefunden."}
          </p>
          {allItems.length === 0 && (
            <div className="flex flex-wrap items-center justify-center gap-2">
              <Button size="sm" className="gap-1.5 touch-target min-h-[44px]" onClick={() => setOpen(true)}>
                <Plus className="h-3.5 w-3.5" /> Ersten Eintrag anlegen
              </Button>
              <Button variant="outline" size="sm" className="gap-1.5 touch-target min-h-[44px]" onClick={() => navigate(ROUTES.OBJEKTE)} aria-label="Objekte öffnen">
                Objekte öffnen
              </Button>
              <Button variant="outline" size="sm" className="gap-1.5 touch-target min-h-[44px]" onClick={() => navigate(ROUTES.REPORTS)} aria-label="Zu Berichte">
                <FileBarChart className="h-3.5 w-3.5" /> Berichte
              </Button>
              <Button variant="outline" size="sm" className="gap-1.5 touch-target min-h-[44px]" onClick={() => navigate(ROUTES.CRM_SCOUT)} aria-label="WGH finden">
                <Store className="h-3.5 w-3.5" /> WGH finden
              </Button>
              <Button variant="outline" size="sm" className="gap-1.5 touch-target min-h-[44px]" onClick={() => navigate(ROUTES.BESICHTIGUNGEN)} aria-label="Besichtigung planen">
                <CalendarCheck className="h-3.5 w-3.5" /> Besichtigung planen
              </Button>
            </div>
          )}
          <p className="text-xs text-muted-foreground mt-1">Nutze die Vorlagen oben oder erstelle eine eigene Wartung</p>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Overdue */}
          {overdueItems.length > 0 && (
            <Collapsible open={overdueOpen} onOpenChange={setOverdueOpen}>
              <CollapsibleTrigger asChild>
                <button className="flex items-center gap-2 w-full text-left">
                  {overdueOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                  <AlertTriangle className="h-4 w-4 text-loss" />
                  <span className="text-sm font-semibold text-loss">Überfällig ({overdueItems.length})</span>
                </button>
              </CollapsibleTrigger>
              <CollapsibleContent className="mt-2 space-y-2">
                {overdueItems.map(renderItem)}
              </CollapsibleContent>
            </Collapsible>
          )}

          {/* Due Soon */}
          {dueSoonItems.length > 0 && (
            <Collapsible open={upcomingOpen} onOpenChange={setUpcomingOpen}>
              <CollapsibleTrigger asChild>
                <button className="flex items-center gap-2 w-full text-left">
                  {upcomingOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                  <Bell className="h-4 w-4 text-gold" />
                  <span className="text-sm font-semibold text-gold">Bald fällig ({dueSoonItems.length})</span>
                </button>
              </CollapsibleTrigger>
              <CollapsibleContent className="mt-2 space-y-2">
                {dueSoonItems.map(renderItem)}
              </CollapsibleContent>
            </Collapsible>
          )}

          {/* OK Items */}
          {okItems.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-semibold">Geplant ({okItems.length})</span>
              </div>
              <div className="space-y-2">
                {okItems.map(renderItem)}
              </div>
            </div>
          )}

          {/* Completed */}
          {showCompleted && completedItems.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Check className="h-4 w-4 text-profit" />
                <span className="text-sm font-semibold text-muted-foreground">Erledigt ({completedItems.length})</span>
              </div>
              <div className="space-y-2">
                {completedItems.map(renderItem)}
              </div>
            </div>
          )}
        </div>
      )}

      <AlertDialog open={!!deleteTargetId} onOpenChange={(open) => { if (!open) setDeleteTargetId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Maßnahme löschen?</AlertDialogTitle>
            <AlertDialogDescription>Die geplante Maßnahme wird unwiderruflich entfernt.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => { if (deleteTargetId) deleteMutation.mutate(deleteTargetId); }}
            >
              Löschen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default Wartungsplaner;
