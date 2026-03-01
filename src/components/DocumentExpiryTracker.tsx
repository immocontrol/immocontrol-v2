import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { FileWarning, Plus, Trash2, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";

interface DocExpiry {
  id: string;
  property_id: string;
  name: string;
  expiry_date: string;
  notes: string | null;
}

interface DocumentExpiryTrackerProps {
  propertyId: string;
}

const DocumentExpiryTracker = ({ propertyId }: DocumentExpiryTrackerProps) => {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", expiry_date: "", notes: "" });

  const { data: docs = [] } = useQuery({
    queryKey: ["doc_expiry", propertyId],
    queryFn: async () => {
      const { data } = await supabase
        /* FIX-25: Replace `as any` with typed table name cast */
        .from("document_expiries" as never)
        .select("*")
        .eq("property_id", propertyId)
        .order("expiry_date", { ascending: true });
      return (data || []) as unknown as DocExpiry[];
    },
    enabled: !!user,
  });

  const addMutation = useMutation({
    mutationFn: async () => {
      if (!user || !form.name.trim() || !form.expiry_date) throw new Error("Pflichtfelder");
      /* FIX-26: Replace `as any` with typed table name cast */
      const { error } = await supabase.from("document_expiries" as never).insert({
        property_id: propertyId,
        user_id: user.id,
        name: form.name.trim(),
        expiry_date: form.expiry_date,
        notes: form.notes || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Dokument gespeichert");
      setForm({ name: "", expiry_date: "", notes: "" });
      setOpen(false);
      qc.invalidateQueries({ queryKey: ["doc_expiry", propertyId] });
    },
    onError: () => toast.error("Fehler"),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      /* FIX-27: Replace `as any` with typed table name cast */
      await supabase.from("document_expiries" as never).delete().eq("id", id);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["doc_expiry", propertyId] }),
  });

  const now = new Date();
  const expiringSoon = docs.filter(d => {
    const days = (new Date(d.expiry_date).getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
    return days <= 60 && days >= 0;
  });

  return (
    <div className="gradient-card rounded-xl border border-border p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold flex items-center gap-2">
          <FileWarning className="h-4 w-4 text-muted-foreground" />
          Dokumentenfristen
          {expiringSoon.length > 0 && (
            <span className="text-[10px] bg-gold/10 text-gold px-1.5 py-0.5 rounded-full font-medium flex items-center gap-0.5">
              <AlertTriangle className="h-2.5 w-2.5" /> {expiringSoon.length} läuft ab
            </span>
          )}
        </h3>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm" variant="outline" className="h-7 gap-1 text-xs">
              <Plus className="h-3 w-3" /> Dokument
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle>Dokumentenfrist eintragen</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <div className="space-y-1">
                <Label className="text-xs">Dokument *</Label>
                <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} className="h-9 text-sm" placeholder="z.B. Energieausweis, TÜV" autoFocus />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Ablaufdatum *</Label>
                <input type="date" value={form.expiry_date} onChange={e => setForm(f => ({ ...f, expiry_date: e.target.value }))} className="h-9 text-sm w-full rounded-md border border-input bg-background px-3 py-1" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Notiz</Label>
                <Input value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} className="h-9 text-sm" placeholder="Optional" />
              </div>
              <Button onClick={() => addMutation.mutate()} className="w-full" disabled={addMutation.isPending || !form.name.trim() || !form.expiry_date}>
                Speichern
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {docs.length === 0 ? (
        <p className="text-xs text-muted-foreground text-center py-4">Keine Dokumentenfristen eingetragen</p>
      ) : (
        <div className="space-y-2">
          {docs.map(doc => {
            const days = Math.ceil((new Date(doc.expiry_date).getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
            const isExpired = days < 0;
            const isSoon = days <= 60 && days >= 0;
            return (
              <div key={doc.id} className="flex items-center gap-3 p-2.5 rounded-lg bg-secondary/40 group">
                <FileWarning className={`h-3.5 w-3.5 shrink-0 ${isExpired ? "text-loss" : isSoon ? "text-gold" : "text-muted-foreground"}`} />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium truncate">{doc.name}</p>
                  <p className="text-[10px] text-muted-foreground">
                    bis {new Date(doc.expiry_date).toLocaleDateString("de-DE", { day: "2-digit", month: "short", year: "numeric" })}
                    {isExpired && <span className="ml-1.5 text-loss font-medium">abgelaufen</span>}
                    {isSoon && <span className="ml-1.5 text-gold font-medium">in {days} Tagen</span>}
                  </p>
                </div>
                <button onClick={() => deleteMutation.mutate(doc.id)} className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-all shrink-0">
                  <Trash2 className="h-3 w-3" />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default DocumentExpiryTracker;
