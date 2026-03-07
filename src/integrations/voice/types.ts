/**
 * Gemeinsame Typen für die Voice/Calling-Integration.
 * Ermöglicht später einfaches Einbinden von Twilio, Vonage, etc.
 */

/** Kontext für einen Anruf (z. B. für Aufzeichnung und Zuordnung zum Lead). */
export interface CallContext {
  /** CRM-Lead-ID – für spätere Zuordnung der Aufzeichnung zu crm_call_logs */
  leadId?: string;
  /** Kontakt-ID (z. B. Kontakte-Seite) */
  contactId?: string;
  /** Aufzeichnung gewünscht (wenn Provider es unterstützt). Einwilligung holt der Nutzer selbst ein. */
  record?: boolean;
  /** Optional: Anzeigename der Gegenseite (für Logs) */
  toLabel?: string;
}

/** Optionen zum Starten eines Anrufs. */
export interface StartCallOptions {
  /** Zielrufnummer (E.164 oder national) */
  to: string;
  /** Optional: Kontext für Recording/Lead-Zuordnung */
  context?: CallContext;
}

/** Ergebnis von startCall. */
export interface StartCallResult {
  ok: boolean;
  /** Wie der Anruf ausgeführt wurde (tel = Gerät öffnet Wähler, voip = über Provider) */
  method: "tel" | "voip";
  /** Vom Provider vergebene Call-ID (für Webhook/Zuordnung der Aufzeichnung) */
  callId?: string;
  /** Fehlermeldung, wenn ok === false */
  error?: string;
}

/**
 * Abstraktion für einen Voice/Calling-Provider.
 * Implementierungen: TelProvider (tel:), TwilioProvider, VonageProvider, etc.
 */
export interface VoiceProvider {
  id: string;
  name: string;
  /** Ob dieser Provider Aufzeichnung unterstützt (ohne System-Ansage). */
  supportsRecording: boolean;
  /**
   * Anruf starten.
   * - Tel: öffnet tel:-Link, return sofort mit method "tel".
   * - Twilio/Vonage: ruft Backend auf, startet Verbindung, return mit callId.
   */
  startCall(options: StartCallOptions): Promise<StartCallResult>;
  /**
   * Gibt die URL zurück, die für einen Anruf verwendet wird (z. B. tel:+49...).
   * Für tel-Provider: zum Setzen von href. Für VoIP: oft nicht nutzbar (Anruf läuft über Backend).
   */
  getCallUrl?(phone: string): string;
}
