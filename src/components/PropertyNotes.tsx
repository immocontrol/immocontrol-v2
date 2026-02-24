import { useState } from "react";
import { StickyNote, Plus, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { relativeTime } from "@/lib/formatters";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/queryKeys";

interface Note {
  id: string;
  content: string;
  created_at: string;
}

const MAX_CHARS = 500;

const PropertyNotes = ({ propertyId }: { propertyId: string }) => {
  const { user } = useAuth();
  const [newNote, setNewNote] = useState("");
  const qc = useQueryClient();

  const { data: notes = [] } = useQuery({
    queryKey: queryKeys.notes.byProperty(propertyId),
    queryFn: async () => {
      const { data } = await supabase
        .from("property_notes")
        .select("id, content, created_at")
        .eq("property_id", propertyId)
        .order("created_at", { ascending: false });
      return (data || []) as Note[];
    },
  });

  const addMutation = useMutation({
    mutationFn: async () => {
      if (!newNote.trim() || !user) throw new Error("Invalid");
      const { error } = await supabase.from("property_notes").insert({
        property_id: propertyId,
        user_id: user.id,
        content: newNote.trim(),
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setNewNote("");
      qc.invalidateQueries({ queryKey: queryKeys.notes.byProperty(propertyId) });
      qc.invalidateQueries({ queryKey: queryKeys.timeline.byProperty(propertyId) });
    },
    onError: () => toast.error("Fehler beim Speichern"),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await supabase.from("property_notes").delete().eq("id", id);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.notes.byProperty(propertyId) });
      qc.invalidateQueries({ queryKey: queryKeys.timeline.byProperty(propertyId) });
    },
  });

  return (
    <div className="gradient-card rounded-xl border border-border p-5 animate-fade-in" style={{ animationDelay: "550ms" }}>
      <h2 className="text-sm font-semibold mb-4 flex items-center gap-2">
        <StickyNote className="h-4 w-4 text-muted-foreground" /> Notizen
        {notes.length > 0 && (
          <span className="text-[10px] bg-secondary px-1.5 py-0.5 rounded-full text-muted-foreground">{notes.length}</span>
        )}
      </h2>

      <div className="space-y-1.5 mb-4">
        <div className="flex gap-2">
          <Textarea
            placeholder="Notiz hinzufügen (z.B. Mieter kündigt 03/2027)..."
            value={newNote}
            onChange={(e) => setNewNote(e.target.value.slice(0, MAX_CHARS))}
            className="min-h-[60px] text-sm resize-none"
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                addMutation.mutate();
              }
            }}
          />
          <Button size="icon" className="shrink-0 self-end" onClick={() => addMutation.mutate()} disabled={addMutation.isPending || !newNote.trim()}>
            <Plus className="h-4 w-4" />
          </Button>
        </div>
        <p className={`text-[10px] text-right ${newNote.length >= MAX_CHARS ? "text-loss" : "text-muted-foreground"}`}>
          {newNote.length}/{MAX_CHARS}
        </p>
      </div>

      {notes.length === 0 ? (
        <p className="text-xs text-muted-foreground text-center py-4">Noch keine Notizen</p>
      ) : (
        <div className="space-y-2">
          {notes.map((note) => (
            <div key={note.id} className="flex items-start gap-2 bg-secondary/50 rounded-lg p-3 group hover:bg-secondary/70 transition-colors">
              <p className="text-sm flex-1 whitespace-pre-wrap">{note.content}</p>
              <div className="flex flex-col items-end gap-1 shrink-0">
                <span className="text-[10px] text-muted-foreground">
                  {relativeTime(note.created_at)}
                </span>
                <button
                  onClick={() => deleteMutation.mutate(note.id)}
                  className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-all"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default PropertyNotes;
