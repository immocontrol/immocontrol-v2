import { useState, useCallback } from "react";
import { Building2, ChevronRight, ChevronLeft, Euro, BarChart3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/hooks/useAuth";
import { useProperties } from "@/context/PropertyContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { toastErrorWithRetry } from "@/lib/toastMessages";
import { handleError } from "@/lib/handleError";
import { PROPERTY_TYPES } from "@/lib/schemas";

const STEP_LABELS = [
  "Übersicht",
  "Objekt & Kauf",
  "Miete & Finanzen",
  "Für Statistiken",
] as const;

const getProgress = (step: number, total: number) => Math.round((step / total) * 100);

const Onboarding = () => {
  const { user } = useAuth();
  const { addProperty } = useProperties();
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);

  /* Schritt 1: Basis */
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [type, setType] = useState<string>("ETW");
  const [purchasePrice, setPurchasePrice] = useState("");
  const [purchaseDate, setPurchaseDate] = useState("");

  /* Schritt 2: Miete & Finanzen */
  const [monthlyRent, setMonthlyRent] = useState("");
  const [monthlyExpenses, setMonthlyExpenses] = useState("");
  const [remainingDebt, setRemainingDebt] = useState("");
  const [monthlyCreditRate, setMonthlyCreditRate] = useState("");

  /* Schritt 3: Für Auswertungen */
  const [sqm, setSqm] = useState("");
  const [yearBuilt, setYearBuilt] = useState("");

  const totalSteps = STEP_LABELS.length;
  const progress = getProgress(step + 1, totalSteps);

  const nextStep = useCallback(() => {
    if (step < totalSteps - 1) setStep(step + 1);
  }, [step, totalSteps]);

  const prevStep = useCallback(() => {
    if (step > 0) setStep(step - 1);
  }, [step]);

  const handleComplete = useCallback(async () => {
    if (!user || saving) return;

    const price = Number(purchasePrice?.replace(/\D/g, "")) || 0;
    const rent = Number(monthlyRent?.replace(/\D/g, "")) || 0;
    const expenses = Number(monthlyExpenses?.replace(/\D/g, "")) || 0;
    const debt = Number(remainingDebt?.replace(/\D/g, "")) || 0;
    const rate = Number(monthlyCreditRate?.replace(/\D/g, "")) || 0;
    const area = Number(sqm?.replace(/\D/g, "")) || 0;
    const year = Number(yearBuilt?.replace(/\D/g, "")) || new Date().getFullYear();

    if (!name.trim()) {
      toast.error("Bitte gib einen Objektnamen an.");
      return;
    }
    if (!address.trim()) {
      toast.error("Bitte gib eine Adresse an.");
      return;
    }
    if (price <= 0) {
      toast.error("Bitte gib den Kaufpreis an.");
      return;
    }

    setSaving(true);
    try {
      const cashflow = rent - expenses - rate;
      const location = address.split(",").map((s) => s.trim()).slice(-2).join(", ") || address;

      await addProperty({
        name: name.trim(),
        address: address.trim(),
        location: location || address.trim(),
        type: type || "ETW",
        units: 1,
        purchasePrice: price,
        purchaseDate: purchaseDate || new Date().toISOString().slice(0, 10),
        currentValue: price,
        monthlyRent: rent,
        monthlyExpenses: expenses,
        monthlyCreditRate: rate,
        monthlyCashflow: cashflow,
        remainingDebt: debt,
        interestRate: 0,
        sqm: area,
        yearBuilt: year,
        ownership: "privat",
      });

      await supabase
        .from("profiles")
        .update({
          display_name: (user.user_metadata?.display_name as string) || undefined,
          onboarding_completed: true,
        } as Record<string, unknown>)
        .eq("user_id", user.id);

      toast.success("Erstes Objekt angelegt – dein Dashboard füllt sich!");
      window.location.href = "/";
    } catch (error: unknown) {
      handleError(error, { context: "supabase", showToast: false });
      const msg = error instanceof Error ? error.message : "Fehler beim Speichern";
      toastErrorWithRetry(msg, () => handleComplete());
      setSaving(false);
    }
  }, [
    user,
    saving,
    name,
    address,
    type,
    purchasePrice,
    purchaseDate,
    monthlyRent,
    monthlyExpenses,
    remainingDebt,
    monthlyCreditRate,
    sqm,
    yearBuilt,
    addProperty,
  ]);

  const handleSkip = useCallback(async () => {
    if (!user) return;
    setSaving(true);
    try {
      await supabase
        .from("profiles")
        .update({ onboarding_completed: true } as Record<string, unknown>)
        .eq("user_id", user.id);
    } catch {
      /* ignore */
    }
    window.location.href = "/";
  }, [user]);

  const canProceedStep1 = name.trim() && address.trim() && (Number(purchasePrice?.replace(/\D/g, "")) || 0) > 0;

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-6 animate-fade-in">
        <div className="text-center space-y-2">
          <div className="flex items-center justify-center gap-2">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <Building2 className="h-6 w-6 text-primary" />
            </div>
            <span className="text-2xl font-bold tracking-tight">ImmoControl</span>
          </div>
          <p className="text-[10px] text-muted-foreground">
            Schritt {step + 1}/{totalSteps}: {STEP_LABELS[step]} · {progress}%
          </p>
        </div>

        <div className="flex gap-1" role="progressbar" aria-valuenow={step + 1} aria-valuemin={1} aria-valuemax={totalSteps} aria-label={`Onboarding: Schritt ${step + 1} von ${totalSteps}`}>
          {STEP_LABELS.map((_, i) => (
            <div
              key={i}
              className={`h-1 flex-1 rounded-full transition-all duration-300 ${i <= step ? "bg-primary" : "bg-secondary"}`}
            />
          ))}
        </div>

        <div className="gradient-card rounded-xl border border-border p-6 space-y-5">
          {/* Step 0: Intro */}
          {step === 0 && (
            <div className="space-y-4">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <Building2 className="h-5 w-5 text-primary" />
                Erstes Objekt anlegen
              </h2>
              <p className="text-sm text-muted-foreground">
                Mit wenigen Angaben füllen sich dein Dashboard, die Statistiken und Grafiken – Kaufpreis, Miete und Fläche werden überall genutzt.
              </p>
              <p className="text-xs text-muted-foreground">
                Du kannst später jederzeit weitere Objekte hinzufügen und alle Daten unter Objekte bearbeiten.
              </p>
            </div>
          )}

          {/* Step 1: Objekt & Kauf */}
          {step === 1 && (
            <div className="space-y-4">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <Building2 className="h-5 w-5 text-primary" />
                Objekt & Kauf
              </h2>
              <div className="space-y-2">
                <Label className="text-xs">Objektname</Label>
                <Input
                  placeholder="z. B. Musterstraße 1"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="h-9 text-sm"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs">Adresse</Label>
                <Input
                  placeholder="Straße, PLZ Ort"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  className="h-9 text-sm"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs">Objekttyp</Label>
                <Select value={type} onValueChange={setType}>
                  <SelectTrigger className="h-9 w-full text-sm" aria-label="Objekttyp">
                    <SelectValue placeholder="Typ wählen" />
                  </SelectTrigger>
                  <SelectContent>
                    {PROPERTY_TYPES.map((t) => (
                      <SelectItem key={t} value={t}>{t}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label className="text-xs">Kaufpreis (€)</Label>
                  <Input
                    type="text"
                    inputMode="numeric"
                    placeholder="250000"
                    value={purchasePrice}
                    onChange={(e) => setPurchasePrice(e.target.value)}
                    className="h-9 text-sm"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs">Kaufdatum</Label>
                  <Input
                    type="date"
                    value={purchaseDate}
                    onChange={(e) => setPurchaseDate(e.target.value)}
                    className="h-9 text-sm"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Step 2: Miete & Finanzen */}
          {step === 2 && (
            <div className="space-y-4">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <Euro className="h-5 w-5 text-primary" />
                Miete & Finanzen
              </h2>
              <p className="text-xs text-muted-foreground">
                Diese Werte steuern Cashflow und Auswertungen. Kein Kredit? Restschuld und Rate auf 0 lassen.
              </p>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label className="text-xs">Kaltmiete/Monat (€)</Label>
                  <Input
                    type="text"
                    inputMode="numeric"
                    placeholder="1200"
                    value={monthlyRent}
                    onChange={(e) => setMonthlyRent(e.target.value)}
                    className="h-9 text-sm"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs">NK/Monat (€)</Label>
                  <Input
                    type="text"
                    inputMode="numeric"
                    placeholder="200"
                    value={monthlyExpenses}
                    onChange={(e) => setMonthlyExpenses(e.target.value)}
                    className="h-9 text-sm"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs">Restschuld (€)</Label>
                  <Input
                    type="text"
                    inputMode="numeric"
                    placeholder="0"
                    value={remainingDebt}
                    onChange={(e) => setRemainingDebt(e.target.value)}
                    className="h-9 text-sm"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs">Kreditrate/Monat (€)</Label>
                  <Input
                    type="text"
                    inputMode="numeric"
                    placeholder="0"
                    value={monthlyCreditRate}
                    onChange={(e) => setMonthlyCreditRate(e.target.value)}
                    className="h-9 text-sm"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Step 3: Für Statistiken */}
          {step === 3 && (
            <div className="space-y-4">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <BarChart3 className="h-5 w-5 text-primary" />
                Für Statistiken & Grafiken
              </h2>
              <p className="text-xs text-muted-foreground">
                Wohnfläche und Baujahr werden in Auswertungen, Mietpreis/m² und Altersstruktur genutzt.
              </p>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label className="text-xs">Wohnfläche (m²)</Label>
                  <Input
                    type="text"
                    inputMode="numeric"
                    placeholder="85"
                    value={sqm}
                    onChange={(e) => setSqm(e.target.value)}
                    className="h-9 text-sm"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs">Baujahr</Label>
                  <Input
                    type="text"
                    inputMode="numeric"
                    placeholder={String(new Date().getFullYear())}
                    value={yearBuilt}
                    onChange={(e) => setYearBuilt(e.target.value)}
                    className="h-9 text-sm"
                  />
                </div>
              </div>
            </div>
          )}

          <div className="flex items-center justify-between pt-2">
            {step === 0 ? (
              <Button variant="ghost" size="sm" onClick={handleSkip} className="text-muted-foreground touch-target min-h-[44px]">
                Überspringen
              </Button>
            ) : (
              <Button variant="ghost" size="sm" onClick={prevStep} className="touch-target min-h-[44px]">
                <ChevronLeft className="h-4 w-4 mr-1" /> Zurück
              </Button>
            )}

            {step < totalSteps - 1 ? (
              <Button
                size="sm"
                onClick={nextStep}
                disabled={step === 1 && !canProceedStep1}
                className="touch-target min-h-[44px]"
              >
                Weiter <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            ) : (
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="sm" onClick={handleSkip} className="text-muted-foreground touch-target min-h-[44px]">
                  Überspringen
                </Button>
                <Button size="sm" onClick={handleComplete} disabled={saving} className="touch-target min-h-[44px]">
                  {saving ? "Speichern…" : "Objekt anlegen & loslegen"}
                </Button>
              </div>
            )}
          </div>
        </div>

        <p className="text-center text-[10px] text-muted-foreground">
          Alle Angaben kannst du später unter Objekte anpassen.
        </p>
      </div>
    </div>
  );
};

export default Onboarding;
