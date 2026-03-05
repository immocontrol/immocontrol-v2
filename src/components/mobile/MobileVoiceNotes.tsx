/**
 * MOB2-6: Voice-to-Text für Notizen
 * Microphone button that can be added to any textarea/notes field.
 * Wraps MobileVoiceInput with a notes-specific UI (append mode, recording indicator).
 */
import { memo, useState, useCallback } from "react";
import { Mic, MicOff, Type } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";
import { useHaptic } from "@/hooks/useHaptic";
import { cn } from "@/lib/utils";

interface MobileVoiceNotesProps {
  /** Current text value */
  value: string;
  /** Callback when text changes */
  onChange: (text: string) => void;
  /** Placeholder text */
  placeholder?: string;
  /** Number of rows for the textarea */
  rows?: number;
  /** Label above the textarea */
  label?: string;
  className?: string;
}

/** Check if Speech Recognition API is available */
const getSpeechRecognition = (): (new () => SpeechRecognition) | null => {
  if (typeof window === "undefined") return null;
  const w = window as unknown as Record<string, unknown>;
  return (w.SpeechRecognition || w.webkitSpeechRecognition) as (new () => SpeechRecognition) | null;
};

export const MobileVoiceNotes = memo(function MobileVoiceNotes({
  value, onChange, placeholder = "Notiz eingeben...", rows = 3, label, className,
}: MobileVoiceNotesProps) {
  const isMobile = useIsMobile();
  const haptic = useHaptic();
  const [listening, setListening] = useState(false);
  const [supported] = useState(() => getSpeechRecognition() !== null);

  const startListening = useCallback(() => {
    const SpeechRecognitionClass = getSpeechRecognition();
    if (!SpeechRecognitionClass) return;

    haptic.medium();
    const recognition = new SpeechRecognitionClass();
    recognition.lang = "de-DE";
    recognition.continuous = true;
    recognition.interimResults = true;

    let baseText = value;
    if (baseText && !baseText.endsWith(" ")) baseText += " ";

    recognition.onstart = () => setListening(true);
    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let transcript = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        transcript += event.results[i][0].transcript;
      }
      onChange(baseText + transcript);
    };
    recognition.onerror = () => { haptic.error(); setListening(false); };
    recognition.onend = () => { setListening(false); haptic.tap(); };

    try { recognition.start(); } catch { setListening(false); }

    // Store ref to stop later
    (window as unknown as Record<string, unknown>).__voiceRecognition = recognition;
  }, [value, onChange, haptic]);

  const stopListening = useCallback(() => {
    haptic.tap();
    const rec = (window as unknown as Record<string, unknown>).__voiceRecognition as SpeechRecognition | undefined;
    rec?.stop();
    setListening(false);
  }, [haptic]);

  const showVoice = isMobile && supported;

  return (
    <div className={cn("space-y-1.5", className)}>
      {label && <label className="text-xs font-medium text-muted-foreground">{label}</label>}
      <div className="relative">
        <textarea
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
          rows={rows}
          className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/30 transition-shadow"
          style={{ paddingRight: showVoice ? "3rem" : undefined }}
        />
        {showVoice && (
          <button
            type="button"
            onClick={listening ? stopListening : startListening}
            className={cn(
              "absolute right-2 top-2 p-2 rounded-full transition-all active:scale-90",
              listening
                ? "bg-destructive text-destructive-foreground animate-pulse"
                : "bg-secondary text-secondary-foreground hover:bg-secondary/80",
            )}
            aria-label={listening ? "Spracheingabe stoppen" : "Spracheingabe starten"}
          >
            {listening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
          </button>
        )}
      </div>
      {listening && (
        <div className="flex items-center gap-2 text-xs text-destructive animate-pulse">
          <div className="w-2 h-2 rounded-full bg-destructive" />
          Spricht... Tippe zum Stoppen
        </div>
      )}
      {showVoice && !listening && (
        <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
          <Type className="h-3 w-3" /> Tippen oder <Mic className="h-3 w-3" /> Diktieren
        </div>
      )}
    </div>
  );
});
