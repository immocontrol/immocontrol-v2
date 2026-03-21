/**
 * INHALT-8: Kautions-Management — Vollständige Kautionsverwaltung
 * Kautionskonto-Tracking mit Zinsberechnung, automatische Rückzahlungsberechnung
 * bei Auszug, Kautionsbürgschafts-Verwaltung.
 */
import { memo, useMemo, useState, useCallback } from "react";
import { Shield, Plus, ChevronDown, ChevronUp, AlertTriangle, CheckCircle2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useProperties } from "@/context/PropertyContext";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { formatCurrency, formatDate } from "@/lib/formatters";
import { toast } from "sonner";

interface KautionEntry {
  id: string;
  tenantId: string;
  tenantName: string;
  propertyName: string;
  type: "barkaution" | "buergschaft" | "sparbuch";
  amount: number;
  depositDate: string;
  interestRate: number;
  status: "aktiv" | "rueckzahlung" | "abgerechnet";
  deductions: number;
  notes: string;
}

const STORAGE_KEY = "immo_kautionen";

const KautionsManagement = memo(() => {
  const { user } = useAuth();
  const { properties } = useProperties();
  const [expanded, setExpanded] = useState(false);
  const [showNew, setShowNew] = useState(false);

  const [kautionen, setKautionen] = useState<KautionEntry[]>(() => {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]"); }
    catch { return []; }
  });

  const { data: tenants = [] } = useQuery({
    queryKey: ["kaution_tenants"],
    queryFn: async () => {
      const { data } = await supabase
        .from("tenants")
        .select("id, name, property_id, rent");
      return (data || []) as Array<{ id: string; name: string; property_id: string; rent: number }>;
    },
    enabled: !!user,
  });

  const [newKaution, setNewKaution] = useState<Partial<KautionEntry>>({
    type: "barkaution",
    status: "aktiv",
    interestRate: 0.01,
    depositDate: new Date().toISOString().slice(0, 10),
  });

  const stats = useMemo(() => {
    const aktiv = kautionen.filter((k) => k.status === "aktiv");
    const totalAmount = aktiv.reduce((s, k) => s + k.amount, 0);
    const totalWithInterest = aktiv.reduce((s, k) => {
      const years = (Date.now() - new Date(k.depositDate).getTime()) / (1000 * 60 * 60 * 24 * 365);
      const interest = k.amount * Math.pow(1 + k.interestRate / 100, Math.max(0, years)) - k.amount;
      return s + k.amount + interest;
    }, 0);
    const pendingReturn = kautionen.filter((k) => k.status === "rueckzahlung");
    return { totalAmount, totalWithInterest, activeCount: aktiv.length, pendingReturn };
  }, [kautionen]);

  const addKaution = useCallback(() => {
    if (!newKaution.tenantName || !newKaution.amount) {
      toast.error("Bitte Mieter und Betrag angeben");
      return;
    }
    const entry: KautionEntry = {
      id: crypto.randomUUID(),
      tenantId: newKaution.tenantId || "",
      tenantName: newKaution.tenantName || "",
      propertyName: newKaution.propertyName || "",
      type: newKaution.type as KautionEntry["type"] || "barkaution",
      amount: newKaution.amount || 0,
      depositDate: newKaution.depositDate || new Date().toISOString(),
      interestRate: newKaution.interestRate || 0.01,
      status: "aktiv",
      deductions: 0,
      notes: newKaution.notes || "",
    };
    const updated = [entry, ...kautionen];
    setKautionen(updated);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    setNewKaution({ type: "barkaution", status: "aktiv", interestRate: 0.01, depositDate: new Date().toISOString().slice(0, 10) });
    setShowNew(false);
    toast.success("Kaution angelegt");
  }, [newKaution, kautionen]);

  const markForReturn = useCallback((id: string) => {
    const updated = kautionen.map((k) => k.id === id ? { ...k, status: "rueckzahlung" as const } : k);
    setKautionen(updated);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    toast.success("Zur Rückzahlung vorgemerkt");
  }, [kautionen]);

  return (
    <div className="gradient-card rounded-xl border border-border p-4 animate-fade-in">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Shield className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-semibold">Kautions-Management</h3>
          <Badge variant="outline" className="text-[10px] h-5">{stats.activeCount} aktiv</Badge>
        </div>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setShowNew(!showNew)}>
            <Plus className="h-3 w-3" />
          </Button>
          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setExpanded(!expanded)}>
            {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
          </Button>
        </div>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 gap-2 mb-3">
        <div className="text-center p-2 rounded-lg bg-background/50">
          <p className="text-[10px] text-muted-foreground">Kautionen gesamt</p>
          <p className="text-xs font-bold">{formatCurrency(stats.totalAmount)}</p>
        </div>
        <div className="text-center p-2 rounded-lg bg-background/50">
          <p className="text-[10px] text-muted-foreground">Inkl. Zinsen</p>
          <p className="text-xs font-bold text-profit">{formatCurrency(stats.totalWithInterest)}</p>
        </div>
      </div>

      {stats.pendingReturn.length > 0 && (
        <div className="flex items-center gap-1 text-[10px] text-gold p-1.5 rounded bg-gold/5 mb-2">
          <AlertTriangle className="h-3 w-3" />
          {stats.pendingReturn.length} Kaution(en) zur Rückzahlung ausstehend
        </div>
      )}

      {/* New kaution form */}
      {showNew && (
        <div className="surface-section p-2 mb-3 space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <Input className="h-7 text-[10px]" placeholder="Mietername" value={newKaution.tenantName || ""} onChange={(e) => setNewKaution((p) => ({ ...p, tenantName: e.target.value }))} />
            <Input className="h-7 text-[10px]" placeholder="Objekt" value={newKaution.propertyName || ""} onChange={(e) => setNewKaution((p) => ({ ...p, propertyName: e.target.value }))} />
          </div>
          <div className="grid grid-cols-3 gap-2">
            <Input className="h-7 text-[10px]" type="number" placeholder="Betrag €" value={newKaution.amount || ""} onChange={(e) => setNewKaution((p) => ({ ...p, amount: parseFloat(e.target.value) || 0 }))} />
            <Select value={newKaution.type} onValueChange={(v) => setNewKaution((p) => ({ ...p, type: v }))}>
              <SelectTrigger className="h-7 text-[10px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="barkaution" className="text-xs">Barkaution</SelectItem>
                <SelectItem value="buergschaft" className="text-xs">Bürgschaft</SelectItem>
                <SelectItem value="sparbuch" className="text-xs">Sparbuch</SelectItem>
              </SelectContent>
            </Select>
            <Input className="h-7 text-[10px]" type="date" value={newKaution.depositDate || ""} onChange={(e) => setNewKaution((p) => ({ ...p, depositDate: e.target.value }))} />
          </div>
          <Button size="sm" className="w-full text-[10px] h-7" onClick={addKaution}>Kaution anlegen</Button>
        </div>
      )}

      {/* Kaution list */}
      <div className="space-y-1.5 max-h-48 overflow-y-auto">
        {kautionen.slice(0, expanded ? undefined : 3).map((k) => {
          const years = Math.max(0, (Date.now() - new Date(k.depositDate).getTime()) / (1000 * 60 * 60 * 24 * 365));
          const interest = k.amount * Math.pow(1 + k.interestRate / 100, years) - k.amount;
          const totalReturn = k.amount + interest - k.deductions;
          return (
            <div key={k.id} className={`p-2 rounded-lg border text-[10px] ${
              k.status === "rueckzahlung" ? "bg-gold/5 border-gold/20" :
              k.status === "abgerechnet" ? "bg-muted/50 border-border" :
              "bg-background/50 border-border/50"
            }`}>
              <div className="flex justify-between items-start">
                <div>
                  <span className="font-medium">{k.tenantName}</span>
                  <span className="text-muted-foreground ml-1">({k.propertyName})</span>
                </div>
                <Badge variant="outline" className="text-[8px] h-4">
                  {k.type === "barkaution" ? "Bar" : k.type === "buergschaft" ? "Bürgschaft" : "Sparbuch"}
                </Badge>
              </div>
              <div className="grid grid-cols-3 gap-1 mt-1">
                <div>
                  <span className="text-muted-foreground">Kaution</span>
                  <p className="font-medium">{formatCurrency(k.amount)}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Zinsen</span>
                  <p className="font-medium text-profit">{formatCurrency(interest)}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Rückzahlung</span>
                  <p className="font-medium">{formatCurrency(totalReturn)}</p>
                </div>
              </div>
              {k.status === "aktiv" && expanded && (
                <Button size="sm" variant="outline" className="text-[10px] h-5 px-2 mt-1" onClick={() => markForReturn(k.id)}>
                  Rückzahlung einleiten
                </Button>
              )}
            </div>
          );
        })}
        {kautionen.length === 0 && (
          <p className="text-[10px] text-muted-foreground text-center py-3">Noch keine Kautionen erfasst</p>
        )}
      </div>
    </div>
  );
});
KautionsManagement.displayName = "KautionsManagement";

export { KautionsManagement };
