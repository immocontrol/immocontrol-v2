/**
 * DRAGDROP-1: Drag & Drop Dashboard
 * 
 * Features:
 * - Free widget arrangement and resizing
 * - Save multiple dashboard layouts
 * - Widget gallery for adding/removing widgets
 * - Drag handle for reordering
 * - Responsive grid layout
 */

import { useState, useCallback, useRef, useMemo, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  GripVertical, Plus, Save, Trash2, LayoutGrid, RotateCcw,
  ChevronUp, ChevronDown, Eye, EyeOff, Maximize2, Minimize2,
  Copy, Download
} from "lucide-react";
import { toast } from "sonner";

/** DRAGDROP-2: Widget definition */
export interface DashboardWidget {
  id: string;
  label: string;
  category: string;
  visible: boolean;
  order: number;
  size: "small" | "medium" | "large" | "full";
  component: React.ReactNode;
}

/** DRAGDROP-3: Layout persistence */
interface SavedLayout {
  name: string;
  widgets: Array<{ id: string; visible: boolean; order: number; size: string }>;
  savedAt: string;
}

const LAYOUTS_KEY = "immo-dashboard-layouts";
const ACTIVE_LAYOUT_KEY = "immo-dashboard-active-layout";

function loadLayouts(): SavedLayout[] {
  try {
    const stored = localStorage.getItem(LAYOUTS_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch { return []; }
}

function saveLayouts(layouts: SavedLayout[]) {
  try { localStorage.setItem(LAYOUTS_KEY, JSON.stringify(layouts)); } catch { /* noop */ }
}

interface DragDropDashboardProps {
  widgets: DashboardWidget[];
  onWidgetsChange: (widgets: DashboardWidget[]) => void;
  children?: React.ReactNode;
}

/** DRAGDROP-4: Size labels */
const SIZE_LABELS: Record<string, string> = {
  small: "Klein (1/4)",
  medium: "Mittel (1/2)",
  large: "Groß (3/4)",
  full: "Voll (1/1)",
};

const SIZE_COLS: Record<string, string> = {
  small: "col-span-1",
  medium: "col-span-1 md:col-span-2",
  large: "col-span-1 md:col-span-3",
  full: "col-span-1 md:col-span-4",
};

export default function DragDropDashboard({ widgets, onWidgetsChange }: DragDropDashboardProps) {
  const [editMode, setEditMode] = useState(false);
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);
  const [layouts, setLayouts] = useState<SavedLayout[]>(loadLayouts);
  const [layoutName, setLayoutName] = useState("");
  const [showGallery, setShowGallery] = useState(false);
  const dragRef = useRef<{ startY: number; idx: number } | null>(null);

  const visibleWidgets = useMemo(
    () => [...widgets].filter(w => w.visible).sort((a, b) => a.order - b.order),
    [widgets]
  );

  /** DRAGDROP-5: Drag start */
  const handleDragStart = useCallback((idx: number, e: React.DragEvent) => {
    setDragIdx(idx);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", String(idx));
  }, []);

  /** DRAGDROP-6: Drag over */
  const handleDragOver = useCallback((idx: number, e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDragOverIdx(idx);
  }, []);

  /** DRAGDROP-7: Drop — reorder widgets */
  const handleDrop = useCallback((targetIdx: number) => {
    if (dragIdx === null || dragIdx === targetIdx) {
      setDragIdx(null);
      setDragOverIdx(null);
      return;
    }

    const visible = [...visibleWidgets];
    const [moved] = visible.splice(dragIdx, 1);
    visible.splice(targetIdx, 0, moved);

    // Update order in all widgets
    const updated = widgets.map(w => {
      const newIdx = visible.findIndex(v => v.id === w.id);
      return newIdx >= 0 ? { ...w, order: newIdx } : w;
    });

    onWidgetsChange(updated);
    setDragIdx(null);
    setDragOverIdx(null);
  }, [dragIdx, visibleWidgets, widgets, onWidgetsChange]);

  /** DRAGDROP-8: Toggle widget visibility */
  const toggleWidget = useCallback((id: string) => {
    onWidgetsChange(widgets.map(w => w.id === id ? { ...w, visible: !w.visible } : w));
  }, [widgets, onWidgetsChange]);

  /** DRAGDROP-9: Change widget size */
  const changeSize = useCallback((id: string, size: DashboardWidget["size"]) => {
    onWidgetsChange(widgets.map(w => w.id === id ? { ...w, size } : w));
  }, [widgets, onWidgetsChange]);

  /** DRAGDROP-10: Move widget up/down */
  const moveWidget = useCallback((id: string, dir: "up" | "down") => {
    const idx = visibleWidgets.findIndex(w => w.id === id);
    if (idx === -1) return;
    const newIdx = dir === "up" ? Math.max(0, idx - 1) : Math.min(visibleWidgets.length - 1, idx + 1);
    if (newIdx === idx) return;

    const reordered = [...visibleWidgets];
    const [moved] = reordered.splice(idx, 1);
    reordered.splice(newIdx, 0, moved);

    onWidgetsChange(widgets.map(w => {
      const newOrder = reordered.findIndex(v => v.id === w.id);
      return newOrder >= 0 ? { ...w, order: newOrder } : w;
    }));
  }, [visibleWidgets, widgets, onWidgetsChange]);

  /** DRAGDROP-11: Save layout */
  const saveLayout = useCallback(() => {
    if (!layoutName.trim()) {
      toast.error("Bitte Layout-Name eingeben");
      return;
    }
    const layout: SavedLayout = {
      name: layoutName.trim(),
      widgets: widgets.map(w => ({ id: w.id, visible: w.visible, order: w.order, size: w.size })),
      savedAt: new Date().toISOString(),
    };
    const updated = [...layouts.filter(l => l.name !== layout.name), layout];
    setLayouts(updated);
    saveLayouts(updated);
    setLayoutName("");
    toast.success(`Layout "${layout.name}" gespeichert`);
  }, [layoutName, widgets, layouts]);

  /** DRAGDROP-12: Load layout */
  const loadLayout = useCallback((layout: SavedLayout) => {
    const updated = widgets.map(w => {
      const saved = layout.widgets.find(s => s.id === w.id);
      if (saved) return { ...w, visible: saved.visible, order: saved.order, size: saved.size as DashboardWidget["size"] };
      return w;
    });
    onWidgetsChange(updated);
    toast.success(`Layout "${layout.name}" geladen`);
  }, [widgets, onWidgetsChange]);

  /** DRAGDROP-13: Delete layout */
  const deleteLayout = useCallback((name: string) => {
    const updated = layouts.filter(l => l.name !== name);
    setLayouts(updated);
    saveLayouts(updated);
    toast.success("Layout gelöscht");
  }, [layouts]);

  /** DRAGDROP-14: Reset to defaults */
  const resetLayout = useCallback(() => {
    onWidgetsChange(widgets.map((w, i) => ({ ...w, visible: true, order: i, size: "medium" as const })));
    toast.success("Layout zurückgesetzt");
  }, [widgets, onWidgetsChange]);

  // Categories for gallery
  const categories = useMemo(() => {
    const cats = new Map<string, DashboardWidget[]>();
    widgets.forEach(w => {
      const list = cats.get(w.category) || [];
      list.push(w);
      cats.set(w.category, list);
    });
    return cats;
  }, [widgets]);

  return (
    <div className="space-y-3">
      {/* Toolbar */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <Button
            variant={editMode ? "default" : "outline"}
            size="sm"
            className="gap-1.5 text-xs h-8"
            onClick={() => setEditMode(!editMode)}
          >
            <LayoutGrid className="h-3.5 w-3.5" />
            {editMode ? "Fertig" : "Layout bearbeiten"}
          </Button>

          {editMode && (
            <>
              <Dialog open={showGallery} onOpenChange={setShowGallery}>
                <DialogTrigger asChild>
                  <Button variant="outline" size="sm" className="gap-1 text-xs h-8">
                    <Plus className="h-3 w-3" /> Widgets
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-md max-h-[80vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                      <LayoutGrid className="h-5 w-5 text-primary" /> Widget-Galerie
                    </DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4">
                    {[...categories.entries()].map(([cat, catWidgets]) => (
                      <div key={cat}>
                        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">{cat}</p>
                        <div className="space-y-1">
                          {catWidgets.sort((a, b) => a.order - b.order).map(w => (
                            <div key={w.id} className="flex items-center justify-between p-2 rounded-lg bg-secondary/30">
                              <span className="text-xs font-medium">{w.label}</span>
                              <Button
                                variant={w.visible ? "default" : "outline"}
                                size="sm"
                                className="h-6 text-[10px] gap-1"
                                onClick={() => toggleWidget(w.id)}
                              >
                                {w.visible ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
                                {w.visible ? "Sichtbar" : "Ausgeblendet"}
                              </Button>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </DialogContent>
              </Dialog>

              <Button variant="outline" size="sm" className="gap-1 text-xs h-8" onClick={resetLayout}>
                <RotateCcw className="h-3 w-3" /> Reset
              </Button>
            </>
          )}
        </div>

        {/* Layout save/load */}
        <div className="flex items-center gap-2">
          {editMode && (
            <div className="flex items-center gap-1">
              <Input
                value={layoutName}
                onChange={e => setLayoutName(e.target.value)}
                placeholder="Layout-Name"
                className="h-8 w-32 text-xs"
              />
              <Button variant="outline" size="sm" className="h-8 gap-1 text-xs" onClick={saveLayout}>
                <Save className="h-3 w-3" /> Speichern
              </Button>
            </div>
          )}

          {layouts.length > 0 && (
            <Select onValueChange={name => {
              const layout = layouts.find(l => l.name === name);
              if (layout) loadLayout(layout);
            }}>
              <SelectTrigger className="h-8 w-36 text-xs">
                <SelectValue placeholder="Layout laden" />
              </SelectTrigger>
              <SelectContent>
                {layouts.map(l => (
                  <SelectItem key={l.name} value={l.name}>
                    {l.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
      </div>

      {/* Widget Grid */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        {visibleWidgets.map((widget, idx) => (
          <div
            key={widget.id}
            className={`${SIZE_COLS[widget.size]} ${
              dragOverIdx === idx ? "ring-2 ring-primary/50 rounded-xl" : ""
            } ${dragIdx === idx ? "opacity-50" : ""} transition-all`}
            draggable={editMode}
            onDragStart={e => handleDragStart(idx, e)}
            onDragOver={e => handleDragOver(idx, e)}
            onDrop={() => handleDrop(idx)}
            onDragEnd={() => { setDragIdx(null); setDragOverIdx(null); }}
          >
            {editMode && (
              <div className="flex items-center justify-between mb-1 px-1">
                <div className="flex items-center gap-1">
                  <GripVertical className="h-3 w-3 text-muted-foreground cursor-grab" />
                  <span className="text-[10px] text-muted-foreground">{widget.label}</span>
                </div>
                <div className="flex items-center gap-0.5">
                  <Select value={widget.size} onValueChange={v => changeSize(widget.id, v as DashboardWidget["size"])}>
                    <SelectTrigger className="h-5 w-16 text-[9px] border-dashed">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="small">Klein</SelectItem>
                      <SelectItem value="medium">Mittel</SelectItem>
                      <SelectItem value="large">Groß</SelectItem>
                      <SelectItem value="full">Voll</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => moveWidget(widget.id, "up")}>
                    <ChevronUp className="h-3 w-3" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => moveWidget(widget.id, "down")}>
                    <ChevronDown className="h-3 w-3" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-5 w-5 text-muted-foreground hover:text-loss" onClick={() => toggleWidget(widget.id)}>
                    <EyeOff className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            )}
            {widget.component}
          </div>
        ))}
      </div>
    </div>
  );
}
