/**
 * MOB6-4: Mobile Smart Clipboard
 * Detects copied IBANs, addresses, amounts and offers context-based paste actions.
 * Shows a floating banner when relevant clipboard content is detected.
 */
import { useState, useEffect, useCallback, useRef, memo } from "react";
import { useIsMobile } from "@/hooks/use-mobile";
import { Clipboard, CreditCard, MapPin, Euro, Hash, X, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";

export interface ClipboardDetection {
  type: "iban" | "address" | "amount" | "phone" | "email" | "unknown";
  value: string;
  formatted: string;
  confidence: number;
}

interface MobileSmartClipboardProps {
  /** Handler when user accepts a paste action */
  onPaste?: (detection: ClipboardDetection) => void;
  /** Handler for specific field paste */
  onPasteToField?: (detection: ClipboardDetection, fieldId: string) => void;
  /** Available target fields */
  targetFields?: Array<{ id: string; label: string; accepts: ClipboardDetection["type"][] }>;
  /** Auto-dismiss timeout in ms (default 8000) */
  autoDismissMs?: number;
  /** Additional class */
  className?: string;
}

const IBAN_REGEX = /^[A-Z]{2}\d{2}\s?\d{4}\s?\d{4}\s?\d{4}\s?\d{4}\s?\d{0,4}\s?\d{0,2}$/i;
const AMOUNT_REGEX = /^[€$]?\s*\d{1,3}([.,]\d{3})*([.,]\d{1,2})?\s*[€$]?$/;
const PHONE_REGEX = /^[+]?\d[\d\s\-/()]{7,}$/;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function detectClipboardContent(text: string): ClipboardDetection | null {
  const trimmed = text.trim();
  if (!trimmed || trimmed.length > 200) return null;

  // IBAN detection
  const ibanClean = trimmed.replace(/\s/g, "");
  if (IBAN_REGEX.test(trimmed) || (ibanClean.length >= 15 && ibanClean.length <= 34 && /^[A-Z]{2}\d{2}/.test(ibanClean))) {
    const formatted = ibanClean.replace(/(.{4})/g, "$1 ").trim();
    return { type: "iban", value: ibanClean, formatted, confidence: 0.95 };
  }

  // Amount detection
  if (AMOUNT_REGEX.test(trimmed)) {
    /* FIX-1: Use global /,/g to replace ALL commas */
    const cleaned = trimmed.replace(/[€$\s]/g, "").replace(/\./g, "").replace(/,/g, ".");
    const num = parseFloat(cleaned);
    if (!isNaN(num)) {
      return {
        type: "amount",
        value: String(num),
        formatted: new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(num),
        confidence: 0.85,
      };
    }
  }

  // Email detection
  if (EMAIL_REGEX.test(trimmed)) {
    return { type: "email", value: trimmed, formatted: trimmed, confidence: 0.95 };
  }

  // Phone detection
  if (PHONE_REGEX.test(trimmed)) {
    return { type: "phone", value: trimmed.replace(/[\s\-/()]/g, ""), formatted: trimmed, confidence: 0.8 };
  }

  // Address detection (contains number + street-like words)
  if (trimmed.length > 10 && /\d/.test(trimmed) && (/str|weg|platz|allee|gasse|ring|damm|ufer/i.test(trimmed) || /\d{5}/.test(trimmed))) {
    return { type: "address", value: trimmed, formatted: trimmed, confidence: 0.7 };
  }

  return null;
}

const typeIcons: Record<ClipboardDetection["type"], React.ReactNode> = {
  iban: <CreditCard className="w-4 h-4" />,
  address: <MapPin className="w-4 h-4" />,
  amount: <Euro className="w-4 h-4" />,
  phone: <Hash className="w-4 h-4" />,
  email: <Hash className="w-4 h-4" />,
  unknown: <Clipboard className="w-4 h-4" />,
};

const typeLabels: Record<ClipboardDetection["type"], string> = {
  iban: "IBAN erkannt",
  address: "Adresse erkannt",
  amount: "Betrag erkannt",
  phone: "Telefonnummer erkannt",
  email: "E-Mail erkannt",
  unknown: "Text erkannt",
};

export const MobileSmartClipboard = memo(function MobileSmartClipboard({
  onPaste,
  onPasteToField,
  targetFields = [],
  autoDismissMs = 8000,
  className,
}: MobileSmartClipboardProps) {
  const isMobile = useIsMobile();
  const [detection, setDetection] = useState<ClipboardDetection | null>(null);
  const [isVisible, setIsVisible] = useState(false);
  const dismissTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastClipboardRef = useRef<string>("");

  const clearTimer = useCallback(() => {
    if (dismissTimerRef.current) {
      clearTimeout(dismissTimerRef.current);
      dismissTimerRef.current = null;
    }
  }, []);

  const dismiss = useCallback(() => {
    setIsVisible(false);
    clearTimer();
    setTimeout(() => setDetection(null), 300);
  }, [clearTimer]);

  // Check clipboard on focus/visibility change
  useEffect(() => {
    const checkClipboard = async () => {
      try {
        if (!navigator.clipboard?.readText) return;
        const text = await navigator.clipboard.readText();
        if (text === lastClipboardRef.current) return;
        lastClipboardRef.current = text;

        const result = detectClipboardContent(text);
        if (result && result.confidence >= 0.7) {
          setDetection(result);
          setIsVisible(true);
          clearTimer();
          dismissTimerRef.current = setTimeout(dismiss, autoDismissMs);
        }
      } catch {
        // Clipboard access denied — silent
      }
    };

    const handleFocus = () => checkClipboard();
    const handleVisibility = () => {
      if (document.visibilityState === "visible") checkClipboard();
    };

    window.addEventListener("focus", handleFocus);
    document.addEventListener("visibilitychange", handleVisibility);
    return () => {
      window.removeEventListener("focus", handleFocus);
      document.removeEventListener("visibilitychange", handleVisibility);
      clearTimer();
    };
  }, [autoDismissMs, dismiss, clearTimer]);

  const handlePaste = useCallback(() => {
    if (detection && onPaste) {
      onPaste(detection);
    }
    dismiss();
  }, [detection, onPaste, dismiss]);

  const handlePasteToField = useCallback((fieldId: string) => {
    if (detection && onPasteToField) {
      onPasteToField(detection, fieldId);
    }
    dismiss();
  }, [detection, onPasteToField, dismiss]);

  const matchingFields = targetFields.filter(f =>
    detection ? f.accepts.includes(detection.type) : false
  );

  if (!detection || !isVisible) return null;

  return (
    <div className={cn(
      "fixed bottom-20 left-3 right-3 z-50",
      "animate-in slide-in-from-bottom-4 fade-in duration-300",
      className
    )}>
      <div className={cn(
        "rounded-xl border bg-background shadow-2xl overflow-hidden",
        isMobile ? "mx-0" : "max-w-sm mx-auto"
      )}>
        {/* Header */}
        <div className="flex items-center gap-2.5 px-3 py-2.5 bg-primary/5">
          <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center text-primary">
            {typeIcons[detection.type]}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium">{typeLabels[detection.type]}</p>
            <p className="text-[10px] text-muted-foreground truncate">{detection.formatted}</p>
          </div>
          <button
            onClick={dismiss}
            className="p-1.5 rounded-lg hover:bg-muted"
            aria-label="Schließen"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Actions */}
        <div className="px-3 py-2 space-y-1">
          {onPaste && (
            <button
              onClick={handlePaste}
              className={cn(
                "w-full flex items-center gap-2 px-2.5 py-2 rounded-lg",
                "hover:bg-muted active:bg-muted/80 transition-colors text-left",
                isMobile && "min-h-[44px]"
              )}
            >
              <Clipboard className="w-3.5 h-3.5 text-muted-foreground" />
              <span className="text-xs">Einfügen</span>
              <ArrowRight className="w-3 h-3 ml-auto text-muted-foreground" />
            </button>
          )}
          {matchingFields.map(field => (
            <button
              key={field.id}
              onClick={() => handlePasteToField(field.id)}
              className={cn(
                "w-full flex items-center gap-2 px-2.5 py-2 rounded-lg",
                "hover:bg-muted active:bg-muted/80 transition-colors text-left",
                isMobile && "min-h-[44px]"
              )}
            >
              <ArrowRight className="w-3.5 h-3.5 text-primary" />
              <span className="text-xs">In &quot;{field.label}&quot; einfügen</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
});

export { detectClipboardContent };
