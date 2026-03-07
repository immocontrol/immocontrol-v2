import { useState, useMemo, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useIsMobile } from "@/hooks/use-mobile";
import { MobileSwipeToAction } from "@/components/mobile/MobileSwipeToAction";
import { Landmark, Building2, Calendar, TriangleAlert as AlertTriangle, CreditCard as Edit2, Trash2, Search, X, Plus, Handshake, Receipt, BarChart3, FileBarChart, Store } from "lucide-react";
import { ROUTES } from "@/lib/routes";
import AddLoanDialog from "@/components/AddLoanDialog";
import LoanPayoffSimulator from "@/components/LoanPayoffSimulator";
import LoanFixedInterestAlerts from "@/components/LoanFixedInterestAlerts";
import { LoanPdfImport } from "@/components/LoanPdfImport";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useProperties } from "@/context/PropertyContext";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/queryKeys";
import { formatCurrency, formatDurationMonths, safeDivide, pluralDE, hslVar } from "@/lib/formatters";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Input } from "@/components/ui/input";
import { NumberInput } from "@/components/NumberInput";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { createMutationErrorHandler } from "@/lib/mutationErrorHandler";
import { handleError } from "@/lib/handleError";
import { toastErrorWithRetry } from "@/lib/toastMessages";
import { LoadingButton } from "@/components/LoadingButton";
import { BarChart, Bar, XAxis, YAxis, Tooltip as RTooltip, ResponsiveContainer, Cell, PieChart, Pie, Legend } from "recharts";
import { GERMAN_BANKS } from "@/data/germanBanks";
import { Download } from "lucide-react";
import { ManusFinanzierung } from "@/components/manus/ManusFinanzierung";

interface Loan {
  id: string;
  property_id: string;
  bank_name: string;
  loan_amount: number;
  remaining_balance: number;
  interest_rate: number;
  repayment_rate: number;
  monthly_payment: number;
  tilgungsfreie_monate: number;
  fixed_interest_until: string | null;
  start_date: string | null;
  end_date: string | null;
  loan_type: string;
  notes: string | null;
}

const loanTypeLabels: Record<string, string> = {
  annuity: "Annuitätendarlehen",
  bullet: "Endfälliges Darlehen",
  variable: "Variables Darlehen",
  kfw: "KfW-Darlehen",
};

const Loans = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const isMobile = useIsMobile();
  const { properties } = useProperties();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editLoan, setEditLoan] = useState<Loan | null>(null);
  const [filterOwnership, setFilterOwnership] = useState<string>("alle");
  const [filterBank, setFilterBank] = useState<string>("alle");
  const [form, setForm] = useState({
    property_id: "", bank_name: "", loan_amount: 0, remaining_balance: 0,
    interest_rate: 0, repayment_rate: 0, monthly_payment: 0, tilgungsfreie_monate: 0,
    fixed_interest_until: "", start_date: "", end_date: "", loan_type: "annuity", notes: "",
  });

  // Bank search state
  const [bankSearch, setBankSearch] = useState("");
  const [bankPopoverOpen, setBankPopoverOpen] = useState(false);
  const [addingNewBank, setAddingNewBank] = useState(false);
  const [newBankName, setNewBankName] = useState("");

  // Bank delete confirmation state
  const [deletingBank, setDeletingBank] = useState<string | null>(null);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  // Loan delete confirmation (UX: always confirm destructive action)
  const [deleteTargetLoan, setDeleteTargetLoan] = useState<string | null>(null);

  useEffect(() => {
    if (form.loan_amount > 0 && (form.interest_rate > 0 || form.repayment_rate > 0)) {
      const monthly = (form.loan_amount * (form.interest_rate + form.repayment_rate)) / 100 / 12;
      setForm(prev => ({ ...prev, monthly_payment: Math.round(monthly * 100) / 100 }));
    }
  }, [form.loan_amount, form.interest_rate, form.repayment_rate]);

  useEffect(() => {
    if (!form.start_date || form.loan_amount <= 0 || form.interest_rate <= 0 || form.repayment_rate <= 0) return;
    const monthlyRate = form.interest_rate / 100 / 12;
    const annuity = (form.loan_amount * (form.interest_rate + form.repayment_rate)) / 100 / 12;
    const gracePeriod = form.tilgungsfreie_monate || 0;
    const balanceAfterGrace = form.loan_amount * Math.pow(1 + monthlyRate, gracePeriod);
    let balance = balanceAfterGrace;
    let months = gracePeriod;
    const maxMonths = 600;
    while (balance > 0 && months < maxMonths) {
      const interest = balance * monthlyRate;
      balance = balance + interest - annuity;
      months++;
    }
    if (months < maxMonths) {
      const startDate = new Date(form.start_date);
      startDate.setMonth(startDate.getMonth() + months);
      const computedEnd = startDate.toISOString().split("T")[0];
      const remainingBalance = Math.max(0, Math.round(balance * 100) / 100);
      setForm(prev => ({
        ...prev,
        end_date: prev.end_date || computedEnd,
        remaining_balance: prev.remaining_balance === 0 ? remainingBalance : prev.remaining_balance,
      }));
    }
  }, [form.start_date, form.loan_amount, form.interest_rate, form.repayment_rate, form.tilgungsfreie_monate]);

  const { data: loans = [], isLoading } = useQuery({
    queryKey: queryKeys.loans.all,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("loans")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as Loan[];
    },
    enabled: !!user,
  });

  /* IMP-40: Dynamic document title */
  useEffect(() => { document.title = `Darlehen (${loans.length}) – ImmoControl`; }, [loans.length]);

  // User's custom banks
  const { data: userBanks = [] } = useQuery({
    queryKey: ["user_banks"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_banks")
        .select("*")
        .order("name");
      if (error) throw error;
      return (data || []) as { id: string; name: string }[];
    },
    enabled: !!user,
  });

  // All available banks: standard + user-added (deduplicated)
  const allBanks = useMemo(() => {
    const set = new Set<string>([...GERMAN_BANKS]);
    userBanks.forEach(b => set.add(b.name));
    return Array.from(set).sort((a, b) => a.localeCompare(b, "de"));
  }, [userBanks]);

  // Check if a bank is a user-added custom bank
  const isCustomBank = (name: string) => userBanks.some(b => b.name === name);

  // Filtered bank list for search
  const filteredBankOptions = useMemo(() => {
    if (!bankSearch.trim()) return allBanks;
    const q = bankSearch.toLowerCase();
    return allBanks.filter(b => b.toLowerCase().includes(q));
  }, [allBanks, bankSearch]);

  // Unique banks used in loans (for filter)
  const usedBanks = useMemo(() => {
    const set = new Set(loans.map(l => l.bank_name));
    return Array.from(set).sort((a, b) => a.localeCompare(b, "de"));
  }, [loans]);

  const resetForm = () => {
    setForm({ property_id: "", bank_name: "", loan_amount: 0, remaining_balance: 0, interest_rate: 0, repayment_rate: 0, monthly_payment: 0, tilgungsfreie_monate: 0, fixed_interest_until: "", start_date: "", end_date: "", loan_type: "annuity", notes: "" });
    setEditLoan(null);
    setBankSearch("");
    setAddingNewBank(false);
    setNewBankName("");
    setDeletingBank(null);
    setDeleteConfirmText("");
  };

  const addCustomBank = async () => {
    if (!user || !newBankName.trim()) return;
    const { error } = await supabase.from("user_banks").insert({ user_id: user.id, name: newBankName.trim() });
    if (error && error.code === "23505") {
      toast.info("Diese Bank existiert bereits");
    } else if (error) {
      handleError(error, { context: "supabase", showToast: false });
      toastErrorWithRetry("Fehler beim Hinzufügen", addCustomBank);
      return;
    }
    const addedName = newBankName.trim();
    setForm({ ...form, bank_name: addedName });
    setBankSearch(addedName);
    setNewBankName("");
    setAddingNewBank(false);
    setBankPopoverOpen(false);
    await qc.invalidateQueries({ queryKey: ["user_banks"] });
    toast.success(`"${addedName}" hinzugefügt`);
  };

  const deleteCustomBank = async (bankName: string) => {
    const bank = userBanks.find(b => b.name === bankName);
    if (!bank) return;
    const { error } = await supabase.from("user_banks").delete().eq("id", bank.id);
    if (error) {
      handleError(error, { context: "supabase", showToast: false });
      toastErrorWithRetry("Fehler beim Löschen", () => deleteCustomBank(bankName));
      return;
    }
    // If the deleted bank was selected, clear it
    if (form.bank_name === bankName) {
      setForm({ ...form, bank_name: "" });
      setBankSearch("");
    }
    setDeletingBank(null);
    setDeleteConfirmText("");
    qc.invalidateQueries({ queryKey: ["user_banks"] });
    toast.success(`"${bankName}" gelöscht`);
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!user || !form.property_id || !form.bank_name.trim()) throw new Error("Invalid");
      const payload = {
        property_id: form.property_id,
        bank_name: form.bank_name.trim(),
        loan_amount: form.loan_amount,
        remaining_balance: form.remaining_balance,
        interest_rate: form.interest_rate,
        repayment_rate: form.repayment_rate,
        monthly_payment: form.monthly_payment,
        tilgungsfreie_monate: form.tilgungsfreie_monate,
        fixed_interest_until: form.fixed_interest_until || null,
        start_date: form.start_date || null,
        end_date: form.end_date || null,
        loan_type: form.loan_type,
        notes: form.notes || null,
      };
      if (editLoan) {
        const { error } = await supabase.from("loans").update(payload).eq("id", editLoan.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("loans").insert({ ...payload, user_id: user.id });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(editLoan ? "Darlehen aktualisiert" : "Darlehen angelegt");
      resetForm();
      setOpen(false);
      qc.invalidateQueries({ queryKey: queryKeys.loans.all });
    },
    onError: createMutationErrorHandler("Darlehen speichern", "Fehler beim Speichern"),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("loans").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Darlehen gelöscht");
      setDeleteTargetLoan(null);
      qc.invalidateQueries({ queryKey: queryKeys.loans.all });
    },
    onError: (e) => {
      createMutationErrorHandler("Darlehen löschen", "Fehler beim Löschen")(e);
      setDeleteTargetLoan(null);
    },
  });

  const openEdit = (l: Loan) => {
    setEditLoan(l);
    setForm({
      property_id: l.property_id, bank_name: l.bank_name,
      loan_amount: l.loan_amount, remaining_balance: l.remaining_balance,
      interest_rate: l.interest_rate, repayment_rate: l.repayment_rate,
      monthly_payment: l.monthly_payment, tilgungsfreie_monate: l.tilgungsfreie_monate || 0,
      fixed_interest_until: l.fixed_interest_until || "",
      start_date: l.start_date || "", end_date: l.end_date || "",
      loan_type: l.loan_type, notes: l.notes || "",
    });
    setBankSearch(l.bank_name);
    setOpen(true);
  };

  /* IMP-24: Memoize property lookup helpers to avoid re-creation on every render */
  const getPropertyOwnership = useCallback((propId: string) => properties.find(p => p.id === propId)?.ownership || "privat", [properties]);
  const getPropertyName = useCallback((propId: string) => properties.find(p => p.id === propId)?.name || "–", [properties]);

  /* IMP-25: Memoize filteredLoans to prevent recalculation on unrelated state changes */
  const filteredLoans = useMemo(() => loans
    .filter(l => filterOwnership === "alle" || getPropertyOwnership(l.property_id) === filterOwnership)
    .filter(l => filterBank === "alle" || l.bank_name === filterBank), [loans, filterOwnership, filterBank, getPropertyOwnership]);

  /* IMP20-4: Consolidate 6 non-memoized derived values into single useMemo — prevents 6 reduce() calls on every render */
  const { totalBalance, totalMonthly, avgRate, totalAnnualInterest, totalLoanAmount, totalTilgungsfortschritt } = useMemo(() => {
    const balance = filteredLoans.reduce((s, l) => s + l.remaining_balance, 0);
    const monthly = filteredLoans.reduce((s, l) => s + l.monthly_payment, 0);
    const rate = filteredLoans.length > 0
      ? filteredLoans.reduce((s, l) => s + l.interest_rate * l.remaining_balance, 0) / Math.max(balance, 1)
      : 0;
    const annualInterest = filteredLoans.reduce((s, l) => s + (l.remaining_balance * l.interest_rate / 100), 0);
    const loanAmount = filteredLoans.reduce((s, l) => s + l.loan_amount, 0);
    const tilgungsfortschritt = safeDivide((loanAmount - balance) * 100, loanAmount, 0);
    return { totalBalance: balance, totalMonthly: monthly, avgRate: rate, totalAnnualInterest: annualInterest, totalLoanAmount: loanAmount, totalTilgungsfortschritt: tilgungsfortschritt };
  }, [filteredLoans]);
  /* STRONG-5: Memoize highRateLoans — previously recalculated on every render despite depending only on filteredLoans */
  const MARKET_RATE_THRESHOLD = 3.5;
  const highRateLoans = useMemo(() => filteredLoans.filter(l => l.interest_rate > MARKET_RATE_THRESHOLD), [filteredLoans]);

  /* STR-12: Refinancing savings estimate — shows potential monthly savings if high-rate loans were refinanced at market rate */
  const refinancingSavings = useMemo(() => {
    if (highRateLoans.length === 0) return { monthlySavings: 0, annualSavings: 0, loanCount: 0 };
    const monthlySavings = highRateLoans.reduce((s, l) => {
      const currentMonthlyInterest = l.remaining_balance * l.interest_rate / 100 / 12;
      const newMonthlyInterest = l.remaining_balance * MARKET_RATE_THRESHOLD / 100 / 12;
      return s + (currentMonthlyInterest - newMonthlyInterest);
    }, 0);
    return { monthlySavings, annualSavings: monthlySavings * 12, loanCount: highRateLoans.length };
  }, [highRateLoans]);

  /* FUNC-11: Loan maturity warnings - loans ending within 12 months */
  const maturingLoans = useMemo(() => {
    const oneYear = new Date();
    oneYear.setFullYear(oneYear.getFullYear() + 1);
    return filteredLoans.filter(l => l.end_date && new Date(l.end_date) <= oneYear);
  }, [filteredLoans]);

  /* FUNC-12: Interest vs Principal split per month */
  const interestPrincipalSplit = useMemo(() => {
    return filteredLoans.map(l => {
      const monthlyInterest = l.remaining_balance * l.interest_rate / 100 / 12;
      const monthlyPrincipal = l.monthly_payment - monthlyInterest;
      return { id: l.id, bank: l.bank_name, interest: monthlyInterest, principal: Math.max(0, monthlyPrincipal), payment: l.monthly_payment };
    });
  }, [filteredLoans]);

  /* FUNC-13: Total interest paid estimate over remaining term */
  const totalRemainingInterest = useMemo(() => {
    return filteredLoans.reduce((s, l) => {
      if (l.interest_rate <= 0 || l.monthly_payment <= 0) return s;
      const monthlyRate = l.interest_rate / 100 / 12;
      let balance = l.remaining_balance;
      let totalInt = 0;
      let months = 0;
      while (balance > 0 && months < 600) {
        const interest = balance * monthlyRate;
        totalInt += interest;
        balance = balance + interest - l.monthly_payment;
        months++;
      }
      return s + totalInt;
    }, 0);
  }, [filteredLoans]);

  /* FUNC-14: Weighted average remaining term in months */
  const weightedAvgTermMonths = useMemo(() => {
    let totalWeightedMonths = 0;
    let totalBal = 0;
    filteredLoans.forEach(l => {
      if (l.end_date) {
        const months = Math.max(0, (new Date(l.end_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24 * 30));
        totalWeightedMonths += months * l.remaining_balance;
        totalBal += l.remaining_balance;
      }
    });
    return totalBal > 0 ? Math.round(totalWeightedMonths / totalBal) : 0;
  }, [filteredLoans]);

  /* OPT-14: Memoized loan type distribution */
  const loanTypeDistribution = useMemo(() => {
    const dist: Record<string, { count: number; balance: number }> = {};
    filteredLoans.forEach(l => {
      if (!dist[l.loan_type]) dist[l.loan_type] = { count: 0, balance: 0 };
      dist[l.loan_type].count++;
      dist[l.loan_type].balance += l.remaining_balance;
    });
    return dist;
  }, [filteredLoans]);

  /* IMPROVE-7: Memoize zinsBindungData to prevent recalculation on unrelated state changes */
  /* FUND-11: Fixed indentation — body was not indented inside useMemo callback */
  const zinsBindungData = useMemo(() => {
    const now = new Date();
    return filteredLoans
      .filter(l => l.fixed_interest_until)
      .map(l => {
        const end = new Date(l.fixed_interest_until!);
        const monthsLeft = Math.max(0, (end.getFullYear() - now.getFullYear()) * 12 + (end.getMonth() - now.getMonth()));
        return {
          name: `${getPropertyName(l.property_id).slice(0, 15)} (${l.bank_name.slice(0, 10)})`,
          monate: monthsLeft,
          balance: l.remaining_balance,
          rate: l.interest_rate,
          end: end.toLocaleDateString("de-DE", { month: "short", year: "numeric" }),
          risk: monthsLeft <= 12 ? "high" : monthsLeft <= 24 ? "medium" : "low",
        };
      })
      .sort((a, b) => a.monate - b.monate);
  }, [filteredLoans, getPropertyName]);

  /* IMPROVE-8: Memoize ownershipGroups for stable pie chart data */
  const ownershipGroups = useMemo(() => loans.reduce((acc, l) => {
    const key = getPropertyOwnership(l.property_id);
    acc[key] = (acc[key] || 0) + l.remaining_balance;
    return acc;
  }, {} as Record<string, number>), [loans, getPropertyOwnership]);

  /* IMPROVE-9: Memoize pieData derived from ownershipGroups */
  const pieData = useMemo(() => Object.entries(ownershipGroups).map(([key, val]) => ({
    name: key === "egbr" ? "eGbR" : key === "privat" ? "Privat" : key,
    value: val,
  })), [ownershipGroups]);

  /* OPT-48: hslVar helper for theme colors */
  const COLORS = [hslVar("primary"), hslVar("gold"), hslVar("chart-3")];

  if (isLoading) {
    return (
      <div className="space-y-6" role="main" aria-label="Darlehensverwaltung">
        {/* UI-4: skeleton-wave for loading */}
        <div className="h-8 w-48 skeleton-wave rounded-lg" />
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 card-stagger-enter">
          {[1, 2, 3].map(i => <div key={i} className="h-24 skeleton-wave rounded-xl" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6" role="main" aria-label="Darlehensverwaltung">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          {/* UI-11: heading-gradient */}
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight flex items-center gap-2 heading-gradient">
            <Landmark className="h-5 w-5 sm:h-6 sm:w-6 text-primary" /> Darlehen
          </h1>
          <p className="text-sm text-muted-foreground mt-1 flex items-center gap-2 flex-wrap">
            {/* OPT-10: pluralDE for correct pluralization */}
            {pluralDE(loans.length, "Darlehen", "Darlehen")} · {formatCurrency(totalBalance)} Restschuld
            {highRateLoans.length > 0 && (
              <span className="ml-2 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-gold/10 text-gold">
                <AlertTriangle className="h-3 w-3" /> {highRateLoans.length} über {MARKET_RATE_THRESHOLD}% Zins
              </span>
            )}
            <Button variant="link" size="sm" className="h-auto p-0 text-xs text-muted-foreground hover:text-primary touch-target min-h-[44px]" onClick={() => navigate(ROUTES.REPORTS)} aria-label="Zu Berichte">
              <FileBarChart className="h-3.5 w-3.5 mr-1" /> Berichte
            </Button>
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {/* Ownership filter */}
          {["alle", "privat", "egbr"].map(f => (
            <button key={f} onClick={() => setFilterOwnership(f)}
              aria-label={`Filter: ${f}`}
              className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-colors ${filterOwnership === f ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-secondary"}`}>
              {f === "alle" ? "Alle" : f === "egbr" ? "eGbR" : "Privat"}
            </button>
          ))}

          {/* Bank filter */}
          {usedBanks.length > 1 && (
            <Select value={filterBank} onValueChange={setFilterBank}>
              <SelectTrigger className="h-8 text-xs w-[160px]">
                <SelectValue placeholder="Bank filtern" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="alle">Alle Banken</SelectItem>
                {usedBanks.map(b => (
                  <SelectItem key={b} value={b}>{b}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          {filterBank !== "alle" && (
            <Button variant="ghost" size="sm" className="h-8 px-2 text-xs" onClick={() => setFilterBank("alle")}>
              <X className="h-3 w-3 mr-1" /> Filter
            </Button>
          )}

          {/* IMP20-17: Enhanced Loans CSV export — includes Tilgungsfortschritt, Zinsanteil, Restlaufzeit */}
          {filteredLoans.length > 0 && (
            <Button variant="outline" size="sm" className="gap-1.5 hidden sm:flex" onClick={() => {
              const headers = ["Bank", "Objekt", "Betrag", "Restschuld", "Tilgungsfortschritt %", "Zinssatz", "Tilgung", "Rate/M", "Zinsanteil/M", "Tilgungsanteil/M", "Zinsbindung bis", "Start", "Ende", "Typ"];
              const rows = filteredLoans.map(l => {
                const monthlyInterest = (l.remaining_balance * l.interest_rate / 100 / 12);
                const monthlyPrincipal = l.monthly_payment - monthlyInterest;
                const progress = l.loan_amount > 0 ? ((l.loan_amount - l.remaining_balance) / l.loan_amount * 100).toFixed(1) : "0";
                return [
                  l.bank_name, getPropertyName(l.property_id), l.loan_amount, l.remaining_balance,
                  progress, l.interest_rate, l.repayment_rate, l.monthly_payment,
                  monthlyInterest.toFixed(2), monthlyPrincipal.toFixed(2),
                  l.fixed_interest_until || "", l.start_date || "", l.end_date || "", loanTypeLabels[l.loan_type] || l.loan_type,
                ];
              });
              const csv = [headers.join(";"), ...rows.map(r => r.join(";"))].join("\n");
              const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
              const url = URL.createObjectURL(blob);
              const a = document.createElement("a");
              a.href = url; a.download = `darlehen_${new Date().toISOString().split("T")[0]}.csv`; a.click();
              URL.revokeObjectURL(url);
              toast.success("Darlehen als CSV exportiert!");
            }}>
              <Download className="h-3.5 w-3.5" /> CSV
            </Button>
          )}

          {/* FUNC-11/12/13/14: Loan maturity, interest split, remaining interest, avg term */}
          {filteredLoans.length > 0 && (
            <div className="flex items-center gap-2 flex-wrap">
              {maturingLoans.length > 0 && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-loss/10 text-loss">
                  <AlertTriangle className="h-3 w-3" /> {maturingLoans.length} laufen in &lt;12M aus
                </span>
              )}
              {totalRemainingInterest > 0 && (
                <span className="text-[11px] px-2 py-0.5 rounded-full bg-secondary text-muted-foreground font-medium">
                  Restzinsen: {formatCurrency(totalRemainingInterest)}
                </span>
              )}
              {weightedAvgTermMonths > 0 && (
                <span className="text-[11px] px-2 py-0.5 rounded-full bg-secondary text-muted-foreground font-medium pill-badge">
                  {/* OPT-6: formatDurationMonths for human-readable duration */}
                  Ø Restlaufzeit: {formatDurationMonths(weightedAvgTermMonths)}
                </span>
              )}
            </div>
          )}

          <LoanPdfImport onImport={(parsed) => {
            setForm(prev => ({
              ...prev,
              bank_name: parsed.bank_name || prev.bank_name,
              loan_amount: parsed.loan_amount || prev.loan_amount,
              remaining_balance: parsed.remaining_balance || prev.remaining_balance,
              interest_rate: parsed.interest_rate || prev.interest_rate,
              repayment_rate: parsed.repayment_rate || prev.repayment_rate,
              monthly_payment: parsed.monthly_payment || prev.monthly_payment,
              fixed_interest_until: parsed.fixed_interest_until || prev.fixed_interest_until,
              start_date: parsed.start_date || prev.start_date,
              loan_type: parsed.loan_type || prev.loan_type,
              notes: parsed.notes || prev.notes,
            }));
            setBankSearch(parsed.bank_name || "");
            setOpen(true);
          }} />

          <AddLoanDialog onCreated={() => qc.invalidateQueries({ queryKey: queryKeys.loans.all })} />

          <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) resetForm(); }}>
            <DialogTrigger asChild>
              <Button size="sm" variant="outline" className="gap-1.5 hidden"><Plus className="h-3.5 w-3.5" /> Darlehen</Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>{editLoan ? "Darlehen bearbeiten" : "Neues Darlehen"}</DialogTitle>
              </DialogHeader>
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2 space-y-1">
                  <Label className="text-xs">Objekt *</Label>
                  <Select value={form.property_id} onValueChange={v => setForm({ ...form, property_id: v })}>
                    <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Objekt wählen" /></SelectTrigger>
                    <SelectContent>
                      {properties.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>

                {/* Bank dropdown with search */}
                <div className="space-y-1">
                  <Label className="text-xs">Bank *</Label>
                  <Popover open={bankPopoverOpen} onOpenChange={setBankPopoverOpen}>
                    <PopoverTrigger asChild>
                      <Button variant="outline" role="combobox" className="h-9 w-full justify-between text-sm font-normal">
                        {form.bank_name || "Bank wählen…"}
                        <Search className="ml-2 h-3 w-3 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[280px] p-0" align="start">
                      <div className="p-2 border-b border-border">
                        <Input
                          placeholder="Bank suchen…"
                          value={bankSearch}
                          onChange={e => setBankSearch(e.target.value)}
                          className="h-8 text-sm"
                          autoFocus
                        />
                      </div>

                      {/* Delete confirmation view */}
                      {deletingBank ? (
                        <div className="p-3 space-y-2">
                          <p className="text-xs text-muted-foreground">
                            Zum Bestätigen tippe: <strong className="text-foreground">{deletingBank} löschen</strong>
                          </p>
                          <Input
                            placeholder={`${deletingBank} löschen`}
                            value={deleteConfirmText}
                            onChange={e => setDeleteConfirmText(e.target.value)}
                            className="h-8 text-sm"
                            autoFocus
                          />
                          <div className="flex gap-1.5">
                            <Button
                              size="sm"
                              variant="destructive"
                              className="h-8 flex-1 text-xs"
                              disabled={deleteConfirmText !== `${deletingBank} löschen`}
                              onClick={() => deleteCustomBank(deletingBank)}
                            >
                              Löschen
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-8 text-xs"
                              onClick={() => { setDeletingBank(null); setDeleteConfirmText(""); }}
                            >
                              Abbrechen
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <>
                          <ScrollArea className="max-h-[200px]">
                            <div className="p-1">
                              {filteredBankOptions.map(bank => (
                                <div key={bank} className="flex items-center group/bank">
                                  <button
                                    className={`flex-1 text-left px-3 py-1.5 text-sm rounded hover:bg-secondary transition-colors ${form.bank_name === bank ? "bg-primary/10 text-primary font-medium" : ""}`}
                                    onClick={() => {
                                      setForm({ ...form, bank_name: bank });
                                      setBankSearch(bank);
                                      setBankPopoverOpen(false);
                                    }}
                                  >
                                    {bank}
                                  </button>
                                  {isCustomBank(bank) && (
                                    // UI-UPDATE-46: Tooltip on delete bank action
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <button
                                          className="opacity-0 group-hover/bank:opacity-100 p-1 mr-1 text-muted-foreground hover:text-destructive transition-all"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            setDeletingBank(bank);
                                            setDeleteConfirmText("");
                                          }}
                                        >
                                          <Trash2 className="h-3 w-3" />
                                        </button>
                                      </TooltipTrigger>
                                      <TooltipContent>Bank löschen</TooltipContent>
                                    </Tooltip>
                                  )}
                                </div>
                              ))}
                              {filteredBankOptions.length === 0 && !addingNewBank && (
                                <p className="text-xs text-muted-foreground px-3 py-2">Keine Bank gefunden</p>
                              )}
                            </div>
                          </ScrollArea>
                          <div className="border-t border-border p-2">
                            {!addingNewBank ? (
                              <button
                                className="w-full text-left px-3 py-1.5 text-sm text-primary hover:bg-primary/5 rounded flex items-center gap-1.5"
                                onClick={() => { setAddingNewBank(true); setNewBankName(bankSearch); }}
                              >
                                <Plus className="h-3 w-3" /> Neue Bank hinzufügen
                              </button>
                            ) : (
                              <div className="flex gap-1.5">
                                <Input
                                  placeholder="Bankname"
                                  value={newBankName}
                                  onChange={e => setNewBankName(e.target.value)}
                                  className="h-8 text-sm flex-1"
                                  autoFocus
                                  onKeyDown={e => e.key === "Enter" && addCustomBank()}
                                />
                                <Button size="sm" className="h-8" onClick={addCustomBank} disabled={!newBankName.trim()}>
                                  OK
                                </Button>
                              </div>
                            )}
                          </div>
                        </>
                      )}
                    </PopoverContent>
                  </Popover>
                </div>

                <div className="space-y-1">
                  <Label className="text-xs">Darlehensart</Label>
                  <Select value={form.loan_type} onValueChange={v => setForm({ ...form, loan_type: v })}>
                    <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {Object.entries(loanTypeLabels).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Darlehensbetrag</Label>
                  <NumberInput value={form.loan_amount} onChange={v => setForm(f => ({ ...f, loan_amount: v }))} className="h-9 text-sm" placeholder="0" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs flex items-center gap-1">
                    Restschuld
                    {form.start_date && form.loan_amount > 0 && form.repayment_rate > 0 && (
                      <span className="text-[10px] text-primary font-normal">(auto-berechnet)</span>
                    )}
                  </Label>
                  <NumberInput value={form.remaining_balance} onChange={v => setForm(f => ({ ...f, remaining_balance: v }))} className="h-9 text-sm" placeholder="0" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Zinssatz %</Label>
                  <NumberInput value={form.interest_rate} onChange={v => setForm(f => ({ ...f, interest_rate: v }))} decimals className="h-9 text-sm" placeholder="0,00" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Tilgung %</Label>
                  <NumberInput value={form.repayment_rate} onChange={v => setForm(f => ({ ...f, repayment_rate: v }))} decimals className="h-9 text-sm" placeholder="0,00" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Rate/Monat (berechnet)</Label>
                  <NumberInput value={form.monthly_payment} onChange={v => setForm(f => ({ ...f, monthly_payment: v }))} decimals className="h-9 text-sm bg-secondary/50" placeholder="0,00" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Tilgungsfreie Zeit (Monate)</Label>
                  <NumberInput value={form.tilgungsfreie_monate} onChange={v => setForm(f => ({ ...f, tilgungsfreie_monate: v }))} className="h-9 text-sm" placeholder="0" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Zinsbindung bis</Label>
                  <Input type="date" value={form.fixed_interest_until} onChange={e => setForm({ ...form, fixed_interest_until: e.target.value })} className="h-9 text-sm" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Startdatum</Label>
                  <Input type="date" value={form.start_date} onChange={e => setForm({ ...form, start_date: e.target.value, end_date: "", remaining_balance: 0 })} className="h-9 text-sm" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs flex items-center gap-1">
                    Enddatum
                    {form.start_date && form.loan_amount > 0 && form.repayment_rate > 0 && (
                      <span className="text-[10px] text-primary font-normal">(auto-berechnet)</span>
                    )}
                  </Label>
                  <Input type="date" value={form.end_date} onChange={e => setForm({ ...form, end_date: e.target.value })} className="h-9 text-sm" />
                </div>
                <div className="col-span-2 space-y-1">
                  <Label className="text-xs">Notizen</Label>
                  <Input value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} className="h-9 text-sm" placeholder="Optional" />
                </div>
              </div>
              <LoadingButton onClick={() => saveMutation.mutate()} className="w-full mt-2" loading={saveMutation.isPending} disabled={!form.property_id || !form.bank_name?.trim()}>
                {editLoan ? "Speichern" : "Darlehen anlegen"}
              </LoadingButton>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Fixed interest expiry alerts */}
      <LoanFixedInterestAlerts loans={filteredLoans} />

      {/* Manus AI: Finanzierungs-Optimierung */}
      {filteredLoans.length > 0 && (
        <ManusFinanzierung
          loans={filteredLoans.map((l) => ({
            bank: l.bank_name,
            restschuld: l.remaining_balance,
            zinssatz: l.interest_rate,
            zinsbindung_bis: l.fixed_interest_until || l.end_date || "",
            tilgung: l.repayment_rate,
          }))}
        />
      )}

      {/* KPI Cards — UI-2: card-stagger-enter */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 card-stagger-enter">
        <div className="gradient-card rounded-xl border border-border p-4 card-accent-shadow">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Restschuld gesamt</p>
          <p className="text-xl font-bold mt-1 currency-display">{formatCurrency(totalBalance)}</p>
          <div className="h-1.5 bg-secondary rounded-full overflow-hidden mt-2">
            {/* UI-14: progress-smooth */}
            <div className="h-full bg-primary rounded-full progress-smooth" style={{ width: `${totalTilgungsfortschritt}%` }} />
          </div>
          <p className="text-[10px] text-muted-foreground mt-1">{totalTilgungsfortschritt.toFixed(0)}% getilgt</p>
        </div>
        <div className="gradient-card rounded-xl border border-border p-4 card-accent-shadow">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Rate/Monat</p>
          <p className="text-xl font-bold mt-1 currency-display">{formatCurrency(totalMonthly)}</p>
          <p className="text-[10px] text-muted-foreground">{formatCurrency(totalMonthly * 12)}/Jahr</p>
        </div>
        <div className="gradient-card rounded-xl border border-border p-4 card-accent-shadow">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Ø Zinssatz</p>
          <p className="text-xl font-bold mt-1">{avgRate.toFixed(2)}%</p>
        </div>
        <div className="gradient-card rounded-xl border border-border p-4 card-accent-shadow">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Zinslast/Jahr</p>
          <p className="text-xl font-bold mt-1 text-loss currency-display">{formatCurrency(totalAnnualInterest)}</p>
          <p className="text-[10px] text-muted-foreground">{formatCurrency(totalAnnualInterest / 12)}/Monat</p>
        </div>
        <div className="gradient-card rounded-xl border border-border p-4 card-accent-shadow">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Zinsänderungsrisiko</p>
          <p className="text-xl font-bold mt-1">
            {zinsBindungData.filter(z => z.risk === "high").length > 0 ? (
              <span className="text-loss flex items-center gap-1"><AlertTriangle className="h-4 w-4" />{zinsBindungData.filter(z => z.risk === "high").length} Darlehen</span>
            ) : (
              <span className="text-profit">Kein akutes Risiko</span>
            )}
          </p>
        </div>
      </div>

      {/* Charts */}
      <div className="grid md:grid-cols-2 gap-3">
        {zinsBindungData.length > 0 && (
          <div className="gradient-card rounded-xl border border-border p-5">
            <h3 className="text-sm font-semibold mb-4 flex items-center gap-2">
              <Calendar className="h-4 w-4 text-muted-foreground" /> Zinsbindungsende
            </h3>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={zinsBindungData} layout="vertical" margin={{ left: 10, right: 10 }}>
                <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={v => `${v}M`} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} width={120} />
                <RTooltip
                  contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }}
                  formatter={(v: number, _: string, p: { payload: { end: string; rate: number; balance: number } }) => [`${v} Monate (${p.payload.end})`, `${p.payload.rate}% · ${formatCurrency(p.payload.balance)}`]}
                />
                <Bar dataKey="monate" radius={[0, 4, 4, 0]}>
                  {zinsBindungData.map((entry, i) => (
                    <Cell key={i} fill={entry.risk === "high" ? "hsl(var(--loss))" : entry.risk === "medium" ? "hsl(var(--gold))" : "hsl(var(--primary))"} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
            <div className="flex items-center gap-4 mt-2 text-[10px] text-muted-foreground">
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-loss" /> {"< 12 Monate"}</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-gold" /> 12–24 Monate</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-primary" /> {"> 24 Monate"}</span>
            </div>
          </div>
        )}

        {pieData.length > 0 && (
          <div className="gradient-card rounded-xl border border-border p-5">
            <h3 className="text-sm font-semibold mb-4 flex items-center gap-2">
              <Building2 className="h-4 w-4 text-muted-foreground" /> Verteilung nach Besitzart
            </h3>
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                  {pieData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Legend />
                <RTooltip formatter={(v: number) => formatCurrency(v)} contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* Loans list */}
      {filteredLoans.length === 0 ? (
        <div className="text-center py-12 space-y-4">
          {/* UI-10: empty-state-float */}
          <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto empty-state-float">
            <Landmark className="h-8 w-8 text-primary" />
          </div>
          <h2 className="text-lg font-bold">Noch keine Darlehen</h2>
          <p className="text-sm text-muted-foreground max-w-xs mx-auto">Lege dein erstes Darlehen an, um Zinsbindungen und Tilgungsfortschritt zu überwachen.</p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-2 flex-wrap">
            <AddLoanDialog onCreated={() => qc.invalidateQueries({ queryKey: queryKeys.loans.all })} />
            <Button variant="outline" size="sm" onClick={() => navigate(ROUTES.OBJEKTE)} className="touch-target min-h-[44px] gap-2">
              <Building2 className="h-4 w-4" /> Objekt anlegen
            </Button>
            <Button variant="outline" size="sm" onClick={() => navigate(ROUTES.DEALS)} className="touch-target min-h-[44px] gap-2">
              <Handshake className="h-4 w-4" /> Deals
            </Button>
            <Button variant="outline" size="sm" onClick={() => navigate(ROUTES.RENT)} className="touch-target min-h-[44px] gap-2">
              <BarChart3 className="h-4 w-4" /> Mietübersicht
            </Button>
            <Button variant="outline" size="sm" onClick={() => navigate(ROUTES.NK)} className="touch-target min-h-[44px] gap-2">
              <Receipt className="h-4 w-4" /> Nebenkosten
            </Button>
            <Button variant="outline" size="sm" onClick={() => navigate(ROUTES.REPORTS)} className="touch-target min-h-[44px] gap-2" aria-label="Zu Berichte">
              <FileBarChart className="h-4 w-4" /> Berichte
            </Button>
            <Button variant="outline" size="sm" onClick={() => navigate(ROUTES.CRM_SCOUT)} className="touch-target min-h-[44px] gap-2" aria-label="WGH-Scout">
              <Store className="h-4 w-4" /> WGH finden
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          {filteredLoans.map(l => {
            const prop = properties.find(p => p.id === l.property_id);
            const monthsLeft = l.fixed_interest_until
              ? Math.max(0, (new Date(l.fixed_interest_until).getTime() - now.getTime()) / (1000 * 60 * 60 * 24 * 30))
              : null;
            /* MOB-IMPROVE-1 + MOB-IMPROVE-6: Mobile card layout with swipe-to-delete */
            const loanCard = (
              <div key={l.id} className="gradient-card rounded-xl border border-border p-4 flex items-center gap-4 group property-card-hover">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                  <Landmark className="h-5 w-5 text-primary" />
                </div>
                  {/* IMP-26: Ensure loan card text never overflows on mobile */}
                  <div className="flex-1 min-w-0 overflow-hidden">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-semibold truncate max-w-[150px] sm:max-w-none">{l.bank_name}</span>
                      <Badge variant="secondary" className="text-[10px] h-4 shrink-0">{loanTypeLabels[l.loan_type] || l.loan_type}</Badge>
                      {prop && <span className="text-[10px] text-muted-foreground truncate hidden sm:inline">· {prop.name}</span>}
                      {monthsLeft !== null && monthsLeft <= 12 && (
                        <span className="text-[10px] bg-loss/10 text-loss px-1.5 py-0.5 rounded-full font-bold flex items-center gap-0.5">
                          <AlertTriangle className="h-2.5 w-2.5" /> <span className="hidden sm:inline">Zinsbindung endet</span> bald
                        </span>
                      )}
                    </div>
                    {/* IMP-27: Responsive loan details — wrap properly on small screens */}
                    <div className="flex items-center gap-2 sm:gap-4 text-[11px] text-muted-foreground mt-0.5 flex-wrap min-w-0">
                      <span>Restschuld: {formatCurrency(l.remaining_balance)}</span>
                      <span>{l.interest_rate}% Zins · {l.repayment_rate}% Tilgung</span>
                      <span className="hidden sm:inline">{formatCurrency(l.monthly_payment)}/M</span>
                      {l.fixed_interest_until && (
                        <span className="hidden sm:flex items-center gap-0.5">
                          <Calendar className="h-2.5 w-2.5" /> bis {new Date(l.fixed_interest_until).toLocaleDateString("de-DE", { month: "short", year: "numeric" })}
                        </span>
                      )}
                    </div>
                    {/* Improvement 2: Loan payoff progress bar */}
                    {l.loan_amount > 0 && (
                      <div className="mt-1.5">
                        <div className="flex items-center justify-between text-[10px] text-muted-foreground mb-0.5">
                          {/* STRONG-6: NaN guard on progress bar percentage — prevents NaN display when loan_amount is 0 */}
          <span>Tilgung: {(l.loan_amount > 0 ? ((1 - l.remaining_balance / l.loan_amount) * 100) : 0).toFixed(0)}%</span>
                          <span>{formatCurrency(l.loan_amount - l.remaining_balance)} von {formatCurrency(l.loan_amount)}</span>
                        </div>
                        {/* UI-14: progress-smooth */}
                        <div className="h-1.5 bg-secondary rounded-full overflow-hidden">
                          <div className="h-full bg-primary rounded-full progress-smooth" style={{ width: `${Math.max(1, l.loan_amount > 0 ? (1 - l.remaining_balance / l.loan_amount) * 100 : 0)}%` }} />
                        </div>
                      </div>
                    )}
                  </div>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <LoanPayoffSimulator remainingBalance={l.remaining_balance} interestRate={l.interest_rate} monthlyPayment={l.monthly_payment} bankName={l.bank_name} />
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(l)} aria-label="Darlehen bearbeiten"><Edit2 className="h-3 w-3" /></Button>
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-loss" onClick={() => setDeleteTargetLoan(l.id)} aria-label="Darlehen löschen"><Trash2 className="h-3 w-3" /></Button>
                </div>
              </div>
            );
            /* MOB-IMPROVE-6: Wrap with swipe-to-delete on mobile */
            return isMobile ? (
              <MobileSwipeToAction
                key={l.id}
                leftActions={[{ id: "edit", label: "Bearbeiten", icon: <Edit2 className="h-4 w-4" />, color: "bg-primary", onAction: () => openEdit(l) }]}
                rightActions={[{ id: "delete", label: "Löschen", icon: <Trash2 className="h-4 w-4" />, color: "bg-destructive", onAction: () => setDeleteTargetLoan(l.id) }]}
              >
                {loanCard}
              </MobileSwipeToAction>
            ) : loanCard;
          })}
        </div>
      )}

      {/* UX: Bestätigung vor Löschen */}
      <AlertDialog open={!!deleteTargetLoan} onOpenChange={(open) => { if (!open) setDeleteTargetLoan(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Darlehen löschen?</AlertDialogTitle>
            <AlertDialogDescription>Das Darlehen wird unwiderruflich entfernt.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => { if (deleteTargetLoan) deleteMutation.mutate(deleteTargetLoan); }}
            >
              Löschen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default Loans;
