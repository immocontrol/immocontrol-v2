/**
 * Einheitlicher Anruf-Button/Link: nutzt startCall() für alle Voice-Provider (tel + VoIP).
 * Zeigt bei Fehler einen Toast mit „Erneut versuchen“; bei tel wird der System-Wähler geöffnet.
 * Nutzbar in Contacts, TenantManagement, TicketSystem, CRM, Scout.
 */
import { useCallback } from "react";
import { Phone } from "lucide-react";
import { toast } from "sonner";
import { startCall } from "@/integrations/voice";
import { toastErrorWithRetry } from "@/lib/toastMessages";
import { cn } from "@/lib/utils";

export interface CallButtonProps {
  /** Rufnummer (wird bereinigt). */
  phone: string;
  /** Anzeigename der Gegenseite (für Logs/VoIP). */
  toLabel?: string;
  /** Optional: Kontext (z. B. leadId, record) für CRM. */
  leadId?: string;
  record?: boolean;
  /** Inhalt (Standard: Icon + Nummer). */
  children?: React.ReactNode;
  className?: string;
  /** Als Link-Stil (underline, primary). */
  variant?: "link" | "inline";
  ariaLabel?: string;
}

export function CallButton({
  phone,
  toLabel,
  leadId,
  record,
  children,
  className,
  variant = "inline",
  ariaLabel,
}: CallButtonProps) {
  const normalized = phone.replace(/\s/g, "").trim();
  const performCall = useCallback(async () => {
    const result = await startCall({
      to: normalized,
      context: { toLabel, leadId, record },
    });
    if (!result?.ok && result?.error) {
      toastErrorWithRetry(result.error, performCall);
    }
  }, [normalized, toLabel, leadId, record]);
  const handleClick = useCallback(async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!normalized) {
      toast.error("Keine Nummer angegeben.");
      return;
    }
    await performCall();
  }, [normalized, performCall]);

  if (!normalized) return null;

  const label = ariaLabel ?? (toLabel ? `Anrufen: ${toLabel}` : `Anrufen: ${phone}`);
  const content = children ?? (
    <>
      <Phone className="h-2.5 w-2.5 shrink-0" /> {phone}
    </>
  );

  return (
    <button
      type="button"
      onClick={handleClick}
      className={cn(
        "inline-flex items-center gap-0.5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded",
        variant === "link" && "text-primary hover:underline",
        variant === "inline" && "hover:text-primary",
        className
      )}
      aria-label={label}
    >
      {content}
    </button>
  );
}
