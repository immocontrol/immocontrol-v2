import { useState, useMemo, useRef, useCallback } from "react";
import { Landmark, Upload, Link2, Unlink, CheckCircle, X, FileSpreadsheet, ArrowRight, Plus, Settings2, TrendingUp, Trash2, BarChart3, Percent, Wallet } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useProperties } from "@/context/PropertyContext";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  account_id: string | null;
  created_at: string;
}

interface BankAccount {
  id: string;
  user_id: string;
  name: string;
  iban: string | null;
  bic: string | null;
  bank_name: string | null;
  is_default: boolean;
  created_at: string;
}

interface MatchingRule {
  id: string;
  user_id: string;
  name: string;
  match_type: string;
  match_value: string;
  tenant_id: string | null;
  property_id: string | null;
  is_active: boolean;
  created_at: string;
}

/* OPT-33: Match confidence threshold constants */
const MATCH_CONFIDENCE = {
  HIGH: 90,
  MEDIUM: 70,
  LOW: 50,
} as const;

/** Feature 1: Parse MT940 (SWIFT) bank statement format */
const parseMT940 = (text: string, userId: string, accountId: string | null): Record<string, unknown>[] => {
  const rows: Record<string, unknown>[] = [];
  const blocks = text.split(":61:").slice(1);
  for (const block of blocks) {
    try {
      const lines = block.split("\n");
      const line1 = lines[0] || "";
      // :61: format: YYMMDD[MMDD]C/DAmount... (simplified parsing)
      const dateMatch = line1.match(/(\d{6})/); 
      if (!dateMatch) continue;
      const yy = dateMatch[1].slice(0, 2);
      const mm = dateMatch[1].slice(2, 4);
      const dd = dateMatch[1].slice(4, 6);
      const year = parseInt(yy) > 50 ? `19${yy}` : `20${yy}`;
      const bookingDate = `${year}-${mm}-${dd}`;
      if (!/^\d{4}-\d{2}-\d{2}$/.test(bookingDate)) continue;
      const amountMatch = line1.match(/([CD])(\d+[,.]\d*)/);
      if (!amountMatch) continue;
      const isCredit = amountMatch[1] === "C";
      const amount = parseFloat(amountMatch[2].replace(",", ".")) * (isCredit ? 1 : -1);
      // :86: contains reference text
      const refLine = lines.find(l => l.startsWith(":86:"));
      const reference = refLine ? refLine.slice(4).trim() : null;
      rows.push({ user_id: userId, booking_date: bookingDate, amount, account_id: accountId, reference, booking_text: "MT940" });
    } catch { /* skip malformed */ }
  }
  return rows;
};

/** Feature 1: Parse CAMT.053 XML bank statement format */
const parseCAMT = (xml: string, userId: string, accountId: string | null): Record<string, unknown>[] => {
  const rows: Record<string, unknown>[] = [];
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(xml, "text/xml");
    const entries = doc.querySelectorAll("Ntry");
    entries.forEach(entry => {
      try {
        const amtEl = entry.querySelector("Amt");
        const dateEl = entry.querySelector("BookgDt Dt") || entry.querySelector("ValDt Dt");
        const cdtEl = entry.querySelector("CdtDbtInd");
        const refEl = entry.querySelector("RmtInf Ustrd") || entry.querySelector("AddtlNtryInf");
        const nameEl = entry.querySelector("RltdPties Dbtr Nm") || entry.querySelector("RltdPties Cdtr Nm");
        if (!amtEl || !dateEl) return;
        const amount = parseFloat(amtEl.textContent || "0") * (cdtEl?.textContent === "CRDT" ? 1 : -1);
        const bookingDate = dateEl.textContent || "";
        if (!/^\d{4}-\d{2}-\d{2}$/.test(bookingDate)) return;
        rows.push({
          user_id: userId,
          booking_date: bookingDate,
          amount,
          account_id: accountId,
          reference: refEl?.textContent || null,
          sender_receiver: nameEl?.textContent || null,
          booking_text: "CAMT",
        });
      } catch { /* skip */ }
    });
  } catch { /* skip */ }
  return rows;
};

/* FUNC-45: Transaction categorization helper */
const categorizeTransaction = (description: string): string => {
  const desc = description.toLowerCase();
  if (desc.includes("miete") || desc.includes("miet")) return "Mieteinnahme";
  if (desc.includes("nebenkost") || desc.includes("nk")) return "Nebenkosten";
  if (desc.includes("versicher")) return "Versicherung";
  if (desc.includes("kredit") || desc.includes("darlehen") || desc.includes("tilg")) return "Kreditrate";
  if (desc.includes("repar") || desc.includes("wartung") || desc.includes("handwerk")) return "Instandhaltung";
  if (desc.includes("steuer") || desc.includes("grundst")) return "Steuern";
  return "Sonstiges";
};

const BankMatching = () => {
  const { user } = useAuth();
  const { properties } = useProperties();
  const queryClient = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [importing, setImporting] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [ruleOpen, setRuleOpen] = useState(false);
  const [selectedAccount, setSelectedAccount] = useState("alle");
  const [accountForm, setAccountForm] = useState({ name: "", iban: "", bic: "", bank_name: "" });
  const [ruleForm, setRuleForm] = useState({ name: "", match_type: "iban", match_value: "", tenant_id: "", property_id: "" });

  // ── Queries ──
  const { data: accounts = [] } = useQuery<BankAccount[]>({
    queryKey: ["bank_accounts"],
    queryFn: async () => {
      const { data, error } = await supabase.from("bank_accounts").select("*").order("created_at");
      if (error) throw error;
      return (data as any[]) || [];
    },
    enabled: !!user,
  });

  const { data: rules = [] } = useQuery<MatchingRule[]>({
    queryKey: ["bank_matching_rules"],
    queryFn: async () => {
      const { data, error } = await supabase.from("bank_matching_rules").select("*").order("created_at");
      if (error) throw error;
      return (data as any[]) || [];
    },
    enabled: !!user,
  });

  const { data: transactions = [], isLoading } = useQuery<BankTransaction[]>({
    queryKey: ["bank_transactions"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bank_transactions")
        .select("*")
        .order("booking_date", { ascending: false })
        .limit(500);
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
  const accountMap = useMemo(() => Object.fromEntries(accounts.map(a => [a.id, a])), [accounts]);

  // Filter by selected account
  const filteredTransactions = useMemo(
    () => selectedAccount === "alle" ? transactions : transactions.filter(t => t.account_id === selectedAccount),
    [transactions, selectedAccount]
  );

  const unmatchedPayments = useMemo(
    () => payments.filter(p => p.status !== "confirmed" && !transactions.some(t => t.matched_payment_id === p.id)),
    [payments, transactions]
  );

  // ── Rule-based + heuristic matching ──
  const suggestMatch = useCallback((tx: BankTransaction) => {
    if (tx.amount <= 0) return null;

    // 1. Check rules first
    const activeRules = rules.filter(r => r.is_active);
    for (const rule of activeRules) {
      const txField = rule.match_type === "iban" ? (tx.iban || "").toLowerCase()
        : rule.match_type === "name" ? (tx.sender_receiver || "").toLowerCase()
        : (tx.reference || "").toLowerCase();
      if (txField.includes(rule.match_value.toLowerCase())) {
        // Find matching payment for this tenant/property
        const match = unmatchedPayments.find(p => {
          const amountOk = Math.abs(Number(p.amount) - tx.amount) < 0.01;
          const tenantOk = !rule.tenant_id || p.tenant_id === rule.tenant_id;
          const propOk = !rule.property_id || p.property_id === rule.property_id;
          return amountOk && tenantOk && propOk;
        });
        if (match) return { payment: match, confidence: "rule" as const };
      }
    }

    // 2. Heuristic: amount + name
    const heuristic = unmatchedPayments.find(p => {
      const amountMatch = Math.abs(Number(p.amount) - tx.amount) < 0.01;
      if (!amountMatch) return false;
      const tenant = tenantMap[p.tenant_id];
      if (!tenant) return true;
      const name = `${tenant.first_name} ${tenant.last_name}`.toLowerCase();
      const ref = ((tx.reference || "") + " " + (tx.sender_receiver || "")).toLowerCase();
      return ref.includes(tenant.last_name.toLowerCase()) || ref.includes(name);
    });
    return heuristic ? { payment: heuristic, confidence: "auto" as const } : null;
  }, [rules, unmatchedPayments, tenantMap]);

  // ── Mutations ──
  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: ["bank_transactions"] });
    queryClient.invalidateQueries({ queryKey: ["bank_matching_payments"] });
    queryClient.invalidateQueries({ queryKey: ["mietuebersicht_payments"] });
  };

  const matchMutation = useMutation({
    mutationFn: async ({ txId, paymentId, confidence }: { txId: string; paymentId: string; confidence: string }) => {
      const { error: e1 } = await supabase
        .from("bank_transactions")
        .update({ matched_payment_id: paymentId, match_confidence: confidence } as any)
        .eq("id", txId);
      if (e1) throw e1;
      const { error: e2 } = await supabase
        .from("rent_payments")
        .update({ status: "confirmed", paid_date: new Date().toISOString().slice(0, 10) })
        .eq("id", paymentId);
      if (e2) throw e2;
    },
    onSuccess: () => { invalidateAll(); toast.success("Zugeordnet & bestätigt"); },
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
    onSuccess: () => { invalidateAll(); toast.success("Zuordnung aufgehoben"); },
  });

  const addAccountMutation = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Not authenticated");
      const { error } = await supabase.from("bank_accounts").insert({
        user_id: user.id,
        name: accountForm.name,
        iban: accountForm.iban || null,
        bic: accountForm.bic || null,
        bank_name: accountForm.bank_name || null,
      } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["bank_accounts"] });
      setAccountOpen(false);
      setAccountForm({ name: "", iban: "", bic: "", bank_name: "" });
      toast.success("Konto hinzugefügt");
    },
  });

  const deleteAccountMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("bank_accounts").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["bank_accounts"] });
      toast.success("Konto gelöscht");
    },
  });

  const addRuleMutation = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Not authenticated");
      const { error } = await supabase.from("bank_matching_rules").insert({
        user_id: user.id,
        name: ruleForm.name,
        match_type: ruleForm.match_type,
        match_value: ruleForm.match_value,
        tenant_id: ruleForm.tenant_id || null,
        property_id: ruleForm.property_id || null,
      } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["bank_matching_rules"] });
      setRuleOpen(false);
      setRuleForm({ name: "", match_type: "iban", match_value: "", tenant_id: "", property_id: "" });
      toast.success("Regel erstellt");
    },
  });

  const deleteRuleMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("bank_matching_rules").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["bank_matching_rules"] });
      toast.success("Regel gelöscht");
    },
  });

  // ── Auto-match all ──
  const autoMatchAll = async () => {
    const unmatched = filteredTransactions.filter(t => !t.matched_payment_id && t.amount > 0);
    let count = 0;
    for (const tx of unmatched) {
      const suggestion = suggestMatch(tx);
      if (suggestion) {
        try {
          await matchMutation.mutateAsync({ txId: tx.id, paymentId: suggestion.payment.id, confidence: suggestion.confidence });
          count++;
        } catch { /* skip */ }
      }
    }
    if (count > 0) toast.success(`${count} Transaktionen automatisch zugeordnet`);
    else toast.info("Keine neuen Matches gefunden");
  };

  // ── CSV Import ──
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    setImporting(true);
    try {
      const text = await file.text();

      /** Feature 1: MT940 / CAMT detection and parsing */
      const ext = file.name.toLowerCase().split(".").pop() || "";
      if (ext === "sta" || text.startsWith(":20:") || text.includes(":60F:")) {
        // MT940 format
        const mt940Rows = parseMT940(text, user.id, selectedAccount !== "alle" ? selectedAccount : (accounts.find(a => a.is_default)?.id || null));
        if (mt940Rows.length === 0) { toast.error("Keine Transaktionen im MT940 gefunden"); return; }
        const batchSize = 100;
        for (let i = 0; i < mt940Rows.length; i += batchSize) {
          const { error } = await supabase.from("bank_transactions").insert(mt940Rows.slice(i, i + batchSize) as any);
          if (error) throw error;
        }
        toast.success(`${mt940Rows.length} MT940-Transaktionen importiert`);
        queryClient.invalidateQueries({ queryKey: ["bank_transactions"] });
        setImportOpen(false);
        return;
      }
      if (ext === "xml" || text.includes("<Document") || text.includes("camt.053")) {
        // CAMT.053 format
        const camtRows = parseCAMT(text, user.id, selectedAccount !== "alle" ? selectedAccount : (accounts.find(a => a.is_default)?.id || null));
        if (camtRows.length === 0) { toast.error("Keine Transaktionen im CAMT gefunden"); return; }
        const batchSize = 100;
        for (let i = 0; i < camtRows.length; i += batchSize) {
          const { error } = await supabase.from("bank_transactions").insert(camtRows.slice(i, i + batchSize) as any);
          if (error) throw error;
        }
        toast.success(`${camtRows.length} CAMT-Transaktionen importiert`);
        queryClient.invalidateQueries({ queryKey: ["bank_transactions"] });
        setImportOpen(false);
        return;
      }

      // CSV format
      const lines = text.split("\n").filter(l => l.trim());
      if (lines.length < 2) { toast.error("CSV ist leer"); return; }
      const sep = lines[0].includes(";") ? ";" : ",";
      const headers = lines[0].split(sep).map(h => h.trim().replace(/"/g, "").toLowerCase());
      const dateCol = headers.findIndex(h => h.includes("buchung") || h.includes("datum") || h.includes("date"));
      const amountCol = headers.findIndex(h => h.includes("betrag") || h.includes("amount") || h.includes("soll") || h.includes("haben"));
      const nameCol = headers.findIndex(h => h.includes("empf") || h.includes("auftrag") || h.includes("name") || h.includes("sender"));
      const refCol = headers.findIndex(h => h.includes("verwendung") || h.includes("referenz") || h.includes("reference") || h.includes("zweck"));
      const ibanCol = headers.findIndex(h => h.includes("iban"));
      const bicCol = headers.findIndex(h => h.includes("bic"));
      const textCol = headers.findIndex(h => h.includes("buchungstext") || h.includes("text") || h.includes("type"));
      if (dateCol === -1 || amountCol === -1) { toast.error("CSV-Format nicht erkannt."); return; }

      // Use default account if selected
      const accountId = selectedAccount !== "alle" ? selectedAccount : (accounts.find(a => a.is_default)?.id || null);

      const rows: any[] = [];
      for (let i = 1; i < lines.length; i++) {
        const cols = lines[i].split(sep).map(c => c.trim().replace(/^"|"$/g, ""));
        if (cols.length <= amountCol) continue;
        const rawDate = cols[dateCol];
        let bookingDate: string;
        if (rawDate.includes(".")) {
          const [d, m, y] = rawDate.split(".");
          bookingDate = `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
        } else { bookingDate = rawDate; }
        if (!/^\d{4}-\d{2}-\d{2}$/.test(bookingDate)) continue;
        const rawAmount = cols[amountCol].replace(/\./g, "").replace(",", ".");
        const amount = parseFloat(rawAmount);
        if (isNaN(amount)) continue;
        rows.push({
          user_id: user.id,
          booking_date: bookingDate,
          amount,
          account_id: accountId,
          sender_receiver: nameCol >= 0 ? cols[nameCol] || null : null,
          reference: refCol >= 0 ? cols[refCol] || null : null,
          iban: ibanCol >= 0 ? cols[ibanCol] || null : null,
          bic: bicCol >= 0 ? cols[bicCol] || null : null,
          booking_text: textCol >= 0 ? cols[textCol] || null : null,
        });
      }
      if (rows.length === 0) { toast.error("Keine gültigen Transaktionen"); return; }
      const batchSize = 100;
      for (let i = 0; i < rows.length; i += batchSize) {
        const { error } = await supabase.from("bank_transactions").insert(rows.slice(i, i + batchSize) as any);
        if (error) throw error;
      }
      toast.success(`${rows.length} Transaktionen importiert`);
      queryClient.invalidateQueries({ queryKey: ["bank_transactions"] });
      setImportOpen(false);
    } catch (err: unknown) {
      toast.error("Import fehlgeschlagen: " + (err instanceof Error ? err.message : "Fehler"));
    } finally {
      setImporting(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  // ── Stats ──
  const matched = filteredTransactions.filter(t => t.matched_payment_id);
  const unmatched = filteredTransactions.filter(t => !t.matched_payment_id && t.amount > 0);
  const totalIncoming = filteredTransactions.filter(t => t.amount > 0).reduce((s, t) => s + t.amount, 0);
  const totalOutgoing = filteredTransactions.filter(t => t.amount < 0).reduce((s, t) => s + Math.abs(t.amount), 0);
  const matchRate = filteredTransactions.filter(t => t.amount > 0).length > 0
    ? (matched.length / filteredTransactions.filter(t => t.amount > 0).length * 100) : 0;
  const totalMatchedAmount = matched.reduce((s, t) => s + t.amount, 0);
  const totalUnmatchedAmount = unmatched.reduce((s, t) => s + t.amount, 0);

  // Monthly trend (last 6 months)
  const monthlyTrend = useMemo(() => {
    const now = new Date();
    const months: { label: string; matched: number; unmatched: number; total: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const label = d.toLocaleDateString("de-DE", { month: "short", year: "2-digit" });
      const monthTx = filteredTransactions.filter(t => t.booking_date.startsWith(key) && t.amount > 0);
      const mCount = monthTx.filter(t => t.matched_payment_id).length;
      months.push({ label, matched: mCount, unmatched: monthTx.length - mCount, total: monthTx.reduce((s, t) => s + t.amount, 0) });
    }
    return months;
  }, [filteredTransactions]);

  const maxMonthTotal = Math.max(...monthlyTrend.map(m => m.total), 1);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <Landmark className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-semibold">Bank-Abgleich</h2>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {accounts.length > 0 && (
            <Select value={selectedAccount} onValueChange={setSelectedAccount}>
              <SelectTrigger className="h-8 w-[160px] text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="alle">Alle Konten</SelectItem>
                {accounts.map(a => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
              </SelectContent>
            </Select>
          )}
          <Button variant="outline" size="sm" className="gap-1 text-xs" onClick={autoMatchAll}>
            <Link2 className="h-3 w-3" /> Auto-Match
          </Button>
          <Dialog open={importOpen} onOpenChange={setImportOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm" className="gap-1 text-xs">
                <Upload className="h-3 w-3" /> Import
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader><DialogTitle>Bank-Import (CSV / MT940 / CAMT)</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">Unterstützt: CSV (Sparkasse, Volksbank, DKB, ING, Commerzbank u.a.), MT940 (.sta) und CAMT.053 (.xml)</p>
                {accounts.length > 0 && (
                  <div>
                    <Label className="text-xs">Konto zuordnen</Label>
                    <Select value={selectedAccount} onValueChange={setSelectedAccount}>
                      <SelectTrigger className="h-8 text-xs mt-1"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="alle">Kein Konto</SelectItem>
                        {accounts.map(a => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                )}
                <input ref={fileRef} type="file" accept=".csv,.CSV,.sta,.STA,.xml,.XML" onChange={handleFileUpload} disabled={importing}
                  className="w-full text-sm file:mr-2 file:py-1 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-medium file:bg-primary file:text-primary-foreground cursor-pointer" />
                <p className="text-[10px] text-muted-foreground">CSV: Semikolon/Komma-getrennt · MT940: SWIFT-Format (.sta) · CAMT: XML-Format (.xml)</p>
                {importing && <p className="text-xs text-muted-foreground animate-pulse">Importiere...</p>}
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Sub-tabs */}
      <Tabs defaultValue="uebersicht" className="w-full">
        <TabsList className="h-8">
          <TabsTrigger value="uebersicht" className="text-xs">Übersicht</TabsTrigger>
          <TabsTrigger value="transaktionen" className="text-xs">Transaktionen</TabsTrigger>
          <TabsTrigger value="konten" className="text-xs">Konten</TabsTrigger>
          <TabsTrigger value="regeln" className="text-xs">Regeln</TabsTrigger>
        </TabsList>

        {/* ── TAB: Übersicht / Stats ── */}
        <TabsContent value="uebersicht" className="space-y-4 mt-3">
          {/* KPI row */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="gradient-card rounded-xl border border-border p-4">
              <div className="flex items-center gap-1.5 mb-1">
                <BarChart3 className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-xs text-muted-foreground uppercase tracking-wider">Transaktionen</span>
              </div>
              <div className="text-xl font-bold">{filteredTransactions.length}</div>
              <div className="text-[10px] text-muted-foreground">{matched.length} zugeordnet · {unmatched.length} offen</div>
            </div>
            <div className="gradient-card rounded-xl border border-border p-4">
              <div className="flex items-center gap-1.5 mb-1">
                <Percent className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-xs text-muted-foreground uppercase tracking-wider">Match-Quote</span>
              </div>
              <div className={`text-xl font-bold ${matchRate >= 80 ? "text-profit" : matchRate >= 50 ? "text-gold" : "text-loss"}`}>
                {matchRate.toFixed(0)}%
              </div>
              <div className="h-1.5 bg-secondary rounded-full overflow-hidden mt-1">
                <div className="h-full bg-profit rounded-full transition-all" style={{ width: `${matchRate}%` }} />
              </div>
            </div>
            <div className="gradient-card rounded-xl border border-border p-4">
              <div className="flex items-center gap-1.5 mb-1">
                <TrendingUp className="h-3.5 w-3.5 text-profit" />
                <span className="text-xs text-muted-foreground uppercase tracking-wider">Eingänge</span>
              </div>
              <div className="text-xl font-bold text-profit">{formatCurrency(totalIncoming)}</div>
              <div className="text-[10px] text-muted-foreground">{formatCurrency(totalMatchedAmount)} zugeordnet</div>
            </div>
            <div className="gradient-card rounded-xl border border-border p-4">
              <div className="flex items-center gap-1.5 mb-1">
                <Wallet className="h-3.5 w-3.5 text-loss" />
                <span className="text-xs text-muted-foreground uppercase tracking-wider">Ausgänge</span>
              </div>
              <div className="text-xl font-bold text-loss">{formatCurrency(totalOutgoing)}</div>
              <div className="text-[10px] text-muted-foreground">Netto: {formatCurrency(totalIncoming - totalOutgoing)}</div>
            </div>
          </div>

          {/* Monthly trend bar chart */}
          <div className="gradient-card rounded-xl border border-border p-4">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Monatstrend (Eingänge)</p>
            <div className="flex items-end gap-2 h-24">
              {monthlyTrend.map((m, i) => (
                <div key={i} className="flex-1 flex flex-col items-center gap-1">
                  <div className="w-full flex flex-col items-stretch" style={{ height: 80 }}>
                    <div className="flex-1" />
                    <div className="bg-profit/20 rounded-t relative" style={{ height: `${(m.total / maxMonthTotal) * 100}%`, minHeight: 2 }}>
                      {m.matched > 0 && (
                        <div className="absolute bottom-0 left-0 right-0 bg-profit rounded-t" style={{ height: `${m.total > 0 ? (m.matched / (m.matched + m.unmatched)) * 100 : 0}%` }} />
                      )}
                    </div>
                  </div>
                  <span className="text-[9px] text-muted-foreground">{m.label}</span>
                </div>
              ))}
            </div>
            <div className="flex items-center gap-4 mt-2">
              <span className="flex items-center gap-1 text-[10px] text-muted-foreground"><span className="w-2 h-2 rounded-sm bg-profit inline-block" /> Zugeordnet</span>
              <span className="flex items-center gap-1 text-[10px] text-muted-foreground"><span className="w-2 h-2 rounded-sm bg-profit/20 inline-block" /> Offen</span>
            </div>
          </div>

          {/* Unmatched amount alert */}
          {totalUnmatchedAmount > 0 && (
            <div className="rounded-lg border border-gold/30 bg-gold/5 p-3 flex items-center gap-3">
              <Wallet className="h-4 w-4 text-gold shrink-0" />
              <div className="flex-1">
                <p className="text-sm font-medium">{formatCurrency(totalUnmatchedAmount)} nicht zugeordnet</p>
                <p className="text-[11px] text-muted-foreground">{unmatched.length} Eingänge ohne Mieter-Zuordnung</p>
              </div>
              <Button variant="outline" size="sm" className="text-xs gap-1" onClick={autoMatchAll}>
                <Link2 className="h-3 w-3" /> Jetzt abgleichen
              </Button>
            </div>
          )}
        </TabsContent>

        {/* ── TAB: Transaktionen ── */}
        <TabsContent value="transaktionen" className="space-y-4 mt-3">
          {unmatched.length > 0 && (
            <div className="space-y-1">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                Nicht zugeordnet ({unmatched.length})
              </p>
              {unmatched.slice(0, 30).map(tx => {
                const suggestion = suggestMatch(tx);
                const suggestedTenant = suggestion ? tenantMap[suggestion.payment.tenant_id] : null;
                const suggestedProperty = suggestion ? propertyMap[suggestion.payment.property_id] : null;
                const account = tx.account_id ? accountMap[tx.account_id] : null;
                return (
                  <div key={tx.id} className="flex items-center gap-3 p-3 rounded-lg border border-border bg-card hover:bg-secondary/30 transition-colors">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium truncate">{tx.sender_receiver || "Unbekannt"}</span>
                        <span className="text-[10px] bg-secondary px-1.5 py-0.5 rounded">
                          {new Date(tx.booking_date).toLocaleDateString("de-DE")}
                        </span>
                        {account && <span className="text-[9px] bg-primary/10 text-primary px-1.5 py-0.5 rounded">{account.name}</span>}
                      </div>
                      <p className="text-[11px] text-muted-foreground truncate">{tx.reference || tx.booking_text || "–"}</p>
                      <div className="flex items-center gap-1">
                        {tx.iban && <span className="text-[10px] text-muted-foreground font-mono">{tx.iban}</span>}
                        {/* FUNC-45: Category badge */}
                        <span className="text-[9px] bg-secondary px-1.5 py-0.5 rounded">{categorizeTransaction(tx.reference || tx.booking_text || tx.sender_receiver || "")}</span>
                      </div>
                    </div>
                    <div className="text-sm font-semibold tabular-nums text-profit">+{formatCurrency(tx.amount)}</div>
                    {suggestion ? (
                      <Button size="sm" variant="outline" className="gap-1 text-xs shrink-0"
                        onClick={() => matchMutation.mutate({ txId: tx.id, paymentId: suggestion.payment.id, confidence: suggestion.confidence })}
                        disabled={matchMutation.isPending}>
                        <Link2 className="h-3 w-3" />
                        {suggestedTenant ? `${suggestedTenant.first_name} ${suggestedTenant.last_name}` : "Zuordnen"}
                        {suggestion.confidence === "rule" && <span className="text-[9px] bg-primary/10 text-primary px-1 rounded ml-1">Regel</span>}
                      </Button>
                    ) : (
                      <span className="text-[10px] text-muted-foreground shrink-0">Kein Match</span>
                    )}
                  </div>
                );
              })}
              {unmatched.length > 30 && <p className="text-xs text-muted-foreground text-center py-2">+{unmatched.length - 30} weitere</p>}
            </div>
          )}
          {matched.length > 0 && (
            <div className="space-y-1">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Zugeordnet ({matched.length})</p>
              {matched.slice(0, 20).map(tx => {
                const payment = tx.matched_payment_id ? paymentMap[tx.matched_payment_id] : null;
                const tenant = payment ? tenantMap[payment.tenant_id] : null;
                return (
                  <div key={tx.id} className="flex items-center gap-3 p-3 rounded-lg hover:bg-secondary/30 transition-colors">
                    <CheckCircle className="h-3.5 w-3.5 text-profit shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium truncate">{tx.sender_receiver || "Unbekannt"}</span>
                        <ArrowRight className="h-3 w-3 text-muted-foreground shrink-0" />
                        <span className="text-sm truncate">{tenant ? `${tenant.first_name} ${tenant.last_name}` : "–"}</span>
                        {tx.match_confidence === "rule" && <span className="text-[9px] bg-primary/10 text-primary px-1 rounded">Regel</span>}
                      </div>
                      <p className="text-[11px] text-muted-foreground">{new Date(tx.booking_date).toLocaleDateString("de-DE")} · {formatCurrency(tx.amount)}</p>
                    </div>
                    <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-muted-foreground hover:text-loss"
                      onClick={() => tx.matched_payment_id && unmatchMutation.mutate({ txId: tx.id, paymentId: tx.matched_payment_id })}>
                      <Unlink className="h-3 w-3" />
                    </Button>
                  </div>
                );
              })}
            </div>
          )}
          {filteredTransactions.length === 0 && !isLoading && (
            <div className="text-center py-8">
              <FileSpreadsheet className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
              <p className="text-sm font-medium">Keine Transaktionen</p>
              <p className="text-xs text-muted-foreground mt-1">Importiere eine CSV deiner Bank</p>
            </div>
          )}
        </TabsContent>

        {/* ── TAB: Konten ── */}
        <TabsContent value="konten" className="space-y-4 mt-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium">{accounts.length} Bankkonten</p>
            <Dialog open={accountOpen} onOpenChange={setAccountOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm" className="gap-1 text-xs"><Plus className="h-3 w-3" /> Konto</Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-sm">
                <DialogHeader><DialogTitle>Bankkonto anlegen</DialogTitle></DialogHeader>
                <div className="space-y-3">
                  <div><Label className="text-xs">Name *</Label><Input className="h-8 text-sm mt-1" value={accountForm.name} onChange={e => setAccountForm(f => ({ ...f, name: e.target.value }))} placeholder="z.B. Sparkasse Haupt" /></div>
                  <div><Label className="text-xs">IBAN</Label><Input className="h-8 text-sm mt-1 font-mono" value={accountForm.iban} onChange={e => setAccountForm(f => ({ ...f, iban: e.target.value }))} placeholder="DE89..." /></div>
                  <div className="grid grid-cols-2 gap-2">
                    <div><Label className="text-xs">BIC</Label><Input className="h-8 text-sm mt-1 font-mono" value={accountForm.bic} onChange={e => setAccountForm(f => ({ ...f, bic: e.target.value }))} /></div>
                    <div><Label className="text-xs">Bank</Label><Input className="h-8 text-sm mt-1" value={accountForm.bank_name} onChange={e => setAccountForm(f => ({ ...f, bank_name: e.target.value }))} /></div>
                  </div>
                  <Button size="sm" className="w-full" disabled={!accountForm.name || addAccountMutation.isPending} onClick={() => addAccountMutation.mutate()}>Speichern</Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
          {accounts.length === 0 ? (
            <div className="text-center py-8">
              <Landmark className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
              <p className="text-sm font-medium">Keine Bankkonten</p>
              <p className="text-xs text-muted-foreground mt-1">Lege Konten an um Transaktionen zu gruppieren</p>
            </div>
          ) : (
            <div className="space-y-2">
              {accounts.map(a => {
                const txCount = transactions.filter(t => t.account_id === a.id).length;
                return (
                  <div key={a.id} className="flex items-center gap-3 p-3 rounded-lg border border-border bg-card">
                    <Landmark className="h-4 w-4 text-primary shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium">{a.name}</div>
                      <div className="text-[11px] text-muted-foreground">
                        {a.iban && <span className="font-mono">{a.iban} · </span>}
                        {a.bank_name && <span>{a.bank_name} · </span>}
                        {txCount} Transaktionen
                      </div>
                    </div>
                    <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-muted-foreground hover:text-loss"
                      onClick={() => deleteAccountMutation.mutate(a.id)}>
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                );
              })}
            </div>
          )}
        </TabsContent>

        {/* ── TAB: Regeln ── */}
        <TabsContent value="regeln" className="space-y-4 mt-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">{rules.length} Matching-Regeln</p>
              <p className="text-[11px] text-muted-foreground">Regeln werden beim Auto-Match vor Heuristiken angewandt</p>
            </div>
            <Dialog open={ruleOpen} onOpenChange={setRuleOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm" className="gap-1 text-xs"><Plus className="h-3 w-3" /> Regel</Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-md">
                <DialogHeader><DialogTitle>Matching-Regel erstellen</DialogTitle></DialogHeader>
                <div className="space-y-3">
                  <div><Label className="text-xs">Name</Label><Input className="h-8 text-sm mt-1" value={ruleForm.name} onChange={e => setRuleForm(f => ({ ...f, name: e.target.value }))} placeholder="z.B. Mieter Müller IBAN" /></div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label className="text-xs">Match-Typ</Label>
                      <Select value={ruleForm.match_type} onValueChange={v => setRuleForm(f => ({ ...f, match_type: v }))}>
                        <SelectTrigger className="h-8 text-xs mt-1"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="iban">IBAN enthält</SelectItem>
                          <SelectItem value="name">Name enthält</SelectItem>
                          <SelectItem value="reference">Verwendungszweck enthält</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div><Label className="text-xs">Suchwert</Label><Input className="h-8 text-sm mt-1" value={ruleForm.match_value} onChange={e => setRuleForm(f => ({ ...f, match_value: e.target.value }))} placeholder="z.B. DE89370400..." /></div>
                  </div>
                  <div>
                    <Label className="text-xs">Mieter zuordnen</Label>
                    <Select value={ruleForm.tenant_id} onValueChange={v => setRuleForm(f => ({ ...f, tenant_id: v }))}>
                      <SelectTrigger className="h-8 text-xs mt-1"><SelectValue placeholder="Mieter wählen" /></SelectTrigger>
                      <SelectContent>
                        {tenants.map(t => <SelectItem key={t.id} value={t.id}>{t.first_name} {t.last_name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs">Objekt (optional)</Label>
                    <Select value={ruleForm.property_id} onValueChange={v => setRuleForm(f => ({ ...f, property_id: v }))}>
                      <SelectTrigger className="h-8 text-xs mt-1"><SelectValue placeholder="Objekt wählen" /></SelectTrigger>
                      <SelectContent>
                        {properties.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <Button size="sm" className="w-full" disabled={!ruleForm.match_value || !ruleForm.tenant_id || addRuleMutation.isPending} onClick={() => addRuleMutation.mutate()}>Regel erstellen</Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
          {rules.length === 0 ? (
            <div className="text-center py-8">
              <Settings2 className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
              <p className="text-sm font-medium">Keine Regeln</p>
              <p className="text-xs text-muted-foreground mt-1">Erstelle Regeln wie „IBAN X → Mieter Y" für automatisches Matching</p>
            </div>
          ) : (
            <div className="space-y-2">
              {rules.map(r => {
                const tenant = r.tenant_id ? tenantMap[r.tenant_id] : null;
                const property = r.property_id ? propertyMap[r.property_id] : null;
                return (
                  <div key={r.id} className="flex items-center gap-3 p-3 rounded-lg border border-border bg-card">
                    <Settings2 className="h-4 w-4 text-primary shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium">{r.name || "Regel"}</div>
                      <div className="text-[11px] text-muted-foreground">
                        {r.match_type === "iban" ? "IBAN" : r.match_type === "name" ? "Name" : "Verwendungszweck"} enthält „{r.match_value}"
                        {tenant && <span> → {tenant.first_name} {tenant.last_name}</span>}
                        {property && <span> ({property.name})</span>}
                      </div>
                    </div>
                    <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-muted-foreground hover:text-loss"
                      onClick={() => deleteRuleMutation.mutate(r.id)}>
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                );
              })}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default BankMatching;
