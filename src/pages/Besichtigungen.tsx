/**
 * Besichtigungen — Notizen, Bilder, Videos zu Immobilien-Besichtigungen
 * Erfasst Gedanken vor Ort, Pro/Kontra, Bewertung, Medien und verknüpft optional mit Deals.
 */
import { useState, useCallback, useMemo, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Link, useSearchParams, useLocation, useNavigate } from "react-router-dom";
import { ROUTES } from "@/lib/routes";
import {
  Camera,
  MapPin,
  Calendar,
  Star,
  ThumbsUp,
  ThumbsDown,
  Plus,
  Trash2,
  Image,
  FileText,
  Search,
  Loader2,
  Link2,
  ChevronRight,
  ListTodo,
  Zap,
  Share2,
  Store,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDate, relativeTime } from "@/lib/formatters";
import { queryKeys } from "@/lib/queryKeys";
import { FileImportPicker } from "@/components/FileImportPicker";
import { useDebounce } from "@/hooks/useDebounce";
import { ResponsiveDialog, ResponsiveDialogHeader, ResponsiveDialogTitle } from "@/components/ResponsiveDialog";
import { handleError } from "@/lib/handleError";
import { fromTable } from "@/lib/typedSupabase";
import { ViewingAISummary } from "@/components/ViewingAISummary";
import { ViewingCard } from "@/components/besichtigungen/ViewingCard";
import { useAccessibility } from "@/components/AccessibilityProvider";
import { useHaptic } from "@/hooks/useHaptic";
import { useShare } from "@/components/mobile/MobileShareSheet";

const MAX_MEDIA_SIZE = 20 * 1024 * 1024; // 20 MB
const IMAGE_TYPES = "image/*";
const VIDEO_TYPES = "video/*";

interface ViewingRecord {
  id: string;
  user_id: string;
  title: string;
  address: string | null;
  deal_id: string | null;
  property_id: string | null;
  scheduled_at: string | null;
  visited_at: string | null;
  notes: string | null;
  pro_points: string | null;
  contra_points: string | null;
  rating: number | null;
  contact_name: string | null;
  contact_phone: string | null;
  checklist: Array<{ id: string; label: string; checked: boolean }> | null;
  created_at: string;
}

const DEFAULT_CHECKLIST = [
  { id: "1", label: "Heizung", checked: false },
  { id: "2", label: "Fenster/Dämmung", checked: false },
  { id: "3", label: "Elektrik", checked: false },
  { id: "4", label: "Badezimmer", checked: false },
  { id: "5", label: "Küche", checked: false },
  { id: "6", label: "Dach/Keller", checked: false },
];

interface ViewingMediaRecord {
  id: string;
  viewing_id: string;
  file_path: string;
  file_type: string;
  caption: string | null;
  sort_order: number;
}

const emptyForm = {
  title: "",
  address: "",
  notes: "",
  pro_points: "",
  contra_points: "",
  rating: 0,
  contact_name: "",
  contact_phone: "",
  visited_at: "",
  checklist: DEFAULT_CHECKLIST as typeof DEFAULT_CHECKLIST,
};

function getSignedUrl(path: string): Promise<string> {
  return supabase.storage.from("property-documents").createSignedUrl(path, 3600).then(({ data, error }) => {
    if (error) throw error;
    return data?.signedUrl ?? "";
  });
}

const SORT_OPTIONS = [
  { key: "visited_at" as const, label: "Datum" },
  { key: "rating" as const, label: "Bewertung" },
  { key: "title" as const, label: "Titel" },
  { key: "created_at" as const, label: "Erstellt" },
];

const Besichtigungen = () => {
  const { user } = useAuth();
  const qc = useQueryClient();
  const haptic = useHaptic();
  const location = useLocation();
  const navigate = useNavigate();
  const { announce } = useAccessibility();
  const { share } = useShare();
  const [searchParams, setSearchParams] = useSearchParams();
  const [addOpen, setAddOpen] = useState(false);
  const [quickAdd, setQuickAdd] = useState(false);
  const [editViewing, setEditViewing] = useState<ViewingRecord | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [searchQuery, setSearchQuery] = useState("");
  const debouncedSearch = useDebounce(searchQuery, 300);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<"visited_at" | "rating" | "title" | "created_at">("visited_at");
  const [sortAsc, setSortAsc] = useState(false);
  const [ratingFilter, setRatingFilter] = useState<number | null>(null);

  const { data: viewings = [], isLoading } = useQuery({
    queryKey: queryKeys.viewings.all,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("property_viewings")
        .select("*")
        .order("visited_at", { ascending: false, nullsFirst: false })
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as ViewingRecord[];
    },
    enabled: !!user,
  });

  const { data: mediaCountMap = {} } = useQuery({
    queryKey: ["viewing_media_counts"],
    queryFn: async () => {
      if (viewings.length === 0) return {};
      const { data, error } = await supabase
        .from("viewing_media")
        .select("viewing_id")
        .in("viewing_id", viewings.map((v) => v.id));
      if (error) throw error;
      const map: Record<string, number> = {};
      (data || []).forEach((r: { viewing_id: string }) => {
        map[r.viewing_id] = (map[r.viewing_id] || 0) + 1;
      });
      return map;
    },
    enabled: !!user && viewings.length > 0,
  });

  useEffect(() => {
    document.title = `Besichtigungen (${viewings.length}) – ImmoControl`;
  }, [viewings.length]);

  // Deep-Link: ?id=xxx öffnet diese Besichtigung
  const viewingIdFromUrl = searchParams.get("id");

  // Synergy: fromScout – WGH-Scout „Als Besichtigung“ → Form vorausgefüllt, Dialog öffnen
  useEffect(() => {
    const fromScout = (location.state as { fromScout?: { title: string; address?: string } })?.fromScout;
    if (fromScout?.title) {
      setForm((f) => ({ ...f, title: fromScout.title.trim(), address: (fromScout.address ?? "").trim() }));
      setEditViewing(null);
      setAddOpen(true);
      toast.success("Vorlage aus WGH-Scout übernommen");
      navigate(location.pathname, { replace: true, state: {} });
    }
  }, [location.state, location.pathname, navigate]);

  const createTodoFromViewing = useCallback(
    async (v: ViewingRecord) => {
      if (!user) return;
      try {
        await fromTable("todos").insert({
          user_id: user.id,
          title: `Besichtigung nachbereiten: ${v.title}`,
          project: "Besichtigungen",
          priority: 3,
        });
        qc.invalidateQueries({ queryKey: queryKeys.todos.all(user.id) });
        haptic.success();
        toast.success("Todo angelegt → Aufgaben");
      } catch (e) {
        handleError(e as Error, { context: "supabase", toastMessage: "Todo konnte nicht angelegt werden" });
      }
    },
    [user, qc, haptic]
  );

  const filteredViewings = useMemo(() => {
    let result = viewings;
    if (debouncedSearch.trim()) {
      const q = debouncedSearch.toLowerCase();
      result = result.filter(
        (v) =>
          v.title.toLowerCase().includes(q) ||
          (v.address || "").toLowerCase().includes(q) ||
          (v.notes || "").toLowerCase().includes(q) ||
          (v.pro_points || "").toLowerCase().includes(q) ||
          (v.contra_points || "").toLowerCase().includes(q)
      );
    }
    if (ratingFilter != null && ratingFilter > 0) {
      result = result.filter((v) => v.rating != null && v.rating >= ratingFilter);
    }
    result = [...result].sort((a, b) => {
      let av: string | number | null = a[sortKey] ?? "";
      let bv: string | number | null = b[sortKey] ?? "";
      if (sortKey === "visited_at" || sortKey === "created_at") {
        av = av ? new Date(av as string).getTime() : 0;
        bv = bv ? new Date(bv as string).getTime() : 0;
      }
      if (typeof av === "number" && typeof bv === "number") return sortAsc ? av - bv : bv - av;
      return sortAsc
        ? String(av).localeCompare(String(bv))
        : String(bv).localeCompare(String(av));
    });
    return result;
  }, [viewings, debouncedSearch, ratingFilter, sortKey, sortAsc]);

  const createMutation = useMutation({
    mutationFn: async (payload: typeof emptyForm & { visited_at?: string; scheduled_at?: string }) => {
      if (!user) throw new Error("Not authenticated");
      const { data, error } = await supabase
        .from("property_viewings")
        .insert({
          user_id: user.id,
          title: payload.title.trim(),
          address: payload.address.trim() || null,
          notes: payload.notes?.trim() || null,
          pro_points: payload.pro_points?.trim() || null,
          contra_points: payload.contra_points?.trim() || null,
          rating: payload.rating || null,
          contact_name: payload.contact_name?.trim() || null,
          contact_phone: payload.contact_phone?.trim() || null,
          visited_at: payload.visited_at || null,
          scheduled_at: payload.scheduled_at || null,
          checklist: payload.checklist ?? null,
        } as never)
        .select("id")
        .single();
      if (error) throw error;
      return data.id;
    },
    onSuccess: (id) => {
      setAddOpen(false);
      qc.invalidateQueries({ queryKey: queryKeys.viewings.all });
      setEditViewing({ id } as ViewingRecord);
      haptic.success();
      announce("Besichtigung angelegt", "polite");
      toast.success("Besichtigung angelegt — Medien hinzufügen");
    },
    onError: (err) => handleError(err, { context: "supabase", toastMessage: "Speichern fehlgeschlagen" }),
  });

  const updateMutation = useMutation({
    mutationFn: async ({
      id,
      payload,
    }: {
      id: string;
      payload: Partial<ViewingRecord>;
    }) => {
      const { error } = await supabase
        .from("property_viewings")
        .update(payload)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.viewings.all });
      haptic.tap();
      announce("Besichtigung gespeichert", "polite");
      toast.success("Gespeichert");
    },
    onError: (err) => handleError(err, { context: "supabase", toastMessage: "Aktualisierung fehlgeschlagen" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { data: media } = await supabase
        .from("viewing_media")
        .select("file_path")
        .eq("viewing_id", id);
      if (media?.length) {
        await supabase.storage
          .from("property-documents")
          .remove(media.map((m) => m.file_path));
      }
      await supabase.from("viewing_media").delete().eq("viewing_id", id);
      const { error } = await supabase.from("property_viewings").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      setDeleteId(null);
      setEditViewing(null);
      qc.invalidateQueries({ queryKey: queryKeys.viewings.all });
      haptic.medium();
      announce("Besichtigung gelöscht", "polite");
      toast.success("Besichtigung gelöscht");
    },
    onError: (err) => handleError(err, { context: "supabase", toastMessage: "Löschen fehlgeschlagen" }),
  });

  const openEdit = useCallback((v: ViewingRecord) => {
    haptic.tap();
    setEditViewing(v);
    const checklist = Array.isArray(v.checklist) && v.checklist.length > 0
      ? v.checklist
      : DEFAULT_CHECKLIST;
    setForm({
      title: v.title,
      address: v.address || "",
      notes: v.notes || "",
      pro_points: v.pro_points || "",
      contra_points: v.contra_points || "",
      rating: v.rating || 0,
      contact_name: v.contact_name || "",
      contact_phone: v.contact_phone || "",
      visited_at: v.visited_at ? v.visited_at.slice(0, 16) : "",
      checklist,
    });
  }, [haptic]);

  useEffect(() => {
    if (!viewingIdFromUrl || viewings.length === 0) return;
    const v = viewings.find((x) => x.id === viewingIdFromUrl);
    if (v) {
      openEdit(v);
      setSearchParams({}, { replace: true });
    }
  }, [viewingIdFromUrl, viewings, openEdit, setSearchParams]);

  const openAdd = useCallback((quick = false) => {
    setEditViewing(null);
    setForm(emptyForm);
    setQuickAdd(quick);
    setAddOpen(true);
  }, []);

  const handleCreate = useCallback(() => {
    if (!form.title.trim()) {
      toast.error("Titel eingeben");
      return;
    }
    const visited = form.visited_at ? new Date(form.visited_at).toISOString() : new Date().toISOString();
    createMutation.mutate({ ...form, visited_at: visited, scheduled_at: visited } as never);
  }, [form, createMutation]);

  const handleExportCsv = useCallback(() => {
    const header = "Titel;Adresse;Datum;Bewertung;Pro;Kontra;Kontakt;Notizen\n";
    const esc = (v: string | number | null) => {
      const s = String(v ?? "");
      return s.includes(";") || s.includes('"') || s.includes("\n") ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const rows = filteredViewings.map((v) =>
      [
        v.title,
        v.address || "",
        v.visited_at ? formatDate(v.visited_at) : "",
        v.rating ?? "",
        (v.pro_points || "").replace(/\n/g, " | "),
        (v.contra_points || "").replace(/\n/g, " | "),
        v.contact_name || "",
        (v.notes || "").replace(/\n/g, " | "),
      ]
        .map(esc)
        .join(";")
    ).join("\n");
    const blob = new Blob(["\uFEFF" + header + rows], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `besichtigungen-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    toast.success("CSV exportiert");
  }, [filteredViewings]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "n" && !e.ctrlKey && !e.metaKey && !e.altKey && !addOpen && !editViewing) {
        const active = document.activeElement;
        if (active && (active.tagName === "INPUT" || active.tagName === "TEXTAREA" || active.tagName === "SELECT")) return;
        e.preventDefault();
        openAdd();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [addOpen, editViewing, openAdd]);

  const handleUpdate = useCallback(() => {
    if (!editViewing) return;
    updateMutation.mutate({
      id: editViewing.id,
      payload: {
        title: form.title.trim(),
        address: form.address.trim() || null,
        notes: form.notes.trim() || null,
        pro_points: form.pro_points.trim() || null,
        contra_points: form.contra_points.trim() || null,
        rating: form.rating || null,
        contact_name: form.contact_name.trim() || null,
        contact_phone: form.contact_phone.trim() || null,
        visited_at: form.visited_at ? new Date(form.visited_at).toISOString() : null,
        checklist: form.checklist ?? null,
      },
    });
  }, [editViewing, form, updateMutation]);

  return (
    <div className="container max-w-4xl py-6 space-y-6 min-w-0">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 min-w-0">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold flex items-center gap-2 break-words">
            <Camera className="h-7 w-7 text-amber-500" />
            Besichtigungen
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Notizen, Bilder und Videos zu Immobilien-Besichtigungen festhalten
          </p>
        </div>
        <div className="flex gap-2 shrink-0">
          {filteredViewings.length > 0 && (
            <Button variant="outline" size="sm" onClick={handleExportCsv} aria-label="Als CSV exportieren">
              CSV
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={() => openAdd(true)} className="shrink-0 touch-target min-h-[44px]" aria-label="Schnell erfassen">
            <Zap className="h-4 w-4 mr-2" />
            Schnell
          </Button>
          <Button onClick={() => openAdd(false)} className="shrink-0 touch-target min-h-[44px]" aria-label="Neue Besichtigung anlegen">
            <Plus className="h-4 w-4 mr-2" />
            Neue Besichtigung
            <span className="hidden sm:inline ml-1 text-xs opacity-70">(n)</span>
          </Button>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Suchen (Titel, Adresse, Pro, Kontra…)"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
            aria-label="Besichtigungen durchsuchen"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <select
            value={sortKey}
            onChange={(e) => setSortKey(e.target.value as typeof sortKey)}
            className="h-9 rounded-md border border-input bg-background px-2 text-sm"
            aria-label="Sortieren nach"
          >
            {SORT_OPTIONS.map((o) => (
              <option key={o.key} value={o.key}>{o.label}</option>
            ))}
          </select>
          <Button variant="ghost" size="sm" onClick={() => setSortAsc((a) => !a)} aria-label={sortAsc ? "Aufsteigend" : "Absteigend"}>
            {sortAsc ? "↑" : "↓"}
          </Button>
          <select
            value={ratingFilter ?? "all"}
            onChange={(e) => setRatingFilter(e.target.value === "all" ? null : Number(e.target.value))}
            className="h-9 rounded-md border border-input bg-background px-2 text-sm"
            aria-label="Filter Bewertung"
          >
            <option value="all">Alle Bewertungen</option>
            {[5, 4, 3, 2, 1].map((r) => (
              <option key={r} value={r}>★ {r}+</option>
            ))}
          </select>
        </div>
      </div>

      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="animate-pulse">
              <CardHeader className="pb-2">
                <div className="h-5 bg-muted rounded w-3/4" />
                <div className="h-4 bg-muted rounded w-1/2 mt-2" />
              </CardHeader>
            </Card>
          ))}
        </div>
      ) : filteredViewings.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <Camera className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="font-medium mb-1">Keine Besichtigungen</h3>
            <p className="text-sm text-muted-foreground mb-6 max-w-sm">
              Legen Sie eine Besichtigung an, um Notizen, Pro/Kontra-Punkte, Bilder und Videos zu erfassen.
            </p>
            <p className="text-xs text-muted-foreground mb-4">
              Tipp: Deals in Stage „Besichtigung“ erzeugen automatisch einen Besichtigungseintrag.{" "}
              <Link to={ROUTES.DEALS} className="text-primary hover:underline">Zu Deals</Link>
              <span className="text-muted-foreground mx-1">·</span>
              <Link to={ROUTES.DOKUMENTE} className="text-primary hover:underline">Dokumente</Link>
              <span className="text-muted-foreground mx-1">·</span>
              <Link to={ROUTES.CRM_SCOUT} className="text-primary hover:underline">WGH finden</Link>
            </p>
            <Button onClick={() => openAdd(false)} className="touch-target min-h-[44px]">
              <Plus className="h-4 w-4 mr-2" />
              Erste Besichtigung anlegen
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2" data-testid="viewing-list" role="list">
          {filteredViewings.map((v) => (
            <ViewingCard
              key={v.id}
              viewing={v}
              mediaCount={mediaCountMap[v.id] ?? 0}
              onClick={() => openEdit(v)}
            />
          ))}
        </div>
      )}

      {/* Add/Edit Dialog */}
      <ResponsiveDialog open={addOpen || !!editViewing} onOpenChange={(o) => {
        if (!o) {
          setAddOpen(false);
          setEditViewing(null);
        }
      }}>
        <ResponsiveDialogHeader>
          <ResponsiveDialogTitle>
            {editViewing ? "Besichtigung bearbeiten" : quickAdd ? "Schnell erfassen" : "Neue Besichtigung"}
          </ResponsiveDialogTitle>
        </ResponsiveDialogHeader>
        <div className="space-y-4 px-6 pb-6">
          {editViewing && (
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => createTodoFromViewing(editViewing)}
                className="gap-1.5"
              >
                <ListTodo className="h-4 w-4" />
                Todo erstellen
              </Button>
              {(editViewing.title?.trim() || editViewing.address?.trim()) && (
                <Link
                  to={`${ROUTES.CRM_SCOUT}&q=${encodeURIComponent([editViewing.title, editViewing.address].filter(Boolean).join(", "))}`}
                  className="inline-flex items-center gap-1.5 rounded-md border border-input bg-background px-3 py-2 text-sm font-medium hover:bg-accent hover:text-accent-foreground transition-colors touch-target min-h-[36px]"
                  onClick={() => { setAddOpen(false); setEditViewing(null); }}
                  aria-label="Gewerbe in Umgebung suchen"
                >
                  <Store className="h-3.5 w-3.5" /> Gewerbe in Umgebung
                </Link>
              )}
              <Button
                variant="ghost"
                size="sm"
                className="text-xs gap-1.5"
                onClick={() => {
                  const url = `${window.location.origin}/besichtigungen?id=${editViewing.id}`;
                  share({
                    title: editViewing.title,
                    text: editViewing.address || undefined,
                    url,
                  });
                }}
              >
                <Share2 className="h-3.5 w-3.5" /> Teilen
              </Button>
            </div>
          )}
          {editViewing?.deal_id && (
            <div className="rounded-lg bg-primary/5 border border-primary/20 p-3 flex items-center justify-between gap-2">
              <span className="text-sm font-medium flex items-center gap-2">
                <Link2 className="h-4 w-4 text-primary" />
                Mit Deal verknüpft
              </span>
              <Link
                to="/deals"
                className="text-sm text-primary hover:underline flex items-center gap-1"
                onClick={() => { setAddOpen(false); setEditViewing(null); }}
              >
                Zu Deals <ChevronRight className="h-4 w-4" />
              </Link>
            </div>
          )}
          <div>
            <label className="text-sm font-medium" htmlFor="besichtigung-titel">Titel / Adresse *</label>
            <Input
              id="besichtigung-titel"
              placeholder="z.B. Musterstr. 5, 10115 Berlin"
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              className="mt-1"
              aria-required="true"
              aria-label="Titel oder Adresse der Besichtigung"
            />
          </div>
          <div>
            <label className="text-sm font-medium" htmlFor="besichtigung-adresse">Adresse (Zusatz)</label>
            <Input
              id="besichtigung-adresse"
              placeholder="Wohnung, Etage, Objekt"
              value={form.address}
              onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
              className="mt-1"
              aria-label="Zusätzliche Adressangaben"
            />
          </div>
          {(!quickAdd || editViewing) && (
          <>
          <div>
            <label className="text-sm font-medium" htmlFor="besichtigung-datum">Datum der Besichtigung</label>
            <Input
              id="besichtigung-datum"
              type="datetime-local"
              value={form.visited_at}
              onChange={(e) => setForm((f) => ({ ...f, visited_at: e.target.value }))}
              className="mt-1"
              aria-label="Datum und Uhrzeit der Besichtigung"
            />
          </div>
          <div>
            <label className="text-sm font-medium" htmlFor="besichtigung-notes">Notizen</label>
            <Textarea
              id="besichtigung-notes"
              placeholder="Gedanken, Eindrücke, Mängel, Highlights…"
              value={form.notes}
              onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
              rows={4}
              className="mt-1 resize-none"
              aria-label="Notizen zur Besichtigung"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium flex items-center gap-1">
                <ThumbsUp className="h-4 w-4 text-green-500" /> Pro
              </label>
              <Textarea
                placeholder="Lage, Zustand, Preis…"
                value={form.pro_points}
                onChange={(e) => setForm((f) => ({ ...f, pro_points: e.target.value }))}
                rows={3}
                className="mt-1 resize-none"
              />
            </div>
            <div>
              <label className="text-sm font-medium flex items-center gap-1">
                <ThumbsDown className="h-4 w-4 text-red-500" /> Kontra
              </label>
              <Textarea
                placeholder="Lärm, Renovierung, Baujahr…"
                value={form.contra_points}
                onChange={(e) => setForm((f) => ({ ...f, contra_points: e.target.value }))}
                rows={3}
                className="mt-1 resize-none"
              />
            </div>
          </div>
          <div>
            <label className="text-sm font-medium">Bewertung (1–5)</label>
            <div className="flex gap-1 mt-2">
              {[1, 2, 3, 4, 5].map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setForm((f) => ({ ...f, rating: f.rating === r ? 0 : r }))}
                  aria-pressed={form.rating >= r}
                  aria-label={`Bewertung ${r} von 5 ${form.rating >= r ? "ausgewählt" : "wählen"}`}
                  className={cn(
                    "p-2 rounded-md transition-colors",
                    form.rating >= r ? "text-amber-500" : "text-muted-foreground hover:text-amber-400"
                  )}
                >
                  <Star className={cn("h-6 w-6", form.rating >= r && "fill-current")} />
                </button>
              ))}
            </div>
          </div>
          {editViewing && (
            <div>
              <label className="text-sm font-medium">Checkliste</label>
              <div className="mt-2 grid grid-cols-2 sm:grid-cols-3 gap-2">
                {(form.checklist || DEFAULT_CHECKLIST).map((item) => (
                  <label key={item.id} className="flex items-center gap-2 text-sm cursor-pointer">
                    <input
                      type="checkbox"
                      checked={item.checked}
                      onChange={() => {
                        setForm((f) => ({
                          ...f,
                          checklist: (f.checklist || DEFAULT_CHECKLIST).map((i) =>
                            i.id === item.id ? { ...i, checked: !i.checked } : i
                          ),
                        }));
                      }}
                      className="rounded"
                    />
                    <span className={item.checked ? "line-through text-muted-foreground" : ""}>{item.label}</span>
                  </label>
                ))}
              </div>
            </div>
          )}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium">Kontakt (Makler/Agent)</label>
              <Input
                placeholder="Name"
                value={form.contact_name}
                onChange={(e) => setForm((f) => ({ ...f, contact_name: e.target.value }))}
                className="mt-1"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Telefon</label>
              <Input
                placeholder="+49 …"
                value={form.contact_phone}
                onChange={(e) => setForm((f) => ({ ...f, contact_phone: e.target.value }))}
                className="mt-1"
              />
            </div>
          </div>
          </>
          )}

          {editViewing && (
            <ViewingAISummary
              title={form.title}
              address={form.address || null}
              notes={form.notes || null}
              pro_points={form.pro_points || null}
              contra_points={form.contra_points || null}
              rating={form.rating || null}
            />
          )}
          {editViewing && (
            <ViewingMediaSection
              viewingId={editViewing.id}
              onInvalidate={() => {
                qc.invalidateQueries({ queryKey: queryKeys.viewings.all });
                qc.invalidateQueries({ queryKey: queryKeys.viewings.media(editViewing.id) });
              }}
            />
          )}
        </div>
        <div className="flex justify-end gap-2 px-6 pb-6">
          {editViewing && (
            <Button
              variant="destructive"
              onClick={() => setDeleteId(editViewing.id)}
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Löschen
            </Button>
          )}
          <div className="flex-1" />
          {editViewing ? (
            <Button onClick={handleUpdate} disabled={updateMutation.isPending}>
              {updateMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Speichern
            </Button>
          ) : (
            <Button onClick={handleCreate} disabled={createMutation.isPending || !form.title.trim()}>
              {createMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Anlegen
            </Button>
          )}
        </div>
      </ResponsiveDialog>

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Besichtigung löschen?</AlertDialogTitle>
            <AlertDialogDescription>
              Alle Notizen, Bilder und Videos werden unwiderruflich entfernt.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground"
              onClick={() => deleteId && deleteMutation.mutate(deleteId)}
            >
              Löschen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

function ViewingMediaSection({
  viewingId,
  onInvalidate,
}: {
  viewingId: string;
  onInvalidate: () => void;
}) {
  const { user } = useAuth();
  const [uploading, setUploading] = useState(false);

  const { data: media = [] } = useQuery({
    queryKey: queryKeys.viewings.media(viewingId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("viewing_media")
        .select("*")
        .eq("viewing_id", viewingId)
        .order("sort_order");
      if (error) throw error;
      return (data || []) as ViewingMediaRecord[];
    },
  });

  const uploadFile = useCallback(
    async (file: File) => {
      if (!user) return;
      if (file.size > MAX_MEDIA_SIZE) {
        toast.error("Max. 20 MB pro Datei");
        return;
      }
      const isVideo = file.type.startsWith("video/");
      const path = `${user.id}/viewings/${viewingId}/${Date.now()}_${file.name}`;

      setUploading(true);
      const { error: uploadError } = await supabase.storage
        .from("property-documents")
        .upload(path, file);

      if (uploadError) {
        handleError(uploadError, { context: "file", toastMessage: "Upload fehlgeschlagen" });
        setUploading(false);
        return;
      }

      const { error: dbError } = await supabase.from("viewing_media").insert({
        viewing_id: viewingId,
        file_path: path,
        file_type: isVideo ? "video" : "image",
        sort_order: media.length,
      } as never);

      if (dbError) {
        toast.error("Metadaten konnten nicht gespeichert werden");
      } else {
        toast.success(file.name + " hochgeladen");
        onInvalidate();
      }
      setUploading(false);
    },
    [user, viewingId, media.length, onInvalidate]
  );

  const removeMedia = useCallback(
    async (m: ViewingMediaRecord) => {
      await supabase.storage.from("property-documents").remove([m.file_path]);
      await supabase.from("viewing_media").delete().eq("id", m.id);
      onInvalidate();
    },
    [onInvalidate]
  );

  return (
    <div role="region" aria-label="Bilder und Videos">
      <label className="text-sm font-medium flex items-center gap-2 mb-2" id="viewing-media-label">
        <Image className="h-4 w-4" /> Bilder & Videos
      </label>
      <div className="flex flex-wrap gap-3" aria-labelledby="viewing-media-label">
        {media.map((m) => (
          <MediaThumb key={m.id} record={m} onRemove={() => removeMedia(m)} />
        ))}
        <FileImportPicker
          accept={`${IMAGE_TYPES},${VIDEO_TYPES}`}
          multiple
          onFile={(f) => uploadFile(f)}
          onFiles={(files) => files.forEach((f) => uploadFile(f))}
          disabled={uploading}
          maxSize={MAX_MEDIA_SIZE}
          label={uploading ? "Hochladen…" : "Hinzufügen"}
          variant="outline"
          size="sm"
        />
      </div>
    </div>
  );
}

function MediaThumb({
  record,
  onRemove,
}: {
  record: ViewingMediaRecord;
  onRemove: () => void;
}) {
  const [url, setUrl] = useState<string | null>(null);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    getSignedUrl(record.file_path)
      .then(setUrl)
      .catch(() => setLoadError(true));
  }, [record.file_path]);

  const isVideo = record.file_type === "video";

  if (loadError) {
    return (
      <div className="w-20 h-20 rounded-lg bg-muted flex items-center justify-center">
        <FileText className="h-8 w-8 text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="relative group w-24 h-24 rounded-lg overflow-hidden bg-muted shrink-0">
      {url && isVideo ? (
        <video src={url} className="w-full h-full object-cover" muted />
      ) : url ? (
        <img src={url} alt="" className="w-full h-full object-cover" />
      ) : (
        <div className="w-full h-full flex items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      )}
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onRemove();
        }}
        onKeyDown={(e) => e.key === "Enter" && onRemove()}
        aria-label="Bild oder Video entfernen"
        className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 focus:opacity-100 flex items-center justify-center transition-opacity focus:outline-none focus:ring-2 focus:ring-primary"
      >
        <Trash2 className="h-6 w-6 text-white" />
      </button>
    </div>
  );
}

export default Besichtigungen;
