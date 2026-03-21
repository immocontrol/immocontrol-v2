import { type AnalysisInputState, BUNDESLAENDER_GRUNDERWERBSTEUER } from "@/hooks/useAnalysisCalculations";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface Props {
  inputs: AnalysisInputState;
  updateInput: <K extends keyof AnalysisInputState>(key: K, value: AnalysisInputState[K]) => void;
}

const InputField = ({ label, value, onChange, suffix, min, max, step }: {
  label: string; value: number; onChange: (v: number) => void;
  suffix?: string; min?: number; max?: number; step?: number;
}) => (
  <div>
    <label className="text-xs text-muted-foreground block mb-1.5">{label}</label>
    <div className="flex items-center gap-3">
      <Slider
        min={min ?? 0}
        max={max ?? 2000000}
        step={step ?? 1000}
        value={[value]}
        onValueChange={([v]) => onChange(v)}
        className="flex-1"
      />
      <div className="flex items-center bg-secondary rounded-lg px-3 py-1.5 min-w-[100px]">
        <input
          type="number"
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          className="bg-transparent text-sm font-medium w-full outline-none text-foreground"
          step={step ?? 1000}
        />
        {suffix && <span className="text-xs text-muted-foreground ml-1">{suffix}</span>}
      </div>
    </div>
  </div>
);

const AnalysisInputs = ({ inputs, updateInput }: Props) => {
  return (
    <div className="space-y-5">
      <div className="gradient-card rounded-xl border border-border p-5 space-y-4 animate-fade-in">
        <h2 className="text-sm font-semibold">Kaufdaten</h2>
        <InputField label="Kaufpreis" value={inputs.kaufpreis} onChange={(v) => updateInput("kaufpreis", v)} suffix="€" max={5000000} step={5000} />
        <div>
          <label className="text-xs text-muted-foreground block mb-1.5">Bundesland</label>
          <Select value={inputs.bundesland} onValueChange={(v) => updateInput("bundesland", v)}>
            <SelectTrigger className="w-full h-10 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.keys(BUNDESLAENDER_GRUNDERWERBSTEUER).map((bl) => (
                <SelectItem key={bl} value={bl}>
                  {bl} ({BUNDESLAENDER_GRUNDERWERBSTEUER[bl]}%)
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <InputField label="Makler-Provision" value={inputs.maklerProvision} onChange={(v) => updateInput("maklerProvision", v)} suffix="%" min={0} max={7} step={0.01} />
        <InputField label="Notar & Grundbuch" value={inputs.notarKosten} onChange={(v) => updateInput("notarKosten", v)} suffix="%" min={0.5} max={3} step={0.1} />
        <InputField label="Wohnfläche" value={inputs.quadratmeter} onChange={(v) => updateInput("quadratmeter", v)} suffix="m²" min={10} max={1000} step={5} />
      </div>

      <div className="gradient-card rounded-xl border border-border p-5 space-y-4 animate-fade-in [animation-delay:100ms]">
        <h2 className="text-sm font-semibold">Mieteinnahmen & Kosten</h2>
        <InputField label="Monatliche Miete (Kalt)" value={inputs.monatlicheMiete} onChange={(v) => updateInput("monatlicheMiete", v)} suffix="€" max={20000} step={50} />
        <InputField label="Bewirtschaftungskosten / M" value={inputs.bewirtschaftungskosten} onChange={(v) => updateInput("bewirtschaftungskosten", v)} suffix="€" max={5000} step={25} />
      </div>

      <div className="gradient-card rounded-xl border border-border p-5 space-y-4 animate-fade-in [animation-delay:200ms]">
        <h2 className="text-sm font-semibold">Finanzierung</h2>
        <InputField label="Eigenkapital" value={inputs.eigenkapital} onChange={(v) => updateInput("eigenkapital", v)} suffix="€" max={inputs.kaufpreis} step={5000} />
        <InputField label="Zinssatz" value={inputs.zinssatz} onChange={(v) => updateInput("zinssatz", v)} suffix="%" min={0.5} max={8} step={0.1} />
        <InputField label="Tilgung" value={inputs.tilgung} onChange={(v) => updateInput("tilgung", v)} suffix="%" min={0.5} max={5} step={0.1} />
      </div>

      <div className="gradient-card rounded-xl border border-border p-5 space-y-4 animate-fade-in [animation-delay:300ms]">
        <h2 className="text-sm font-semibold">Steuerliche Parameter</h2>
        <InputField label="AfA-Dauer (Jahre)" value={inputs.afaDauer} onChange={(v) => updateInput("afaDauer", v)} suffix="J." min={33} max={50} step={1} />
        <InputField label="Persönlicher Steuersatz" value={inputs.persSteuersatz} onChange={(v) => updateInput("persSteuersatz", v)} suffix="%" min={0} max={45} step={1} />
      </div>
    </div>
  );
};

export default AnalysisInputs;
