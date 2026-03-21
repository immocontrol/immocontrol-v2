/**
 * MOB5-10: Mobile Quick Note
 * Floating action button for quick notes attached to any property/contact.
 * Notes are saved to localStorage and can be synced later.
 */
import { useState, useCallback, useRef, useEffect, memo } from "react";
import { useIsMobile } from "@/hooks/use-mobile";
import { StickyNote, X, Send, Trash2, Clock } from "lucide-react";
import { cn } from "@/lib/utils";

export interface QuickNote {
  id: string;
  text: string;
  createdAt: number;
  /** Optional entity reference */
  entityType?: "property" | "contact" | "deal" | "general";
  entityId?: string;
  entityName?: string;
}

const STORAGE_KEY = "immo-quick-notes";

function loadNotes(): QuickNote[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) return JSON.parse(stored);
  } catch {
    // ignore
  }
  return [];
}

function saveNotes(notes: QuickNote[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(notes));
  } catch {
    // ignore
  }
}

/**
 * Hook for managing quick notes.
 */
export function useQuickNotes() {
  const [notes, setNotes] = useState<QuickNote[]>(loadNotes);

  const addNote = useCallback((text: string, entity?: { type: QuickNote["entityType"]; id: string; name: string }): QuickNote => {
    const note: QuickNote = {
      id: `note-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      text,
      createdAt: Date.now(),
      entityType: entity?.type,
      entityId: entity?.id,
      entityName: entity?.name,
    };
    setNotes(prev => {
      const updated = [note, ...prev];
      saveNotes(updated);
      return updated;
    });
    return note;
  }, []);

  const deleteNote = useCallback((id: string) => {
    setNotes(prev => {
      const updated = prev.filter(n => n.id !== id);
      saveNotes(updated);
      return updated;
    });
  }, []);

  const clearAll = useCallback(() => {
    setNotes([]);
    saveNotes([]);
  }, []);

  return { notes, addNote, deleteNote, clearAll };
}

interface MobileQuickNoteProps {
  /** Current entity context (optional) */
  entity?: {
    type: QuickNote["entityType"];
    id: string;
    name: string;
  };
  /** Callback when note is saved */
  onNoteSaved?: (note: QuickNote) => void;
  /** Position of the FAB */
  position?: "bottom-right" | "bottom-left";
  /** Additional class */
  className?: string;
}

export const MobileQuickNote = memo(function MobileQuickNote({
  entity,
  onNoteSaved,
  position = "bottom-right",
  className,
}: MobileQuickNoteProps) {
  const isMobile = useIsMobile();
  const [isOpen, setIsOpen] = useState(false);
  const [text, setText] = useState("");
  const { notes, addNote, deleteNote } = useQuickNotes();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [showList, setShowList] = useState(false);

  // Focus textarea when opened
  useEffect(() => {
    if (isOpen && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [isOpen]);

  const handleSubmit = useCallback(() => {
    const trimmed = text.trim();
    if (!trimmed) return;

    const note = addNote(trimmed, entity);
    setText("");
    setIsOpen(false);

    if (onNoteSaved) {
      onNoteSaved(note);
    }
  }, [text, entity, addNote, onNoteSaved]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      handleSubmit();
    }
  }, [handleSubmit]);

  const recentNotes = notes.slice(0, 5);
  const noteCount = notes.length;

  const formatTime = (timestamp: number): string => {
    const diff = Date.now() - timestamp;
    const minutes = Math.floor(diff / 60000);
    if (minutes < 1) return "Gerade eben";
    if (minutes < 60) return `Vor ${minutes} Min.`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `Vor ${hours} Std.`;
    const days = Math.floor(hours / 24);
    return `Vor ${days} Tag${days > 1 ? "en" : ""}`;
  };

  return (
    <>
      {/* FAB Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "fixed z-40 h-12 w-12 rounded-full shadow-xl",
          "flex items-center justify-center transition-all",
          "bg-amber-500 text-white hover:bg-amber-600",
          "hover:shadow-xl active:scale-95",
          position === "bottom-right" ? "right-4" : "left-4",
          isMobile ? "bottom-20" : "bottom-4",
          noteCount > 0 && "ring-2 ring-amber-300/50",
          className
        )}
        aria-label="Schnellnotiz"
      >
        <StickyNote className="w-5 h-5" />
        {noteCount > 0 && (
          <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
            {noteCount > 9 ? "9+" : noteCount}
          </span>
        )}
      </button>

      {/* Note dialog */}
      {isOpen && (
        <div className="fixed inset-0 z-50" role="dialog" aria-label="Schnellnotiz">
          <div
            className="absolute inset-0 bg-black/30"
            onClick={() => setIsOpen(false)}
          />
          <div
            className={cn(
              "absolute bg-background rounded-2xl shadow-2xl border w-[320px] max-h-[70vh] flex flex-col",
              "animate-in zoom-in-95 fade-in duration-200",
              position === "bottom-right" ? "right-4" : "left-4",
              isMobile ? "bottom-20" : "bottom-4"
            )}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 pt-4 pb-2">
              <div className="flex items-center gap-2">
                <StickyNote className="w-4 h-4 text-amber-500" />
                <h3 className="text-sm font-semibold">Schnellnotiz</h3>
              </div>
              <div className="flex items-center gap-1">
                {noteCount > 0 && (
                  <button
                    onClick={() => setShowList(!showList)}
                    className="text-xs text-muted-foreground hover:text-foreground px-2 py-1 rounded transition-colors"
                  >
                    {showList ? "Neue Notiz" : `${noteCount} Notizen`}
                  </button>
                )}
                <button
                  onClick={() => setIsOpen(false)}
                  className="p-1 rounded-full hover:bg-muted transition-colors"
                  aria-label="Schließen"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {showList ? (
              /* Notes list */
              <div className="px-4 pb-4 overflow-y-auto flex-1">
                <div className="space-y-2">
                  {recentNotes.map(note => (
                    <div
                      key={note.id}
                      className="flex items-start gap-2 p-2 rounded-lg bg-muted/50 group"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-xs leading-relaxed">{note.text}</p>
                        <div className="flex items-center gap-1.5 mt-1">
                          <Clock className="w-2.5 h-2.5 text-muted-foreground" />
                          <span className="text-[10px] text-muted-foreground">
                            {formatTime(note.createdAt)}
                          </span>
                          {note.entityName && (
                            <span className="text-[10px] text-muted-foreground">
                              · {note.entityName}
                            </span>
                          )}
                        </div>
                      </div>
                      <button
                        onClick={() => deleteNote(note.id)}
                        className="p-1 rounded opacity-0 group-hover:opacity-100 hover:bg-background transition-all"
                        aria-label="Notiz löschen"
                      >
                        <Trash2 className="w-3 h-3 text-destructive" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              /* New note input */
              <div className="px-4 pb-4">
                {entity && (
                  <p className="text-[10px] text-muted-foreground mb-2">
                    Notiz für: <span className="font-medium">{entity.name}</span>
                  </p>
                )}
                <textarea
                  ref={textareaRef}
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Notiz eingeben..."
                  className={cn(
                    "w-full h-24 px-3 py-2 text-sm rounded-lg border bg-card resize-none",
                    "focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary",
                    "placeholder:text-muted-foreground/50"
                  )}
                  maxLength={500}
                />
                <div className="flex items-center justify-between mt-2">
                  <span className="text-[10px] text-muted-foreground">
                    {text.length}/500 · ⌘+Enter zum Speichern
                  </span>
                  <button
                    onClick={handleSubmit}
                    disabled={!text.trim()}
                    className={cn(
                      "flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md",
                      "bg-amber-500 text-white hover:bg-amber-600 transition-colors",
                      "disabled:opacity-30 disabled:cursor-not-allowed",
                      isMobile && "min-h-[36px]"
                    )}
                  >
                    <Send className="w-3 h-3" />
                    Speichern
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
});
