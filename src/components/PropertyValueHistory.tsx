import { useState } from "react";
import { TrendingUp, Plus, Trash2, ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NumberInput } from "@/components/NumberInput";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { formatCurrency } from "@/lib/formatters";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine } from "recharts";

interface ValueEntry {
  id: string;
  property_id: string;
  value: number;
  date: string;
  note: string | null;
}

interface PropertyValueHistoryProps {
  propertyId: string;
  currentValue: number;
  purchasePrice: number;
}

const PropertyValueHistory = ({ propertyId, currentValue, purchasePrice }: PropertyValueHistoryProps) => {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [form, setForm] = useState({ value: 0, date: new Date().toISOString().split("T")[0], note: "" });

  const { data: entries = [] } = useQuery({
    queryKey: ["value_history", propertyId],
    queryFn: async () => {
      const { data } = await supabase
        .from("property_value_history" as any)
        .select("*")
        .eq("property_id", propertyId)
        .order("date", { ascending: true });
      return (data || []) as unknown as ValueEntry[];
    },
    enabled: !!user,
  });

  const addMutation = useMutation({
    mutationFn: async () => {
      if (!user || form.value <= 0) throw new Error("Wert erforderlich");
      const { error } = await supabase.from("property_value_history" as any).insert({
        property_id: propertyId,
        user_id: user.id,
        value: form.value,
        date: form.date,
        note: form.note || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Wertentwicklung eingetragen");
      setForm({ value: 0, date: new Date().toISOString().split("T")[0], note: "" });
      setOpen(false);
      qc.invalidateQueries({ queryKey: ["value_history", propertyId] });
    },
    onError: () => toast.error("Fehler beim Speichern"),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await supabase.from("property_value_history" as any).delete().eq("id", id);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["value_history", propertyId] }),
  });

  const chartData = [
    { date: "Kauf", value: purchasePrice },
    ...entries.map(e => ({ date: new Date(e.date).toLocaleDateString("de-DE", { month: "short", year: "2-digit" }), value: e.value, note: e.note })),
    { date: "Heute", value: currentValue },
  ];

  const totalGain = currentValue - purchasePrice;
  const gainPct = purchasePrice > 0 ? ((currentValue - purchasePrice) / purchasePrice) * 100 : 0;

  return (
    <div className="gradient-card rounded-xl border border-border p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-muted-foreground" />
          <h3 className="text-sm font-semibold">Wertentwicklung</h3>
          <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${gainPct >= 0 ? "bg-profit/10 text-profit" : "bg-loss/10 text-loss"}`}>
            {gainPct >= 0 ? "+" : ""}{gainPct.toFixed(1)}%
          </span>
        </div>
        <div className="flex items-center gap-1">
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm" variant="outline" className="h-7 gap-1 text-xs">
                <Plus className="h-3 w-3" /> Eintrag
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-sm">
              <DialogHeader>
                <DialogTitle>Wert eintragen</DialogTitle>
              </DialogHeader>
              <div className="space-y-3">
                <div className="space-y-1">
                  <Label className="text-xs">Datum</Label>
                  <Input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} className="h-9 text-sm" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Marktwert *</Label>
                  <NumberInput value={form.value} onChange={v => setForm(f => ({ ...f, value: v }))} className="h-9 text-sm" placeholder="0" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Notiz</Label>
                  <Input value={form.note} onChange={e => setForm(f => ({ ...f, note: e.target.value }))} className="h-9 text-sm" placeholder="z.B. Gutachten, Maklereinschätzung" />
                </div>
                <Button onClick={() => addMutation.mutate()} className="w-full" disabled={addMutation.isPending || form.value <= 0}>
                  Eintragen
                </Button>
              </div>
            </DialogContent>
          </Dialog>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setExpanded(e => !e)}>
            {expanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
          </Button>
        </div>
      </div>

      <div className="flex items-center gap-4 text-xs text-muted-foreground mb-3">
        <span>Kaufpreis: {formatCurrency(purchasePrice)}</span>
        <span>Heute: {formatCurrency(currentValue)}</span>
        <span className={gainPct >= 0 ? "text-profit font-medium" : "text-loss font-medium"}>
          {gainPct >= 0 ? "+" : ""}{formatCurrency(totalGain)}
        </span>
      </div>

      {chartData.length > 2 && (
        <ResponsiveContainer width="100%" height={120}>
          <LineChart data={chartData}>
            <XAxis dataKey="date" tick={{ fontSize: 10 }} />
            <YAxis tick={{ fontSize: 10 }} tickFormatter={v => `${(v / 1000).toFixed(0)}k`} width={45} />
            <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 11 }} formatter={(v: number) => [formatCurrency(v), "Wert"]} />
            <ReferenceLine y={purchasePrice} stroke="hsl(var(--muted-foreground))" strokeDasharray="3 3" />
            <Line type="monotone" dataKey="value" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ r: 3, fill: "hsl(var(--primary))" }} />
          </LineChart>
        </ResponsiveContainer>
      )}

      {expanded && entries.length > 0 && (
        <div className="mt-3 space-y-1 border-t border-border pt-3">
          {entries.map(e => (
            <div key={e.id} className="flex items-center justify-between text-xs group">
              <span className="text-muted-foreground">{new Date(e.date).toLocaleDateString("de-DE")}</span>
              <span className="font-medium">{formatCurrency(e.value)}</span>
              {e.note && <span className="text-muted-foreground italic truncate max-w-[120px]">{e.note}</span>}
              <button onClick={() => deleteMutation.mutate(e.id)} className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-all">
                <Trash2 className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default PropertyValueHistory;
