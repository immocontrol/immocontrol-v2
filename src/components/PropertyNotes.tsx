import { useState, useRef } from "react";
import { StickyNote, Plus, Trash2, Sparkles, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { handleError } from "@/lib/handleError";
import { toastErrorWithRetry } from "@/lib/toastMessages";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { relativeTime } from "@/lib/formatters";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/queryKeys";
import { isDeepSeekConfigured, summarizeNotes } from "@/integrations/ai/extractors";

interface Note {
  id: string;
  content: string;
  created_at: string;
}

const MAX_CHARS = 500;

const PropertyNotes = ({ propertyId }: { propertyId: string }) => {
  const { user } = useAuth();
  const [newNote, setNewNote] = useState("");
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [summaryText, setSummaryText] = useState("");
  const [summaryOpen, setSummaryOpen] = useState(false);
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
  const qc = useQueryClient();

  const handleSummarize = async () => {
    if (!notes.length || !isDeepSeekConfigured()) return;
    setSummaryLoading(true);
    setSummaryOpen(true);
    try {
      const text = await summarizeNotes(notes);
      setSummaryText(text);
    } catch {
      setSummaryText("Zusammenfassung konnte nicht erstellt werden.");
    } finally {
      setSummaryLoading(false);
    }
  };

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
    onError: (e: unknown) => {
      handleError(e, { context: "supabase", details: "property_notes.insert", showToast: false });
      toastErrorWithRetry("Fehler beim Speichern", () => addMutation.mutate());
    },
  });

  const lastDeletedNoteIdRef = useRef<string | null>(null);
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("property_notes").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.notes.byProperty(propertyId) });
      qc.invalidateQueries({ queryKey: queryKeys.timeline.byProperty(propertyId) });
      setDeleteTargetId(null);
    },
    onError: (e: unknown) => {
      handleError(e, { context: "supabase", details: "property_notes.delete", showToast: false });
      toastErrorWithRetry("Fehler beim Löschen", () => { if (lastDeletedNoteIdRef.current) deleteMutation.mutate(lastDeletedNoteIdRef.current); });
    },
  });

  return (
    <div className="gradient-card rounded-xl border border-border p-5 animate-fade-in [animation-delay:550ms]" role="region" aria-label="Notizen">
      <h2 className="text-sm font-semibold mb-4 flex items-center justify-between gap-2">
        <span className="flex items-center gap-2">
          <StickyNote className="h-4 w-4 text-muted-foreground" /> Notizen
          {notes.length > 0 && (
            <span className="text-[10px] bg-secondary px-1.5 py-0.5 rounded-full text-muted-foreground">{notes.length}</span>
          )}
        </span>
        {notes.length > 0 && isDeepSeekConfigured() && (
          <Button variant="outline" size="sm" className="h-8 gap-1.5 touch-target min-h-[36px] text-xs" onClick={handleSummarize} disabled={summaryLoading}>
            {summaryLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
            Zusammenfassen
          </Button>
        )}
      </h2>
      <Dialog open={summaryOpen} onOpenChange={setSummaryOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>KI-Zusammenfassung der Notizen</DialogTitle>
          </DialogHeader>
          {summaryLoading ? (
            <p className="text-sm text-muted-foreground flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" /> Auswertung…
            </p>
          ) : (
            <p className="text-sm whitespace-pre-wrap">{summaryText}</p>
          )}
        </DialogContent>
      </Dialog>

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
                  onClick={() => setDeleteTargetId(note.id)}
                  className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-all"
                  aria-label="Notiz löschen"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <AlertDialog open={!!deleteTargetId} onOpenChange={(open) => { if (!open) setDeleteTargetId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Notiz löschen?</AlertDialogTitle>
            <AlertDialogDescription>Die Notiz wird unwiderruflich entfernt.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (deleteTargetId) {
                  lastDeletedNoteIdRef.current = deleteTargetId;
                  deleteMutation.mutate(deleteTargetId);
                }
              }}
            >
              Löschen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default PropertyNotes;
