/**
 * AI-basierte Extraktion für Verträge, Exposés, Dokumentkategorien und Nachrichtenzusammenfassungen.
 * Nutzt DeepSeek (completeDeepSeekChat). Nur nutzbar wenn VITE_DEEPSEEK_API_KEY gesetzt ist.
 */

import { completeDeepSeekChat, isDeepSeekConfigured } from "./deepseek";

/** Extrahierte Vertragsfelder aus PDF/Text (für App-Formular) */
export interface ExtractedContractFields {
  start_date?: string; // YYYY-MM-DD
  end_date?: string | null;
  is_indefinite?: boolean;
  notice_period_months?: number;
  base_rent?: number;
  cold_rent?: number;
  warm_rent?: number;
  deposit_amount?: number;
  rent_increase_index?: string;
  notes?: string;
}

/** Extrahierte Deal-Felder + Bewertung aus Exposé-Text */
export interface ExtractedDealData {
  title?: string;
  address?: string;
  description?: string;
  purchase_price?: number;
  expected_rent?: number;
  sqm?: number;
  units?: number;
  property_type?: string;
  contact_name?: string;
  contact_phone?: string;
  contact_email?: string;
  source?: string;
  notes?: string;
  deal_score?: number; // 0–100
  score_reason?: string;
}

/** Extrahierte Darlehensfelder aus PDF/Text */
export interface ExtractedLoanFields {
  bank_name?: string;
  loan_amount?: number;
  remaining_balance?: number;
  interest_rate?: number;
  repayment_rate?: number;
  monthly_payment?: number;
  fixed_interest_until?: string; // YYYY-MM-DD
  start_date?: string;
  loan_type?: string;
  notes?: string;
}

const SYSTEM_JSON = "Antworte ausschließlich mit gültigem JSON, ohne Code-Block oder Erklärung.";

/**
 * Vertragstext (z. B. aus PDF) analysieren und strukturierte Felder extrahieren.
 * Geeignet für Mietverträge (Beginn, Ende, Kündigungsfrist, Mieten, Kaution).
 */
export async function extractContractFromText(text: string): Promise<ExtractedContractFields> {
  const prompt = `Analysiere den folgenden Vertragstext (Mietvertrag o. ä.) und extrahiere die genannten Felder.
Antworte NUR mit einem JSON-Objekt mit genau diesen Keys (fehlende Werte als null oder weglassen):
- start_date: Vertragsbeginn im Format YYYY-MM-DD
- end_date: Vertragsende YYYY-MM-DD oder null wenn unbefristet
- is_indefinite: true wenn unbefristet, sonst false
- notice_period_months: Kündigungsfrist in Monaten (Zahl)
- base_rent: Nettokaltmiete/Monat in Euro (Zahl)
- cold_rent: Kaltmiete/Monat in Euro (Zahl)
- warm_rent: Warmmiete/Monat in Euro (Zahl)
- deposit_amount: Kaution in Euro (Zahl)
- rent_increase_index: "mietspiegel" | "index" | "staffel" | "keine" falls erkennbar
- notes: kurze Stichpunkte zu Besonderheiten (ein Satz) oder weglassen

Vertragstext:
---
${text.slice(0, 12000)}
---`;

  const raw = await completeDeepSeekChat(
    [{ role: "user", content: prompt }],
    { systemPrompt: SYSTEM_JSON, maxTokens: 1024 }
  );
  return parseJsonSafe<ExtractedContractFields>(raw);
}

/**
 * Exposé-Text analysieren: Deal-Felder + Deal-Score (0–100) und Begründung.
 */
export async function extractDealFromExposeText(text: string): Promise<ExtractedDealData> {
  const prompt = `Analysiere den folgenden Immobilien-Exposé-Text und extrahiere alle relevanten Angaben für einen Deal.
Zusätzlich gib einen Deal-Score von 0–100 (deal_score) und eine kurze Begründung (score_reason, 1–2 Sätze) basierend auf Lage, Preis, Mietrendite, Zustand, etc.

Antworte NUR mit einem JSON-Objekt mit diesen Keys (fehlende Werte weglassen oder null):
- title: Kurzer Objekttitel (z. B. "ETW Musterstraße 1")
- address: vollständige Adresse
- description: kurze Beschreibung oder Stichpunkte
- purchase_price: Kaufpreis in Euro (Zahl)
- expected_rent: erwartete Monatsmiete in Euro (Zahl), falls im Text
- sqm: Wohnfläche in qm (Zahl)
- units: Anzahl Einheiten/Wohnungen (Zahl, Standard 1)
- property_type: "ETW" | "MFH" | "EFH" | "Gewerbe" | "Grundstück"
- contact_name, contact_phone, contact_email: falls im Text
- source: z. B. "Exposé PDF"
- notes: weitere wichtige Infos
- deal_score: Zahl 0–100 (Bewertung des Deals)
- score_reason: kurze Begründung für den Score

Exposé-Text:
---
${text.slice(0, 14000)}
---`;

  const raw = await completeDeepSeekChat(
    [{ role: "user", content: prompt }],
    { systemPrompt: SYSTEM_JSON, maxTokens: 1024 }
  );
  return parseJsonSafe<ExtractedDealData>(raw);
}

/**
 * Darlehens-Text (z. B. aus Kreditvertrags-PDF) analysieren und strukturierte Felder extrahieren.
 */
export async function extractLoanFromText(text: string): Promise<ExtractedLoanFields> {
  const prompt = `Analysiere den folgenden Darlehens-/Kreditvertragstext und extrahiere die genannten Felder.
Antworte NUR mit einem JSON-Objekt mit genau diesen Keys (fehlende Werte weglassen oder null):
- bank_name: Name der Bank (z. B. "Sparkasse XY")
- loan_amount: Darlehensbetrag in Euro (Zahl)
- remaining_balance: Restschuld in Euro (Zahl)
- interest_rate: Zinssatz in % (Zahl)
- repayment_rate: Tilgungssatz in % (Zahl)
- monthly_payment: Monatliche Rate in Euro (Zahl)
- fixed_interest_until: Ende der Zinsbindung im Format YYYY-MM-DD (String)
- start_date: Vertragsbeginn/Auszahlung YYYY-MM-DD (String)
- loan_type: "annuity" | "bullet" | "variable" | "kfw" falls erkennbar
- notes: kurze Besonderheiten (1–2 Sätze) oder weglassen

Text:
---
${text.slice(0, 12000)}
---`;

  const raw = await completeDeepSeekChat(
    [{ role: "user", content: prompt }],
    { systemPrompt: SYSTEM_JSON, maxTokens: 512 }
  );
  return parseJsonSafe<ExtractedLoanFields>(raw);
}

const DOC_CATEGORIES = [
  "Mietvertrag", "Grundbuchauszug", "Nebenkostenabrechnung", "Versicherung",
  "Gutachten", "Steuer", "Rechnung", "Bescheid", "Protokoll", "Sonstiges",
];

/**
 * Aus Dokumenttext (z. B. OCR/PDF) eine Kategorie vorschlagen.
 * Gibt genau einen der DOC_CATEGORIES zurück.
 */
export async function suggestDocumentCategory(text: string): Promise<string> {
  if (!text || text.trim().length < 50) return "Sonstiges";

  const prompt = `Der folgende Text stammt aus einem hochgeladenen Dokument.
Wähle die passendste Kategorie. Antworte NUR mit genau einem der folgenden Wörter (ohne Anführungszeichen, ohne Punkt):
${DOC_CATEGORIES.join(", ")}

Dokumenttext (Auszug):
---
${text.slice(0, 4000)}
---`;

  const raw = await completeDeepSeekChat(
    [{ role: "user", content: prompt }],
    { maxTokens: 50 }
  );

  const normalized = raw.trim().replace(/^["']|["']\.?$/g, "");
  const found = DOC_CATEGORIES.find(
    (c) => c.toLowerCase() === normalized.toLowerCase()
  );
  return found ?? "Sonstiges";
}

/**
 * Liste von Nachrichten (z. B. Mieter/Vermieter) in einer kurzen Zusammenfassung zusammenfassen.
 */
export async function summarizeMessages(
  messages: { content: string; sender_role?: string }[]
): Promise<string> {
  if (messages.length === 0) return "";

  const block = messages
    .map((m) => `[${m.sender_role ?? "unbekannt"}]: ${m.content}`)
    .join("\n");

  const prompt = `Fasse die folgenden Nachrichten zwischen Mieter und Vermieter in 2–4 Sätzen sachlich zusammen. Nenne Kernanliegen, Fragen und ggf. vereinbarte Punkte. Keine Einleitung wie "Zusammenfassung:".

Nachrichten:
---
${block.slice(0, 8000)}
---`;

  const raw = await completeDeepSeekChat(
    [{ role: "user", content: prompt }],
    { maxTokens: 512 }
  );
  return raw.trim();
}

/**
 * Antwortvorschlag für Vermieter basierend auf Nachrichtenverlauf (Mieter/Vermieter).
 */
export async function suggestReply(
  messages: { content: string; sender_role?: string }[]
): Promise<string> {
  if (messages.length === 0) return "";

  const block = messages
    .map((m) => `[${m.sender_role ?? "unbekannt"}]: ${m.content}`)
    .join("\n");

  const prompt = `Du bist der Vermieter. Basierend auf den folgenden Nachrichten schlage eine kurze, sachliche Antwort vor (2–4 Sätze). Höflich, professionell, auf Deutsch. Keine Anrede, direkt die Antwort. Keine Einleitung wie "Vorschlag:".

Nachrichten:
---
${block.slice(0, 4000)}
---`;

  const raw = await completeDeepSeekChat(
    [{ role: "user", content: prompt }],
    { maxTokens: 256 }
  );
  return raw.trim();
}

/**
 * Liste von Notizen zu einer Immobilie in 2–4 Sätzen zusammenfassen.
 */
export async function summarizeNotes(notes: { content: string; created_at?: string }[]): Promise<string> {
  if (notes.length === 0) return "";

  const block = notes
    .map((n, i) => `[${i + 1}]: ${n.content}`)
    .join("\n");

  const prompt = `Fasse die folgenden Objekt-Notizen in 2–4 Sätzen sachlich zusammen. Nenne die wichtigsten Punkte (Mietermeldungen, geplante Maßnahmen, Besonderheiten). Keine Einleitung wie "Zusammenfassung:".

Notizen:
---
${block.slice(0, 8000)}
---`;

  const raw = await completeDeepSeekChat(
    [{ role: "user", content: prompt }],
    { maxTokens: 512 }
  );
  return raw.trim();
}

/**
 * Ticket-Beschreibung aus Titel und Kategorie vorschlagen (für Handwerker-Vorgaben).
 */
/**
 * Begründung für Mieterhöhung (Index-/Staffelmiete) generieren.
 * Für Mieterhöhungsschreiben und IndexMietanpassung.
 */
export async function generateRentIncreaseJustification(adj: {
  propertyName: string;
  currentRent: number;
  newRent: number;
  increasePct: number;
}): Promise<string> {
  const prompt = `Generiere eine kurze, formelle Begründung (2–4 Sätze) für eine Mieterhöhung gemäß Mietvertrag (Index-/Staffelmietanpassung).
- Objekt: ${adj.propertyName}
- Aktuelle Nettokaltmiete: ${adj.currentRent.toFixed(2)} €/Monat
- Neue Nettokaltmiete: ${adj.newRent.toFixed(2)} €/Monat (Erhöhung um ${adj.increasePct.toFixed(2)} %)
- Bezug auf Verbraucherpreisindex oder vertragliche Staffel, sachlich und höflich.
- Auf Deutsch. Keine Anrede.`;

  const raw = await completeDeepSeekChat(
    [{ role: "user", content: prompt }],
    { maxTokens: 256 }
  );
  return raw.trim();
}

/** Stage-Namen für Deal-Next-Step */
const DEAL_STAGES: Record<string, string> = {
  recherche: "Recherche",
  kontaktiert: "Kontaktiert",
  besichtigung: "Besichtigung",
  angebot: "Angebot",
  verhandlung: "Verhandlung",
  abgeschlossen: "Abgeschlossen",
  abgelehnt: "Abgelehnt",
};

/**
 * Nächsten Deal-Schritt vorschlagen (AI).
 * Basierend auf Stage, Notizen und Alter.
 */
export async function suggestDealNextStep(ctx: {
  stage: string;
  title?: string;
  address?: string;
  notes?: string;
  createdAt?: string;
}): Promise<string> {
  const stageLabel = DEAL_STAGES[ctx.stage] || ctx.stage;
  const days = ctx.createdAt
    ? Math.floor((Date.now() - new Date(ctx.createdAt).getTime()) / 86400000)
    : null;
  const prompt = `Du bist ein Immobilien-Experte. Der Nutzer bearbeitet einen Deal.
- Stage: ${stageLabel}
- Titel: ${ctx.title || "–"}
- Adresse: ${ctx.address || "–"}
- Notizen: ${(ctx.notes || "").slice(0, 300)}
${days != null ? `- Alter: ${days} Tage` : ""}

Schlage den nächsten konkreten Schritt vor (1–2 Sätze). Auf Deutsch. Kein Bullet. Beispiel: "Angebot erstellen und per E-Mail versenden" oder "Besichtigung planen und Mieter kontaktieren".`;

  const raw = await completeDeepSeekChat(
    [{ role: "user", content: prompt }],
    { maxTokens: 120 }
  );
  return raw.trim();
}

export async function suggestTicketDescription(title: string, category: string): Promise<string> {
  const prompt = `Der Nutzer erstellt ein Ticket für Vermieter/Handwerker.
Titel: "${title}"
Kategorie: ${category}

Generiere eine kurze, sachliche Beschreibung (2–4 Sätze) als Vorschlag, die das Problem klar macht und ggf. Handlungsbedarf beschreibt. Auf Deutsch. Keine Anrede.`;

  const raw = await completeDeepSeekChat(
    [{ role: "user", content: prompt }],
    { maxTokens: 256 }
  );
  return raw.trim();
}

/**
 * Kurzer Einstiegssatz für Kaltakquise-Anruf (WGH-Scout).
 * Ein Satz, höflich, mit Namen/Branche, ohne Werbung.
 */
export async function suggestColdCallOpening(name: string, type: string, address?: string | null): Promise<string> {
  const prompt = `Du bist ein Immobilieninvestor. Du rufst ein Gewerbe (Wohn- und Geschäftshaus / WGH) an (Kaltakquise), um nach dem Gebäude/Objekt zu fragen.
Name: ${name}
Branche/Typ: ${type}
${address ? `Adresse: ${address}` : ""}

Generiere genau einen kurzen Einstiegssatz (1 Satz) für den Anruf. Höflich, sachlich, kein Werbesprache. Du stellst dich kurz vor und sagst, dass du dich für das Objekt/Gebäude interessierst. Keine Anrede wie "Guten Tag". Direkt der Satz. Auf Deutsch.`;

  const raw = await completeDeepSeekChat(
    [{ role: "user", content: prompt }],
    { systemPrompt: "Du bist ein Assistent für kurze, professionelle Formulierungen. Antworte nur mit dem einen Satz.", maxTokens: 80 }
  );
  return raw.trim();
}

/**
 * Text verbessern/formalieren (Rechtschreibung, Stil, Formulierung).
 * Für Anschreiben, Begründungen, Notizen.
 */
export async function improveText(text: string, context?: string): Promise<string> {
  if (!text || text.trim().length < 10) return text;
  const prompt = context
    ? `Verbessere den folgenden Text: Rechtschreibung, Satzbau und Stil. Behalte die Aussage bei, mache ihn formeller und prägnanter. Kontext: ${context}\n\nText:\n${text}`
    : `Verbessere den folgenden Text: Rechtschreibung, Satzbau und Stil. Behalte die Aussage bei, mache ihn formeller und prägnanter. Auf Deutsch.\n\nText:\n${text}`;

  const raw = await completeDeepSeekChat(
    [{ role: "user", content: prompt }],
    { maxTokens: 512 }
  );
  return raw.trim() || text;
}

export { isDeepSeekConfigured };

function parseJsonSafe<T>(raw: string): T {
  const cleaned = raw
    .replace(/^[\s\n]*```\w*\n?/i, "")
    .replace(/\n?```[\s\n]*$/i, "")
    .trim();
  try {
    const parsed = JSON.parse(cleaned) as T;
    return typeof parsed === "object" && parsed !== null ? parsed : ({} as T);
  } catch {
    return {} as T;
  }
}
