import { useState } from "react";
import { Contact, Plus, Search, Phone, Mail, MapPin, Trash2, Edit2, Wrench, Building, Shield, Briefcase, X, Upload, MessageCircle } from "lucide-react";
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

const ContactManagement = () => {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [catFilter, setCatFilter] = useState("alle");
  const [open, setOpen] = useState(false);
  const [csvImportOpen, setCsvImportOpen] = useState(false);
  const [editContact, setEditContact] = useState<ContactItem | null>(null);
  const [form, setForm] = useState({
    name: "", company: "", category: "Handwerker",
    email: "", phone: "", address: "", notes: "",
  });

  // Improvement 5: React Query for contacts
  const { data: contacts = [] } = useQuery({
    queryKey: queryKeys.contacts.all,
    queryFn: async () => {
      const { data } = await supabase
        .from("contacts")
        .select("*")
        .order("name");
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
    onError: (e: any) => toast.error(e.message || "Fehler"),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await supabase.from("contacts").delete().eq("id", id);
    },
    onSuccess: () => { toast.success("Kontakt entfernt"); invalidate(); },
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

  const filtered = contacts.filter((c) => {
    if (catFilter !== "alle" && c.category !== catFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      return c.name.toLowerCase().includes(q) || (c.company || "").toLowerCase().includes(q);
    }
    return true;
  });

  // Improvement 9: Contact summary stats
  const handworkerCount = contacts.filter(c => c.category === "Handwerker").length;
  const activeAssignments = Object.values(contactTicketCounts).reduce((s, c) => s + c, 0);
  const totalSpent = Object.values(contactCosts).reduce((s, c) => s + c, 0);

  return (
    <div className="space-y-6" role="main" aria-label="Kontaktverwaltung">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Kontakte</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {contacts.length} Kontakte · {handworkerCount} Handwerker
            {activeAssignments > 0 && <span> · {activeAssignments} aktive Aufträge</span>}
            {totalSpent > 0 && <span> · {formatCurrency(totalSpent)} Gesamtkosten</span>}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setCsvImportOpen(true)}>
            <Upload className="h-3.5 w-3.5" /> CSV importieren
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
      <div className="flex gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Kontakt suchen..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 pr-8 h-9 text-sm" />
          {search && (
            <button
              onClick={() => setSearch("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
              aria-label="Suche leeren"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
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

      {/* Contact list */}
      {filtered.length === 0 ? (
        <div className="text-center py-12 animate-fade-in">
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
          <div className="grid gap-3 md:grid-cols-2">
          {filtered.map((c) => {
            const CatIcon = CATEGORIES.find(cat => cat.value === c.category)?.icon || Briefcase;
            return (
              <div key={c.id} className="gradient-card rounded-xl border border-border p-4 group hover:border-primary/20 transition-all duration-200 hover:shadow-sm">
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
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-all duration-200">
                    {c.phone && (
                      <a href={`https://wa.me/${c.phone.replace(/\D/g, "")}`} target="_blank" rel="noopener noreferrer">
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-[#25D366]" title="WhatsApp">
                          <MessageCircle className="h-3 w-3" />
                        </Button>
                      </a>
                    )}
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(c)}>
                      <Edit2 className="h-3 w-3" />
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive">
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Kontakt löschen?</AlertDialogTitle>
                          <AlertDialogDescription>„{c.name}" wird unwiderruflich entfernt.</AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Abbrechen</AlertDialogCancel>
                          <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={() => deleteMutation.mutate(c.id)}>Löschen</AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
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
