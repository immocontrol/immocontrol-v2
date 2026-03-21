import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useSearchParams, useNavigate, Link } from "react-router-dom";
import { useIsMobile } from "@/hooks/use-mobile";
import { MobileSwipeToAction } from "@/components/mobile/MobileSwipeToAction";
import { Contact, Plus, Search, Mail, MapPin, Trash2, Edit2, X, Upload, MessageCircle, Download, RotateCcw, Archive, Store, CalendarCheck, Sparkles, Loader2, Briefcase, CheckSquare, Star } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import ContactCsvImport from "@/components/ContactCsvImport";
import ContactStats from "@/components/ContactStats";
import AddContactDialog from "@/components/AddContactDialog";
import { isValidEmail } from "@/lib/validation";
import AddressAutocomplete from "@/components/AddressAutocomplete";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useAccessibility } from "@/components/AccessibilityProvider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { toastSuccess, toastInfo } from "@/lib/toastMessages";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/queryKeys";
import { formatCurrency } from "@/lib/formatters";
import { CallButton } from "@/components/CallButton";
import { useDebounce } from "@/hooks/useDebounce";
import { useUndoToast } from "@/hooks/useUndoToast";
import { ContactDuplicateDetector } from "@/components/ContactDuplicateDetector";
import { ListSkeleton } from "@/components/ListSkeleton";
import { logAudit } from "@/lib/auditLog";
import { ResponsiveDialog, ResponsiveDialogHeader, ResponsiveDialogTitle } from "@/components/ResponsiveDialog";
import { LoadingButton } from "@/components/LoadingButton";
import { createMutationErrorHandler } from "@/lib/mutationErrorHandler";
import { handleError } from "@/lib/handleError";
import { toastErrorWithRetry } from "@/lib/toastMessages";
import { useSuccessAnimation, SuccessAnimation } from "@/components/SuccessAnimation";
import { useHaptic } from "@/hooks/useHaptic";
import { FloatingActionButton } from "@/components/FloatingActionButton";
import { EmptyState } from "@/components/EmptyState";
import { PageHeader, PageHeaderActions, PageHeaderDescription, PageHeaderMain, PageHeaderTitle } from "@/components/ui/page-header";
import { CONTACT_CATEGORIES } from "@/lib/contactCategories";
import { ROUTES } from "@/lib/routes";
import { isDeepSeekConfigured, suggestContactFollowUp } from "@/integrations/ai/extractors";

interface ContactItem {
  id: string;
  name: string;
  company: string | null;
  category: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  notes: string | null;
}

/* IMPROVE-1: Batch empty-trash cleanup after 30 days */
const TRASH_RETENTION_DAYS = 30;
/** Performance: show first N contacts, then "Mehr anzeigen" */
const CONTACTS_PAGE_SIZE = 50;

const ContactManagement = () => {
  const { user } = useAuth();
  const { announce } = useAccessibility();
  const isMobile = useIsMobile();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const highlightId = searchParams.get("highlight");
  const contactRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const qc = useQueryClient();
  const haptic = useHaptic();
  const { showUndo } = useUndoToast();
  const { visible: successVisible, trigger: triggerSuccess } = useSuccessAnimation();

  const [search, setSearch] = useState("");
  const [catFilter, setCatFilter] = useState("alle");
  const [open, setOpen] = useState(false);
  const [csvImportOpen, setCsvImportOpen] = useState(false);
  const [editContact, setEditContact] = useState<ContactItem | null>(null);
  const [showTrash, setShowTrash] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [aiNotesLoading, setAiNotesLoading] = useState(false);
  const [visibleCount, setVisibleCount] = useState(CONTACTS_PAGE_SIZE);
  const [form, setForm] = useState({
    name: "", company: "", category: "Handwerker",
    email: "", phone: "", address: "", notes: "",
  });

  useEffect(() => {
    setVisibleCount(CONTACTS_PAGE_SIZE);
  }, [search, catFilter]);

  useEffect(() => {
    if (showTrash) setSelectedIds(new Set());
  }, [showTrash]);

  /* Ctrl+A: Alle sichtbaren Kontakte auswählen (nicht in Input) */
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      if ((e.ctrlKey || e.metaKey) && e.key === "a") {
        e.preventDefault();
        if (filtered.length === 0) return;
        const visible = filtered.slice(0, visibleCount).map(c => c.id);
        setSelectedIds(prev => prev.size === visible.length ? new Set() : new Set(visible));
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [filtered, visibleCount]);

  // Improvement 5: React Query for contacts
  const { data: contacts = [] } = useQuery({
    queryKey: [...queryKeys.contacts.all, showTrash ? "trash" : "active"],
    queryFn: async () => {
      let query = supabase
        .from("contacts")
        .select("*");
      if (showTrash) {
        query = query.not("deleted_at", "is", null).order("deleted_at", { ascending: false });
      } else {
        query = query.is("deleted_at", null).order("name");
      }
      const { data } = await query;
      return (data || []) as ContactItem[];
    },
    enabled: !!user,
  });

  /* IMP-41: Dynamic document title */
  useEffect(() => { document.title = `Kontakte (${contacts.length}) – ImmoControl`; }, [contacts.length]);

  /* IMP20-14: Auto-purge expired trash entries on mount — silently delete contacts older than TRASH_RETENTION_DAYS */
  useEffect(() => {
    if (!user || !showTrash) return;
    const purgeExpired = async () => {
      const cutoff = new Date(Date.now() - TRASH_RETENTION_DAYS * 86400000).toISOString();
      await supabase.from("contacts").delete().not("deleted_at", "is", null).lt("deleted_at", cutoff);
    };
    purgeExpired();
  }, [user, showTrash]);

  /* STR-13: Keyboard shortcut Ctrl+N to open new contact dialog */
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "n" && !e.shiftKey && !e.altKey) {
        e.preventDefault();
        resetForm();
        setOpen(true);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  // Synergy 7: Fetch ticket count per handworker contact
  const { data: contactTicketCounts = {} } = useQuery({
    queryKey: [...queryKeys.contacts.all, "ticket-counts"],
    queryFn: async () => {
      const { data } = await supabase
        .from("tickets")
        .select("assigned_to_contact_id, status")
        .in("status", ["open", "in_progress"])
        .not("assigned_to_contact_id", "is", null);
      const counts: Record<string, number> = {};
      (data || []).forEach(t => {
        if (t.assigned_to_contact_id) counts[t.assigned_to_contact_id] = (counts[t.assigned_to_contact_id] || 0) + 1;
      });
      return counts;
    },
    enabled: !!user,
  });

  // Synergy 9: Fetch deal count per contact (contact_name match)
  const { data: contactDealCounts = {} } = useQuery({
    queryKey: [...queryKeys.contacts.all, "deal-counts"],
    queryFn: async () => {
      const { data } = await supabase.from("deals").select("contact_name").not("contact_name", "is", null);
      const counts: Record<string, number> = {};
      (data || []).forEach(d => {
        const name = (d.contact_name || "").trim();
        if (!name) return;
        const c = contacts.find(x => x.name.trim().toLowerCase() === name.toLowerCase());
        if (c) counts[c.id] = (counts[c.id] || 0) + 1;
      });
      return counts;
    },
    enabled: !!user && contacts.length > 0,
  });

  // Synergy 8: Fetch total cost per handworker contact
  const { data: contactCosts = {} } = useQuery({
    queryKey: [...queryKeys.contacts.all, "costs"],
    queryFn: async () => {
      const { data } = await supabase
        .from("tickets")
        .select("assigned_to_contact_id, actual_cost")
        .not("assigned_to_contact_id", "is", null)
        .in("status", ["resolved", "closed"]);
      const costs: Record<string, number> = {};
      (data || []).forEach(t => {
        if (t.assigned_to_contact_id) costs[t.assigned_to_contact_id] = (costs[t.assigned_to_contact_id] || 0) + Number(t.actual_cost || 0);
      });
      return costs;
    },
    enabled: !!user,
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: queryKeys.contacts.all });

  const resetForm = () => {
    setForm({ name: "", company: "", category: "Handwerker", email: "", phone: "", address: "", notes: "" });
    setEditContact(null);
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!user || !form.name.trim()) throw new Error("Name ist erforderlich");
      if (form.email && !isValidEmail(form.email)) throw new Error("Bitte eine gültige E-Mail-Adresse eingeben");
      const payload = {
        name: form.name.trim(),
        company: form.company || null,
        category: form.category,
        email: form.email || null,
        phone: form.phone || null,
        address: form.address || null,
        notes: form.notes || null,
      };
      if (editContact) {
        const { error } = await supabase.from("contacts").update(payload).eq("id", editContact.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("contacts").insert({ ...payload, user_id: user.id });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      /* Improvement 16: Audit log integration */
      logAudit(editContact ? "update" : "create", "contact", {
        entityName: form.name,
        entityId: editContact?.id,
        details: editContact ? "Kontakt aktualisiert" : "Neuer Kontakt angelegt",
        userId: user?.id,
      });
      /* UX-4: Haptic feedback on save */
      haptic.success();
      /* UX-15: Success animation */
      triggerSuccess();
      toastSuccess(editContact ? "Kontakt aktualisiert" : "Kontakt angelegt");
      resetForm();
      setOpen(false);
      invalidate();
    },
    onError: (e: unknown) => {
      handleError(e, { context: "supabase", details: "contacts.insert/update", showToast: false });
      toastErrorWithRetry(e instanceof Error ? e.message || "Fehler" : "Fehler beim Speichern", () => saveMutation.mutate());
    },
  });

  // Soft delete: move to trash (with undo)
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("contacts").update({ deleted_at: new Date().toISOString() }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_data, id) => {
      const c = contacts.find(x => x.id === id);
      logAudit("delete", "contact", { entityId: id, entityName: c?.name, details: "In Papierkorb verschoben", userId: user?.id });
      haptic.medium();
      announce("Kontakt gelöscht", "polite");
      invalidate();
      showUndo({
        message: "Kontakt gelöscht",
        onCommit: () => {},
        onUndo: () => restoreMutation.mutate(id),
        duration: 15_000,
      });
    },
    onError: createMutationErrorHandler("Kontakt löschen", "Fehler beim Löschen"),
  });

  // Bulk delete (soft delete)
  const bulkDeleteMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      const { error } = await supabase.from("contacts").update({ deleted_at: new Date().toISOString() }).in("id", ids);
      if (error) throw error;
    },
    onSuccess: (_data, ids) => {
      setSelectedIds(new Set());
      invalidate();
      toastSuccess(`${ids.length} Kontakt${ids.length > 1 ? "e" : ""} in den Papierkorb verschoben`);
    },
    onError: createMutationErrorHandler("Kontakte löschen", "Fehler beim Löschen"),
  });

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const selectAllFiltered = () => {
    const visible = filtered.slice(0, visibleCount).map(c => c.id);
    setSelectedIds(prev => {
      const next = new Set(prev);
      const allSelected = visible.every(id => next.has(id));
      if (allSelected) visible.forEach(id => next.delete(id));
      else visible.forEach(id => next.add(id));
      return next;
    });
  };

  // Restore from trash
  const restoreMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("contacts").update({ deleted_at: null }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toastSuccess("Kontakt wiederhergestellt"); invalidate(); },
    onError: createMutationErrorHandler("Kontakt wiederherstellen", "Fehler beim Wiederherstellen"),
  });

  // Permanently delete
  const permanentDeleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("contacts").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toastSuccess("Kontakt endgültig gelöscht"); invalidate(); },
    onError: createMutationErrorHandler("Kontakt endgültig löschen", "Fehler beim endgültigen Löschen"),
  });


  const openEdit = (c: ContactItem) => {
    setEditContact(c);
    setForm({
      name: c.name, company: c.company || "", category: c.category,
      email: c.email || "", phone: c.phone || "",
      address: c.address || "", notes: c.notes || "",
    });
    setOpen(true);
  };

  const debouncedSearch = useDebounce(search, 200);

  const FAVORITES_KEY = "immocontrol_contact_favorites";

  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(() => {
    try {
      const raw = localStorage.getItem(FAVORITES_KEY);
      if (raw) {
        const arr = JSON.parse(raw) as string[];
        return new Set(Array.isArray(arr) ? arr : []);
      }
    } catch { /* ignore */ }
    return new Set();
  });

  const toggleFavorite = (id: string) => {
    setFavoriteIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      try { localStorage.setItem(FAVORITES_KEY, JSON.stringify([...next])); } catch { /* ignore */ }
      return next;
    });
  };

  /* IMPROVE-2: Sort contacts alphabetically, favorites first */
  const sortedContacts = useMemo(() =>
    [...contacts].sort((a, b) => {
      const aFav = favoriteIds.has(a.id);
      const bFav = favoriteIds.has(b.id);
      if (aFav && !bFav) return -1;
      if (!aFav && bFav) return 1;
      return a.name.localeCompare(b.name, "de");
    }),
    [contacts, favoriteIds]
  );

  /* IMPROVE-25: Debounced search input avoids re-filtering on every keystroke */
  /* IMPROVE-22: Memoize filtered contact list for performance */
  const filtered = useMemo(() => sortedContacts.filter((c) => {
    if (catFilter !== "alle" && c.category !== catFilter) return false;
    if (debouncedSearch) {
      const q = debouncedSearch.toLowerCase();
      return c.name.toLowerCase().includes(q) || (c.company || "").toLowerCase().includes(q) || (c.email || "").toLowerCase().includes(q) || (c.phone || "").toLowerCase().includes(q);
    }
    return true;
  }), [sortedContacts, catFilter, debouncedSearch]);

  /* SYNERGY: Deep-Link ?highlight= – scroll and highlight contact from GlobalSearch (after filtered is defined) */
  useEffect(() => {
    if (!highlightId || filtered.length === 0) return;
    const el = contactRefs.current[highlightId];
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [highlightId, filtered.length]);

  // Improvement 9: Contact summary stats
  const handworkerCount = contacts.filter(c => c.category === "Handwerker").length;
  const activeAssignments = Object.values(contactTicketCounts).reduce((s, c) => s + c, 0);
  const totalSpent = Object.values(contactCosts).reduce((s, c) => s + c, 0);

  /* IMPROVE-3: Trash retention info — show how many days until auto-cleanup */
  const trashCount = useMemo(() => {
    if (!showTrash) return 0;
    return contacts.length;
  }, [contacts, showTrash]);

  /* IMP20-20: Memoize duplicateGroups with stable dependency — avoids re-computation when contacts ref is same */
  const contactIds = useMemo(() => contacts.map(c => c.id).join(","), [contacts]);
  const duplicateGroups = useMemo(() => {
    const seen = new Map<string, string[]>();
    contacts.forEach(c => {
      const key = c.name.toLowerCase().trim();
      if (!seen.has(key)) seen.set(key, []);
      seen.get(key)!.push(c.id);
    });
    return Array.from(seen.values()).filter(ids => ids.length > 1);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contactIds]);
  const possibleDuplicates = duplicateGroups.flat();

  return (
    <div className="space-y-6" role="main" aria-label="Kontaktverwaltung">
      {/* #17: Duplicate Detection with Fuzzy Matching */}
      <ContactDuplicateDetector
        contacts={contacts.map(c => ({ id: c.id, name: c.name, email: c.email, phone: c.phone, company: c.company }))}
      />

      <PageHeader>
        <PageHeaderMain>
          <PageHeaderTitle>Kontakte</PageHeaderTitle>
          <PageHeaderDescription>
            {contacts.length} Kontakte · {handworkerCount} Handwerker
            {activeAssignments > 0 && <span> · {activeAssignments} aktive Aufträge</span>}
            {totalSpent > 0 && <span> · {formatCurrency(totalSpent)} Gesamtkosten</span>}
            {duplicateGroups.length > 0 && <span className="text-gold"> · mögliche Duplikate: {duplicateGroups.length}</span>}
          </PageHeaderDescription>
        </PageHeaderMain>
        <PageHeaderActions>
          {/* vCard Export */}
          {contacts.length > 0 && (
            <Button variant="outline" size="sm" className="gap-1.5 hidden sm:flex" onClick={() => {
              const vcards = contacts.map(c => {
                const parts = c.name.split(" ");
                const lastName = parts.pop() || "";
                const firstName = parts.join(" ") || "";
                return `BEGIN:VCARD\nVERSION:3.0\nN:${lastName};${firstName}\nFN:${c.name}${c.company ? `\nORG:${c.company}` : ""}${c.email ? `\nEMAIL:${c.email}` : ""}${c.phone ? `\nTEL:${c.phone}` : ""}${c.address ? `\nADR:;;${c.address}` : ""}${c.notes ? `\nNOTE:${c.notes}` : ""}\nEND:VCARD`;
              }).join("\n");
              const blob = new Blob([vcards], { type: "text/vcard;charset=utf-8" });
              const url = URL.createObjectURL(blob);
              const a = document.createElement("a");
              a.href = url;
              a.download = "immocontrol-kontakte.vcf";
              a.click();
              /* FIX-3: Delay revoke — immediate revoke can race with download on slow devices */
              setTimeout(() => URL.revokeObjectURL(url), 1000);
              toastSuccess("Kontakte als vCard exportiert!");
            }}>
              <Download className="h-3.5 w-3.5" /> vCard
            </Button>
          )}
          <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setCsvImportOpen(true)}>
            <Upload className="h-3.5 w-3.5" /> CSV importieren
          </Button>
          <Button
            variant={showTrash ? "default" : "outline"}
            size="sm"
            className="gap-1.5"
            onClick={() => setShowTrash(!showTrash)}
          >
            <Archive className="h-3.5 w-3.5" /> {showTrash ? "Zur\u00fcck" : "Papierkorb"}
          </Button>
          <AddContactDialog onCreated={() => invalidate()} />
            {/* UX-1: ResponsiveDialog — Bottom Sheet on mobile, Dialog on desktop */}
          <ResponsiveDialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) resetForm(); }}>
            <ResponsiveDialogHeader>
              <ResponsiveDialogTitle>{editContact ? "Kontakt bearbeiten" : "Neuen Kontakt anlegen"}</ResponsiveDialogTitle>
            </ResponsiveDialogHeader>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Name *</Label>
                  <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="h-9 text-sm" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Firma</Label>
                  <Input value={form.company} onChange={(e) => setForm({ ...form, company: e.target.value })} className="h-9 text-sm" />
                </div>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Kategorie</Label>
                <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
                  <SelectTrigger className="h-9 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CONTACT_CATEGORIES.map((c) => (
                      <SelectItem key={c.value} value={c.value}>{c.value}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">E-Mail</Label>
                  <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="h-9 text-sm" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Telefon</Label>
                  <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="h-9 text-sm" />
                </div>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Adresse</Label>
                <AddressAutocomplete value={form.address} onChange={(val) => setForm({ ...form, address: val })} />
              </div>
              <div className="space-y-1">
                <div className="flex items-center justify-between gap-2">
                  <Label className="text-xs">Notizen</Label>
                  {isDeepSeekConfigured() && form.name.trim() && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-7 gap-1 text-xs"
                      disabled={aiNotesLoading}
                      onClick={async () => {
                        setAiNotesLoading(true);
                        try {
                          const text = await suggestContactFollowUp({
                            name: form.name.trim(),
                            company: form.company || null,
                            category: form.category,
                            notes: form.notes || null,
                          });
                          if (text) setForm((f) => ({ ...f, notes: text }));
                        } catch (e) {
                          handleError(e, { context: "ai", details: "suggestContactFollowUp", showToast: true });
                        } finally {
                          setAiNotesLoading(false);
                        }
                      }}
                    >
                      {aiNotesLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
                      KI Vorschlag
                    </Button>
                  )}
                </div>
                <Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} className="text-sm min-h-[60px]" placeholder="Notizen zum Kontakt..." />
              </div>
              {/* UX-14: LoadingButton with spinner during save */}
              <LoadingButton onClick={() => saveMutation.mutate()} className="w-full" loading={saveMutation.isPending}>
                {editContact ? "Speichern" : "Kontakt anlegen"}
              </LoadingButton>
            </div>
        </ResponsiveDialog>
        </PageHeaderActions>
      </PageHeader>

      <ContactCsvImport
        open={csvImportOpen}
        onClose={() => setCsvImportOpen(false)}
        onImported={() => { invalidate(); }}
      />

      {/* Search + Filter */}
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1 min-w-0">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          {/* IMPROVE-21: Better search placeholder with keyboard hint */}
          <Input placeholder="z. B. Max Mustermann oder Firma (Ctrl+K)" aria-label="Kontakte durchsuchen" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 pr-8 h-9 text-sm" />
          {search && (
            <button
              onClick={() => setSearch("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
              aria-label="Suche leeren" onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setSearch(""); } }}
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
        {/* IMPROVE-24: Category filter badges with emoji icons and count for quick visual scanning */}
        <div className="flex gap-1 flex-wrap">
          {[{ value: "alle", label: "Alle", icon: "👥" }, ...CONTACT_CATEGORIES.map(c => ({ value: c.value, label: c.value, icon: c.value === "Handwerker" ? "🔧" : c.value === "Hausverwaltung" ? "🏢" : c.value === "Versicherung" ? "🛡️" : "📋" }))].map((f) => {
            const count = f.value === "alle" ? contacts.length : contacts.filter(c => c.category === f.value).length;
            return (
              <button
                key={f.value}
                onClick={() => setCatFilter(f.value)}
                className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-colors whitespace-nowrap flex items-center gap-1 ${
                  catFilter === f.value ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-secondary"
                }`}
              >
                <span className="text-[10px]">{f.icon}</span>
                {f.label}
                <span className="text-muted-foreground">({count})</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* IMPROVE-23: Show filtered count when searching */}
      {debouncedSearch && (
        <p className="text-xs text-muted-foreground" aria-live="polite">
          {filtered.length} {filtered.length === 1 ? "Kontakt" : "Kontakte"}
          {contacts.length !== filtered.length && ` von ${contacts.length}`}
        </p>
      )}

      {/* Bulk actions bar */}
      {!showTrash && selectedIds.size > 0 && (
        <div className="flex items-center justify-between gap-2 p-3 rounded-xl border border-primary/20 bg-primary/5">
          <span className="text-sm font-medium">{selectedIds.size} ausgewählt</span>
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={() => setSelectedIds(new Set())}>Auswahl aufheben</Button>
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={() => {
                const toExport = contacts.filter(c => selectedIds.has(c.id));
                if (toExport.length === 0) return;
                const vcards = toExport.map(c => {
                  const parts = c.name.split(" ");
                  const lastName = parts.pop() || "";
                  const firstName = parts.join(" ") || "";
                  return `BEGIN:VCARD\nVERSION:3.0\nN:${lastName};${firstName}\nFN:${c.name}${c.company ? `\nORG:${c.company}` : ""}${c.email ? `\nEMAIL:${c.email}` : ""}${c.phone ? `\nTEL:${c.phone}` : ""}${c.address ? `\nADR:;;${c.address}` : ""}${c.notes ? `\nNOTE:${c.notes}` : ""}\nEND:VCARD`;
                }).join("\n");
                const blob = new Blob([vcards], { type: "text/vcard;charset=utf-8" });
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = `immocontrol-kontakte-${selectedIds.size}.vcf`;
                a.click();
                setTimeout(() => URL.revokeObjectURL(url), 1000);
                toastSuccess(`${selectedIds.size} Kontakt${selectedIds.size > 1 ? "e" : ""} exportiert`);
              }}
            >
              <Download className="h-3.5 w-3.5" /> vCard
            </Button>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" size="sm" className="gap-1.5">
                  <Trash2 className="h-3.5 w-3.5" /> In Papierkorb
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>{selectedIds.size} Kontakt{selectedIds.size > 1 ? "e" : ""} löschen?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Die folgenden Kontakte werden in den Papierkorb verschoben und können dort wiederhergestellt werden:
                    <ul className="mt-2 list-disc list-inside text-xs max-h-24 overflow-y-auto">
                      {contacts.filter(c => selectedIds.has(c.id)).slice(0, 10).map(c => (
                        <li key={c.id}>{c.name}</li>
                      ))}
                      {selectedIds.size > 10 && <li className="text-muted-foreground">… und {selectedIds.size - 10} weitere</li>}
                    </ul>
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Abbrechen</AlertDialogCancel>
                  <AlertDialogAction className="bg-destructive text-destructive-foreground" onClick={() => bulkDeleteMutation.mutate(Array.from(selectedIds))}>
                    Löschen
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>
      )}

      {/* Contact list */}
      {/* UPD-24: Better empty state animation for contacts */}
      {filtered.length === 0 ? (
        contacts.length === 0 ? (
          <EmptyState
            icon={Contact}
            title="Noch keine Kontakte"
            description="Lege deinen ersten Kontakt an – Handwerker, Hausverwaltung oder Partner. Oder übernimm Kontakte aus Deals."
            action={
              <div className="flex flex-wrap items-center justify-center gap-2">
                <Button size="sm" className="gap-1.5 touch-target min-h-[44px]" onClick={() => setOpen(true)}>
                  <Plus className="h-3.5 w-3.5" /> Ersten Kontakt anlegen
                </Button>
                <Button variant="outline" size="sm" className="gap-1.5 touch-target min-h-[44px]" onClick={() => navigate(ROUTES.DEALS)}>
                  <Briefcase className="h-3.5 w-3.5" /> Zu Deals
                </Button>
                <Button variant="outline" size="sm" className="gap-1.5 touch-target min-h-[44px]" onClick={() => navigate(ROUTES.CRM_SCOUT)} aria-label="WGH finden">
                  <Store className="h-3.5 w-3.5" /> WGH finden
                </Button>
                <Button variant="outline" size="sm" className="gap-1.5 touch-target min-h-[44px]" onClick={() => navigate(ROUTES.BESICHTIGUNGEN)} aria-label="Besichtigung planen">
                  <CalendarCheck className="h-3.5 w-3.5" /> Besichtigung planen
                </Button>
              </div>
            }
          />
        ) : (
          <div className="text-center py-12 empty-state-bounce">
            <div className="w-14 h-14 rounded-2xl bg-secondary/50 flex items-center justify-center mx-auto mb-4">
              <Contact className="h-6 w-6 text-muted-foreground" />
            </div>
            <p className="text-sm font-medium mb-1">Keine Ergebnisse</p>
            <p className="text-xs text-muted-foreground mb-4">Keine Kontakte gefunden für „{search}"</p>
            <Button variant="ghost" size="sm" className="text-xs" onClick={() => { setSearch(""); setCatFilter("alle"); }}>
              Filter zurücksetzen
            </Button>
          </div>
        )
      ) : (
        <>
          <ContactStats contacts={contacts} />
          {/* Bulk select header */}
          {!showTrash && filtered.length > 0 && (
            <div className="flex items-center gap-2 mb-2">
              <Checkbox
                id="select-all-contacts"
                checked={filtered.slice(0, visibleCount).length > 0 && filtered.slice(0, visibleCount).every(c => selectedIds.has(c.id))}
                onCheckedChange={selectAllFiltered}
                aria-label="Alle sichtbaren auswählen"
              />
              <label htmlFor="select-all-contacts" className="text-xs text-muted-foreground cursor-pointer">Alle sichtbaren auswählen</label>
            </div>
          )}
          {/* Improvement 14: Contact list with stagger animation */}
          {/* Performance: show first CONTACTS_PAGE_SIZE, then "Mehr anzeigen" */}
          <div className="grid gap-3 md:grid-cols-2 list-stagger">
          {filtered.slice(0, visibleCount).map((c) => {
            const CatIcon = CONTACT_CATEGORIES.find(cat => cat.value === c.category)?.icon || Briefcase;
            /* MOB-IMPROVE-6: Contact card with swipe-to-delete on mobile */
            const isHighlighted = highlightId === c.id;
            const contactCard = (
              <div
                key={c.id}
                ref={(el) => { contactRefs.current[c.id] = el; }}
                className={`gradient-card rounded-xl border p-4 group hover:border-primary/20 transition-all duration-200 hover:shadow-sm hover-lift ${possibleDuplicates.includes(c.id) ? "border-gold/30" : "border-border"} ${isHighlighted ? "ring-2 ring-primary ring-offset-2" : ""}`}
              >
                <div className="flex items-start gap-3">
                  {!showTrash && (
                    <Checkbox
                      checked={selectedIds.has(c.id)}
                      onCheckedChange={() => toggleSelect(c.id)}
                      onClick={(e) => e.stopPropagation()}
                      aria-label={`${c.name} auswählen`}
                      className="mt-1 shrink-0"
                    />
                  )}
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                    <CatIcon className="h-4 w-4 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 min-w-0">
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); toggleFavorite(c.id); }}
                        className="shrink-0 text-muted-foreground hover:text-gold transition-colors touch-target min-h-[44px] min-w-[44px] flex items-center justify-center -ml-1"
                        aria-label={favoriteIds.has(c.id) ? "Aus Favoriten entfernen" : "Zu Favoriten hinzufügen"}
                      >
                        <Star className={`h-4 w-4 ${favoriteIds.has(c.id) ? "fill-gold text-gold" : ""}`} />
                      </button>
                      <span className="text-sm font-semibold truncate min-w-0" title={c.name}>{c.name}</span>
                      <span className="text-[10px] bg-secondary px-1.5 py-0.5 rounded text-muted-foreground">{c.category}</span>
                      {/* Synergy 7: Active ticket count per contact */}
                      {contactTicketCounts[c.id] > 0 && (
                        <span className="text-[10px] bg-gold/15 text-gold px-1.5 py-0.5 rounded-full font-bold flex items-center gap-0.5">
                          🔧 {contactTicketCounts[c.id]} aktiv
                        </span>
                      )}
                      {/* Synergy 8: Completed cost for handworkers */}
                      {c.category === "Handwerker" && contactCosts[c.id] > 0 && (
                        <span className="text-[10px] bg-secondary px-1.5 py-0.5 rounded text-muted-foreground">
                          💰 {formatCurrency(contactCosts[c.id])}
                        </span>
                      )}
                      {/* Synergy 9: Deal count per contact – klickbar → /deals mit Filter */}
                      {contactDealCounts[c.id] > 0 && (
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); navigate(ROUTES.DEALS, { state: { filterByContact: c.name } }); }}
                          className="text-[10px] bg-primary/15 text-primary px-1.5 py-0.5 rounded-full font-medium hover:bg-primary/25 transition-colors cursor-pointer"
                          title={`${contactDealCounts[c.id]} Deal(s) anzeigen`}
                        >
                          📋 {contactDealCounts[c.id]} Deal{contactDealCounts[c.id] > 1 ? "s" : ""}
                        </button>
                      )}
                    </div>
                    {c.company && <p className="text-xs text-muted-foreground">{c.company}</p>}
                    <div className="flex flex-wrap items-center gap-3 mt-1.5 text-[11px] text-muted-foreground">
                      {c.phone && (
                        <CallButton phone={c.phone} toLabel={c.name ?? undefined} className="hover:text-primary" />
                      )}
                      {c.email && (
                        <a href={`mailto:${c.email}`} className="flex items-center gap-0.5 hover:text-primary transition-colors">
                          <Mail className="h-2.5 w-2.5" /> {c.email}
                        </a>
                      )}
                      {c.address && (
                        <span className="flex items-center gap-0.5">
                          <MapPin className="h-2.5 w-2.5" /> {c.address}
                        </span>
                      )}
                      {c.address?.trim() && (
                        <Link
                          to={`${ROUTES.CRM_SCOUT}&q=${encodeURIComponent(c.address.trim())}`}
                          className="text-[10px] text-primary hover:underline flex items-center gap-0.5 w-fit mt-0.5"
                          onClick={(e) => e.stopPropagation()}
                          aria-label="Gewerbe in Umgebung suchen"
                        >
                          <Store className="h-2.5 w-2.5 shrink-0" /> Gewerbe in Umgebung
                        </Link>
                      )}
                    </div>
                    {/* Improvement 14: Notes preview */}
                    {c.notes && (
                      <p className="text-[11px] text-muted-foreground mt-1.5 italic truncate">
                        💬 {c.notes}
                      </p>
                    )}
                  </div>
                  {/* UI-UPDATE-13: Always show action buttons on mobile */}
                  <div className="flex gap-1 sm:opacity-0 sm:group-hover:opacity-100 transition-all duration-200 mobile-action-row">
                    {showTrash ? (
                      <>
                        {/* UI-UPDATE-11: Tooltip on restore action */}
                        <Tooltip><TooltipTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-primary touch-target min-h-[44px] min-w-[44px]" onClick={() => restoreMutation.mutate(c.id)} aria-label="Kontakt wiederherstellen">
                          <RotateCcw className="h-3 w-3" />
                        </Button>
                        </TooltipTrigger><TooltipContent>Wiederherstellen</TooltipContent></Tooltip>
                        <AlertDialog>
                          {/* UI-UPDATE-15: Tooltip on permanent delete action */}
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <AlertDialogTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive touch-target min-h-[44px] min-w-[44px]" aria-label="Kontakt endgültig löschen">
                                  <Trash2 className="h-3 w-3" />
                                </Button>
                              </AlertDialogTrigger>
                            </TooltipTrigger>
                            <TooltipContent>Endgültig löschen</TooltipContent>
                          </Tooltip>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Endgültig löschen?</AlertDialogTitle>
                              <AlertDialogDescription>„{c.name}" wird unwiderruflich entfernt und kann nicht wiederhergestellt werden.</AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Abbrechen</AlertDialogCancel>
                              <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={() => permanentDeleteMutation.mutate(c.id)}>Endgültig löschen</AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </>
                    ) : (
                      <>
                        {c.phone && (
                          <Tooltip>
                            {/* UI-UPDATE-16: Tooltip on WhatsApp action */}
                            <TooltipTrigger asChild>
                              <a href={`https://wa.me/${c.phone.replace(/\D/g, "")}`} target="_blank" rel="noopener noreferrer">
                                <Button variant="ghost" size="icon" className="h-7 w-7 text-[#25D366] touch-target min-h-[44px] min-w-[44px]" aria-label="WhatsApp öffnen">
                                  <MessageCircle className="h-3 w-3" />
                                </Button>
                              </a>
                            </TooltipTrigger>
                            <TooltipContent>WhatsApp</TooltipContent>
                          </Tooltip>
                        )}
                        {/* UI-UPDATE-12: Tooltip on edit action */}
                        <Tooltip><TooltipTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-7 w-7 touch-target min-h-[44px] min-w-[44px]" onClick={() => openEdit(c)} aria-label="Kontakt bearbeiten">
                          <Edit2 className="h-3 w-3" />
                        </Button>
                        </TooltipTrigger><TooltipContent>Bearbeiten</TooltipContent></Tooltip>
                        {/* Synergy: Quick-Add Deal mit vorausgefülltem Kontakt */}
                        <Tooltip><TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-primary touch-target min-h-[44px] min-w-[44px]"
                            onClick={() => {
                              navigate(ROUTES.DEALS, { state: { fromContact: { name: c.name, company: c.company, phone: c.phone, email: c.email, address: c.address, notes: c.notes } } });
                              toastInfo("Deal-Vorlage aus Kontakt übernommen");
                            }}
                            aria-label="Als Deal anlegen"
                          >
                            <Briefcase className="h-3 w-3" />
                          </Button>
                        </TooltipTrigger><TooltipContent>Als Deal</TooltipContent></Tooltip>
                        <AlertDialog>
                          {/* UI-UPDATE-17: Tooltip on trash action */}
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <AlertDialogTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive touch-target min-h-[44px] min-w-[44px]" aria-label="Kontakt löschen">
                                  <Trash2 className="h-3 w-3" />
                                </Button>
                              </AlertDialogTrigger>
                            </TooltipTrigger>
                            <TooltipContent>Löschen</TooltipContent>
                          </Tooltip>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Kontakt löschen?</AlertDialogTitle>
                              <AlertDialogDescription>„{c.name}" wird in den Papierkorb verschoben.</AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Abbrechen</AlertDialogCancel>
                              <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={() => deleteMutation.mutate(c.id)}>Löschen</AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </>
                    )}
                  </div>
                </div>
              </div>
            );
            /* MOB-IMPROVE-6: Wrap with swipe actions on mobile */
            return isMobile && !showTrash ? (
              <MobileSwipeToAction
                key={c.id}
                leftActions={[{ id: "edit", label: "Bearbeiten", icon: <Edit2 className="h-4 w-4" />, color: "bg-primary", onAction: () => openEdit(c) }]}
                rightActions={[{ id: "delete", label: "Löschen", icon: <Trash2 className="h-4 w-4" />, color: "bg-destructive", onAction: () => {
                  toast(`„${c.name}" löschen?`, {
                    action: { label: "Löschen", onClick: () => deleteMutation.mutate(c.id) },
                    cancel: { label: "Abbrechen", onClick: () => {} },
                    duration: 5000,
                  });
                } }]}
              >
                {contactCard}
              </MobileSwipeToAction>
            ) : contactCard;
          })}
          </div>
          {filtered.length > visibleCount && (
            <div className="flex justify-center pt-4">
              <Button variant="outline" size="sm" className="touch-target min-h-[44px]" onClick={() => setVisibleCount((n) => n + CONTACTS_PAGE_SIZE)}>
                {filtered.length - visibleCount <= CONTACTS_PAGE_SIZE
                  ? `Alle ${filtered.length} anzeigen`
                  : `${CONTACTS_PAGE_SIZE} weitere anzeigen (${filtered.length - visibleCount} übrig)`}
              </Button>
            </div>
          )}
        </>
      )}
      {/* UX-15: Success animation overlay */}
      <SuccessAnimation visible={successVisible} />

      {/* UX-5: Floating Action Button on mobile */}
      <FloatingActionButton onClick={() => { resetForm(); setOpen(true); }} />
    </div>
  );
};

export default ContactManagement;
