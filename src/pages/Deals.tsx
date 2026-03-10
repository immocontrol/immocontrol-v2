import { useState, useMemo, useEffect, useCallback, useRef } from "react";
import { useLocation, useNavigate, useSearchParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Plus, Building2, FileText, MapPin, Trash2, Clock, AlertTriangle, Search, X, Download, MessageSquare, Loader2, Camera, Share2, Sparkles, Store, CalendarCheck, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/formatters";
import { queryKeys } from "@/lib/queryKeys";
import { useDebounce } from "@/hooks/useDebounce";
import { TelegramDealImport, telegramDealToForm } from "@/components/TelegramDealImport";
import { useTelegramBot } from "@/hooks/useTelegramBot";
import { useSupabaseStorage } from "@/hooks/useSupabaseStorage";
import { useFormDraft } from "@/hooks/useFormDraft";
import { logAudit } from "@/lib/auditLog";
import { ResponsiveDialog, ResponsiveDialogHeader, ResponsiveDialogTitle } from "@/components/ResponsiveDialog";
import { LoadingButton } from "@/components/LoadingButton";
import { useSuccessAnimation, SuccessAnimation } from "@/components/SuccessAnimation";
import { useHaptic } from "@/hooks/useHaptic";
import { FloatingActionButton } from "@/components/FloatingActionButton";
import { DealToPropertyConverter } from "@/components/DealToPropertyConverter";
import { MobileSwipeableDealCard } from "@/components/mobile";
import { useIsMobile } from "@/hooks/use-mobile";
import { extractPdfText } from "@/lib/exposeParser";
import { extractDealFromExposeText, isDeepSeekConfigured, suggestDealNextStep, improveText } from "@/integrations/ai/extractors";
import { calculateDealScore } from "@/lib/dealScoring";
import { DealPipelineChecklist } from "@/components/DealPipelineChecklist";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { sanitizeFormData } from "@/lib/sanitize";
import { useShare } from "@/components/mobile/MobileShareSheet";
import { handleError } from "@/lib/handleError";
import { toastErrorWithRetry } from "@/lib/toastMessages";
import { ROUTES, dealsWithId } from "@/lib/routes";
import { EmptyState } from "@/components/EmptyState";
import { DealRecord, STAGES, stageMap, emptyForm } from "./deals/DealTypes";
import { DealCard } from "./deals/DealCard";
import { isFormValid, formatDealCurrency as fmt, SORT_OPTIONS, filterAndSortDeals, type SortKey } from "./deals/dealUtils";

const Deals = () => {
  const { user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { share } = useShare();
  const queryClient = useQueryClient();
  const haptic = useHaptic();
  const isMobile = useIsMobile();
  const { visible: successVisible, trigger: triggerSuccess } = useSuccessAnimation();
  const [addOpen, setAddOpen] = useState(false);
  const [editDeal, setEditDeal] = useState<DealRecord | null>(null);
  /* Improvement 18: Form Draft Recovery — auto-save deal form to sessionStorage */
  const { values: form, setValues: setForm, clearDraft: clearDealDraft, hasDraft: hasDealDraft } = useFormDraft("deals", { ...emptyForm });
  const [viewMode, setViewMode] = useState<"kanban" | "list">("kanban");
  /* UPD-18: Search and filter state */
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 250);
  const [sortKey, setSortKey] = useState<SortKey>("created_at");
  const [sortAsc, setSortAsc] = useState(false);
  /* UPD-19: Delete confirmation dialog state */
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  /* SYNERGY: WGH-Scout „Erste 10 als Deals“ – Batch aus Scout-Treffern nacheinander anlegen */
  const [scoutBatch, setScoutBatch] = useState<Array<{ name: string; address?: string | null; phone?: string | null; email?: string | null }>> | null>(null);
  const [scoutBatchIndex, setScoutBatchIndex] = useState(0);
  /* Exposé-Analyse: Ladezustand + Deal-Score nach PDF-Import */
  const [exposeAnalyzing, setExposeAnalyzing] = useState(false);
  const [dealScore, setDealScore] = useState<number | null>(null);
  const [scoreReason, setScoreReason] = useState<string | null>(null);
  /* AI: Nächster Deal-Schritt (suggestDealNextStep) */
  const [nextStepLoading, setNextStepLoading] = useState(false);
  const [improveNotesLoading, setImproveNotesLoading] = useState(false);

  /* FUNC-12: Kanban Drag & Drop between stages */
  const [draggedDeal, setDraggedDeal] = useState<DealRecord | null>(null);
  const [dragOverStage, setDragOverStage] = useState<string | null>(null);
  const lastLinkViewingRef = useRef<{ viewingId: string } | null>(null);
  const lastDeletedDealIdRef = useRef<string | null>(null);
  const lastMoveDealRef = useRef<{ id: string; stage: string; deal?: DealRecord } | null>(null);
  const lastBatchImportRef = useRef<(typeof emptyForm)[] | null>(null);

  /* SYNERGY: Load contacts for contact picker */
  const { data: contacts = [] } = useQuery({
    queryKey: queryKeys.contacts.all,
    queryFn: async () => {
      const { data } = await supabase.from("contacts").select("id, name, phone, email").is("deleted_at", null).order("name");
      return (data || []) as { id: string; name: string; phone: string | null; email: string | null }[];
    },
    enabled: !!user && addOpen,
  });

  /* SYNERGY: Load viewings for Besichtigungs-Picker when stage besichtigung */
  const { data: viewings = [] } = useQuery({
    queryKey: [...queryKeys.viewings.all, "for-deal-picker", editDeal?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("property_viewings")
        .select("id, title, address, deal_id, visited_at")
        .or(editDeal ? `deal_id.is.null,deal_id.eq.${editDeal.id}` : "deal_id.is.null")
        .order("visited_at", { ascending: false, nullsFirst: false })
        .limit(30);
      return (data || []) as { id: string; title: string; address: string | null; deal_id: string | null; visited_at: string | null }[];
    },
    enabled: !!user && addOpen && (form.stage === "besichtigung") && !!editDeal,
  });

  /* SYNERGY: Link viewing to deal mutation */
  const linkViewingToDeal = useMutation({
    mutationFn: async ({ viewingId }: { viewingId: string }) => {
      if (!editDeal) throw new Error("Kein Deal ausgewählt");
      const { error } = await supabase.from("property_viewings").update({ deal_id: editDeal.id }).eq("id", viewingId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.viewings.all });
      toast.success("Besichtigung zugeordnet");
    },
    onError: (e: unknown) => {
      handleError(e, { context: "supabase", details: "property_viewings.update (deal_id)", showToast: false });
      toastErrorWithRetry(e instanceof Error ? e.message : "Fehler beim Zuordnen", () => { if (lastLinkViewingRef.current) linkViewingToDeal.mutate(lastLinkViewingRef.current); });
    },
  });

  /* UPD-20: Use centralised query keys */
  const { data: deals = [], isLoading } = useQuery({
    queryKey: [...queryKeys.deals.all, user?.id],
    queryFn: async () => {
      const { data, error } = await supabase.from("deals").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data as DealRecord[];
    },
    enabled: !!user,
  });

  const saveDeal = useMutation({
    mutationFn: async () => {
      /* UPD-21: Safe yield calculation -- handle division by zero */
      const yld = form.expected_rent && form.purchase_price && form.purchase_price > 0
        ? ((form.expected_rent * 12) / form.purchase_price) * 100
        : 0;
      const payload = sanitizeFormData({ ...form, user_id: user!.id, expected_yield: yld } as Record<string, unknown>) as typeof form & { user_id: string; expected_yield: number };
      if (editDeal) {
        const { error } = await supabase.from("deals").update(payload).eq("id", editDeal.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("deals").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      /* Improvement 16: Audit log integration */
      logAudit(editDeal ? "update" : "create", "deal", {
        entityName: form.title,
        entityId: editDeal?.id,
        details: editDeal ? "Deal aktualisiert" : "Neuer Deal angelegt",
        userId: user?.id,
      });
      queryClient.invalidateQueries({ queryKey: queryKeys.deals.all });
      /* UX-4: Haptic feedback + UX-15: Success animation on save */
      haptic.success();
      triggerSuccess();
      toast.success(editDeal ? "Deal aktualisiert" : "Deal angelegt");
      setAddOpen(false);
      setEditDeal(null);
      setScoutBatch(null);
      setScoutBatchIndex(0);
      clearDealDraft();
    },
    onError: (e: unknown) => {
      handleError(e, { context: "supabase", details: "deals.insert/update", showToast: false });
      toastErrorWithRetry(e instanceof Error ? e.message : "Fehler beim Speichern", () => saveDeal.mutate());
    },
  });

  const deleteDeal = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("deals").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_data, id) => {
      const d = deals.find(x => x.id === id);
      logAudit("delete", "deal", { entityId: id, entityName: d?.title, details: "Deal gelöscht", userId: user?.id });
      queryClient.invalidateQueries({ queryKey: queryKeys.deals.all });
      haptic.medium();
      toast.success("Deal gelöscht");
      setDeleteTarget(null);
    },
    onError: (e: unknown) => {
      handleError(e, { context: "supabase", details: "deals.delete", showToast: false });
      toastErrorWithRetry("Löschen fehlgeschlagen", () => { if (lastDeletedDealIdRef.current) deleteDeal.mutate(lastDeletedDealIdRef.current); });
      setDeleteTarget(null);
    },
  });

  const moveDeal = useMutation({
    mutationFn: async ({ id, stage, deal }: { id: string; stage: string; deal?: DealRecord }) => {
      const { error } = await supabase.from("deals").update({ stage }).eq("id", id);
      if (error) throw error;

      /* BESICHTIGUNG-AUTO: Wenn Deal auf Besichtigung gesetzt wird, automatisch Besichtigungseintrag anlegen */
      if (stage === "besichtigung" && deal && user) {
        const { data: existing } = await supabase
          .from("property_viewings")
          .select("id")
          .eq("deal_id", id)
          .eq("user_id", user.id)
          .limit(1)
          .maybeSingle();
        if (!existing) {
          const notesParts: string[] = [];
          if (deal.description?.trim()) notesParts.push(deal.description.trim());
          if (deal.notes?.trim()) notesParts.push(deal.notes.trim());
          const facts: string[] = [];
          if (deal.purchase_price && deal.purchase_price > 0) facts.push(`Kaufpreis: ${formatCurrency(deal.purchase_price)}`);
          if (deal.expected_rent && deal.expected_rent > 0) facts.push(`Miete: ${formatCurrency(deal.expected_rent)}/Monat`);
          if (deal.sqm && deal.sqm > 0) facts.push(`${deal.sqm} m²`);
          if (deal.units && deal.units > 1) facts.push(`${deal.units} Einheiten`);
          if (deal.property_type) facts.push(deal.property_type);
          if (deal.source) facts.push(`Quelle: ${deal.source}`);
          if (facts.length > 0) notesParts.push(facts.join(" · "));
          const notes = notesParts.length > 0 ? notesParts.join("\n\n") : null;

          const { error: insErr } = await supabase.from("property_viewings").insert({
            user_id: user.id,
            deal_id: id,
            title: deal.title || "Unbenannte Besichtigung",
            address: deal.address || null,
            notes,
            contact_name: deal.contact_name || null,
            contact_phone: deal.contact_phone || null,
            visited_at: new Date().toISOString(),
          } as never);
          if (!insErr) {
            toast.success("Besichtigung angelegt — Notizen & Fotos unter Besichtigungen hinzufügen");
          }
        }
      }
    },
    onSuccess: (_, { stage }) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.deals.all });
      if (stage === "besichtigung") {
        queryClient.invalidateQueries({ queryKey: queryKeys.viewings.all });
      }
    },
    onError: (e: unknown) => {
      handleError(e, { context: "supabase", details: "deals.update (stage)", showToast: false });
      toastErrorWithRetry("Verschieben fehlgeschlagen", () => { if (lastMoveDealRef.current) moveDeal.mutate(lastMoveDealRef.current); });
    },
  });

  const exposePdfFileRef = useRef<File | null>(null);
  const handleExposePdf = async (file: File) => {
    if (!file?.name?.toLowerCase().endsWith(".pdf")) {
      toast.error("Bitte eine PDF-Datei wählen.");
      return;
    }
    exposePdfFileRef.current = file;
    setExposeAnalyzing(true);
    setDealScore(null);
    setScoreReason(null);
    try {
      const text = await extractPdfText(file);
      if (!text || text.trim().length < 80) {
        toast.error("Im Exposé wurde zu wenig Text gefunden.");
        setExposeAnalyzing(false);
        return;
      }
      const extracted = await extractDealFromExposeText(text);
      setForm((prev) => ({
        ...prev,
        ...(extracted.title != null && extracted.title !== "" && { title: extracted.title }),
        ...(extracted.address != null && extracted.address !== "" && { address: extracted.address }),
        ...(extracted.description != null && extracted.description !== "" && { description: extracted.description }),
        ...(typeof extracted.purchase_price === "number" && { purchase_price: extracted.purchase_price }),
        ...(typeof extracted.expected_rent === "number" && { expected_rent: extracted.expected_rent }),
        ...(typeof extracted.sqm === "number" && extracted.sqm > 0 && { sqm: extracted.sqm }),
        ...(typeof extracted.units === "number" && extracted.units > 0 && { units: extracted.units }),
        ...(extracted.property_type && ["ETW", "MFH", "EFH", "Gewerbe", "Grundstück"].includes(extracted.property_type) && { property_type: extracted.property_type }),
        ...(extracted.contact_name != null && { contact_name: extracted.contact_name ?? "" }),
        ...(extracted.contact_phone != null && { contact_phone: extracted.contact_phone ?? "" }),
        ...(extracted.contact_email != null && { contact_email: extracted.contact_email ?? "" }),
        ...(extracted.source != null && { source: extracted.source ?? "" }),
        ...(extracted.notes != null && { notes: extracted.notes ?? "" }),
      }));
      if (typeof extracted.deal_score === "number") setDealScore(extracted.deal_score);
      if (extracted.score_reason) setScoreReason(extracted.score_reason);
      toast.success("Exposé ausgewertet. Felder übernommen.");
    } catch (e: unknown) {
      handleError(e, { context: "general", showToast: false });
      toastErrorWithRetry(e instanceof Error ? e.message : "Exposé-Analyse fehlgeschlagen.", () => {
        if (exposePdfFileRef.current) handleExposePdf(exposePdfFileRef.current);
      });
    } finally {
      setExposeAnalyzing(false);
    }
  };

  const runImproveNotes = useCallback(async () => {
    setImproveNotesLoading(true);
    try {
      const improved = await improveText(form.notes || "", "Deal-Notizen (Immobilie, Besichtigung, Verhandlung)");
      setForm(p => ({ ...p, notes: improved }));
      toast.success("Notizen überarbeitet");
    } catch (e: unknown) {
      handleError(e, { context: "general", showToast: false });
      toastErrorWithRetry((e instanceof Error ? e.message : "Text verbessern fehlgeschlagen"), runImproveNotes);
    } finally {
      setImproveNotesLoading(false);
    }
  }, [form.notes]);

  const runNextStep = useCallback(async () => {
    setNextStepLoading(true);
    try {
      const step = await suggestDealNextStep({
        stage: form.stage,
        title: form.title || undefined,
        address: form.address || undefined,
        notes: form.notes || undefined,
        createdAt: editDeal?.created_at,
      });
      const prefix = form.notes?.trim() ? "\n\n" : "";
      setForm(p => ({ ...p, notes: (p.notes || "").trimEnd() + prefix + step }));
      toast.success("KI-Vorschlag übernommen");
    } catch (e: unknown) {
      handleError(e, { context: "general", showToast: false });
      toastErrorWithRetry((e instanceof Error ? e.message : "KI-Vorschlag fehlgeschlagen"), runNextStep);
    } finally {
      setNextStepLoading(false);
    }
  }, [form.stage, form.title, form.address, form.notes, editDeal?.created_at]);

  /* UPD-24: Batch import mutation for Telegram deals */
  const batchImport = useMutation({
    mutationFn: async (dealForms: (typeof emptyForm)[]) => {
      const payloads = dealForms.map(f => ({
        ...f,
        user_id: user!.id,
        expected_yield: f.expected_rent && f.purchase_price && f.purchase_price > 0
          ? ((f.expected_rent * 12) / f.purchase_price) * 100 : 0,
      }));
      const { error } = await supabase.from("deals").insert(payloads);
      if (error) throw error;
      return payloads.length;
    },
    onSuccess: (count) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.deals.all });
      toast.success(`${count} Deal${count > 1 ? "s" : ""} aus Telegram importiert`);
    },
    onError: (e: unknown) => {
      handleError(e, { context: "supabase", details: "deals.insert (batch)", showToast: false });
      toastErrorWithRetry("Import fehlgeschlagen", () => { if (lastBatchImportRef.current?.length) batchImport.mutate(lastBatchImportRef.current); });
    },
  });

  /* TELEGRAM-AUTO-1: Auto-import deals from Telegram Bot API (no manual paste required) */
  const telegram = useTelegramBot();
  const [telegramAutoImportEnabled] = useSupabaseStorage<boolean>("immo-telegram-auto-import-enabled", true);
  const [telegramDealChatId] = useSupabaseStorage<number | null>("immo-telegram-deal-chat-id", null);
  const [telegramDealChatTitleIncludes] = useSupabaseStorage<string>("immo-telegram-deal-chat-title", "");
  const importedTelegramNotesRef = useRef<Set<string>>(new Set());
  const telegramPollInFlight = useRef(false);
  const batchImportMutateRef = useRef(batchImport.mutate);
  batchImportMutateRef.current = batchImport.mutate;

  useEffect(() => {
    importedTelegramNotesRef.current = new Set(
      deals
        .filter((d) => (d.source || "").toLowerCase().includes("telegram") && typeof d.notes === "string" && d.notes.length > 0)
        .map((d) => d.notes as string),
    );
  }, [deals]);

  useEffect(() => {
    if (!user || !telegramAutoImportEnabled || !telegram.token || isLoading) return;

    let cancelled = false;

    const pollOnce = async () => {
      if (telegramPollInFlight.current) return;
      telegramPollInFlight.current = true;
      try {
        const parsedDeals = await telegram.fetchMessages({
          ...(typeof telegramDealChatId === "number" ? { allowedChatId: telegramDealChatId } : {}),
          ...(typeof telegramDealChatId !== "number" && telegramDealChatTitleIncludes
            ? { chatTitleIncludes: telegramDealChatTitleIncludes }
            : {}),
        });

        if (cancelled || parsedDeals.length === 0) return;

        const dealForms = parsedDeals
          .map(telegramDealToForm)
          .filter((f) => {
            const note = typeof f.notes === "string" ? f.notes : "";
            return note.length > 0 && !importedTelegramNotesRef.current.has(note);
          });

        if (dealForms.length === 0) return;

        for (const f of dealForms) {
          if (typeof f.notes === "string" && f.notes.length > 0) {
            importedTelegramNotesRef.current.add(f.notes);
          }
        }

        batchImportMutateRef.current(dealForms);
      } finally {
        telegramPollInFlight.current = false;
      }
    };

    pollOnce();
    const interval = window.setInterval(pollOnce, 30_000);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [user, telegramAutoImportEnabled, telegram.token, telegram.fetchMessages, telegramDealChatId, telegramDealChatTitleIncludes, isLoading]);

  const openEdit = useCallback((deal: DealRecord) => {
    setEditDeal(deal);
    setForm({
      title: deal.title, address: deal.address || "", description: deal.description || "",
      stage: deal.stage, purchase_price: deal.purchase_price || 0, expected_rent: deal.expected_rent || 0,
      sqm: deal.sqm || 0, units: deal.units || 1, property_type: deal.property_type || "ETW",
      contact_name: deal.contact_name || "", contact_phone: deal.contact_phone || "",
      contact_email: deal.contact_email || "", source: deal.source || "", notes: deal.notes || "",
      lost_reason: deal.lost_reason || "",
    });
    setAddOpen(true);
  }, []);

  /* UPD-25: Memoized stats calculations */
  /* FUND-17: NaN/Infinity guards on all derived stats — prevents broken UI from invalid dates */
  const stats = useMemo(() => {
    const active = deals.filter(d => d.stage !== "abgelehnt" && d.stage !== "abgeschlossen");
    const won = deals.filter(d => d.stage === "abgeschlossen");
    const totalVol = active.reduce((s, d) => s + (d.purchase_price || 0), 0);
    const rawAvgAge = active.length > 0
      ? active.reduce((s, d) => {
          const age = Math.floor((Date.now() - new Date(d.created_at).getTime()) / 86400000);
          return s + (Number.isFinite(age) ? age : 0);
        }, 0) / active.length
      : 0;
    const avgAge = Number.isFinite(rawAvgAge) ? Math.round(rawAvgAge) : 0;
    const withPrice = deals.filter(d => (d.purchase_price ?? 0) > 0);
    const rawAvgVal = withPrice.length > 0
      ? withPrice.reduce((s, d) => s + (d.purchase_price || 0), 0) / withPrice.length
      : 0;
    const avgVal = Number.isFinite(rawAvgVal) ? rawAvgVal : 0;
    const rawVelocity = active.length > 0
      ? active.reduce((s, d) => s + (Date.now() - new Date(d.created_at).getTime()) / 86400000, 0) / active.length
      : 0;
    const velocity = Number.isFinite(rawVelocity) ? Math.round(rawVelocity) : 0;
    const conversion = deals.length > 0 ? Math.round((won.length / deals.length) * 100) : 0;
    return { active, won, totalVol, avgAge, avgVal, velocity, conversion };
  }, [deals]);

  /* UPD-26: Memoized stage conversion rates */
  const stageConversionRates = useMemo(() => {
    const rates: Record<string, number> = {};
    STAGES.forEach((stage, idx) => {
      const inStage = deals.filter(d => d.stage === stage.key).length;
      const later = STAGES.slice(idx + 1).filter(s => s.key !== "abgelehnt").map(s => s.key);
      const progressed = deals.filter(d => later.includes(d.stage)).length;
      const total = inStage + progressed;
      rates[stage.key] = total > 0 ? Math.round((progressed / total) * 100) : 0;
    });
    return rates;
  }, [deals]);

  /* UPD-27: Memoized source analytics */
  const sourceAnalytics = useMemo(() => {
    const sources: Record<string, number> = {};
    deals.forEach(d => {
      const src = d.source || "Unbekannt";
      sources[src] = (sources[src] || 0) + 1;
    });
    return sources;
  }, [deals]);

  /* UPD-28: Pipeline value per stage */
  const stageValues = useMemo(() => {
    return STAGES.reduce((acc, s) => {
      acc[s.key] = deals
        .filter(d => d.stage === s.key)
        .reduce((sum, d) => sum + (d.purchase_price || 0), 0);
      return acc;
    }, {} as Record<string, number>);
  }, [deals]);

  /* UPD-29: Filtered and sorted deals for list view */
  const filteredDeals = useMemo(
    () => filterAndSortDeals(deals, debouncedSearch, sortKey, sortAsc),
    [deals, debouncedSearch, sortKey, sortAsc],
  );

  /* UPD-30: Export deals as CSV */
  const exportCSV = useCallback(() => {
    const header = "Titel;Adresse;Stage;Preis;Miete/Monat;Rendite;qm;Typ;Kontakt;Quelle;Erstellt\n";
    const esc = (v: string | number) => {
      const s = String(v);
      return s.includes(";") || s.includes('"') || s.includes("\n") ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const rows = deals.map(d =>
      [d.title, d.address || "", stageMap[d.stage]?.label || d.stage,
       d.purchase_price || 0, d.expected_rent || 0,
       d.expected_yield ? `${d.expected_yield.toFixed(1)}%` : "",
       d.sqm || 0, d.property_type || "", d.contact_name || "", d.source || "",
       new Date(d.created_at).toLocaleDateString("de-DE"),
      ].map(esc).join(";")
    ).join("\n");
    const blob = new Blob(["\uFEFF" + header + rows], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `deals-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    /* STRONG-16: Delay URL.revokeObjectURL — immediate revoke can race with download on slow devices */
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    toast.success("Deals als CSV exportiert");
  }, [deals]);

  /* SYNERGY: Filter by contact when navigating from Contacts (filterByContact) */
  useEffect(() => {
    const state = location.state as { filterByContact?: string };
    if (state?.filterByContact) {
      setSearch(state.filterByContact);
      navigate(location.pathname, { replace: true, state: {} });
      toast.info(`Filter: Deals für „${state.filterByContact}"`);
    }
  }, [location.state, navigate, location.pathname]);

  /* SYNERGY: Prefill deal form when navigating from CRM (fromLead), Contacts (fromContact) or WGH-Scout (fromScout) */
  useEffect(() => {
    const state = location.state as {
      fromLead?: { name: string; company?: string; phone?: string; email?: string; address?: string; notes?: string };
      fromContact?: { name: string; company?: string; phone?: string; email?: string; address?: string; notes?: string };
      fromScout?: { name: string; address?: string; phone?: string; email?: string };
      fromScoutBatch?: Array<{ name: string; address?: string | null; phone?: string | null; email?: string | null }>;
      fromProperty?: { title: string; address?: string };
    };
    const fromScoutBatch = state?.fromScoutBatch;
    if (Array.isArray(fromScoutBatch) && fromScoutBatch.length > 0) {
      setScoutBatch(fromScoutBatch);
      setScoutBatchIndex(0);
      const first = fromScoutBatch[0];
      setForm(p => ({
        ...p,
        title: first.name ?? "",
        address: first.address ?? "",
        contact_name: first.name ?? "",
        contact_phone: first.phone ?? "",
        contact_email: first.email ?? "",
        source: "WGH-Scout",
      }));
      setEditDeal(null);
      setAddOpen(true);
      navigate(location.pathname, { replace: true, state: {} });
      toast.info(`Scout-Batch: 1 von ${fromScoutBatch.length} – Deal anlegen, dann „Nächsten übernehmen“ für die weiteren.`);
      return;
    }
    const fromLead = state?.fromLead;
    const fromContact = state?.fromContact;
    const fromScout = state?.fromScout;
    const fromProperty = state?.fromProperty;
    const prefilled = fromLead || fromContact || fromScout || fromProperty;
    if (prefilled) {
      const name = "name" in prefilled ? prefilled.name : (fromProperty?.title ?? "");
      if (name || fromProperty?.title) {
        setForm(p => ({
          ...p,
          title: fromProperty ? fromProperty.title : name,
          address: (prefilled as { address?: string }).address || "",
          description: fromLead?.notes ?? fromContact?.notes ?? "",
          contact_name: fromLead?.name ?? fromContact?.name ?? "",
          contact_phone: fromLead?.phone ?? fromContact?.phone ?? fromScout?.phone ?? "",
          contact_email: fromLead?.email ?? fromContact?.email ?? fromScout?.email ?? "",
          source: fromLead ? "CRM" : fromContact ? "Kontakte" : fromScout ? "WGH-Scout" : fromProperty ? "Objekt" : p.source,
        }));
        setEditDeal(null);
        setAddOpen(true);
        navigate(location.pathname, { replace: true, state: {} });
        toast.info(fromLead ? "Deal-Vorlage aus CRM übernommen" : fromContact ? "Deal-Vorlage aus Kontakt übernommen" : fromScout ? "Deal-Vorlage aus WGH-Scout übernommen" : "Deal-Vorlage aus Objekt übernommen");
      }
    }
  }, [location.state, navigate, location.pathname]);

  /* SYNERGY: Deep-Link ?id= – open deal when navigating from GlobalSearch */
  useEffect(() => {
    const id = searchParams.get("id");
    if (!id || !deals.length || isLoading) return;
    const d = deals.find(x => x.id === id);
    if (d) {
      setForm({
        title: d.title, address: d.address || "", description: d.description || "",
        stage: d.stage, purchase_price: d.purchase_price || 0, expected_rent: d.expected_rent || 0,
        sqm: d.sqm || 0, units: d.units || 1, property_type: d.property_type || "ETW",
        contact_name: d.contact_name || "", contact_phone: d.contact_phone || "",
        contact_email: d.contact_email || "", source: d.source || "", notes: d.notes || "",
        lost_reason: d.lost_reason || "",
      });
      setEditDeal(d);
      setAddOpen(true);
      setSearchParams(prev => { const p = new URLSearchParams(prev); p.delete("id"); return p; }, { replace: true });
    }
  }, [searchParams, deals, isLoading, setSearchParams]);

  /* UPD-31: Keyboard shortcut -- press n to create new deal */
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "n" && !e.ctrlKey && !e.metaKey && !e.altKey && !addOpen) {
        const active = document.activeElement;
        if (active && (active.tagName === "INPUT" || active.tagName === "TEXTAREA" || active.tagName === "SELECT")) return;
        e.preventDefault();
        /* Fix: Only reset form if no draft exists — preserve draft for recovery */
        if (!hasDealDraft) setForm({ ...emptyForm });
        setEditDeal(null);
        setAddOpen(true);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
    /* STRONG-20: Added hasDealDraft to dependency array — handler reads hasDealDraft but it was missing */
  }, [addOpen, hasDealDraft]);

  /* UPD-32: Document title with deal count */
  useEffect(() => {
    document.title = `Deal Pipeline (${stats.active.length}) \u2013 ImmoControl`;
  }, [stats.active.length]);

  /* UPD-33: Clear lost_reason when stage changes away from abgelehnt */
  useEffect(() => {
    if (form.stage !== "abgelehnt" && form.lost_reason) {
      setForm(p => ({ ...p, lost_reason: "" }));
    }
  }, [form.stage, form.lost_reason]);

  /* UPD-34: Handle Telegram bulk import */
  const handleTelegramImport = useCallback((dealForms: (typeof emptyForm)[]) => {
    lastBatchImportRef.current = dealForms;
    batchImport.mutate(dealForms);
  }, [batchImport]);

  /* UPD-35: Loading skeleton */
  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-48 bg-secondary animate-pulse rounded" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 card-stagger-enter">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-16 bg-secondary animate-pulse rounded-lg" />
          ))}
        </div>
        <div className="flex gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="w-60 h-40 bg-secondary animate-pulse rounded-lg shrink-0" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight">Deal Pipeline</h1>
          <p className="text-muted-foreground text-sm">
            {stats.active.length} aktive Deals · {fmt(stats.totalVol)} Volumen
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {/* UPD-36: Telegram Import button */}
          <TelegramDealImport onImportDeals={handleTelegramImport} />
          {telegramAutoImportEnabled && telegram.token && (
            <span className="text-[10px] text-muted-foreground flex items-center gap-1">
              {telegram.loading ? <Loader2 className="h-3 w-3 animate-spin" /> : <MessageSquare className="h-3 w-3 text-[#0088cc]" />}
              Auto-Import
            </span>
          )}
          {/* UPD-37: CSV export button */}
          {deals.length > 0 && (
            <Button variant="outline" size="sm" onClick={exportCSV} className="gap-1.5" aria-label="Deals als CSV exportieren">
              <Download className="h-4 w-4" />
              <span className="hidden sm:inline">CSV</span>
            </Button>
          )}
          <div className="flex items-center gap-1 bg-secondary rounded-lg p-0.5">
            <Button variant={viewMode === "kanban" ? "default" : "ghost"} size="sm" className="text-xs h-7" onClick={() => setViewMode("kanban")}>Kanban</Button>
            <Button variant={viewMode === "list" ? "default" : "ghost"} size="sm" className="text-xs h-7" onClick={() => setViewMode("list")}>Liste</Button>
          </div>
          <Button size="sm" onClick={() => { if (!hasDealDraft) setForm({ ...emptyForm }); setEditDeal(null); setAddOpen(true); }} aria-label="Neuen Deal anlegen" className="touch-target min-h-[44px]">
            <Plus className="h-4 w-4 mr-1" /> Deal anlegen
          </Button>
        </div>
      </div>

      {/* UPD-38: Search bar */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="z. B. Adresse oder Deal-Titel"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="pl-9 pr-9 h-9 search-focus-ring"
          aria-label="Deals durchsuchen"
        />
        {search && (
          <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground" aria-label="Suche l\u00f6schen">
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Stats */}
      {/* UPD-8: Add stagger animation to deal stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 card-stagger-enter">
        <Card><CardContent className="p-3"><p className="text-xs text-muted-foreground">Aktive Deals</p><p className="text-xl font-bold">{stats.active.length}</p></CardContent></Card>
        <Card><CardContent className="p-3"><p className="text-xs text-muted-foreground">Pipeline-Volumen</p><p className="text-xl font-bold">{fmt(stats.totalVol)}</p></CardContent></Card>
        <Card><CardContent className="p-3"><p className="text-xs text-muted-foreground">Gewonnen</p><p className="text-xl font-bold text-green-600">{stats.won.length}</p></CardContent></Card>
        <Card><CardContent className="p-3"><p className="text-xs text-muted-foreground">Conversion</p><p className="text-xl font-bold">{stats.conversion}%</p></CardContent></Card>
        <Card><CardContent className="p-3"><p className="text-xs text-muted-foreground">{"\u00d8"} Alter (Tage)</p><p className="text-xl font-bold flex items-center gap-1">{stats.avgAge}{stats.avgAge > 30 && <AlertTriangle className="h-4 w-4 text-yellow-500" />}</p></CardContent></Card>
        {stats.avgVal > 0 && <Card><CardContent className="p-3"><p className="text-xs text-muted-foreground">{"\u00d8"} Dealwert</p><p className="text-xl font-bold">{fmt(stats.avgVal)}</p></CardContent></Card>}
        {stats.velocity > 0 && <Card><CardContent className="p-3"><p className="text-xs text-muted-foreground">{"\u00d8"} Tage im Stage</p><p className="text-xl font-bold">{stats.velocity}d</p></CardContent></Card>}
      </div>

      {/* Conversion rates & source analytics */}
      {deals.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Card>
            <CardContent className="p-3">
              <p className="text-xs text-muted-foreground font-semibold uppercase tracking-wider mb-2">Conversion pro Stage</p>
              <div className="space-y-1.5">
                {STAGES.filter(s => s.key !== "abgelehnt" && s.key !== "abgeschlossen").map(s => (
                  <div key={s.key} className="flex items-center gap-2">
                    <div className={cn("w-2 h-2 rounded-full shrink-0", s.color)} />
                    <span className="text-xs flex-1">{s.label}</span>
                    <div className="w-16 h-1.5 bg-secondary rounded-full overflow-hidden">
                      <div className="h-full bg-primary rounded-full transition-all duration-300" style={{ width: `${stageConversionRates[s.key] || 0}%` }} />
                    </div>
                    <span className="text-xs font-medium w-8 text-right">{stageConversionRates[s.key] || 0}%</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
          {Object.keys(sourceAnalytics).length > 0 && (
            <Card>
              <CardContent className="p-3">
                <p className="text-xs text-muted-foreground font-semibold uppercase tracking-wider mb-2">Quellen</p>
                <div className="space-y-1.5">
                  {Object.entries(sourceAnalytics).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([source, count]) => (
                    <div key={source} className="flex items-center justify-between">
                      <span className="text-xs truncate flex items-center gap-1.5">
                        {source.toLowerCase().includes("telegram") && <MessageSquare className="h-3 w-3 text-blue-500 shrink-0" />}
                        {source}
                      </span>
                      <span className="text-xs font-medium bg-secondary px-1.5 py-0.5 rounded">{count}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Kanban View */}
      {viewMode === "kanban" ? (
        <div className="flex gap-3 overflow-x-auto pb-4 snap-x -mx-4 px-4 sm:mx-0 sm:px-0" role="region" aria-label="Deal Pipeline Kanban">
          {STAGES.map(stage => {
            const stageDeals = filteredDeals.filter(d => d.stage === stage.key);
            return (
              <div
                key={stage.key}
                className={cn(
                  "min-w-[240px] sm:min-w-[260px] w-[240px] sm:w-[260px] shrink-0 snap-start rounded-lg",
                  dragOverStage === stage.key && "ring-2 ring-primary/40 bg-primary/5",
                )}
                role="list"
                aria-label={`Stage: ${stage.label}`}
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragOverStage(stage.key);
                }}
                onDragLeave={() => {
                  setDragOverStage((prev) => (prev === stage.key ? null : prev));
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  if (!draggedDeal) return;
                  if (draggedDeal.stage !== stage.key) {
                    const payload = { id: draggedDeal.id, stage: stage.key, deal: draggedDeal };
                    lastMoveDealRef.current = payload;
                    moveDeal.mutate(payload);
                    toast.success(`Verschoben: ${stage.label}`);
                  }
                  setDraggedDeal(null);
                  setDragOverStage(null);
                }}
              >
                <div className="flex items-center gap-2 mb-2">
                  <div className={cn("w-2.5 h-2.5 rounded-full", stage.color)} />
                  <span className="text-sm font-semibold">{stage.label}</span>
                  <Badge variant="outline" className="text-[10px] ml-auto">{stageDeals.length}</Badge>
                  {stageValues[stage.key] > 0 && (
                    <span className="text-[9px] text-muted-foreground">{fmt(stageValues[stage.key])}</span>
                  )}
                </div>
                <div className="space-y-2">
                  {stageDeals.map((deal) => (
                    /* MOB2-2: Wrap DealCard with MobileSwipeableDealCard on mobile for swipe-between-stages */
                    <MobileSwipeableDealCard
                      key={deal.id}
                      currentStage={deal.stage}
                      stages={STAGES.map(s => ({ key: s.key, label: s.label, color: s.color }))}
                      onStageChange={(newStage) => {
                        const payload = { id: deal.id, stage: newStage, deal };
                        lastMoveDealRef.current = payload;
                        moveDeal.mutate(payload);
                        toast.success(`Verschoben: ${stageMap[newStage]?.label || newStage}`);
                      }}
                    >
                      <DealCard
                        deal={deal}
                        onClick={() => openEdit(deal)}
                        onShare={(d) => share({ title: d.title, text: d.address || undefined, url: `${window.location.origin}${dealsWithId(d.id)}` })}
                        onConverted={() => queryClient.invalidateQueries({ queryKey: queryKeys.properties.all })}
                        draggable={!isMobile}
                        onDragStart={(e) => {
                          setDraggedDeal(deal);
                          e.dataTransfer.setData("text/plain", deal.id);
                          e.dataTransfer.effectAllowed = "move";
                        }}
                        onDragEnd={() => {
                          setDraggedDeal(null);
                          setDragOverStage(null);
                        }}
                      />
                    </MobileSwipeableDealCard>
                  ))}
                  {stageDeals.length === 0 && (
                    <div className="py-4 text-center text-xs text-muted-foreground/50 border border-dashed rounded-lg">
                      Keine Deals
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* List View */
        <Card>
          <CardContent className="p-0">
            {/* UPD-39: Sort controls in list view */}
            <div className="flex items-center gap-2 p-3 border-b border-border">
              <span className="text-xs text-muted-foreground">Sortierung:</span>
              {SORT_OPTIONS.map(opt => (
                <Button
                  key={opt.key}
                  variant={sortKey === opt.key ? "default" : "ghost"}
                  size="sm"
                  className="text-xs h-6 px-2"
                  onClick={() => {
                    if (sortKey === opt.key) setSortAsc(p => !p);
                    else { setSortKey(opt.key); setSortAsc(false); }
                  }}
                >
                  {opt.label} {sortKey === opt.key && (sortAsc ? "\u2191" : "\u2193")}
                </Button>
              ))}
            </div>
            <div className="overflow-x-auto" role="region" aria-label="Deals-Tabelle (horizontal scrollbar auf kleinen Bildschirmen)">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-xs text-muted-foreground">
                    <th className="text-left p-3 font-medium">Deal</th>
                    <th className="text-left p-3 font-medium">Stage</th>
                    <th className="text-left p-3 font-medium">Preis</th>
                    <th className="text-left p-3 font-medium">Rendite</th>
                    <th className="text-left p-3 font-medium hidden md:table-cell">Kontakt</th>
                    <th className="text-left p-3 font-medium hidden sm:table-cell">Quelle</th>
                    <th className="text-left p-3 font-medium">Erstellt</th>
                    <th className="p-3" aria-label="Aktionen"></th>
                  </tr>
                </thead>
                <tbody>
                  {filteredDeals.map((deal) => {
                    const s = stageMap[deal.stage];
                    return (
                      <tr key={deal.id} className="border-b border-border/50 hover:bg-secondary/30 cursor-pointer transition-colors" onClick={() => openEdit(deal)}>
                        <td className="p-3">
                          <p className="font-medium">{deal.title}</p>
                          {deal.address && <p className="text-xs text-muted-foreground">{deal.address}</p>}
                        </td>
                        <td className="p-3">
                          <div className="flex items-center gap-1.5">
                            <div className={cn("w-2 h-2 rounded-full", s?.color)} />
                            <span className="text-xs">{s?.label || deal.stage}</span>
                          </div>
                        </td>
                        <td className="p-3">
                          {(deal.purchase_price ?? 0) > 0 ? (
                            <>
                              {fmt(deal.purchase_price!)}
                              {(deal.sqm ?? 0) > 0 && (
                                <span className="block text-xs text-muted-foreground">{fmt(Math.round(deal.purchase_price! / deal.sqm!))} / m²</span>
                              )}
                            </>
                          ) : "\u2013"}
                        </td>
                        <td className="p-3">{(deal.expected_yield ?? 0) > 0 ? `${deal.expected_yield!.toFixed(1)}%` : "\u2013"}</td>
                        <td className="p-3 text-xs text-muted-foreground hidden md:table-cell">{deal.contact_name || "\u2013"}</td>
                        <td className="p-3 text-xs text-muted-foreground hidden sm:table-cell">
                          {deal.source ? (
                            <span className="flex items-center gap-1">
                              {deal.source.toLowerCase().includes("telegram") && <MessageSquare className="h-3 w-3 text-blue-500" />}
                              {deal.source}
                            </span>
                          ) : "\u2013"}
                        </td>
                        <td className="p-3 text-xs text-muted-foreground">{new Date(deal.created_at).toLocaleDateString("de-DE")}</td>
                        <td className="p-3">
                          <div className="flex items-center gap-1">
                            {deal.address && (
                              <Link
                                to={`${ROUTES.CRM_SCOUT}&q=${encodeURIComponent(deal.address)}`}
                                className="text-xs text-primary hover:underline flex items-center gap-0.5 px-1.5 py-1 rounded hover:bg-secondary"
                                onClick={e => e.stopPropagation()}
                                aria-label="WGH in Umgebung suchen"
                              >
                                <Store className="h-3 w-3" /> Scout
                              </Link>
                            )}
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7"
                              aria-label="Deal l\u00f6schen"
                              onClick={e => { e.stopPropagation(); setDeleteTarget(deal.id); }}
                            >
                              <Trash2 className="h-3.5 w-3.5 text-destructive" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {/* UX: Empty state mit klarer nächster Aktion */}
              {filteredDeals.length === 0 && (
                <tr>
                  <td colSpan={8} className="p-0 border-0">
                    <div className="p-4">
                      <EmptyState
                        icon={Building2}
                        title={search ? `Keine Deals für „${search}"` : "Noch keine Deals"}
                        description={
                          search
                            ? "Suchbegriff anpassen oder neuen Deal anlegen."
                            : "Lege einen Deal an, um Angebote und Besichtigungen zu verfolgen. Oder importiere aus dem CRM oder Telegram."
                        }
                        action={
                          !search ? (
                            <div className="flex flex-wrap items-center justify-center gap-2">
                              <Button
                                size="sm"
                                className="gap-1.5 touch-target min-h-[44px]"
                                onClick={() => {
                                  if (!hasDealDraft) setForm({ ...emptyForm });
                                  setEditDeal(null);
                                  setAddOpen(true);
                                }}
                              >
                                <Plus className="h-3.5 w-3.5" /> Deal anlegen
                              </Button>
                              <Button variant="outline" size="sm" asChild className="touch-target min-h-[44px] gap-1.5">
                                <Link to={ROUTES.CRM}>Leads aus CRM</Link>
                              </Button>
                              <Button variant="outline" size="sm" asChild className="touch-target min-h-[44px] gap-1.5" aria-label="WGH-Scout">
                                <Link to={ROUTES.CRM_SCOUT}><Store className="h-3 w-3" /> WGH</Link>
                              </Button>
                              <Button variant="outline" size="sm" asChild className="touch-target min-h-[44px] gap-1.5" aria-label="Besichtigung planen">
                                <Link to={ROUTES.BESICHTIGUNGEN}><CalendarCheck className="h-3 w-3" /> Besichtigung</Link>
                              </Button>
                            </div>
                          ) : undefined
                        }
                      />
                    </div>
                  </td>
                </tr>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* UX-1: ResponsiveDialog — Bottom Sheet on mobile, Dialog on desktop */}
      {/* Fix: Don't reset form on close — preserve draft for recovery. Only clearDealDraft() on successful save. */}
      <ResponsiveDialog open={addOpen} onOpenChange={o => { setAddOpen(o); if (!o) { setEditDeal(null); setDealScore(null); setScoreReason(null); setScoutBatch(null); setScoutBatchIndex(0); } }} className="max-w-lg">
          <ResponsiveDialogHeader>
            <div className="flex items-center justify-between gap-2">
              <ResponsiveDialogTitle>{editDeal ? "Deal bearbeiten" : "Neuen Deal anlegen"}</ResponsiveDialogTitle>
              {editDeal && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 shrink-0"
                  aria-label="Deal teilen"
                  onClick={() => {
                    const url = `${window.location.origin}${dealsWithId(editDeal.id)}`;
                    share({ title: editDeal.title, text: editDeal.address || undefined, url });
                  }}
                >
                  <Share2 className="h-4 w-4" />
                </Button>
              )}
            </div>
          </ResponsiveDialogHeader>
          <div className="space-y-3">
            {Array.isArray(scoutBatch) && scoutBatch.length > 0 && !editDeal && (
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border bg-muted/30 p-2 text-sm">
                <span className="text-muted-foreground">
                  Scout-Batch: {scoutBatchIndex + 1} von {scoutBatch.length}
                </span>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="gap-1"
                  disabled={scoutBatchIndex >= scoutBatch.length - 1}
                  onClick={() => {
                    const next = scoutBatchIndex + 1;
                    if (next >= scoutBatch.length) return;
                    setScoutBatchIndex(next);
                    const item = scoutBatch[next];
                    if (!item) return;
                    setForm(p => ({
                      ...p,
                      title: item.name ?? "",
                      address: item.address ?? "",
                      contact_name: item.name ?? "",
                      contact_phone: item.phone ?? "",
                      contact_email: item.email ?? "",
                      source: "WGH-Scout",
                    }));
                    toast.info(`Treffer ${next + 1} von ${scoutBatch.length} übernommen`);
                  }}
                >
                  Nächsten übernehmen <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            )}
            {isDeepSeekConfigured() && !editDeal && (
              <div className="flex items-center gap-2">
                <input
                  type="file"
                  accept=".pdf,application/pdf"
                  className="hidden"
                  id="deal-expose-pdf"
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) handleExposePdf(f); e.target.value = ""; }}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={exposeAnalyzing}
                  onClick={() => document.getElementById("deal-expose-pdf")?.click()}
                  aria-label="Exposé aus PDF auswerten"
                >
                  {exposeAnalyzing ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <FileText className="h-4 w-4 mr-1" />}
                  Exposé aus PDF
                </Button>
                <span className="text-xs text-muted-foreground">KI analysiert & bewertet</span>
              </div>
            )}
            {dealScore != null && (
              <Alert className="border-primary/30 bg-primary/5">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>Deal-Score: {dealScore}/100</AlertTitle>
                {scoreReason && <AlertDescription>{scoreReason}</AlertDescription>}
              </Alert>
            )}
            {/* UX-19: Auto-focus first field in dialogs */}
            <Input placeholder="Titel / Objektname *" value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} aria-label="Deal Titel" autoFocus />
            <Input placeholder="Adresse" value={form.address} onChange={e => setForm(p => ({ ...p, address: e.target.value }))} aria-label="Adresse" />
            {/* UPD-41: Show description field */}
            <Textarea placeholder="Beschreibung" value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} rows={2} aria-label="Beschreibung" />
            <div className="grid grid-cols-2 gap-3">
              <Select value={form.stage} onValueChange={v => setForm(p => ({ ...p, stage: v }))}>
                <SelectTrigger aria-label="Stage"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {STAGES.map(s => <SelectItem key={s.key} value={s.key}>{s.label}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={form.property_type} onValueChange={v => setForm(p => ({ ...p, property_type: v }))}>
                <SelectTrigger aria-label="Immobilientyp"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ETW">ETW</SelectItem>
                  <SelectItem value="MFH">MFH</SelectItem>
                  <SelectItem value="EFH">EFH</SelectItem>
                  <SelectItem value="Sanierungsfall">Sanierungsfall</SelectItem>
                  <SelectItem value="Neubau">Neubau</SelectItem>
                  <SelectItem value="Gewerbe">Gewerbe</SelectItem>
                  <SelectItem value="Grundst\u00fcck">Grundst\u00fcck</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <Input type="number" placeholder="Kaufpreis \u20ac" value={form.purchase_price || ""} onChange={e => setForm(p => ({ ...p, purchase_price: parseFloat(e.target.value) || 0 }))} aria-label="Kaufpreis" />
              <Input type="number" placeholder="Miete \u20ac/Monat" value={form.expected_rent || ""} onChange={e => setForm(p => ({ ...p, expected_rent: parseFloat(e.target.value) || 0 }))} aria-label="Erwartete Miete" />
              <Input type="number" placeholder="qm" value={form.sqm || ""} onChange={e => setForm(p => ({ ...p, sqm: parseFloat(e.target.value) || 0 }))} aria-label="Quadratmeter" />
            </div>
            {/* SYNERGY: Contact picker — Kontakt aus Kontaktliste übernehmen */}
            {contacts.length > 0 && (
              <div className="col-span-full">
                <Select
                  value="__none__"
                  onValueChange={(id) => {
                    if (id === "__none__") return;
                    const c = contacts.find((x) => x.id === id);
                    if (c) setForm(p => ({ ...p, contact_name: c.name, contact_phone: c.phone || "", contact_email: c.email || "" }));
                  }}
                >
                  <SelectTrigger className="w-full" aria-label="Kontakt übernehmen">
                    <SelectValue placeholder="Kontakt aus Liste übernehmen…" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">— Kontakt wählen —</SelectItem>
                    {contacts.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name} {c.phone ? ` · ${c.phone}` : ""} {c.email ? ` · ${c.email}` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 col-span-full">
              <Input placeholder="Kontakt Name" value={form.contact_name} onChange={e => setForm(p => ({ ...p, contact_name: e.target.value }))} aria-label="Kontaktname" />
              <Input placeholder="Kontakt Tel." value={form.contact_phone} onChange={e => setForm(p => ({ ...p, contact_phone: e.target.value }))} aria-label="Kontakt Telefon" />
              <Input placeholder="Kontakt E-Mail" value={form.contact_email} onChange={e => setForm(p => ({ ...p, contact_email: e.target.value }))} aria-label="Kontakt E-Mail" />
            </div>
            {/* UPD-42: Source field with Telegram preset hint */}
            <Input placeholder="Quelle (z.B. ImmoScout, Makler, Telegram)" value={form.source} onChange={e => setForm(p => ({ ...p, source: e.target.value }))} aria-label="Quelle" />
            <div>
              <div className="flex items-center justify-between gap-2 mb-1 flex-wrap">
                <span className="text-xs text-muted-foreground">Notizen</span>
                {isDeepSeekConfigured() && (
                  <span className="flex items-center gap-1">
                    {(form.notes || "").trim().length > 0 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-7 text-xs gap-1 touch-target min-h-[44px]"
                        disabled={improveNotesLoading}
                        onClick={runImproveNotes}
                        aria-label="Notizen mit KI überarbeiten"
                      >
                        {improveNotesLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
                        Verbessern
                      </Button>
                    )}
                    {(editDeal || form.title || form.address) && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-7 text-xs gap-1 touch-target min-h-[44px]"
                        disabled={nextStepLoading}
                        onClick={runNextStep}
                        aria-label="Nächsten Deal-Schritt vorschlagen"
                      >
                        {nextStepLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
                        Nächster Schritt
                      </Button>
                    )}
                  </span>
                )}
              </div>
              <Textarea placeholder="Notizen" value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} rows={3} aria-label="Notizen" />
            </div>
            {editDeal && (
              <DealPipelineChecklist
                dealId={editDeal.id}
                stage={form.stage}
                propertyType={form.property_type}
                compact
              />
            )}
            {form.stage === "abgelehnt" && (
              <Input placeholder="Grund f\u00fcr Absage" value={form.lost_reason} onChange={e => setForm(p => ({ ...p, lost_reason: e.target.value }))} aria-label="Absagegrund" />
            )}
            <div className="flex gap-2">
              {editDeal && (
                <Button variant="destructive" className="flex-1" onClick={() => setDeleteTarget(editDeal.id)} aria-label="Deal l\u00f6schen">
                  <Trash2 className="h-4 w-4 mr-1" /> L\u00f6schen
                </Button>
              )}
              {/* UX-14: LoadingButton with spinner during save */}
              <LoadingButton
                onClick={() => saveDeal.mutate()}
                disabled={!isFormValid(form)}
                loading={saveDeal.isPending}
                className="flex-1"
                aria-label={editDeal ? "Deal speichern" : "Deal anlegen"}
              >
                {editDeal ? "Speichern" : "Deal anlegen"}
              </LoadingButton>
            </div>
            {/* SYNERGY: Besichtigungs-Picker & Link wenn Deal in Stage Besichtigung */}
            {editDeal && form.stage === "besichtigung" && (
              <div className="rounded-lg bg-amber-500/10 border border-amber-500/20 p-3 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-medium flex items-center gap-2">
                    <Camera className="h-4 w-4 text-amber-600" />
                    Besichtigung angelegt
                  </span>
                  <Link to={ROUTES.BESICHTIGUNGEN} className="text-sm text-primary hover:underline flex items-center gap-1" onClick={() => setAddOpen(false)}>
                    Zu Besichtigungen →
                  </Link>
                </div>
                {viewings.length > 0 && (
                  <Select
                    value="__link__"
                    onValueChange={(v) => { if (v !== "__link__") { const payload = { viewingId: v }; lastLinkViewingRef.current = payload; linkViewingToDeal.mutate(payload); } }}
                  >
                    <SelectTrigger className="h-8 text-xs" aria-label="Besthende Besichtigung zuordnen">
                      <SelectValue placeholder="Besthende Besichtigung zuordnen…" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__link__">— Besichtigung wählen —</SelectItem>
                      {viewings.map((v) => (
                        <SelectItem key={v.id} value={v.id}>
                          {v.title}
                          {v.address ? ` · ${v.address}` : ""}
                          {v.deal_id === editDeal.id ? " ✓" : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
            )}
            {/* IMP20-4: Deal → Immobilie Konvertierung for won deals */}
            {editDeal && form.stage === "abgeschlossen" && (
              <DealToPropertyConverter
                deal={editDeal}
                onConverted={() => { setAddOpen(false); setEditDeal(null); }}
              />
            )}
            {editDeal && form.stage !== "abgeschlossen" && form.stage !== "abgelehnt" && (
              <div className="flex gap-1 flex-wrap">
                <span className="text-xs text-muted-foreground mr-1 mt-1">Verschieben:</span>
                {STAGES.filter(s => s.key !== form.stage).map(s => (
                  <Button key={s.key} variant="outline" size="sm" className="text-xs h-7" onClick={() => {
                    const payload = { id: editDeal.id, stage: s.key, deal: editDeal };
                    lastMoveDealRef.current = payload;
                    moveDeal.mutate(payload);
                    setForm(p => ({ ...p, stage: s.key }));
                  }}>
                    <div className={cn("w-2 h-2 rounded-full mr-1", s.color)} /> {s.label}
                  </Button>
                ))}
              </div>
            )}
          </div>
      </ResponsiveDialog>

      {/* UPD-44: Delete confirmation dialog */}
      <AlertDialog open={!!deleteTarget} onOpenChange={o => { if (!o) setDeleteTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Deal l\u00f6schen?</AlertDialogTitle>
            <AlertDialogDescription>
              Dieser Deal wird endg\u00fcltig gel\u00f6scht. Diese Aktion kann nicht r\u00fcckg\u00e4ngig gemacht werden.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (deleteTarget) {
                  lastDeletedDealIdRef.current = deleteTarget; deleteDeal.mutate(deleteTarget);
                  if (addOpen) { setAddOpen(false); setEditDeal(null); }
                }
              }}
            >
              {deleteDeal.isPending && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
              L\u00f6schen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* UX-15: Success animation overlay */}
      <SuccessAnimation visible={successVisible} />

      {/* UX-5: Floating Action Button on mobile */}
      <FloatingActionButton onClick={() => { setEditDeal(null); setForm({ ...emptyForm }); setAddOpen(true); }} />
    </div>
  );
};

export default Deals;
