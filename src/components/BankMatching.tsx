import { useState, useMemo, useRef } from "react";
import { Landmark, Upload, Link2, Unlink, CheckCircle, X, FileSpreadsheet, ArrowRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useProperties } from "@/context/PropertyContext";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { formatCurrency } from "@/lib/formatters";
import { toast } from "sonner";

interface BankTransaction {
  id: string;
  user_id: string;
  booking_date: string;
  value_date: string | null;
  amount: number;
  currency: string;
  sender_receiver: string | null;
  iban: string | null;
  bic: string | null;
  reference: string | null;
  booking_text: string | null;
  matched_payment_id: string | null;
  match_confidence: string | null;
  created_at: string;
}

const BankMatching = () => {
  const { user } = useAuth();
  const { properties } = useProperties();
  const queryClient = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [importing, setImporting] = useState(false);

  const { data: transactions = [], isLoading } = useQuery<BankTransaction[]>({
    queryKey: ["bank_transactions"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bank_transactions")
        .select("*")
        .order("booking_date", { ascending: false })
        .limit(200);
      if (error) throw error;
      return (data as any[]) || [];
    },
    enabled: !!user,
  });

  const { data: payments = [] } = useQuery({
    queryKey: ["bank_matching_payments"],
    queryFn: async () => {
      const { data } = await supabase.from("rent_payments").select("*").order("due_date", { ascending: false });
      return data || [];
    },
    enabled: !!user,
  });

  const { data: tenants = [] } = useQuery({
    queryKey: ["bank_matching_tenants"],
    queryFn: async () => {
      const { data } = await supabase.from("tenants").select("*");
      return data || [];
    },
    enabled: !!user,
  });

  const tenantMap = useMemo(() => Object.fromEntries(tenants.map(t => [t.id, t])), [tenants]);
  const propertyMap = useMemo(() => Object.fromEntries(properties.map(p => [p.id, p])), [properties]);
  const paymentMap = useMemo(() => Object.fromEntries(payments.map(p => [p.id, p])), [payments]);

  // Unmatched payments for suggestion
  const unmatchedPayments = useMemo(
    () => payments.filter(p => p.status !== "confirmed" && !transactions.some(t => t.matched_payment_id === p.id)),
    [payments, transactions]
  );

  // Auto-match suggestion: find payment with same amount and close date
  const suggestMatch = (tx: BankTransaction) => {
    if (tx.amount <= 0) return null;
    return unmatchedPayments.find(p => {
      const amountMatch = Math.abs(Number(p.amount) - tx.amount) < 0.01;
      if (!amountMatch) return false;
      // Check if tenant name appears in reference or sender
      const tenant = tenantMap[p.tenant_id];
      if (!tenant) return true; // amount-only match
      const name = `${tenant.first_name} ${tenant.last_name}`.toLowerCase();
      const ref = (tx.reference || "").toLowerCase() + " " + (tx.sender_receiver || "").toLowerCase();
      return ref.includes(tenant.last_name.toLowerCase()) || ref.includes(name);
    });
  };

  const matchMutation = useMutation({
    mutationFn: async ({ txId, paymentId }: { txId: string; paymentId: string }) => {
      const { error: e1 } = await supabase
        .from("bank_transactions")
        .update({ matched_payment_id: paymentId, match_confidence: "manual" } as any)
        .eq("id", txId);
      if (e1) throw e1;
      const { error: e2 } = await supabase
        .from("rent_payments")
        .update({ status: "confirmed", paid_date: new Date().toISOString().slice(0, 10) })
        .eq("id", paymentId);
      if (e2) throw e2;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["bank_transactions"] });
      queryClient.invalidateQueries({ queryKey: ["bank_matching_payments"] });
      queryClient.invalidateQueries({ queryKey: ["mietuebersicht_payments"] });
      toast.success("Transaktion zugeordnet & Zahlung bestätigt");
    },
  });

  const unmatchMutation = useMutation({
    mutationFn: async ({ txId, paymentId }: { txId: string; paymentId: string }) => {
      const { error: e1 } = await supabase
        .from("bank_transactions")
        .update({ matched_payment_id: null, match_confidence: null } as any)
        .eq("id", txId);
      if (e1) throw e1;
      const { error: e2 } = await supabase
        .from("rent_payments")
        .update({ status: "pending", paid_date: null })
        .eq("id", paymentId);
      if (e2) throw e2;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["bank_transactions"] });
      queryClient.invalidateQueries({ queryKey: ["bank_matching_payments"] });
      queryClient.invalidateQueries({ queryKey: ["mietuebersicht_payments"] });
      toast.success("Zuordnung aufgehoben");
    },
  });

  // CSV Import (simple German bank CSV: Buchungstag;Wertstellungstag;Betrag;Auftraggeber/Empfänger;Verwendungszweck;IBAN;BIC;Buchungstext)
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    setImporting(true);

    try {
      const text = await file.text();
      const lines = text.split("\n").filter(l => l.trim());
      if (lines.length < 2) { toast.error("CSV ist leer"); return; }

      const sep = lines[0].includes(";") ? ";" : ",";
      const headers = lines[0].split(sep).map(h => h.trim().replace(/"/g, "").toLowerCase());

      // Find column indices flexibly
      const dateCol = headers.findIndex(h => h.includes("buchung") || h.includes("datum") || h.includes("date"));
      const amountCol = headers.findIndex(h => h.includes("betrag") || h.includes("amount") || h.includes("soll") || h.includes("haben"));
      const nameCol = headers.findIndex(h => h.includes("empf") || h.includes("auftrag") || h.includes("name") || h.includes("sender"));
      const refCol = headers.findIndex(h => h.includes("verwendung") || h.includes("referenz") || h.includes("reference") || h.includes("zweck"));
      const ibanCol = headers.findIndex(h => h.includes("iban"));
      const bicCol = headers.findIndex(h => h.includes("bic"));
      const textCol = headers.findIndex(h => h.includes("buchungstext") || h.includes("text") || h.includes("type"));

      if (dateCol === -1 || amountCol === -1) {
        toast.error("CSV-Format nicht erkannt. Spalten 'Buchungstag' und 'Betrag' benötigt.");
        return;
      }

      const rows: any[] = [];
      for (let i = 1; i < lines.length; i++) {
        const cols = lines[i].split(sep).map(c => c.trim().replace(/^"|"$/g, ""));
        if (cols.length <= amountCol) continue;

        const rawDate = cols[dateCol];
        // Parse DD.MM.YYYY or YYYY-MM-DD
        let bookingDate: string;
        if (rawDate.includes(".")) {
          const [d, m, y] = rawDate.split(".");
          bookingDate = `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
        } else {
          bookingDate = rawDate;
        }
        if (!/^\d{4}-\d{2}-\d{2}$/.test(bookingDate)) continue;

        const rawAmount = cols[amountCol].replace(/\./g, "").replace(",", ".");
        const amount = parseFloat(rawAmount);
        if (isNaN(amount)) continue;

        rows.push({
          user_id: user.id,
          booking_date: bookingDate,
          amount,
          sender_receiver: nameCol >= 0 ? cols[nameCol] || null : null,
          reference: refCol >= 0 ? cols[refCol] || null : null,
          iban: ibanCol >= 0 ? cols[ibanCol] || null : null,
          bic: bicCol >= 0 ? cols[bicCol] || null : null,
          booking_text: textCol >= 0 ? cols[textCol] || null : null,
        });
      }

      if (rows.length === 0) { toast.error("Keine gültigen Transaktionen gefunden"); return; }

      // Insert in batches
      const batchSize = 100;
      for (let i = 0; i < rows.length; i += batchSize) {
        const { error } = await supabase.from("bank_transactions").insert(rows.slice(i, i + batchSize) as any);
        if (error) throw error;
      }

      toast.success(`${rows.length} Transaktionen importiert`);
      queryClient.invalidateQueries({ queryKey: ["bank_transactions"] });
      setImportOpen(false);
    } catch (err: any) {
      toast.error("Import fehlgeschlagen: " + (err?.message || "Unbekannter Fehler"));
    } finally {
      setImporting(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const matched = transactions.filter(t => t.matched_payment_id);
  const unmatched = transactions.filter(t => !t.matched_payment_id && t.amount > 0);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Landmark className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-semibold">Bank-Abgleich</h2>
          <span className="text-xs text-muted-foreground">
            {transactions.length} Transaktionen · {matched.length} zugeordnet
          </span>
        </div>
        <Dialog open={importOpen} onOpenChange={setImportOpen}>
          <DialogTrigger asChild>
            <Button variant="outline" size="sm" className="gap-1.5">
              <Upload className="h-3.5 w-3.5" />
              CSV Import
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Banktransaktionen importieren</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Lade eine CSV-Datei deiner Bank hoch. Unterstützte Formate: Sparkasse, Volksbank, DKB, ING, Commerzbank und weitere.
              </p>
              <div className="text-xs text-muted-foreground bg-secondary/50 rounded-lg p-3 space-y-1">
                <p className="font-medium">Benötigte Spalten:</p>
                <p>• Buchungstag / Datum (Pflicht)</p>
                <p>• Betrag (Pflicht)</p>
                <p>• Auftraggeber/Empfänger (optional)</p>
                <p>• Verwendungszweck (optional)</p>
                <p>• IBAN, BIC (optional)</p>
              </div>
              <div className="flex items-center gap-2">
                <input
                  ref={fileRef}
                  type="file"
                  accept=".csv,.CSV"
                  onChange={handleFileUpload}
                  className="flex-1 text-sm file:mr-2 file:py-1 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-medium file:bg-primary file:text-primary-foreground hover:file:bg-primary/90 cursor-pointer"
                  disabled={importing}
                />
              </div>
              {importing && <p className="text-xs text-muted-foreground animate-pulse">Importiere...</p>}
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Unmatched transactions with suggestions */}
      {unmatched.length > 0 && (
        <div className="space-y-1">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
            Nicht zugeordnet ({unmatched.length})
          </p>
          {unmatched.slice(0, 20).map(tx => {
            const suggestion = suggestMatch(tx);
            const suggestedTenant = suggestion ? tenantMap[suggestion.tenant_id] : null;
            const suggestedProperty = suggestion ? propertyMap[suggestion.property_id] : null;

            return (
              <div key={tx.id} className="flex items-center gap-3 p-3 rounded-lg border border-border bg-card hover:bg-secondary/30 transition-colors">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium truncate">{tx.sender_receiver || "Unbekannt"}</span>
                    <span className="text-[10px] bg-secondary px-1.5 py-0.5 rounded">
                      {new Date(tx.booking_date).toLocaleDateString("de-DE")}
                    </span>
                  </div>
                  <p className="text-[11px] text-muted-foreground truncate">{tx.reference || tx.booking_text || "–"}</p>
                </div>
                <div className="text-sm font-semibold tabular-nums text-profit">
                  +{formatCurrency(tx.amount)}
                </div>
                {suggestion ? (
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-1 text-xs shrink-0"
                    onClick={() => matchMutation.mutate({ txId: tx.id, paymentId: suggestion.id })}
                    disabled={matchMutation.isPending}
                  >
                    <Link2 className="h-3 w-3" />
                    {suggestedTenant ? `${suggestedTenant.first_name} ${suggestedTenant.last_name}` : "Zuordnen"}
                    {suggestedProperty && <span className="text-muted-foreground">({suggestedProperty.name})</span>}
                  </Button>
                ) : (
                  <span className="text-[10px] text-muted-foreground">Kein Match</span>
                )}
              </div>
            );
          })}
          {unmatched.length > 20 && (
            <p className="text-xs text-muted-foreground text-center py-2">
              +{unmatched.length - 20} weitere Transaktionen
            </p>
          )}
        </div>
      )}

      {/* Matched transactions */}
      {matched.length > 0 && (
        <div className="space-y-1">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
            Zugeordnet ({matched.length})
          </p>
          {matched.slice(0, 10).map(tx => {
            const payment = tx.matched_payment_id ? paymentMap[tx.matched_payment_id] : null;
            const tenant = payment ? tenantMap[payment.tenant_id] : null;
            return (
              <div key={tx.id} className="flex items-center gap-3 p-3 rounded-lg hover:bg-secondary/30 transition-colors">
                <CheckCircle className="h-3.5 w-3.5 text-profit shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium truncate">{tx.sender_receiver || "Unbekannt"}</span>
                    <ArrowRight className="h-3 w-3 text-muted-foreground shrink-0" />
                    <span className="text-sm truncate">
                      {tenant ? `${tenant.first_name} ${tenant.last_name}` : "–"}
                    </span>
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    {new Date(tx.booking_date).toLocaleDateString("de-DE")} · {formatCurrency(tx.amount)}
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 w-7 p-0 text-muted-foreground hover:text-loss"
                  onClick={() => tx.matched_payment_id && unmatchMutation.mutate({ txId: tx.id, paymentId: tx.matched_payment_id })}
                >
                  <Unlink className="h-3 w-3" />
                </Button>
              </div>
            );
          })}
        </div>
      )}

      {transactions.length === 0 && !isLoading && (
        <div className="text-center py-8">
          <FileSpreadsheet className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
          <p className="text-sm font-medium">Keine Transaktionen vorhanden</p>
          <p className="text-xs text-muted-foreground mt-1">Importiere eine CSV-Datei deiner Bank um Zahlungen abzugleichen</p>
        </div>
      )}
    </div>
  );
};

export default BankMatching;
