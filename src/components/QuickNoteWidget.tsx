import { useState, useEffect, useCallback } from "react";
import { StickyNote, Save, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

const STORAGE_KEY = "immocontrol_quick_notes";

const QuickNoteWidget = () => {
  const { user } = useAuth();
  const [content, setContent] = useState("");
  const [saved, setSaved] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) setContent(stored);
  }, []);

  const save = useCallback(() => {
    localStorage.setItem(STORAGE_KEY, content);
    setSaved(true);
    setLastSaved(new Date());
    setTimeout(() => setSaved(false), 2000);
  }, [content]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "s") {
        e.preventDefault();
        save();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [save]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (content !== (localStorage.getItem(STORAGE_KEY) || "")) {
        save();
      }
    }, 3000);
    return () => clearTimeout(timer);
  }, [content, save]);

  return (
    <div className="gradient-card rounded-xl border border-border p-5">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold flex items-center gap-2">
          <StickyNote className="h-4 w-4 text-muted-foreground" /> Schnellnotiz
        </h3>
        <div className="flex items-center gap-2">
          {lastSaved && (
            <span className="text-[10px] text-muted-foreground">
              {lastSaved.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" })}
            </span>
          )}
          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={save}>
            {saved ? <Check className="h-3.5 w-3.5 text-profit" /> : <Save className="h-3.5 w-3.5" />}
          </Button>
        </div>
      </div>
      <Textarea
        value={content}
        onChange={e => setContent(e.target.value)}
        placeholder="Gedanken, Ideen, To-Dos… (auto-gespeichert)"
        className="text-sm min-h-[100px] resize-none border-0 bg-transparent p-0 focus-visible:ring-0 placeholder:text-muted-foreground/50"
      />
      <p className="text-[10px] text-muted-foreground mt-2">Ctrl+S zum Speichern · Auto-save nach 3 Sek.</p>
    </div>
  );
};

export default QuickNoteWidget;
