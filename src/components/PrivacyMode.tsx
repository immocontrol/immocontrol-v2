/**
 * #19: Datenschutz-Modus — Sensible Daten wie Mieten, Cashflow etc. auf Knopfdruck ausblenden
 */
import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from "react";
import { EyeOff, Eye } from "lucide-react";

interface PrivacyContextValue {
  isPrivate: boolean;
  toggle: () => void;
  mask: (value: string | number, type?: "currency" | "percent" | "text") => string;
}

const PrivacyContext = createContext<PrivacyContextValue>({
  isPrivate: false,
  toggle: () => {},
  mask: (v) => String(v),
});

const STORAGE_KEY = "immo-privacy-mode";

export function PrivacyProvider({ children }: { children: ReactNode }) {
  const [isPrivate, setIsPrivate] = useState(() => {
    try { return localStorage.getItem(STORAGE_KEY) === "true"; }
    catch { return false; }
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, String(isPrivate));
  }, [isPrivate]);

  const toggle = useCallback(() => setIsPrivate(p => !p), []);

  const mask = useCallback((value: string | number, type?: "currency" | "percent" | "text"): string => {
    if (!isPrivate) return String(value);
    switch (type) {
      case "currency": return "***,** €";
      case "percent": return "**,* %";
      case "text": return "••••••";
      default: return "•••";
    }
  }, [isPrivate]);

  return (
    <PrivacyContext.Provider value={{ isPrivate, toggle, mask }}>
      {children}
    </PrivacyContext.Provider>
  );
}

export function usePrivacy() {
  return useContext(PrivacyContext);
}

/** Toggle button for the header/toolbar */
export function PrivacyToggle() {
  const { isPrivate, toggle } = usePrivacy();

  return (
    <button
      onClick={toggle}
      className={`p-2 rounded-lg transition-colors ${
        isPrivate
          ? "bg-primary/10 text-primary border border-primary/20"
          : "hover:bg-secondary text-muted-foreground"
      }`}
      aria-label={isPrivate ? "Datenschutz-Modus deaktivieren" : "Datenschutz-Modus aktivieren"}
      title={isPrivate ? "Werte anzeigen" : "Werte verbergen"}
    >
      {isPrivate ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
    </button>
  );
}

/** Wrapper component to mask content */
export function PrivateValue({
  value,
  type = "text",
  className = "",
}: {
  value: string | number;
  type?: "currency" | "percent" | "text";
  className?: string;
}) {
  const { isPrivate, mask } = usePrivacy();

  return (
    <span className={`${className} ${isPrivate ? "select-none blur-[3px] hover:blur-none transition-all" : ""}`}>
      {mask(value, type)}
    </span>
  );
}

export default PrivacyToggle;
