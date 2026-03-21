/** NEW-17: Immobilien-Watchlist / Marktbeobachtung
 * Allows users to save and track properties they're interested in from external sources. */
import { memo, useState, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { formatCurrency } from "@/lib/formatters";
import { Eye, Plus, Trash2, ExternalLink, MapPin, TrendingUp, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Label } from "@/components/ui/label";
import { NumberInput } from "@/components/NumberInput";
import { toast } from "sonner";
import { handleMutationError } from "@/lib/mutationErrorHandler";

interface WatchlistItem {
  id: string;
  title: string;
  address: string;
  price: number;
  sqm: number;
  expected_rent: number;
  url: string;
  notes: string;
  created_at: string;
}

const emptyForm = { title: "", address: "", price: 0, sqm: 0, expected_rent: 0, url: "", notes: "" };

const ImmobilienWatchlist = memo(() => {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [addOpen, setAddOpen] = useState(false);
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);

  const { data: items = [], isLoading } = useQuery({
    queryKey: ["watchlist", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("watchlist")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) {
        // Table might not exist yet — return empty
        if (error.code === "42P01") return [];
        throw error;
      }
      return (data || []) as WatchlistItem[];
    },
    enabled: !!user,
    retry: false,
  });

  const addItem = useMutation({
    mutationFn: async () => {
      if (!user || !form.title.trim()) throw new Error("Titel erforderlich");
      const { error } = await supabase.from("watchlist").insert({
        user_id: user.id,
        ...form,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["watchlist"] });
      toast.success("Zur Watchlist hinzugefügt");
      setForm(emptyForm);
      setAddOpen(false);
    },
    onError: (e) => handleMutationError(e, { context: "Watchlist hinzufügen" }),
  });

  const removeItem = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("watchlist").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["watchlist"] });
      toast.success("Von Watchlist entfernt");
    },
    onError: (e) => handleMutationError(e, { context: "Watchlist entfernen" }),
  });

  const calcYield = useCallback((price: number, rent: number) => {
    return price > 0 && rent > 0 ? ((rent * 12) / price * 100).toFixed(1) : "–";
  }, []);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Eye className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-bold">Immobilien-Watchlist</h2>
          <Badge variant="outline" className="text-xs">{items.length}</Badge>
        </div>
        <Dialog open={addOpen} onOpenChange={setAddOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="gap-1.5">
              <Plus className="h-3.5 w-3.5" /> Hinzufügen
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Immobilie beobachten</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div><Label className="text-xs">Titel *</Label><Input value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} placeholder="z.B. MFH Berlin-Kreuzberg" /></div>
              <div><Label className="text-xs">Adresse</Label><Input value={form.address} onChange={e => setForm(p => ({ ...p, address: e.target.value }))} placeholder="Straße, PLZ Ort" /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label className="text-xs">Kaufpreis</Label><NumberInput value={form.price} onChange={v => setForm(p => ({ ...p, price: v }))} min={0} /></div>
                <div><Label className="text-xs">Fläche (m²)</Label><NumberInput value={form.sqm} onChange={v => setForm(p => ({ ...p, sqm: v }))} min={0} /></div>
              </div>
              <div><Label className="text-xs">Erwartete Miete/M</Label><NumberInput value={form.expected_rent} onChange={v => setForm(p => ({ ...p, expected_rent: v }))} min={0} /></div>
              <div><Label className="text-xs">Link zum Inserat</Label><Input value={form.url} onChange={e => setForm(p => ({ ...p, url: e.target.value }))} placeholder="https://..." /></div>
              <div><Label className="text-xs">Notizen</Label><Input value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} placeholder="Zusätzliche Infos..." /></div>
              <Button onClick={() => addItem.mutate()} disabled={!form.title.trim()} className="w-full">
                Zur Watchlist hinzufügen
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {items.length === 0 && !isLoading && (
        <div className="text-center py-8 text-sm text-muted-foreground">
          <Eye className="h-8 w-8 mx-auto mb-2 opacity-30" />
          <p>Noch keine Immobilien auf der Watchlist</p>
          <p className="text-xs mt-1">Füge interessante Objekte hinzu, um sie im Blick zu behalten</p>
        </div>
      )}

      <div className="grid gap-3 md:grid-cols-2">
        {items.map(item => (
          <div key={item.id} className="gradient-card rounded-xl border border-border p-3 hover-lift">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <p className="font-medium text-sm truncate">{item.title}</p>
                {item.address && (
                  <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5 truncate">
                    <MapPin className="h-3 w-3 shrink-0" /> {item.address}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-1 shrink-0">
                {item.url && (
                  <a href={item.url} target="_blank" rel="noopener noreferrer" className="p-1 rounded hover:bg-secondary transition-colors">
                    <ExternalLink className="h-3.5 w-3.5 text-muted-foreground" />
                  </a>
                )}
                <button onClick={() => setDeleteTargetId(item.id)} className="p-1 rounded hover:bg-destructive/10 transition-colors" aria-label={`${item.title} von Watchlist entfernen`}>
                  <Trash2 className="h-3.5 w-3.5 text-muted-foreground hover:text-loss" />
                </button>
              </div>
            </div>
            <div className="flex items-center gap-3 mt-2 text-xs">
              {item.price > 0 && <span className="font-medium">{formatCurrency(item.price)}</span>}
              {item.sqm > 0 && <span className="text-muted-foreground">{item.sqm} m²</span>}
              {item.price > 0 && item.sqm > 0 && (
                <span className="text-muted-foreground">{formatCurrency(item.price / item.sqm)}/m²</span>
              )}
              {item.expected_rent > 0 && (
                <Badge variant="outline" className="text-[10px] gap-0.5">
                  <TrendingUp className="h-2.5 w-2.5" /> {calcYield(item.price, item.expected_rent)}%
                </Badge>
              )}
            </div>
            {item.notes && <p className="text-[10px] text-muted-foreground mt-1.5 line-clamp-2">{item.notes}</p>}
          </div>
        ))}
      </div>

      <AlertDialog open={!!deleteTargetId} onOpenChange={(open) => { if (!open) setDeleteTargetId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Von Watchlist entfernen?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTargetId && items.find(i => i.id === deleteTargetId)
                ? `„${items.find(i => i.id === deleteTargetId)?.title}" wird von der Watchlist entfernt.`
                : "Dieser Eintrag wird von der Watchlist entfernt."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => { if (deleteTargetId) { removeItem.mutate(deleteTargetId); setDeleteTargetId(null); } }}
            >
              Entfernen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
});
ImmobilienWatchlist.displayName = "ImmobilienWatchlist";

export { ImmobilienWatchlist };
