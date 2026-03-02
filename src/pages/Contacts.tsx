import { useState, useEffect, useMemo } from "react";
import { Contact, Plus, Search, Phone, Mail, MapPin, Trash2, Edit2, Wrench, Building, Shield, Briefcase, X, Upload, MessageCircle, Download, RotateCcw, Archive } from "lucide-react";
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
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/queryKeys";
import { formatCurrency } from "@/lib/formatters";
import { useDebounce } from "@/hooks/useDebounce";

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

const CATEGORIES = [
  { value: "Handwerker", icon: Wrench },
  { value: "Hausverwaltung", icon: Building },
  { value: "Versicherung", icon: Shield },
  { value: "Sonstiges", icon: Briefcase },
];

/* IMPROVE-1: Batch empty-trash cleanup after 30 days */
const TRASH_RETENTION_DAYS = 30;

const ContactManagement = () => {
  const { user } = useAuth();
  const qc = useQueryClient();

  // Document title
  /* IMP-41: Dynamic document title */ useEffect(() => { document.title = `Kontakte (${contacts.length}) \u2013 ImmoControl`; }, [contacts.length]);

  const [search, setSearch] = useState("");
  const [catFilter, setCatFilter] = useState("alle");
  const [open, setOpen] = useState(false);
  const [csvImportOpen, setCsvImportOpen] = useState(false);
  const [editContact, setEditContact] = useState<ContactItem | null>(null);
  const [showTrash, setShowTrash] = useState(false);
  const [form, setForm] = useState({
    name: "", company: "", category: "Handwerker",
    email: "", phone: "", address: "", notes: "",
  });

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
      if (form.email && !isValidEmail(form.email)) throw new Error("Bitte eine gueltige E-Mail-Adresse eingeben");
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
      toast.success(editContact ? "Kontakt aktualisiert" : "Kontakt angelegt");
      resetForm();
      setOpen(false);
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message || "Fehler"),
  });

  // Soft delete: move to trash
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("contacts").update({ deleted_at: new Date().toISOString() }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Kontakt in Papierkorb verschoben"); invalidate(); },
    onError: () => toast.error("Fehler beim Löschen"),
  });

  // Restore from trash
  const restoreMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("contacts").update({ deleted_at: null }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Kontakt wiederhergestellt"); invalidate(); },
    onError: () => toast.error("Fehler beim Wiederherstellen"),
  });

  // Permanently delete
  const permanentDeleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("contacts").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Kontakt endg\u00fcltig gel\u00f6scht"); invalidate(); },
    onError: () => toast.error("Fehler beim endg\u00fcltigen L\u00f6schen"),
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

  /* IMPROVE-2: Sort contacts alphabetically within each category */
  const sortedContacts = useMemo(() =>
    [...contacts].sort((a, b) => a.name.localeCompare(b.name, "de")),
    [contacts]
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

  // Improvement 9: Contact summary stats
  const handworkerCount = contacts.filter(c => c.category === "Handwerker").length;
  const activeAssignments = Object.values(contactTicketCounts).reduce((s, c) => s + c, 0);
  const totalSpent = Object.values(contactCosts).reduce((s, c) => s + c, 0);

  /* IMPROVE-3: Trash retention info — show how many days until auto-cleanup */
  const trashCount = useMemo(() => {
    if (!showTrash) return 0;
    return contacts.length;
  }, [contacts, showTrash]);

  // New: Duplicate detection
  const duplicateGroups = useMemo(() => {
    const seen = new Map<string, string[]>();
    contacts.forEach(c => {
      const key = c.name.toLowerCase().trim();
      if (!seen.has(key)) seen.set(key, []);
      seen.get(key)!.push(c.id);
    });
    return Array.from(seen.values()).filter(ids => ids.length > 1);
  }, [contacts]);
  const possibleDuplicates = duplicateGroups.flat();

  return (
    <div className="space-y-6" role="main" aria-label="Kontaktverwaltung">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight">Kontakte</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {contacts.length} Kontakte · {handworkerCount} Handwerker
            {activeAssignments > 0 && <span> · {activeAssignments} aktive Aufträge</span>}
            {totalSpent > 0 && <span> · {formatCurrency(totalSpent)} Gesamtkosten</span>}
            {/* BUGFIX: Correct duplicate count — count groups, not flat array */}
            {duplicateGroups.length > 0 && <span className="text-gold"> · ⚠ {duplicateGroups.length} mögliche Duplikate</span>}
          </p>
        </div>
        <div className="flex items-center gap-2">
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
              URL.revokeObjectURL(url);
              toast.success("Kontakte als vCard exportiert!");
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
          <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) resetForm(); }}>
          <DialogTrigger asChild>
            <Button size="sm" variant="outline" className="gap-1.5 hidden">
              <Plus className="h-3.5 w-3.5" /> Kontakt
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>{editContact ? "Kontakt bearbeiten" : "Neuen Kontakt anlegen"}</DialogTitle>
            </DialogHeader>
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
                    {CATEGORIES.map((c) => (
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
                <Label className="text-xs">Notizen</Label>
                <Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} className="text-sm min-h-[60px]" placeholder="Notizen zum Kontakt..." />
              </div>
              <Button onClick={() => saveMutation.mutate()} className="w-full" disabled={saveMutation.isPending}>
                {editContact ? "Speichern" : "Kontakt anlegen"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
        </div>
      </div>

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
          <Input placeholder="Kontakt suchen... (Ctrl+K)" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 pr-8 h-9 text-sm" />
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
          {[{ value: "alle", label: "Alle", icon: "👥" }, ...CATEGORIES.map(c => ({ value: c.value, label: c.value, icon: c.value === "Handwerker" ? "🔧" : c.value === "Hausverwaltung" ? "🏢" : c.value === "Versicherung" ? "🛡️" : "📋" }))].map((f) => {
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
      {debouncedSearch && filtered.length > 0 && (
        <p className="text-xs text-muted-foreground">{filtered.length} von {contacts.length} Kontakten</p>
      )}

      {/* Contact list */}
      {/* UPD-24: Better empty state animation for contacts */}
      {filtered.length === 0 ? (
        <div className="text-center py-12 empty-state-bounce">
          <div className="w-14 h-14 rounded-2xl bg-secondary/50 flex items-center justify-center mx-auto mb-4">
            <Contact className="h-6 w-6 text-muted-foreground" />
          </div>
          <p className="text-sm font-medium mb-1">
            {contacts.length === 0 ? "Noch keine Kontakte" : "Keine Ergebnisse"}
          </p>
          <p className="text-xs text-muted-foreground mb-4">
            {contacts.length === 0 ? "Lege deinen ersten Kontakt an" : `Keine Kontakte gefunden für „${search}"`}
          </p>
          {contacts.length === 0 ? (
            <Button size="sm" className="gap-1.5" onClick={() => setOpen(true)}>
              <Plus className="h-3.5 w-3.5" /> Ersten Kontakt anlegen
            </Button>
          ) : (
            <Button variant="ghost" size="sm" className="text-xs" onClick={() => { setSearch(""); setCatFilter("alle"); }}>
              Filter zurücksetzen
            </Button>
          )}
        </div>
      ) : (
        <>
          <ContactStats contacts={contacts} />
          {/* Improvement 14: Contact list with stagger animation */}
                    {/* UI-UPDATE-14: Card hover animation for contacts */}
          {/* UPD-25: Add card-press class for mobile touch feedback */}
          <div className="grid gap-3 md:grid-cols-2 list-stagger">
          {filtered.map((c) => {
            const CatIcon = CATEGORIES.find(cat => cat.value === c.category)?.icon || Briefcase;
            return (
              <div key={c.id} className={`gradient-card rounded-xl border p-4 group hover:border-primary/20 transition-all duration-200 hover:shadow-sm hover-lift ${possibleDuplicates.includes(c.id) ? "border-gold/30" : "border-border"}`}>
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                    <CatIcon className="h-4 w-4 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold truncate">{c.name}</span>
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
                    </div>
                    {c.company && <p className="text-xs text-muted-foreground">{c.company}</p>}
                    <div className="flex flex-wrap items-center gap-3 mt-1.5 text-[11px] text-muted-foreground">
                      {c.phone && (
                        <a href={`tel:${c.phone}`} className="flex items-center gap-0.5 hover:text-primary transition-colors">
                          <Phone className="h-2.5 w-2.5" /> {c.phone}
                        </a>
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
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-primary" onClick={() => restoreMutation.mutate(c.id)}>
                          <RotateCcw className="h-3 w-3" />
                        </Button>
                        </TooltipTrigger><TooltipContent>Wiederherstellen</TooltipContent></Tooltip>
                        <AlertDialog>
                          {/* UI-UPDATE-15: Tooltip on permanent delete action */}
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <AlertDialogTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive">
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
                                <Button variant="ghost" size="icon" className="h-7 w-7 text-[#25D366]">
                                  <MessageCircle className="h-3 w-3" />
                                </Button>
                              </a>
                            </TooltipTrigger>
                            <TooltipContent>WhatsApp</TooltipContent>
                          </Tooltip>
                        )}
                        {/* UI-UPDATE-12: Tooltip on edit action */}
                        <Tooltip><TooltipTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(c)}>
                          <Edit2 className="h-3 w-3" />
                        </Button>
                        </TooltipTrigger><TooltipContent>Bearbeiten</TooltipContent></Tooltip>
                        <AlertDialog>
                          {/* UI-UPDATE-17: Tooltip on trash action */}
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <AlertDialogTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive">
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
          })}
          </div>
        </>
      )}
    </div>
  );
};

export default ContactManagement;
