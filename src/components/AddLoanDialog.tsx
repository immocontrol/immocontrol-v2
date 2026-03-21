import { useState, useCallback, useEffect, useRef } from "react";
import { Plus, ChevronRight, ChevronLeft, Landmark, Search, Trash2, Sparkles, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NumberInput } from "@/components/NumberInput";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { toastSuccess, toastError } from "@/lib/toastMessages";
import { cn } from "@/lib/utils";
import { handleError } from "@/lib/handleError";
import { toastErrorWithRetry } from "@/lib/toastMessages";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useProperties } from "@/context/PropertyContext";
import { useAccessibility } from "@/components/AccessibilityProvider";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/queryKeys";
import { GERMAN_BANKS } from "@/data/germanBanks";
import { StepIndicator } from "@/components/StepIndicator";
import { useFocusFirstInput } from "@/hooks/useFocusFirstInput";
import { useKeyboardAwareScroll } from "@/components/mobile/MobileKeyboardAwareScroll";
import { useIsMobile } from "@/hooks/use-mobile";
import { isDeepSeekConfigured, improveText } from "@/integrations/ai/extractors";

const LOAN_TYPE_LABELS: Record<string, string> = {
  annuity: "Annuitätendarlehen",
  bullet: "Endfälliges Darlehen",
  variable: "Variables Darlehen",
  kfw: "KfW-Darlehen",
};

const STEP_LABELS = ["Objekt & Bank", "Konditionen", "Details"];

interface AddLoanDialogProps {
  onCreated?: () => void;
}

const AddLoanDialog = ({ onCreated }: AddLoanDialogProps) => {
  const { user } = useAuth();
  const { announce } = useAccessibility();
  const { properties } = useProperties();
  const qc = useQueryClient();
  const contentRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [showCloseConfirm, setShowCloseConfirm] = useState(false);
  const isMobile = useIsMobile();
  useKeyboardAwareScroll({ enabled: isMobile && open, offset: 80 });
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [aiNotesLoading, setAiNotesLoading] = useState(false);

  const [form, setForm] = useState({
    property_id: "", bank_name: "", loan_type: "annuity",
    loan_amount: 0, remaining_balance: 0, interest_rate: 0,
    repayment_rate: 0, monthly_payment: 0, tilgungsfreie_monate: 0,
    fixed_interest_until: "", start_date: "", end_date: "", notes: "",
  });

  const [bankSearch, setBankSearch] = useState("");
  const [bankPopoverOpen, setBankPopoverOpen] = useState(false);
  const [addingNewBank, setAddingNewBank] = useState(false);
  const [newBankName, setNewBankName] = useState("");
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [highlightFields, setHighlightFields] = useState<string[]>([]);

  const { data: userBanks = [] } = useQuery({
    queryKey: ["user_banks"],
    queryFn: async () => {
      const { data } = await supabase.from("user_banks").select("*").order("name");
      return (data || []) as { id: string; name: string }[];
    },
    enabled: !!user,
  });

  const allBanks = [...new Set([...GERMAN_BANKS, ...userBanks.map(b => b.name)])].sort((a, b) => a.localeCompare(b, "de"));
  const filteredBanks = bankSearch.trim() ? allBanks.filter(b => b.toLowerCase().includes(bankSearch.toLowerCase())) : allBanks;
  const isCustomBank = (name: string) => userBanks.some(b => b.name === name);

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
    let balance = form.loan_amount * Math.pow(1 + monthlyRate, gracePeriod);
    let months = gracePeriod;
    while (balance > 0 && months < 600) {
      balance = balance + balance * monthlyRate - annuity;
      months++;
    }
    if (months < 600) {
      const startDate = new Date(form.start_date);
      startDate.setMonth(startDate.getMonth() + months);
      setForm(prev => ({
        ...prev,
        end_date: prev.end_date || startDate.toISOString().split("T")[0],
        remaining_balance: prev.remaining_balance === 0 ? Math.max(0, Math.round(balance * 100) / 100) : prev.remaining_balance,
      }));
    }
  }, [form.start_date, form.loan_amount, form.interest_rate, form.repayment_rate, form.tilgungsfreie_monate]);

  const resetForm = useCallback(() => {
    setForm({ property_id: "", bank_name: "", loan_type: "annuity", loan_amount: 0, remaining_balance: 0, interest_rate: 0, repayment_rate: 0, monthly_payment: 0, tilgungsfreie_monate: 0, fixed_interest_until: "", start_date: "", end_date: "", notes: "" });
    setBankSearch("");
    setAddingNewBank(false);
    setNewBankName("");
    setStep(0);
    setValidationErrors([]);
    setHighlightFields([]);
  }, []);

  const isFormDirty =
    !!form.property_id || !!form.bank_name || form.loan_amount > 0 || !!form.notes?.trim() ||
    !!form.start_date || !!form.end_date || !!form.fixed_interest_until || form.tilgungsfreie_monate > 0 ||
    form.remaining_balance > 0 || form.interest_rate > 0 || form.repayment_rate > 0 || form.monthly_payment > 0;

  const handleOpenChange = useCallback((v: boolean) => {
    if (v) {
      setOpen(true);
      setShowCloseConfirm(false);
    } else if (isFormDirty) {
      setShowCloseConfirm(true);
    } else {
      setOpen(false);
      resetForm();
    }
  }, [resetForm, isFormDirty]);

  const handleConfirmClose = useCallback(() => {
    setOpen(false);
    resetForm();
    setShowCloseConfirm(false);
  }, [resetForm]);

  useFocusFirstInput(open, contentRef);

  const canGoNext = step === 0
    ? !!form.property_id && !!form.bank_name
    : step === 1
    ? form.loan_amount > 0 && form.interest_rate > 0
    : true;

  const addCustomBank = async () => {
    if (!user || !newBankName.trim()) return;
    const { error } = await supabase.from("user_banks").insert({ user_id: user.id, name: newBankName.trim() });
    if (error && error.code !== "23505") { toastError("Fehler beim Hinzufügen"); return; }
    const name = newBankName.trim();
    setForm(f => ({ ...f, bank_name: name }));
    setBankSearch(name);
    setNewBankName("");
    setAddingNewBank(false);
    setBankPopoverOpen(false);
    await qc.invalidateQueries({ queryKey: ["user_banks"] });
    toastSuccess(`"${name}" hinzugefügt`);
  };

  const deleteCustomBank = async (bankName: string) => {
    const bank = userBanks.find(b => b.name === bankName);
    if (!bank) return;
    await supabase.from("user_banks").delete().eq("id", bank.id);
    if (form.bank_name === bankName) { setForm(f => ({ ...f, bank_name: "" })); setBankSearch(""); }
    qc.invalidateQueries({ queryKey: ["user_banks"] });
    toastSuccess(`"${bankName}" gelöscht`);
  };

  const handleSave = async () => {
    if (!user) return;
    /* Validate required fields and show specific error messages */
    const errors: string[] = [];
    const fields: string[] = [];
    if (!form.property_id) { errors.push("Objekt muss ausgew\u00e4hlt werden"); fields.push("property_id"); }
    if (!form.bank_name) { errors.push("Bank muss ausgew\u00e4hlt werden"); fields.push("bank_name"); }
    if (form.loan_amount <= 0) { errors.push("Darlehensbetrag muss gr\u00f6\u00dfer als 0 sein"); fields.push("loan_amount"); }
    if (form.interest_rate <= 0) { errors.push("Zinssatz muss angegeben werden"); fields.push("interest_rate"); }
    if (errors.length > 0) {
      setValidationErrors(errors);
      setHighlightFields(fields);
      toastError(errors[0]);
      /* Auto-clear highlight after flash animation */
      setTimeout(() => setHighlightFields([]), 2000);
      /* Navigate to the step containing the first missing field */
      if (fields.includes("property_id") || fields.includes("bank_name")) setStep(0);
      else if (fields.includes("loan_amount") || fields.includes("interest_rate")) setStep(1);
      return;
    }
    setValidationErrors([]);
    setHighlightFields([]);
    setSaving(true);
    try {
      const payload: Record<string, unknown> = {
        user_id: user.id,
        property_id: form.property_id,
        bank_name: form.bank_name,
        loan_type: form.loan_type,
        loan_amount: form.loan_amount,
        remaining_balance: form.remaining_balance,
        interest_rate: form.interest_rate,
        repayment_rate: form.repayment_rate,
        monthly_payment: form.monthly_payment,
        tilgungsfreie_monate: form.tilgungsfreie_monate,
        fixed_interest_until: form.fixed_interest_until || null,
        start_date: form.start_date || null,
        end_date: form.end_date || null,
        notes: form.notes || null,
      };
      /* Fix 11: Retry without tilgungsfreie_monate if column doesn't exist in schema */
      let { error } = await supabase.from("loans").insert(payload);
      if (error?.message?.includes("tilgungsfreie_monate")) {
        delete payload.tilgungsfreie_monate;
        const retry = await supabase.from("loans").insert(payload);
        error = retry.error;
      }
      if (error) {
        handleError(error, { context: "supabase", showToast: false });
        toastErrorWithRetry(`Fehler beim Speichern: ${error.message || "Unbekannter Fehler"}`, handleSave);
        return;
      }
      toastSuccess("Darlehen angelegt");
      announce("Darlehen wurde angelegt.", "polite");
      handleOpenChange(false);
      qc.invalidateQueries({ queryKey: queryKeys.loans.all });
      onCreated?.();
    } catch (e: unknown) {
      handleError(e, { context: "supabase", showToast: false });
      toastErrorWithRetry(e instanceof Error ? `Fehler beim Anlegen: ${e.message}` : "Fehler beim Anlegen", handleSave);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <Tooltip>
        <TooltipTrigger asChild>
          <DialogTrigger asChild>
            <Button size="sm" className="gap-1.5">
              <Plus className="h-3.5 w-3.5" /> Darlehen
            </Button>
          </DialogTrigger>
        </TooltipTrigger>
        <TooltipContent>Neues Darlehen anlegen</TooltipContent>
      </Tooltip>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Landmark className="h-5 w-5 text-primary" /> Neues Darlehen anlegen
          </DialogTitle>
          <p className="text-xs text-muted-foreground">Schritt {step + 1} von 3 — {STEP_LABELS[step]}</p>
        </DialogHeader>

        <StepIndicator current={step} total={3} />

        {validationErrors.length > 0 && (
          <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-xs">
            <p className="font-medium text-destructive">Bitte prüfen:</p>
            <ul className="mt-1 list-disc pl-4 text-destructive/90 space-y-0.5">
              {validationErrors.map((err) => (
                <li key={err}>{err}</li>
              ))}
            </ul>
          </div>
        )}

        <div ref={contentRef} className="space-y-4 min-h-[260px]">
          {step === 0 && (
            <div className="space-y-3">
              <div className="space-y-1">
                <Label className={`text-xs ${highlightFields.includes("property_id") ? "text-destructive font-semibold" : ""}`}>Objekt *</Label>
                <Select value={form.property_id} onValueChange={v => setForm(f => ({ ...f, property_id: v }))}>
                  <SelectTrigger className={`h-9 text-sm ${highlightFields.includes("property_id") ? "ring-2 ring-destructive animate-pulse" : ""}`}><SelectValue placeholder="Objekt wählen" /></SelectTrigger>
                  <SelectContent>
                    {properties.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className={`text-xs ${highlightFields.includes("bank_name") ? "text-destructive font-semibold" : ""}`}>Bank *</Label>
                <Popover open={bankPopoverOpen} onOpenChange={setBankPopoverOpen}>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className={`h-9 w-full justify-between text-sm font-normal ${highlightFields.includes("bank_name") ? "ring-2 ring-destructive animate-pulse" : ""}`}>
                      {form.bank_name || "Bank wählen…"}
                      <Search className="ml-2 h-3 w-3 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[300px] p-0" align="start">
                    <div className="p-2 border-b">
                      <Input placeholder="z. B. Sparkasse oder Volksbank" value={bankSearch} onChange={e => setBankSearch(e.target.value)} className="h-8 text-sm" autoFocus />
                    </div>
                    <ScrollArea className="max-h-[200px]">
                      <div className="p-1">
                        {filteredBanks.map(bank => (
                          <div key={bank} className="flex items-center group/bank">
                            <button
                              className={cn("flex-1 text-left px-3 py-1.5 text-sm rounded hover:bg-secondary transition-colors", form.bank_name === bank && "bg-primary/10 text-primary font-medium")}
                              onClick={() => { setForm(f => ({ ...f, bank_name: bank })); setBankSearch(bank); setBankPopoverOpen(false); }}
                            >
                              {bank}
                            </button>
                            {isCustomBank(bank) && (
                              <button className="opacity-0 group-hover/bank:opacity-100 p-1 mr-1 text-muted-foreground hover:text-destructive transition-all" onClick={e => { e.stopPropagation(); deleteCustomBank(bank); }}>
                                <Trash2 className="h-3 w-3" />
                              </button>
                            )}
                          </div>
                        ))}
                        {filteredBanks.length === 0 && <p className="text-xs text-muted-foreground px-3 py-2">Nicht gefunden</p>}
                      </div>
                    </ScrollArea>
                    <div className="border-t p-2">
                      {!addingNewBank ? (
                        <button className="w-full text-left px-3 py-1.5 text-sm text-primary hover:bg-primary/5 rounded flex items-center gap-1.5" onClick={() => { setAddingNewBank(true); setNewBankName(bankSearch); }}>
                          <Plus className="h-3 w-3" /> Neue Bank hinzufügen
                        </button>
                      ) : (
                        <div className="flex gap-1.5">
                          <Input placeholder="Bankname" value={newBankName} onChange={e => setNewBankName(e.target.value)} className="h-8 text-sm flex-1" autoFocus onKeyDown={e => e.key === "Enter" && addCustomBank()} />
                          <Button size="sm" className="h-8" onClick={addCustomBank} disabled={!newBankName.trim()}>OK</Button>
                        </div>
                      )}
                    </div>
                  </PopoverContent>
                </Popover>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Darlehensart</Label>
                <Select value={form.loan_type} onValueChange={v => setForm(f => ({ ...f, loan_type: v }))}>
                  <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(LOAN_TYPE_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          {step === 1 && (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className={`text-xs ${highlightFields.includes("loan_amount") ? "text-destructive font-semibold" : ""}`}>Darlehensbetrag *</Label>
                <NumberInput value={form.loan_amount} onChange={v => setForm(f => ({ ...f, loan_amount: v }))} className={`h-9 text-sm ${highlightFields.includes("loan_amount") ? "ring-2 ring-destructive animate-pulse" : ""}`} placeholder="0" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Restschuld</Label>
                <NumberInput value={form.remaining_balance} onChange={v => setForm(f => ({ ...f, remaining_balance: v }))} className="h-9 text-sm" placeholder="0" />
              </div>
              <div className="space-y-1">
                <Label className={`text-xs ${highlightFields.includes("interest_rate") ? "text-destructive font-semibold" : ""}`}>Zinssatz % *</Label>
                <NumberInput value={form.interest_rate} onChange={v => setForm(f => ({ ...f, interest_rate: v }))} decimals className={`h-9 text-sm ${highlightFields.includes("interest_rate") ? "ring-2 ring-destructive animate-pulse" : ""}`} placeholder="0,00" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Tilgung %</Label>
                <NumberInput value={form.repayment_rate} onChange={v => setForm(f => ({ ...f, repayment_rate: v }))} decimals className="h-9 text-sm" placeholder="0,00" />
              </div>
              <p className="text-[10px] text-muted-foreground -mt-0.5">Zins + Tilgung in % p.a. – die monatliche Rate wird daraus berechnet.</p>
              <div className="space-y-1">
                <Label className="text-xs">Rate/Monat (berechnet)</Label>
                <NumberInput value={form.monthly_payment} onChange={v => setForm(f => ({ ...f, monthly_payment: v }))} decimals className="h-9 text-sm bg-secondary/50" placeholder="0,00" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Tilgungsfreie Monate</Label>
                <NumberInput value={form.tilgungsfreie_monate} onChange={v => setForm(f => ({ ...f, tilgungsfreie_monate: v }))} className="h-9 text-sm" placeholder="0" />
              </div>
              <p className="text-[10px] text-muted-foreground -mt-0.5">Tilgungsfreie Monate: Anzahl Monate ohne Tilgung (z. B. bei Anschlussfinanzierung).</p>
            </div>
          )}

          {step === 2 && (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Zinsbindung bis</Label>
                <Input type="date" value={form.fixed_interest_until} onChange={e => setForm(f => ({ ...f, fixed_interest_until: e.target.value }))} className="h-9 text-sm" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Startdatum</Label>
                <Input type="date" value={form.start_date} onChange={e => setForm(f => ({ ...f, start_date: e.target.value, end_date: "", remaining_balance: 0 }))} className="h-9 text-sm" />
              </div>
              <div className="space-y-1 col-span-2">
                <Label className="text-xs flex items-center gap-1">
                  Enddatum
                  {form.start_date && form.loan_amount > 0 && form.repayment_rate > 0 && (
                    <span className="text-[10px] text-primary font-normal">(auto-berechnet)</span>
                  )}
                </Label>
                <Input type="date" value={form.end_date} onChange={e => setForm(f => ({ ...f, end_date: e.target.value }))} className="h-9 text-sm" />
              </div>
              <div className="col-span-2 space-y-1">
                <div className="flex items-center justify-between gap-2">
                  <Label className="text-xs">Notizen</Label>
                  {isDeepSeekConfigured() && form.notes && form.notes.trim().length >= 10 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-7 gap-1 text-xs"
                      disabled={aiNotesLoading}
                      onClick={async () => {
                        setAiNotesLoading(true);
                        try {
                          const text = await improveText(form.notes || "", "Darlehensnotiz");
                          if (text) setForm(f => ({ ...f, notes: text }));
                        } catch (e) {
                          handleError(e, { context: "ai", details: "improveText", showToast: true });
                        } finally {
                          setAiNotesLoading(false);
                        }
                      }}
                    >
                      {aiNotesLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
                      Verbessern
                    </Button>
                  )}
                </div>
                <Input value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} className="h-9 text-sm" placeholder="Optional" />
              </div>
            </div>
          )}
        </div>

        <div className="flex gap-3 pt-2">
          {step > 0 && (
            <Button type="button" variant="outline" onClick={() => setStep(s => s - 1)} className="gap-1.5 touch-target min-h-[44px]">
              <ChevronLeft className="h-4 w-4" /> Zurück
            </Button>
          )}
          {step < 2 ? (
            <Button type="button" onClick={() => setStep(s => s + 1)} className="flex-1 gap-1.5 touch-target min-h-[44px]" disabled={!canGoNext}>
              Weiter <ChevronRight className="h-4 w-4" />
            </Button>
          ) : (
            <Button onClick={handleSave} className="flex-1 touch-target min-h-[44px]" disabled={saving}>
              {saving ? "Anlegen…" : "Darlehen anlegen"}
            </Button>
          )}
        </div>
      </DialogContent>
      <AlertDialog open={showCloseConfirm} onOpenChange={setShowCloseConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Formular schließen?</AlertDialogTitle>
            <AlertDialogDescription>
              Es sind noch Eingaben im Formular. Beim Schließen gehen diese verloren. Wirklich schließen?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmClose}>Ja, schließen</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Dialog>
  );
};

export default AddLoanDialog;
