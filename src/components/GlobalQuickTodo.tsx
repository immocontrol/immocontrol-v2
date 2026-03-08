import { useState, forwardRef } from "react";
import { Plus, X, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useLocation } from "react-router-dom";
import { ROUTES } from "@/lib/routes";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

const GlobalQuickTodo = forwardRef<HTMLDivElement>((_, ref) => {
  const { user } = useAuth();
  const qc = useQueryClient();
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [saving, setSaving] = useState(false);

  const isHidden = location.pathname === ROUTES.TODOS;
  if (isHidden) return null;

  const handleSave = async () => {
    if (!user || !title.trim()) return;
    setSaving(true);
    const { error } = await supabase.from("todos").insert({
      user_id: user.id,
      title: title.trim(),
      priority: 4,
      completed: false,
      project: "Inbox",
      labels: [],
      sort_order: Math.floor(Date.now() / 1000),
    });
    setSaving(false);
    if (error) {
      toast.error("Fehler beim Speichern");
    } else {
      toast.success("Aufgabe erstellt");
      qc.invalidateQueries({ queryKey: ["todos"] });
      setTitle("");
      setOpen(false);
    }
  };

  return (
    <div ref={ref} className="fixed bottom-24 right-4 md:bottom-6 z-40">
      {open ? (
        <div className="bg-card border border-border rounded-xl shadow-lg p-3 w-72 animate-fade-in">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xs font-semibold text-muted-foreground">Schnell-Aufgabe</span>
            <button onClick={() => { setOpen(false); setTitle(""); }} className="ml-auto text-muted-foreground hover:text-foreground">
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
          <Input
            autoFocus
            value={title}
            onChange={e => setTitle(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter") handleSave(); if (e.key === "Escape") setOpen(false); }}
            placeholder="Aufgabe eingeben…"
            className="h-8 text-sm mb-2"
            aria-label="Schnell-Aufgabe Titel"
          />
          <Button onClick={handleSave} disabled={saving || !title.trim()} className="w-full h-8 text-xs gap-1">
            <Check className="h-3.5 w-3.5" /> Speichern
          </Button>
          <p className="text-[10px] text-muted-foreground text-center mt-1.5">Enter zum Speichern · Esc zum Schließen</p>
        </div>
      ) : (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              data-global-quick-todo
              onClick={() => setOpen(true)}
              size="icon"
              className="h-12 w-12 rounded-full shadow-lg hover:scale-110 transition-transform"
            >
              <Plus className="h-5 w-5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="left" className="text-xs">
            Schnell-Aufgabe (Q)
          </TooltipContent>
        </Tooltip>
      )}
    </div>
  );
});

GlobalQuickTodo.displayName = "GlobalQuickTodo";

export default GlobalQuickTodo;
