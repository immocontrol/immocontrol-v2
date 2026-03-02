/**
 * WIDGET-2: Widget Customizer UI — allows users to show/hide/reorder dashboard widgets
 */

import { useState } from "react";
import { Settings2, Eye, EyeOff, ChevronUp, ChevronDown, RotateCcw, LayoutGrid } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { useWidgetConfig, type WidgetConfig } from "@/hooks/useWidgetConfig";

const CATEGORY_COLORS: Record<string, string> = {
  analyse: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  finanzen: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
  immobilien: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  steuer: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
  sonstiges: "bg-gray-100 text-gray-700 dark:bg-gray-800/30 dark:text-gray-400",
};

interface WidgetCustomizerProps {
  onConfigChange?: () => void;
}

const WidgetCustomizer = ({ onConfigChange }: WidgetCustomizerProps) => {
  const { widgets, visibleWidgets, toggleWidget, moveWidget, resetToDefaults, categories } = useWidgetConfig();
  const [open, setOpen] = useState(false);
  const [filterCategory, setFilterCategory] = useState<string>("alle");

  const filteredWidgets = filterCategory === "alle"
    ? widgets
    : widgets.filter(w => w.category === filterCategory);

  const handleToggle = (id: string) => {
    toggleWidget(id);
    onConfigChange?.();
  };

  const handleMove = (id: string, dir: "up" | "down") => {
    moveWidget(id, dir);
    onConfigChange?.();
  };

  const handleReset = () => {
    resetToDefaults();
    onConfigChange?.();
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5 text-xs h-8">
          <Settings2 className="h-3.5 w-3.5" /> Widgets anpassen
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <LayoutGrid className="h-5 w-5 text-primary" /> Dashboard-Widgets anpassen
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Stats */}
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <Eye className="h-3 w-3" /> {visibleWidgets.length} sichtbar
            </span>
            <span className="flex items-center gap-1">
              <EyeOff className="h-3 w-3" /> {widgets.length - visibleWidgets.length} ausgeblendet
            </span>
          </div>

          {/* Category filter */}
          <div className="flex flex-wrap gap-1.5">
            <button
              onClick={() => setFilterCategory("alle")}
              className={`text-[10px] px-2 py-1 rounded-full transition-colors ${
                filterCategory === "alle" ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground hover:bg-secondary/80"
              }`}
            >
              Alle ({widgets.length})
            </button>
            {[...categories.entries()].map(([key, label]) => {
              const count = widgets.filter(w => w.category === key).length;
              return (
                <button
                  key={key}
                  onClick={() => setFilterCategory(key)}
                  className={`text-[10px] px-2 py-1 rounded-full transition-colors ${
                    filterCategory === key ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground hover:bg-secondary/80"
                  }`}
                >
                  {label} ({count})
                </button>
              );
            })}
          </div>

          {/* Widget list */}
          <div className="space-y-1">
            {filteredWidgets.sort((a, b) => a.order - b.order).map((widget: WidgetConfig) => (
              <div
                key={widget.id}
                className={`flex items-center gap-3 p-2.5 rounded-lg transition-colors ${
                  widget.visible ? "bg-secondary/30" : "bg-secondary/10 opacity-60"
                }`}
              >
                <Switch
                  checked={widget.visible}
                  onCheckedChange={() => handleToggle(widget.id)}
                  className="shrink-0"
                />
                <div className="flex-1 min-w-0">
                  <span className="text-xs font-medium">{widget.label}</span>
                  <Badge variant="outline" className={`ml-2 text-[9px] h-4 ${CATEGORY_COLORS[widget.category] || ""}`}>
                    {categories.get(widget.category) || widget.category}
                  </Badge>
                </div>
                {widget.visible && (
                  <div className="flex gap-0.5 shrink-0">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      onClick={() => handleMove(widget.id, "up")}
                    >
                      <ChevronUp className="h-3 w-3" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      onClick={() => handleMove(widget.id, "down")}
                    >
                      <ChevronDown className="h-3 w-3" />
                    </Button>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Reset button */}
          <Button variant="outline" size="sm" className="w-full text-xs gap-1.5" onClick={handleReset}>
            <RotateCcw className="h-3 w-3" /> Auf Standard zurücksetzen
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default WidgetCustomizer;
