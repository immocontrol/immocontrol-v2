/**
 * MOB-9: Voice-Input für Notizen/Suche
 * Microphone button for search fields and note inputs.
 * Uses Web Speech API for speech-to-text. Especially useful during property visits.
 */
import { memo, useState, useCallback, useRef, useEffect } from "react";
import { Mic, MicOff, Loader2 } from "lucide-react";
import { useHaptic } from "@/hooks/useHaptic";
import { cn } from "@/lib/utils";

interface MobileVoiceInputProps {
  /** Callback with transcribed text */
  onResult: (text: string) => void;
  /** Language code (default: "de-DE") */
  lang?: string;
  /** Whether to append to existing text or replace */
  append?: boolean;
  /** Button size */
  size?: "sm" | "md" | "lg";
  className?: string;
}

/** Check if Speech Recognition API is available */
const getSpeechRecognition = (): (new () => SpeechRecognition) | null => {
  if (typeof window === "undefined") return null;
  const w = window as unknown as Record<string, unknown>;
  return (w.SpeechRecognition || w.webkitSpeechRecognition) as (new () => SpeechRecognition) | null;
};

export const MobileVoiceInput = memo(function MobileVoiceInput({
  onResult, lang = "de-DE", size = "md", className,
}: MobileVoiceInputProps) {
  const haptic = useHaptic();
  const [listening, setListening] = useState(false);
  const [supported, setSupported] = useState(false);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const transcriptRef = useRef("");

  useEffect(() => {
    setSupported(getSpeechRecognition() !== null);
  }, []);

  const startListening = useCallback(() => {
    const SpeechRecognitionClass = getSpeechRecognition();
    if (!SpeechRecognitionClass) return;

    haptic.medium();
    const recognition = new SpeechRecognitionClass();
    recognition.lang = lang;
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => setListening(true);

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let finalTranscript = "";
      let interimTranscript = "";

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) {
          finalTranscript += result[0].transcript;
        } else {
          interimTranscript += result[0].transcript;
        }
      }

      if (finalTranscript) {
        transcriptRef.current += finalTranscript + " ";
        onResult(transcriptRef.current.trim());
      } else if (interimTranscript) {
        onResult((transcriptRef.current + interimTranscript).trim());
      }
    };

    recognition.onerror = () => {
      haptic.error();
      setListening(false);
    };

    recognition.onend = () => {
      setListening(false);
    };

    transcriptRef.current = "";
    recognitionRef.current = recognition;

    try {
      recognition.start();
    } catch {
      setListening(false);
    }
  }, [haptic, lang, onResult]);

  const stopListening = useCallback(() => {
    haptic.tap();
    recognitionRef.current?.stop();
    setListening(false);
  }, [haptic]);

  const handleClick = useCallback(() => {
    if (listening) {
      stopListening();
    } else {
      startListening();
    }
  }, [listening, startListening, stopListening]);

  if (!supported) return null;

  const sizes = {
    sm: "h-8 w-8",
    md: "h-10 w-10",
    lg: "h-12 w-12",
  };

  const iconSizes = {
    sm: "h-3.5 w-3.5",
    md: "h-4 w-4",
    lg: "h-5 w-5",
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      className={cn(
        "rounded-full flex items-center justify-center transition-all active:scale-95",
        listening
          ? "bg-destructive text-destructive-foreground animate-pulse shadow-lg"
          : "bg-secondary text-secondary-foreground hover:bg-secondary/80",
        sizes[size],
        className,
      )}
      aria-label={listening ? "Spracheingabe stoppen" : "Spracheingabe starten"}
      title={listening ? "Aufnahme läuft..." : "Spracheingabe"}
    >
      {listening ? (
        <MicOff className={iconSizes[size]} />
      ) : (
        <Mic className={iconSizes[size]} />
      )}
    </button>
  );
});
