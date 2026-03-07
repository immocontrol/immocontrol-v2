/**
 * TodoEditDialog — extracted from Todos.tsx (Fix 3: Split large files).
 * Edit dialog for a single todo item.
 */
import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ResponsiveDialog, ResponsiveDialogHeader, ResponsiveDialogTitle } from "@/components/ResponsiveDialog";
import { LoadingButton } from "@/components/LoadingButton";
import { isDeepSeekConfigured, suggestTodoDescription } from "@/integrations/ai/extractors";
import { handleError } from "@/lib/handleError";

const PRIORITY_CONFIG: Record<number, { label: string; icon: string }> = {
  1: { label: "Dringend", icon: "\uD83D\uDD34" },
  2: { label: "Hoch", icon: "\uD83D\uDFE0" },
  3: { label: "Mittel", icon: "\uD83D\uDFE1" },
  4: { label: "Niedrig", icon: "\u26AA" },
};

export interface TodoEditForm {
  title: string;
  description: string;
  due_date: string;
  due_time: string;
  priority: number;
  project: string;
  labels: string[];
}

interface TodoEditDialogProps {
  open: boolean;
  onClose: () => void;
  form: TodoEditForm;
  onFormChange: (updater: (prev: TodoEditForm) => TodoEditForm) => void;
  onSave: () => void;
  isSaving: boolean;
}

export function TodoEditDialog({ open, onClose, form, onFormChange, onSave, isSaving }: TodoEditDialogProps) {
  const [aiLoading, setAiLoading] = useState(false);
  return (
    <ResponsiveDialog open={open} onOpenChange={(o) => !o && onClose()}>
      <ResponsiveDialogHeader>
        <ResponsiveDialogTitle>Aufgabe bearbeiten</ResponsiveDialogTitle>
      </ResponsiveDialogHeader>
      <div className="space-y-3">
        <Input
          value={form.title}
          onChange={(e) => onFormChange((f) => ({ ...f, title: e.target.value }))}
          placeholder="Titel"
          className="h-9 text-sm font-medium"
          autoFocus
          aria-label="Aufgabentitel"
        />
        <div className="space-y-1">
          <div className="flex items-center justify-between gap-2">
            <label className="text-xs text-muted-foreground">Beschreibung (optional)</label>
            {isDeepSeekConfigured() && form.title.trim().length >= 2 && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 gap-1 text-xs"
                disabled={aiLoading}
                onClick={async () => {
                  setAiLoading(true);
                  try {
                    const text = await suggestTodoDescription(form.title.trim());
                    if (text) onFormChange((f) => ({ ...f, description: text }));
                  } catch (e) {
                    handleError(e, { context: "ai", details: "suggestTodoDescription", showToast: true });
                  } finally {
                    setAiLoading(false);
                  }
                }}
              >
                {aiLoading ? <span className="animate-spin">⏳</span> : "✨"}
                KI Beschreibung
              </Button>
            )}
          </div>
          <Textarea
            value={form.description}
            onChange={(e) => onFormChange((f) => ({ ...f, description: e.target.value }))}
            placeholder="Beschreibung (optional)"
            className="text-sm min-h-[80px] resize-none"
            aria-label="Aufgabenbeschreibung"
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Fälligkeitsdatum</label>
            <Input
              type="date"
              value={form.due_date}
              onChange={(e) => onFormChange((f) => ({ ...f, due_date: e.target.value }))}
              className="h-9 text-sm"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Uhrzeit</label>
            <Input
              type="time"
              value={form.due_time}
              onChange={(e) => onFormChange((f) => ({ ...f, due_time: e.target.value }))}
              className="h-9 text-sm"
            />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Priorität</label>
            <Select value={String(form.priority)} onValueChange={(v) => onFormChange((f) => ({ ...f, priority: Number(v) }))}>
              <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
              <SelectContent>
                {Object.entries(PRIORITY_CONFIG).map(([k, v]) => (
                  <SelectItem key={k} value={k}>{v.icon} {v.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Projekt</label>
            <Input
              value={form.project}
              onChange={(e) => onFormChange((f) => ({ ...f, project: e.target.value }))}
              placeholder="z.B. Arbeit"
              className="h-9 text-sm"
            />
          </div>
        </div>
        <div className="flex gap-2 pt-1">
          <LoadingButton onClick={onSave} className="flex-1" loading={isSaving} disabled={!form.title.trim()}>
            Speichern
          </LoadingButton>
          <Button variant="outline" onClick={onClose}>Abbrechen</Button>
        </div>
      </div>
    </ResponsiveDialog>
  );
}
