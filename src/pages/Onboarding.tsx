import { useState, useCallback, useEffect } from "react";
import { Building2, User, Briefcase, ChevronRight, ChevronLeft, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const INVESTOR_TYPES = [
  { value: "beginner", label: "Einsteiger", description: "Ich plane mein erstes Investment", icon: "🌱" },
  { value: "experienced", label: "Erfahren", description: "Ich besitze bereits 1–5 Objekte", icon: "📈" },
  { value: "professional", label: "Profi", description: "6+ Objekte, Vollzeit-Investor", icon: "🏢" },
];

const STRATEGIES = [
  { value: "buy_and_hold", label: "Buy & Hold", description: "Langfristiger Vermögensaufbau" },
  { value: "fix_and_flip", label: "Fix & Flip", description: "Kaufen, sanieren, verkaufen" },
  { value: "cashflow", label: "Cashflow", description: "Maximaler monatlicher Ertrag" },
  { value: "mixed", label: "Gemischt", description: "Kombination mehrerer Strategien" },
];

const Onboarding = () => {
  const [step, setStep] = useState(0);
  const [displayName, setDisplayName] = useState("");
  const [investorType, setInvestorType] = useState("");
  const [strategy, setStrategy] = useState("");
  const [saving, setSaving] = useState(false);
  const [focusedIndex, setFocusedIndex] = useState(-1);
  const { user } = useAuth();

  const totalSteps = 3;

  const nextStep = useCallback(() => {
    if (step < totalSteps - 1) {
      setStep(step + 1);
      setFocusedIndex(-1);
    }
  }, [step]);

  const prevStep = useCallback(() => {
    if (step > 0) {
      setStep(step - 1);
      setFocusedIndex(-1);
    }
  }, [step]);

  const handleComplete = useCallback(async () => {
    if (!user || saving) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({
          display_name: displayName || undefined,
          investor_type: investorType || undefined,
          strategy: strategy || undefined,
          onboarding_completed: true,
        } as any)
        .eq("user_id", user.id);

      if (error) throw error;
      toast.success("Willkommen bei ImmoControl! 🏠");
      // Full reload to reset RoleRouter state
      window.location.href = "/";
    } catch (error: any) {
      toast.error("Fehler beim Speichern: " + error.message);
      setSaving(false);
    }
  }, [user, saving, displayName, investorType, strategy]);

  const handleSkip = useCallback(async () => {
    if (!user) return;
    setSaving(true);
    try {
      await supabase
        .from("profiles")
        .update({ onboarding_completed: true } as any)
        .eq("user_id", user.id);
    } catch {
      // ignore
    }
    window.location.href = "/";
  }, [user]);

  // Current options list for keyboard nav
  const currentOptions = step === 1 ? INVESTOR_TYPES : step === 2 ? STRATEGIES : [];
  const currentValue = step === 1 ? investorType : strategy;
  const setCurrentValue = step === 1 ? setInvestorType : setStrategy;

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Enter") {
        e.preventDefault();
        if (step < totalSteps - 1) {
          nextStep();
        } else {
          handleComplete();
        }
        return;
      }

      if (currentOptions.length === 0) return;

      if (e.key === "ArrowDown" || e.key === "ArrowRight") {
        e.preventDefault();
        const next = focusedIndex < currentOptions.length - 1 ? focusedIndex + 1 : 0;
        setFocusedIndex(next);
        setCurrentValue(currentOptions[next].value);
      } else if (e.key === "ArrowUp" || e.key === "ArrowLeft") {
        e.preventDefault();
        const prev = focusedIndex > 0 ? focusedIndex - 1 : currentOptions.length - 1;
        setFocusedIndex(prev);
        setCurrentValue(currentOptions[prev].value);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [step, focusedIndex, currentOptions, setCurrentValue, nextStep, handleComplete]);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-6 animate-fade-in">
        {/* Header */}
        <div className="text-center space-y-2">
          <div className="flex items-center justify-center gap-2">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <Building2 className="h-6 w-6 text-primary" />
            </div>
            <span className="text-2xl font-bold tracking-tight">ImmoControl</span>
          </div>
          <p className="text-sm text-muted-foreground">
            Richte dein Profil ein – dauert nur 30 Sekunden
          </p>
        </div>

        {/* Progress */}
        <div className="flex gap-1">
          {Array.from({ length: totalSteps }).map((_, i) => (
            <div
              key={i}
              className={`h-1 flex-1 rounded-full transition-colors ${
                i <= step ? "bg-primary" : "bg-secondary"
              }`}
            />
          ))}
        </div>

        {/* Step Content */}
        <div className="gradient-card rounded-xl border border-border p-6 space-y-5">
          {step === 0 && (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <User className="h-5 w-5 text-primary" />
                <h2 className="text-lg font-semibold">Wie heißt du?</h2>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="name" className="text-xs text-muted-foreground">Anzeigename</Label>
                <Input
                  id="name"
                  placeholder="Max Mustermann"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className="h-10"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      nextStep();
                    }
                  }}
                />
              </div>
            </div>
          )}

          {step === 1 && (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Briefcase className="h-5 w-5 text-primary" />
                <h2 className="text-lg font-semibold">Dein Investoren-Typ</h2>
              </div>
              <div className="space-y-2" role="listbox">
                {INVESTOR_TYPES.map((type, i) => (
                  <button
                    key={type.value}
                    onClick={(e) => { e.stopPropagation(); setInvestorType(type.value); setFocusedIndex(i); }}
                    className={`w-full text-left p-3 rounded-lg border transition-colors ${
                      investorType === type.value
                        ? "border-primary bg-primary/5"
                        : "border-border hover:border-primary/40"
                    } ${focusedIndex === i ? "ring-2 ring-primary/50" : ""}`}
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-xl">{type.icon}</span>
                      <div>
                        <p className="text-sm font-medium">{type.label}</p>
                        <p className="text-[11px] text-muted-foreground">{type.description}</p>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-primary" />
                <h2 className="text-lg font-semibold">Deine Strategie</h2>
              </div>
              <div className="grid grid-cols-2 gap-2" role="listbox">
                {STRATEGIES.map((s, i) => (
                  <button
                    key={s.value}
                    onClick={(e) => { e.stopPropagation(); setStrategy(s.value); setFocusedIndex(i); }}
                    className={`text-left p-3 rounded-lg border transition-colors ${
                      strategy === s.value
                        ? "border-primary bg-primary/5"
                        : "border-border hover:border-primary/40"
                    } ${focusedIndex === i ? "ring-2 ring-primary/50" : ""}`}
                  >
                    <p className="text-sm font-medium">{s.label}</p>
                    <p className="text-[10px] text-muted-foreground">{s.description}</p>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Navigation */}
          <div className="flex items-center justify-between pt-2">
            {step > 0 ? (
              <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); prevStep(); }}>
                <ChevronLeft className="h-4 w-4 mr-1" /> Zurück
              </Button>
            ) : (
              <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); handleSkip(); }} className="text-muted-foreground">
                Überspringen
              </Button>
            )}

            {step < totalSteps - 1 ? (
              <Button size="sm" onClick={(e) => { e.stopPropagation(); nextStep(); }}>
                Weiter <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            ) : (
              <Button
                size="sm"
                onClick={(e) => { e.stopPropagation(); handleComplete(); }}
                disabled={saving}
              >
                {saving ? "Speichern..." : "Loslegen 🚀"}
              </Button>
            )}
          </div>

          <p className="text-center text-[10px] text-muted-foreground">
            Enter ↵ zum Weiter · Pfeiltasten ↑↓ zum Auswählen
          </p>
        </div>

        <p className="text-center text-[10px] text-muted-foreground">
          Du kannst alle Angaben jederzeit in den Einstellungen ändern.
        </p>
      </div>
    </div>
  );
};

export default Onboarding;
