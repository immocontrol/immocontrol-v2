/**
 * BULK-1: Bulk-Operationen
 * 
 * Features:
 * - Multi-select tenants/properties
 * - Bulk edit (status, tags, notes)
 * - Bulk export (CSV, PDF)
 * - Bulk communication (email templates)
 * - Select all / deselect all
 */

import { useState, useCallback, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import {
  CheckSquare, Square, Download, Mail, Edit3, Trash2,
  FileText, X, Copy, Check
} from "lucide-react";
import { toast } from "sonner";
import { formatCurrency } from "@/lib/formatters";

export interface BulkItem {
  id: string;
  name: string;
  subtitle?: string;
  category?: string;
  value?: number;
  status?: string;
}

interface BulkOperationsProps {
  items: BulkItem[];
  entityName: string; // e.g. "Mieter", "Objekte"
  onBulkDelete?: (ids: string[]) => void;
  onBulkEdit?: (ids: string[], field: string, value: string) => void;
  columns?: string[];
}

export default function BulkOperations({ items, entityName, onBulkDelete, onBulkEdit, columns }: BulkOperationsProps) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [showActions, setShowActions] = useState(false);
  const [editField, setEditField] = useState("");
  const [editValue, setEditValue] = useState("");
  const [emailTemplate, setEmailTemplate] = useState("");

  const selectedCount = selected.size;
  const allSelected = selectedCount === items.length && items.length > 0;

  /** BULK-2: Toggle single item */
  const toggleItem = useCallback((id: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  /** BULK-3: Select all / deselect all */
  const toggleAll = useCallback(() => {
    if (allSelected) {
      setSelected(new Set());
    } else {
      setSelected(new Set(items.map(i => i.id)));
    }
  }, [allSelected, items]);

  /** BULK-4: Clear selection */
  const clearSelection = useCallback(() => {
    setSelected(new Set());
    setShowActions(false);
  }, []);

  /** BULK-5: Export selected as CSV */
  const exportCSV = useCallback(() => {
    const selectedItems = items.filter(i => selected.has(i.id));
    if (selectedItems.length === 0) return;

    const headers = ["Name", "Kategorie", "Status", "Wert"];
    const csvEscape = (v: string) => `"${v.replace(/"/g, '""')}"`;  
    const rows = selectedItems.map(i => [
      csvEscape(i.name),
      csvEscape(i.category || ""),
      csvEscape(i.status || ""),
      i.value?.toString() || "",
    ]);
    const csv = [headers.join(";"), ...rows.map(r => r.join(";"))].join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${entityName.toLowerCase()}_export_${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(`${selectedItems.length} ${entityName} exportiert`);
  }, [items, selected, entityName]);

  /** BULK-6: Copy selected names to clipboard */
  const copyNames = useCallback(async () => {
    const selectedItems = items.filter(i => selected.has(i.id));
    const text = selectedItems.map(i => i.name).join("\n");
    try {
      await navigator.clipboard.writeText(text);
      toast.success(`${selectedItems.length} Namen kopiert`);
    } catch {
      toast.error("Kopieren fehlgeschlagen");
    }
  }, [items, selected]);

  /** BULK-7: Bulk delete */
  const handleBulkDelete = useCallback(() => {
    if (!onBulkDelete) return;
    const ids = Array.from(selected);
    if (confirm(`${ids.length} ${entityName} wirklich löschen?`)) {
      onBulkDelete(ids);
      clearSelection();
    }
  }, [selected, entityName, onBulkDelete, clearSelection]);

  /** BULK-8: Bulk edit */
  const handleBulkEdit = useCallback(() => {
    if (!onBulkEdit || !editField || !editValue) return;
    const ids = Array.from(selected);
    onBulkEdit(ids, editField, editValue);
    setEditField("");
    setEditValue("");
    toast.success(`${ids.length} ${entityName} aktualisiert`);
  }, [selected, editField, editValue, entityName, onBulkEdit]);

  /** BULK-9: Summary of selected items */
  const selectionSummary = useMemo(() => {
    const selectedItems = items.filter(i => selected.has(i.id));
    const totalValue = selectedItems.reduce((s, i) => s + (i.value || 0), 0);
    const categories = new Map<string, number>();
    selectedItems.forEach(i => {
      const cat = i.category || "Sonstige";
      categories.set(cat, (categories.get(cat) || 0) + 1);
    });
    return { count: selectedItems.length, totalValue, categories };
  }, [items, selected]);

  if (items.length === 0) return null;

  return (
    <div className="space-y-2">
      {/* Bulk selection bar */}
      <div className="flex items-center justify-between flex-wrap gap-2 p-2 rounded-lg bg-secondary/30 border border-border/50">
        <div className="flex items-center gap-3">
          <button
            onClick={toggleAll}
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
            aria-label={allSelected ? "Alle abwählen" : "Alle auswählen"}
          >
            {allSelected ? (
              <CheckSquare className="h-4 w-4 text-primary" />
            ) : (
              <Square className="h-4 w-4" />
            )}
            <span>{allSelected ? "Alle abwählen" : "Alle auswählen"}</span>
          </button>

          {selectedCount > 0 && (
            <Badge variant="secondary" className="text-xs gap-1">
              {selectedCount} ausgewählt
              <button onClick={clearSelection} className="ml-1 hover:text-loss">
                <X className="h-3 w-3" />
              </button>
            </Badge>
          )}
        </div>

        {/* Bulk action buttons */}
        {selectedCount > 0 && (
          <div className="flex items-center gap-1.5">
            <Button variant="outline" size="sm" className="h-7 text-xs gap-1" onClick={exportCSV}>
              <Download className="h-3 w-3" /> CSV
            </Button>
            <Button variant="outline" size="sm" className="h-7 text-xs gap-1" onClick={copyNames}>
              <Copy className="h-3 w-3" /> Kopieren
            </Button>
            {onBulkEdit && (
              <Dialog>
                <DialogTrigger asChild>
                  <Button variant="outline" size="sm" className="h-7 text-xs gap-1">
                    <Edit3 className="h-3 w-3" /> Bearbeiten
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-sm">
                  <DialogHeader>
                    <DialogTitle>{selectedCount} {entityName} bearbeiten</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-3">
                    <Select value={editField} onValueChange={setEditField}>
                      <SelectTrigger><SelectValue placeholder="Feld wählen" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="status">Status</SelectItem>
                        <SelectItem value="category">Kategorie</SelectItem>
                        <SelectItem value="notes">Notizen</SelectItem>
                        {columns?.map(c => (
                          <SelectItem key={c} value={c}>{c}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Textarea
                      value={editValue}
                      onChange={e => setEditValue(e.target.value)}
                      placeholder="Neuer Wert"
                      className="text-xs"
                    />
                    <Button className="w-full" size="sm" onClick={handleBulkEdit} disabled={!editField || !editValue}>
                      {selectedCount} {entityName} aktualisieren
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            )}
            {onBulkDelete && (
              <Button variant="outline" size="sm" className="h-7 text-xs gap-1 text-loss hover:text-loss" onClick={handleBulkDelete}>
                <Trash2 className="h-3 w-3" /> Löschen
              </Button>
            )}
          </div>
        )}
      </div>

      {/* Selection summary */}
      {selectedCount > 0 && selectionSummary.totalValue > 0 && (
        <div className="flex items-center gap-3 text-xs text-muted-foreground px-2">
          <span>Gesamtwert: <strong className="text-foreground">{formatCurrency(selectionSummary.totalValue)}</strong></span>
          {[...selectionSummary.categories.entries()].map(([cat, count]) => (
            <Badge key={cat} variant="outline" className="text-[10px]">{cat}: {count}</Badge>
          ))}
        </div>
      )}

      {/* Items with checkboxes */}
      <div className="space-y-1">
        {items.map(item => (
          <div
            key={item.id}
            className={`flex items-center gap-3 p-2 rounded-lg transition-colors cursor-pointer ${
              selected.has(item.id) ? "bg-primary/5 border border-primary/20" : "hover:bg-secondary/30"
            }`}
            onClick={() => toggleItem(item.id)}
          >
            <Checkbox
              checked={selected.has(item.id)}
              onCheckedChange={() => toggleItem(item.id)}
              aria-label={`${item.name} auswählen`}
            />
            <div className="flex-1 min-w-0">
              <span className="text-sm font-medium">{item.name}</span>
              {item.subtitle && (
                <span className="text-xs text-muted-foreground ml-2">{item.subtitle}</span>
              )}
            </div>
            {item.category && (
              <Badge variant="outline" className="text-[10px] shrink-0">{item.category}</Badge>
            )}
            {item.value !== undefined && (
              <span className="text-xs font-medium shrink-0">{formatCurrency(item.value)}</span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
