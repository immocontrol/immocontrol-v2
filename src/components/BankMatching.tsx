import { useState, useMemo, useCallback, useRef } from "react";
import { Landmark, Upload, Link2, Unlink, CheckCircle, X, FileSpreadsheet, ArrowRight, Plus, Settings2, TrendingUp, Trash2, BarChart3, Percent, Wallet } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useProperties } from "@/context/PropertyContext";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/queryKeys";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatCurrency } from "@/lib/formatters";
import { toast } from "sonner";
import { toastErrorWithRetry } from "@/lib/toastMessages";
import { handleError } from "@/lib/handleError";
import { createMutationErrorHandler } from "@/lib/mutationErrorHandler";
import FileImportPicker from "@/components/FileImportPicker";
/* IMP-2: Extracted parsing utilities to reduce component size */
import {
  parseMT940, parseCAMT, categorizeTransaction,
  BANK_CSV_FIELDS, SKIP_VALUE, guessBankMapping,
  parseBankCsv, importBankCsvWithMapping,
  toIsoDate, parseEuroAmount,
} from "@/lib/bankCsvParser";

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

/* IMP-2: ~300 lines of parsing logic extracted to @/lib/bankCsvParser.ts */

const BankMatching = () => {
  const { user } = useAuth();
  const { properties } = useProperties();
  const queryClient = useQueryClient();
  const [importOpen, setImportOpen] = useState(false);
  const [importing, setImporting] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [ruleOpen, setRuleOpen] = useState(false);
  const [selectedAccount, setSelectedAccount] = useState("alle");
  const [accountForm, setAccountForm] = useState({ name: "", iban: "", bic: "", bank_name: "" });
  const [ruleForm, setRuleForm] = useState({ name: "", match_type: "iban", match_value: "", tenant_id: "", property_id: "" });

  /* CSV column mapping state */
  const [csvStep, setCsvStep] = useState<"upload" | "map" | "preview">("upload");
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const [csvRows, setCsvRows] = useState<string[][]>([]);
  const [csvMapping, setCsvMapping] = useState<Record<string, string>>({});
  const [csvFileName, setCsvFileName] = useState("");
  const resetCsvState = () => {
    setCsvStep("upload");
    setCsvHeaders([]);
    setCsvRows([]);
    setCsvMapping({});
    setCsvFileName("");
  };

  /** Last file used for import — enables retry on failure */
  const lastImportFileRef = useRef<File | null>(null);

  // ── Queries ──
  const { data: accounts = [] } = useQuery<BankAccount[]>({
    queryKey: queryKeys.bankMatching.accounts,
    queryFn: async () => {
      const { data, error } = await supabase.from("bank_accounts").select("*").order("created_at");
      if (error) throw error;
      return (data || []) as BankAccount[];
    },
    enabled: !!user,
  });

  const { data: rules = [] } = useQuery<MatchingRule[]>({
    queryKey: queryKeys.bankMatching.rules,
    queryFn: async () => {
      const { data, error } = await supabase.from("bank_matching_rules").select("*").order("created_at");
      if (error) throw error;
      return (data || []) as MatchingRule[];
    },
    enabled: !!user,
  });

  const { data: transactions = [], isLoading } = useQuery<BankTransaction[]>({
    queryKey: queryKeys.bankMatching.transactions,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bank_transactions")
        .select("*")
        .order("booking_date", { ascending: false })
        .limit(500);
      if (error) throw error;
      return (data || []) as BankTransaction[];
    },
    enabled: !!user,
  });

  const { data: payments = [] } = useQuery({
    queryKey: queryKeys.bankMatching.payments,
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

  /**
   * FEATURE-2: Enhanced fuzzy matching for IBAN/Name
   * - Normalizes IBANs (remove spaces/dashes)
   * - Fuzzy name comparison with Levenshtein distance
   * - Amount tolerance (±1 cent for rounding, ±5% for partial matches)
   * - Reference keyword scanning
   */
  const normalizeIBAN = useCallback((iban: string): string =>
    iban.replace(/[\s-]/g, "").toUpperCase(), []);

  const levenshtein = useCallback((a: string, b: string): number => {
    if (a.length === 0) return b.length;
    if (b.length === 0) return a.length;
    const matrix: number[][] = [];
    for (let i = 0; i <= b.length; i++) matrix[i] = [i];
    for (let j = 0; j <= a.length; j++) matrix[0][j] = j;
    for (let i = 1; i <= b.length; i++) {
      for (let j = 1; j <= a.length; j++) {
        const cost = b[i - 1] === a[j - 1] ? 0 : 1;
        matrix[i][j] = Math.min(matrix[i - 1][j] + 1, matrix[i][j - 1] + 1, matrix[i - 1][j - 1] + cost);
      }
    }
    return matrix[b.length][a.length];
  }, []);

  const fuzzyNameMatch = useCallback((txName: string, tenantName: string): boolean => {
    const a = txName.toLowerCase().trim();
    const b = tenantName.toLowerCase().trim();
    if (!a || !b || b.length < 4) return false; // Skip very short names to avoid false positives
    // Exact substring match — Unicode-aware word boundary (supports umlauts: ä, ö, ü, ß)
    const escaped = b.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const wordBoundaryRegex = new RegExp(`(?<![\\p{L}\\p{N}])${escaped}(?![\\p{L}\\p{N}])`, "u");
    if (wordBoundaryRegex.test(a)) return true;
    // Multi-word name: require ALL words (not just 50%) with length > 3 to match
    const bWords = b.split(/\s+/).filter(w => w.length > 3);
    if (bWords.length >= 2) {
      const allWordsFound = bWords.every(w => a.includes(w));
      if (allWordsFound) return true;
    }
    // Levenshtein only for short, similar-length strings (typo tolerance)
    if (Math.abs(a.length - b.length) <= 3 && b.length >= 5) {
      const dist = levenshtein(a, b);
      return dist <= Math.max(2, Math.floor(b.length * 0.15));
    }
    return false;
  }, [levenshtein]);

  // ── Rule-based + heuristic matching ──
  const suggestMatch = useCallback((tx: BankTransaction) => {
    if (tx.amount <= 0) return null;

    // 1. Check rules first
    const activeRules = rules.filter(r => r.is_active);
    for (const rule of activeRules) {
      const txField = rule.match_type === "iban"
        ? normalizeIBAN(tx.iban || "")
        : rule.match_type === "name" ? (tx.sender_receiver || "").toLowerCase()
        : (tx.reference || "").toLowerCase();
      const ruleVal = rule.match_type === "iban"
        ? normalizeIBAN(rule.match_value)
        : rule.match_value.toLowerCase();
      if (txField.includes(ruleVal) || (rule.match_type === "name" && fuzzyNameMatch(txField, ruleVal))) {
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

    // 2. Enhanced heuristic: IBAN match → name match → reference keywords
    for (const p of unmatchedPayments) {
      const amountExact = Math.abs(Number(p.amount) - tx.amount) < 0.01;
      if (!amountExact) continue;

      const tenant = tenantMap[p.tenant_id];
      if (!tenant) {
        // No tenant info → amount-only match (low confidence)
        return { payment: p, confidence: "auto" as const };
      }

      // IBAN-based matching (highest confidence after rules)
      if (tx.iban && tenant.iban) {
        if (normalizeIBAN(tx.iban) === normalizeIBAN(tenant.iban)) {
          return { payment: p, confidence: "auto" as const };
        }
      }

      // Name-based fuzzy matching
      const fullName = `${tenant.first_name} ${tenant.last_name}`;
      const txText = ((tx.reference || "") + " " + (tx.sender_receiver || ""));
      if (fuzzyNameMatch(txText, fullName) || fuzzyNameMatch(txText, tenant.last_name)) {
        return { payment: p, confidence: "auto" as const };
      }

      // Reference keyword scan (property name, unit number)
      const prop = propertyMap[p.property_id];
      if (prop) {
        const ref = (tx.reference || "").toLowerCase();
        const propName = prop.name.toLowerCase();
        if ((ref.includes(propName) || ref.includes("miete")) && ref.includes(tenant.last_name.toLowerCase())) {
          return { payment: p, confidence: "auto" as const };
        }
      }
    }

    return null;
  }, [rules, unmatchedPayments, tenantMap, propertyMap, normalizeIBAN, fuzzyNameMatch]);

  // ── Mutations ──
  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: queryKeys.bankMatching.transactions });
    queryClient.invalidateQueries({ queryKey: queryKeys.bankMatching.payments });
    queryClient.invalidateQueries({ queryKey: ["mietuebersicht_payments"] });
  };

  const matchMutation = useMutation({
    mutationFn: async ({ txId, paymentId, confidence }: { txId: string; paymentId: string; confidence: string }) => {
      const { error: e1 } = await supabase
        .from("bank_transactions")
        .update({ matched_payment_id: paymentId, match_confidence: confidence } as Record<string, unknown>)
        .eq("id", txId);
      if (e1) throw e1;
      const { error: e2 } = await supabase
        .from("rent_payments")
        .update({ status: "confirmed", paid_date: new Date().toISOString().slice(0, 10) })
        .eq("id", paymentId);
      if (e2) throw e2;
    },
    onSuccess: () => { invalidateAll(); toast.success("Zugeordnet & bestätigt"); },
    onError: createMutationErrorHandler("Bank-Zuordnung", "Fehler beim Zuweisen"),
  });

  const unmatchMutation = useMutation({
    mutationFn: async ({ txId, paymentId }: { txId: string; paymentId: string }) => {
      const { error: e1 } = await supabase
        .from("bank_transactions")
        .update({ matched_payment_id: null, match_confidence: null } as Record<string, unknown>)
        .eq("id", txId);
      if (e1) throw e1;
      const { error: e2 } = await supabase
        .from("rent_payments")
        .update({ status: "pending", paid_date: null })
        .eq("id", paymentId);
      if (e2) throw e2;
    },
    onSuccess: () => { invalidateAll(); toast.success("Zuordnung aufgehoben"); },
    onError: createMutationErrorHandler("Bank-Zuordnung", "Fehler beim Aufheben"),
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
      } as Record<string, unknown>);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.bankMatching.accounts });
      setAccountOpen(false);
      setAccountForm({ name: "", iban: "", bic: "", bank_name: "" });
      toast.success("Konto hinzugefügt");
    },
    onError: createMutationErrorHandler("Bank-Konto", "Fehler beim Hinzufügen"),
  });

  const deleteAccountMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("bank_accounts").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.bankMatching.accounts });
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
      } as Record<string, unknown>);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.bankMatching.rules });
      setRuleOpen(false);
      setRuleForm({ name: "", match_type: "iban", match_value: "", tenant_id: "", property_id: "" });
      toast.success("Regel erstellt");
    },
    onError: createMutationErrorHandler("Bank-Regel", "Fehler beim Erstellen"),
  });

  const deleteRuleMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("bank_matching_rules").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.bankMatching.rules });
      toast.success("Regel gelöscht");
    },
    onError: createMutationErrorHandler("Bank-Regel", "Fehler beim Löschen"),
  });

  // ── IMP20-1: Auto-match all — enhanced: also invalidates MieteingangsTracker so rent tracker shows confirmed payments instantly ──
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
    if (count > 0) {
      // IMP20-1: Sync MieteingangsTracker to reflect newly confirmed payments
      queryClient.invalidateQueries({ queryKey: ["mieteingang_tracker"] });
      queryClient.invalidateQueries({ queryKey: ["mieteingang_tenants"] });
      toast.success(`${count} Transaktionen automatisch zugeordnet & Mieteingänge aktualisiert`);
    } else {
      toast.info("Keine neuen Matches gefunden");
    }
  };

  // ── CSV Import ──
  const handleFileUpload = async (file: File) => {
    if (!user) return;
    lastImportFileRef.current = file;
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
          const { error } = await supabase.from("bank_transactions").insert(mt940Rows.slice(i, i + batchSize) as Record<string, unknown>[]);
          if (error) throw error;
        }
        toast.success(`${mt940Rows.length} MT940-Transaktionen importiert`);
        queryClient.invalidateQueries({ queryKey: queryKeys.bankMatching.transactions });
        setImportOpen(false);
        return;
      }
      if (ext === "xml" || text.includes("<Document") || text.includes("camt.053")) {
        // CAMT.053 format
        const camtRows = parseCAMT(text, user.id, selectedAccount !== "alle" ? selectedAccount : (accounts.find(a => a.is_default)?.id || null));
        if (camtRows.length === 0) { toast.error("Keine Transaktionen im CAMT gefunden"); return; }
        const batchSize = 100;
        for (let i = 0; i < camtRows.length; i += batchSize) {
          const { error } = await supabase.from("bank_transactions").insert(camtRows.slice(i, i + batchSize) as Record<string, unknown>[]);
          if (error) throw error;
        }
        toast.success(`${camtRows.length} CAMT-Transaktionen importiert`);
        queryClient.invalidateQueries({ queryKey: queryKeys.bankMatching.transactions });
        setImportOpen(false);
        return;
      }

      // CSV format — show column mapping UI (like contact import)
      const { headers, rows } = parseBankCsv(text);
      setCsvHeaders(headers);
      setCsvRows(rows);
      setCsvMapping(guessBankMapping(headers));
      setCsvFileName(file.name);
      setCsvStep("map");
      toast.info("CSV erkannt – bitte Spalten zuordnen");
      return; /* keep dialog open */
    } catch (err: unknown) {
      handleError(err, { context: "supabase", showToast: false });
      const msg = "Import fehlgeschlagen: " + (err instanceof Error ? err.message : "Fehler");
      toastErrorWithRetry(msg, () => {
        const f = lastImportFileRef.current;
        if (f) handleFileUpload(f);
      });
    } finally {
      setImporting(false);
    }
  };

  const csvPreview = useMemo(() => {
    if (csvHeaders.length === 0 || csvRows.length === 0) return [] as { date: string; amount: number; name: string; reference: string }[];

    const idxForHeader = (header: string | undefined) => header ? csvHeaders.findIndex(h => h === header) : -1;
    const dateIdx = idxForHeader(csvMapping.date);
    const amountIdx = idxForHeader(csvMapping.amount);
    const creditIdx = idxForHeader(csvMapping.credit);
    const debitIdx = idxForHeader(csvMapping.debit);
    const nameIdx = idxForHeader(csvMapping.name);
    const refIdx = idxForHeader(csvMapping.reference);

    if (dateIdx < 0) return [];

    const preview: { date: string; amount: number; name: string; reference: string }[] = [];
    for (const cols of csvRows.slice(0, 8)) {
      const bookingDate = toIsoDate(cols[dateIdx] || "");
      if (!bookingDate) continue;

      const signedAmount = amountIdx >= 0 ? parseEuroAmount(cols[amountIdx] || "") : null;
      const credit = creditIdx >= 0 ? parseEuroAmount(cols[creditIdx] || "") : null;
      const debit = debitIdx >= 0 ? parseEuroAmount(cols[debitIdx] || "") : null;

      let amount: number | null = signedAmount;
      if (amount === null) {
        const creditVal = credit ? Math.abs(credit) : 0;
        const debitVal = debit ? Math.abs(debit) : 0;
        if (creditVal || debitVal) amount = creditVal - debitVal;
      }
      if (amount === null || isNaN(amount)) continue;

      preview.push({
        date: bookingDate,
        amount,
        name: nameIdx >= 0 ? (cols[nameIdx] || "") : "",
        reference: refIdx >= 0 ? (cols[refIdx] || "") : "",
      });
      if (preview.length >= 5) break;
    }

    return preview;
  }, [csvHeaders, csvRows, csvMapping]);

  const handleCsvImport = async () => {
    if (!user) return;
    setImporting(true);
    try {
      const accountId = selectedAccount !== "alle" ? selectedAccount : (accounts.find(a => a.is_default)?.id || null);
      const count = await importBankCsvWithMapping({
        userId: user.id,
        accountId,
        headers: csvHeaders,
        rows: csvRows,
        mapping: csvMapping,
      });
      toast.success(`${count} Transaktionen importiert`);
      queryClient.invalidateQueries({ queryKey: queryKeys.bankMatching.transactions });
      setImportOpen(false);
      resetCsvState();
    } catch (e: unknown) {
      handleError(e, { context: "supabase", showToast: false });
      toastErrorWithRetry(e instanceof Error ? e.message : "Import fehlgeschlagen", () => handleCsvImport());
    } finally {
      setImporting(false);
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
          <Dialog
            open={importOpen}
            onOpenChange={(open) => {
              setImportOpen(open);
              if (!open) resetCsvState();
            }}
          >
            <DialogTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="gap-1 text-xs"
                onClick={() => resetCsvState()}
              >
                <Upload className="h-3 w-3" /> Import
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader><DialogTitle>Bank-Import (CSV / MT940 / CAMT)</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  Unterstützt: CSV (Sparkasse, Volksbank, DKB, ING, Commerzbank u.a.), MT940 (.sta) und CAMT.053 (.xml)
                </p>

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

                {csvStep === "upload" && (
                  <>
                    {/* IMPROVE-20: Use FileImportPicker so mobile users can import bank files from apps/cloud */}
                    <FileImportPicker
                      accept=".csv,.CSV,.sta,.STA,.xml,.XML"
                      onFile={handleFileUpload}
                      label={importing ? "Importiere..." : "Datei auswählen"}
                      variant="outline"
                      size="sm"
                      className="w-full justify-center"
                      disabled={importing}
                    />
                    <p className="text-[10px] text-muted-foreground">
                      CSV: Semikolon/Komma/Tab · MT940: SWIFT-Format (.sta) · CAMT: XML-Format (.xml)
                    </p>
                  </>
                )}

                {csvStep === "map" && (
                  <div className="space-y-3">
                    <div className="bg-secondary/50 rounded-lg p-3 text-xs text-muted-foreground">
                      <strong>{csvRows.length} Zeilen</strong> in <strong>{csvFileName}</strong> erkannt. Weise die Spalten zu.
                    </div>

                    <div className="space-y-2">
                      {BANK_CSV_FIELDS.map((field) => (
                        <div key={field.key} className="flex items-center gap-2">
                          <div className="w-28 text-xs shrink-0">
                            {field.label}
                            {(field as { required?: boolean }).required && <span className="text-loss ml-0.5">*</span>}
                          </div>
                          <Select
                            value={csvMapping[field.key] || SKIP_VALUE}
                            onValueChange={(v) => setCsvMapping(prev => ({ ...prev, [field.key]: v === SKIP_VALUE ? "" : v }))}
                          >
                            <SelectTrigger className="h-8 text-xs flex-1">
                              <SelectValue placeholder="Spalte auswählen…" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value={SKIP_VALUE}>
                                <span className="text-muted-foreground">— Überspringen —</span>
                              </SelectItem>
                              {csvHeaders.map(h => (
                                <SelectItem key={`${field.key}-${h}`} value={h}>{h}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      ))}
                    </div>

                    {(!csvMapping.date || (!csvMapping.amount && !csvMapping.credit && !csvMapping.debit)) && (
                      <div className="text-xs text-gold bg-gold/10 rounded-lg p-2">
                        Bitte mindestens Buchungsdatum und Betrag (oder Soll/Haben) zuweisen.
                      </div>
                    )}

                    <div className="flex justify-between pt-1">
                      <Button variant="ghost" size="sm" onClick={resetCsvState}>
                        <X className="h-3.5 w-3.5 mr-1" /> Zurück
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => setCsvStep("preview")}
                        disabled={!csvMapping.date || (!csvMapping.amount && !csvMapping.credit && !csvMapping.debit)}
                        className="gap-1"
                      >
                        Vorschau <ArrowRight className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                )}

                {csvStep === "preview" && (
                  <div className="space-y-3">
                    <div className="bg-secondary/50 rounded-lg p-3 text-xs text-muted-foreground">
                      Vorschau der ersten {csvPreview.length} Transaktion{csvPreview.length !== 1 ? "en" : ""}:
                    </div>

                    <div className="space-y-2">
                      {csvPreview.length === 0 ? (
                        <p className="text-xs text-muted-foreground text-center py-2">
                          Keine gültigen Zeilen gefunden. Prüfe die Zuordnung.
                        </p>
                      ) : (
                        csvPreview.map((tx, i) => (
                          <div key={i} className="surface-section p-2">
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-xs font-medium">{tx.date}</span>
                              <span className={`text-xs font-semibold ${tx.amount >= 0 ? "text-profit" : "text-loss"}`}>
                                {formatCurrency(tx.amount)}
                              </span>
                            </div>
                            {(tx.name || tx.reference) && (
                              <div className="text-[10px] text-muted-foreground mt-1 line-clamp-2">
                                {[tx.name, tx.reference].filter(Boolean).join(" · ")}
                              </div>
                            )}
                          </div>
                        ))
                      )}
                    </div>

                    <div className="flex justify-between pt-1">
                      <Button variant="ghost" size="sm" onClick={() => setCsvStep("map")}> 
                        <X className="h-3.5 w-3.5 mr-1" /> Zurück
                      </Button>
                      <Button size="sm" className="gap-1" onClick={handleCsvImport} disabled={importing}>
                        <Upload className="h-3.5 w-3.5" /> {importing ? "Importiere…" : "Import starten"}
                      </Button>
                    </div>
                  </div>
                )}

                {importing && <p className="text-xs text-muted-foreground animate-pulse">Importiere…</p>}
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
                  <div key={tx.id} className="flex items-center gap-3 p-3 surface-section bg-card hover:bg-secondary/30 transition-colors">
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
                  <div key={a.id} className="flex items-center gap-3 p-3 surface-section bg-card">
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
                  <div key={r.id} className="flex items-center gap-3 p-3 surface-section bg-card">
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
