/**
 * #10: Dashboard-Presets — Save/load different dashboard layouts
 */
import { useState, useCallback } from "react";
import { LayoutGrid, Save, Trash2, Check, Plus } from "lucide-react";
import { toast } from "sonner";

interface DashboardPreset {
  id: string;
  name: string;
  widgetOrder: string[];
  chartOrder: string[];
  chartsCollapsed: boolean;
  widgetsCollapsed: boolean;
  createdAt: string;
}

const PRESETS_KEY = "immo-dashboard-presets";

function loadPresets(): DashboardPreset[] {
  try {
    const stored = localStorage.getItem(PRESETS_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch { return []; }
}

function savePresets(presets: DashboardPreset[]) {
  localStorage.setItem(PRESETS_KEY, JSON.stringify(presets));
}

interface DashboardPresetsProps {
  currentWidgetOrder: string[];
  currentChartOrder: string[];
  chartsCollapsed: boolean;
  widgetsCollapsed: boolean;
  onApply: (preset: { widgetOrder: string[]; chartOrder: string[]; chartsCollapsed: boolean; widgetsCollapsed: boolean }) => void;
}

export function DashboardPresets({ currentWidgetOrder, currentChartOrder, chartsCollapsed, widgetsCollapsed, onApply }: DashboardPresetsProps) {
  const [presets, setPresets] = useState<DashboardPreset[]>(loadPresets);
  const [showSave, setShowSave] = useState(false);
  const [newName, setNewName] = useState("");
  const [activePreset, setActivePreset] = useState<string | null>(null);

  const handleSave = useCallback(() => {
    if (!newName.trim()) return;
    const preset: DashboardPreset = {
      id: `preset_${Date.now()}`,
      name: newName.trim(),
      widgetOrder: currentWidgetOrder,
      chartOrder: currentChartOrder,
      chartsCollapsed,
      widgetsCollapsed,
      createdAt: new Date().toISOString(),
    };
    const next = [...presets, preset];
    setPresets(next);
    savePresets(next);
    setNewName("");
    setShowSave(false);
    toast.success(`Preset "${preset.name}" gespeichert`);
  }, [newName, currentWidgetOrder, currentChartOrder, chartsCollapsed, widgetsCollapsed, presets]);

  const handleApply = useCallback((preset: DashboardPreset) => {
    onApply({
      widgetOrder: preset.widgetOrder,
      chartOrder: preset.chartOrder,
      chartsCollapsed: preset.chartsCollapsed,
      widgetsCollapsed: preset.widgetsCollapsed,
    });
    setActivePreset(preset.id);
    toast.success(`Preset "${preset.name}" angewendet`);
  }, [onApply]);

  const handleDelete = useCallback((id: string) => {
    const next = presets.filter(p => p.id !== id);
    setPresets(next);
    savePresets(next);
    if (activePreset === id) setActivePreset(null);
    toast.success("Preset gelöscht");
  }, [presets, activePreset]);

  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      {presets.map(p => (
        <div key={p.id} className="group flex items-center gap-1">
          <button
            onClick={() => handleApply(p)}
            className={`flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg border transition-colors ${
              activePreset === p.id
                ? "bg-primary/10 border-primary/30 text-primary font-medium"
                : "bg-secondary/50 border-border hover:bg-secondary"
            }`}
          >
            {activePreset === p.id && <Check className="h-3 w-3" />}
            <LayoutGrid className="h-3 w-3" />
            {p.name}
          </button>
          <button
            onClick={() => handleDelete(p.id)}
            className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-secondary transition-opacity"
            aria-label="Löschen"
          >
            <Trash2 className="h-3 w-3 text-muted-foreground" />
          </button>
        </div>
      ))}

      {showSave ? (
        <div className="flex items-center gap-1">
          <input
            type="text"
            value={newName}
            onChange={e => setNewName(e.target.value)}
            onKeyDown={e => e.key === "Enter" && handleSave()}
            placeholder="Preset-Name..."
            className="text-xs px-2 py-1.5 rounded border border-border bg-background w-32 focus:outline-none focus:ring-1 focus:ring-primary"
            autoFocus
          />
          <button onClick={handleSave} className="p-1.5 rounded bg-primary text-primary-foreground hover:bg-primary/90">
            <Save className="h-3 w-3" />
          </button>
          <button onClick={() => { setShowSave(false); setNewName(""); }} className="p-1.5 rounded hover:bg-secondary">
            <span className="text-xs text-muted-foreground">Abbrechen</span>
          </button>
        </div>
      ) : (
        <button
          onClick={() => setShowSave(true)}
          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground px-2 py-1.5 rounded-lg border border-dashed border-border hover:border-primary/30 transition-colors"
        >
          <Plus className="h-3 w-3" />
          Layout speichern
        </button>
      )}
    </div>
  );
}

export default DashboardPresets;
