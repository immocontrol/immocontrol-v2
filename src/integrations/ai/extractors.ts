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

/**
 * Vorschlag für Notizen zu einer Wartungsmaßnahme (Titel + Kategorie).
 * Nutzt DeepSeek. Nur nutzbar wenn VITE_DEEPSEEK_API_KEY gesetzt ist.
 */
export async function suggestMaintenanceNotes(title: string, category: string): Promise<string> {
  const prompt = `Der Nutzer plant eine Wartungsmaßnahme für eine Immobilie.
Titel: "${title}"
Kategorie: ${category}

Generiere 2–4 kurze Sätze als Notiz-Vorschlag: was zu prüfen ist, ggf. rechtliche Hinweise (z. B. Fristen, Pflichten), und praktische Tipps. Auf Deutsch. Keine Anrede. Kompakt.`;

  const raw = await completeDeepSeekChat(
    [{ role: "user", content: prompt }],
    { systemPrompt: "Du bist ein Assistent für Immobilienwartung. Antworte nur mit dem Notiz-Vorschlag.", maxTokens: 256 }
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
 * Kurze Begründung, warum ein WGH-Scout-Treffer für Akquise interessant sein könnte (Lage, Größe, Nutzung).
 * Ein Satz für Investoren.
 */
export async function suggestScoutInterest(business: { name: string; type?: string; address?: string | null; estimatedGrossArea?: number | null }): Promise<string> {
  const parts = [
    `Name: ${business.name}`,
    business.type ? `Typ/Branche: ${business.type}` : "",
    business.address ? `Adresse: ${business.address}` : "",
    business.estimatedGrossArea != null && business.estimatedGrossArea > 0 ? `ca. ${business.estimatedGrossArea} m²` : "",
  ].filter(Boolean);
  const prompt = `Als Immobilieninvestor: Warum könnte dieses Gewerbe/Gebäude (WGH) für eine Akquise interessant sein? Gib genau einen kurzen Satz (max. 20 Wörter), z. B. Lage, Größe, Nutzungsmix. Auf Deutsch. Keine Anrede.\n\n${parts.join("\n")}`;
  const raw = await completeDeepSeekChat(
    [{ role: "user", content: prompt }],
    { systemPrompt: "Du bist ein Assistent für Immobilienakquise. Antworte nur mit dem einen Satz.", maxTokens: 100 }
  );
  return raw.trim();
}

/**
 * Gesprächstranskript für CRM zusammenfassen (Stichpunkte, Vereinbarungen, nächste Schritte).
 * Nutzt DeepSeek. Nur nutzbar wenn VITE_DEEPSEEK_API_KEY gesetzt ist.
 */
export async function summarizeCallTranscript(transcript: string): Promise<string> {
  if (!transcript || transcript.trim().length < 20) {
    return "";
  }
  const prompt = `Fasse das folgende Gesprächstranskript für ein CRM (Immobilien-Akquise) zusammen. Ausgabe auf Deutsch, als übersichtliche Stichpunkte:
- Wichtigste Aussagen und Vereinbarungen
- Nächste Schritte / To-dos
- Offene Punkte oder Fragen
- Optional: Stimmung/Ergebnis in einem Satz

Halte die Zusammenfassung kompakt (ca. 5–10 Zeilen). Keine Einleitung wie "Zusammenfassung:". Direkt die Stichpunkte.

Transkript:
---
${transcript.slice(0, 12000)}
---`;

  const raw = await completeDeepSeekChat(
    [{ role: "user", content: prompt }],
    { systemPrompt: "Du bist ein Assistent für prägnante Gesprächszusammenfassungen. Antworte nur mit der geforderten Stichpunktliste.", maxTokens: 600 }
  );
  return raw.trim();
}

/**
 * Vorschlag für den nächsten Schritt bei einem CRM-Lead (Anruf, E-Mail, Besichtigung, etc.).
 * Nutzt DeepSeek. Nur nutzbar wenn VITE_DEEPSEEK_API_KEY gesetzt ist.
 */
export async function suggestLeadNextStep(lead: {
  name: string;
  company?: string | null;
  status?: string;
  notes?: string | null;
}): Promise<string> {
  const context = [
    `Name: ${lead.name}`,
    lead.company ? `Firma: ${lead.company}` : "",
    lead.status ? `Status: ${lead.status}` : "",
    lead.notes ? `Notizen: ${lead.notes.slice(0, 500)}` : "",
  ].filter(Boolean).join("\n");
  const prompt = `Als Immobilieninvestor: Was ist der sinnvollste nächste Schritt für diesen Akquise-Lead? Gib genau einen kurzen Satz (max. 15 Wörter), z. B. "Heute anrufen und Besichtigung vorschlagen" oder "E-Mail mit Exposé-Link senden". Auf Deutsch.`;

  const raw = await completeDeepSeekChat(
    [{ role: "user", content: `${context}\n\n${prompt}` }],
    { systemPrompt: "Du bist ein Assistent für Akquise. Antworte nur mit dem einen Satz, ohne Anführungszeichen.", maxTokens: 80 }
  );
  return raw.trim();
}

/**
 * KI-Kurzbewertung für eine Immobilie (1–2 Sätze: Lage, Rendite, Einschätzung).
 * Nutzt DeepSeek. Nur nutzbar wenn VITE_DEEPSEEK_API_KEY gesetzt ist.
 */
export async function suggestPropertySummary(property: {
  name?: string | null;
  address?: string | null;
  monthly_rent?: number | null;
  purchase_price?: number | null;
  sqm?: number | null;
  units?: number | null;
  notes?: string | null;
}): Promise<string> {
  const parts = [
    property.name ? `Objekt: ${property.name}` : "",
    property.address ? `Adresse: ${property.address}` : "",
    property.monthly_rent != null ? `Monatsmiete: ${property.monthly_rent} €` : "",
    property.purchase_price != null ? `Kaufpreis: ${property.purchase_price} €` : "",
    property.sqm != null ? `Wohnfläche: ${property.sqm} m²` : "",
    property.units != null ? `Einheiten: ${property.units}` : "",
    property.notes ? `Notizen: ${property.notes.slice(0, 300)}` : "",
  ].filter(Boolean);
  const context = parts.join("\n");
  const prompt = `Bewerte diese Immobilie als Immobilieninvestor in 1–2 kurzen Sätzen (Lage, Rendite wenn möglich, Einschätzung). Max. 25 Wörter. Auf Deutsch.`;

  const raw = await completeDeepSeekChat(
    [{ role: "user", content: `${context}\n\n${prompt}` }],
    { systemPrompt: "Du bist ein sachkundiger Assistent für Immobilienbewertung. Antworte nur mit den 1–2 Sätzen.", maxTokens: 120 }
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

/**
 * Kurze banktaugliche Zusammenfassung der Selbstauskunft (für Anschreiben oder Prüfung).
 * Nutzt DeepSeek. Nur nutzbar wenn VITE_DEEPSEEK_API_KEY gesetzt ist.
 */
export async function suggestSelbstauskunftSummary(data: {
  vorname?: string;
  name?: string;
  sumEinnahmen?: number;
  sumAusgaben?: number;
  ueberschuss?: number;
  vermoegenKurz?: string;
}): Promise<string> {
  const parts = [
    data.vorname || data.name ? `Antragsteller: ${[data.vorname, data.name].filter(Boolean).join(" ")}` : "",
    data.sumEinnahmen != null ? `Monatliche Einnahmen: ${data.sumEinnahmen.toFixed(2)} €` : "",
    data.sumAusgaben != null ? `Monatliche Ausgaben: ${data.sumAusgaben.toFixed(2)} €` : "",
    data.ueberschuss != null ? `Überschuss: ${data.ueberschuss.toFixed(2)} €/Monat` : "",
    data.vermoegenKurz ? `Vermögen (Kurz): ${data.vermoegenKurz}` : "",
  ].filter(Boolean);
  const prompt = `Basierend auf diesen Selbstauskunft-Daten: Erstelle einen kurzen, sachlichen Absatz (3–4 Sätze) für die Bank: Einkommenssituation, Überschuss und ggf. Vermögen. Formell, auf Deutsch. Keine Anrede. Falls Überschuss negativ ist, erwähne das neutral.`;

  const raw = await completeDeepSeekChat(
    [{ role: "user", content: `${parts.join("\n")}\n\n${prompt}` }],
    { systemPrompt: "Du bist ein Assistent für banktaugliche Formulierungen. Antworte nur mit dem Absatz.", maxTokens: 256 }
  );
  return raw.trim();
}

/**
 * Kurztext für die Bank zum Entwicklungsplan (Objekt mit Entwicklungspotenzial).
 * Nutzt DeepSeek. Nur nutzbar wenn VITE_DEEPSEEK_API_KEY gesetzt ist.
 */
export async function suggestEntwicklungsplanSummary(plan: {
  istMieteMonat: number;
  zielMieteMonat: number;
  kappungsgrenzePercent: number;
  angespanntMarkt?: boolean;
  massnahmenAnzahl?: number;
  /** Optional: bereits umgesetzte Sofagespräche (einvernehmliche Mieterhöhung) */
  sofagespraeche?: { mieteVorher: number; mieteNachher: number; increasePercent: number };
}): Promise<string> {
  const parts = [
    plan.sofagespraeche
      ? `Bereits umgesetzt: Sofagespräche – einvernehmliche Mieterhöhung von ${plan.sofagespraeche.mieteVorher.toFixed(0)} € auf ${plan.sofagespraeche.mieteNachher.toFixed(0)} € (+${plan.sofagespraeche.increasePercent} %).`
      : null,
    `Aktuelle Monatsmiete: ${plan.istMieteMonat.toFixed(2)} €`,
    `Geplante Miete (nach Maßnahmen): ${plan.zielMieteMonat.toFixed(2)} €/Monat`,
    `Kappungsgrenze §558: ${plan.kappungsgrenzePercent} % alle 3 Jahre${plan.angespanntMarkt ? " (angespannter Markt)" : ""}`,
    plan.massnahmenAnzahl != null ? `${plan.massnahmenAnzahl} geplante wertsteigernde Maßnahmen (Mietanpassung, PV, Dämmung, Sanierung)` : "",
  ].filter(Boolean);
  const prompt = `Für ein Bankanschreiben: Formuliere einen kurzen Absatz (2–3 Sätze), der das Objekt positiv darstellt – Entwicklungspotenzial durch Mietanpassungen und Modernisierungen, Zielmiete. Formell, auf Deutsch. Keine Anrede.`;

  const raw = await completeDeepSeekChat(
    [{ role: "user", content: `${parts.join("\n")}\n\n${prompt}` }],
    { systemPrompt: "Du bist ein Assistent für Finanzierungsanträge. Antworte nur mit dem Absatz.", maxTokens: 200 }
  );
  return raw.trim();
}

/**
 * Priorität der fehlenden Dokumente für Finanzierung (welche zuerst besorgen).
 * Nutzt DeepSeek. Nur nutzbar wenn VITE_DEEPSEEK_API_KEY gesetzt ist.
 */
export async function suggestDocumentPriority(fehlendeDokumente: string[], propertyContext?: string): Promise<string> {
  if (fehlendeDokumente.length === 0) return "";
  const list = fehlendeDokumente.join(", ");
  const context = propertyContext ? `Objekt: ${propertyContext}\n` : "";
  const prompt = `Für eine Immobilien-Finanzierung fehlen folgende Dokumente: ${list}

${context}Gib eine kurze Prioritätenempfehlung (2–4 Sätze): Welche Dokumente sollte man zuerst besorgen und warum? Formell, auf Deutsch.`;

  const raw = await completeDeepSeekChat(
    [{ role: "user", content: prompt }],
    { systemPrompt: "Du bist ein Assistent für Finanzierungsunterlagen. Antworte nur mit der Prioritätenempfehlung.", maxTokens: 200 }
  );
  return raw.trim();
}

/**
 * Kurzer Vorschlag für Kontakt-Notizen oder Follow-up (Handwerker, Mieter, Bank, etc.).
 * Nutzt DeepSeek. Nur nutzbar wenn VITE_DEEPSEEK_API_KEY gesetzt ist.
 */
export async function suggestContactFollowUp(contact: {
  name: string;
  company?: string | null;
  category?: string;
  notes?: string | null;
}): Promise<string> {
  const parts = [
    `Name: ${contact.name}`,
    contact.company ? `Firma: ${contact.company}` : "",
    contact.category ? `Kategorie: ${contact.category}` : "",
    contact.notes ? `Bereits notiert: ${contact.notes.slice(0, 300)}` : "",
  ].filter(Boolean);
  const prompt = `Als Immobilienverwalter: Gib einen kurzen Vorschlag für Notizen oder das nächste Follow-up zu diesem Kontakt (1–3 Sätze). Z. B. Besonderheiten, Preise, Empfehlung oder nächste Schritte. Kontext: ${contact.category || "Kontakt"}. Auf Deutsch.`;

  const raw = await completeDeepSeekChat(
    [{ role: "user", content: `${parts.join("\n")}\n\n${prompt}` }],
    { systemPrompt: "Du bist ein Assistent für Kontaktverwaltung. Antworte nur mit dem Notiz-Vorschlag.", maxTokens: 150 }
  );
  return raw.trim();
}

/**
 * Kurzbeschreibung für eine Aufgabe aus dem Titel vorschlagen (z. B. To-dos).
 * Nutzt DeepSeek. Nur nutzbar wenn VITE_DEEPSEEK_API_KEY gesetzt ist.
 */
export async function suggestTodoDescription(title: string): Promise<string> {
  if (!title || title.trim().length < 2) return "";
  const prompt = `Aufgabentitel: "${title.trim()}"

Gib eine kurze, hilfreiche Beschreibung (1–2 Sätze) für diese Aufgabe: Was ist zu tun, worauf zu achten? Für Immobilienverwaltung: Mieter, Objekt, Termine, etc. Auf Deutsch. Keine Anrede.`;

  const raw = await completeDeepSeekChat(
    [{ role: "user", content: prompt }],
    { systemPrompt: "Du bist ein Assistent für Aufgaben. Antworte nur mit der Beschreibung.", maxTokens: 120 }
  );
  return raw.trim();
}

/**
 * Interpretation eines Stress-Test-Ergebnisses — kurze Einschätzung und Handlungsempfehlung.
 */
export async function suggestStressTestInterpretation(ctx: {
  survives: boolean;
  scenario: string;
  currentCashflow: number;
  stressedCashflow: number;
  survivalMonths?: number;
}): Promise<string> {
  const prompt = `Portfolio-Stresstest Szenario "${ctx.scenario}":
- Aktueller Cashflow: ${ctx.currentCashflow.toFixed(0)} €/Monat
- Stress-Cashflow: ${ctx.stressedCashflow.toFixed(0)} €/Monat
- Portfolio übersteht Szenario: ${ctx.survives ? "Ja" : "Nein"}
${ctx.survivalMonths !== undefined && ctx.survivalMonths < 999 ? `- Durchhaltbarkeit bei Reserven: ~${ctx.survivalMonths} Monate` : ""}

Gib eine kurze, hilfreiche Einschätzung (2–4 Sätze): Wie resilient ist das Portfolio? Welche Handlungsempfehlungen (z. B. Liquiditätsreserve, Refinanzierung prüfen)? Auf Deutsch. Sachlich.`;

  const raw = await completeDeepSeekChat(
    [{ role: "user", content: prompt }],
    { systemPrompt: "Du bist ein Immobilien-Investment-Berater. Antworte nur mit der Einschätzung.", maxTokens: 300 }
  );
  return raw.trim();
}

/**
 * Personalisierte Steuer-Tipps für Immobilieninvestoren.
 */
export async function suggestSteuerTipps(ctx: {
  propertyCount: number;
  totalAfA: number;
  totalInterest: number;
  totalRent: number;
  taxRate: number;
}): Promise<string> {
  const prompt = `Als Immobilien-Steuerexperte: Der Nutzer hat ${ctx.propertyCount} Objekte.
- Jahres-AfA: ~${ctx.totalAfA.toFixed(0)} €
- Schuldzinsen: ~${ctx.totalInterest.toFixed(0)} €
- Mieteinnahmen: ~${ctx.totalRent.toFixed(0)} €
- Grenzsteuersatz: ${ctx.taxRate}%

Gib 2–4 kurze, konkrete Steuer-Tipps (AfA, Zinsen, Erhaltungsaufwand, ggf. Verlustverrechnung). Auf Deutsch. Nummeriert. Sachlich.`;

  const raw = await completeDeepSeekChat(
    [{ role: "user", content: prompt }],
    { systemPrompt: "Du bist ein Steuerberater für Vermieter. Antworte nur mit den Tipps.", maxTokens: 350 }
  );
  return raw.trim();
}

/**
 * Diversifikations-Einschätzung — Risiko-Kommentar zur Portfolio-Verteilung.
 */
export async function suggestDiversificationInterpretation(ctx: {
  propertyCount: number;
  maxLocationShare: number;
  tenantConcentration: number;
  locations: string[];
  types: string[];
}): Promise<string> {
  const prompt = `Portfolio: ${ctx.propertyCount} Objekte.
- Größte Regionskonzentration: ${ctx.maxLocationShare.toFixed(0)}% Miete
- Mieterkonzentration (max. Objektanteil): ${(ctx.tenantConcentration * 100).toFixed(0)}%
- Regionen: ${ctx.locations.slice(0, 6).join(", ")}
- Objekttypen: ${ctx.types.join(", ")}

Gib eine kurze Einschätzung (2–4 Sätze): Wie diversifiziert ist das Portfolio? Welche Risiken oder Stärken siehst du? Auf Deutsch. Sachlich.`;

  const raw = await completeDeepSeekChat(
    [{ role: "user", content: prompt }],
    { systemPrompt: "Du bist ein Portfolio-Analyst für Immobilien. Antworte nur mit der Einschätzung.", maxTokens: 250 }
  );
  return raw.trim();
}

/**
 * Exit-Strategie Einschätzung — Verkaufs-/Halte-Empfehlung.
 */
export async function suggestExitStrategieInterpretation(ctx: {
  propertyCount: number;
  holdCount: number;
  sellCount: number;
  waitCount: number;
  totalNetProceeds: number;
  totalAnnualCashflow: number;
}): Promise<string> {
  const prompt = `Exit-Strategie für ${ctx.propertyCount} Objekte:
- Halten: ${ctx.holdCount}, Verkauf prüfen: ${ctx.sellCount}, Abwarten (Spekulationsfrist): ${ctx.waitCount}
- Gesamter Netto-Erlös (Verkauf): ~${ctx.totalNetProceeds.toFixed(0)} €
- Jährlicher Cashflow (Halten): ~${ctx.totalAnnualCashflow.toFixed(0)} €

Gib eine kurze Einschätzung (2–4 Sätze): Welche Objekte zuerst prüfen? Halten vs. Verkaufen? Auf Deutsch. Sachlich.`;

  const raw = await completeDeepSeekChat(
    [{ role: "user", content: prompt }],
    { systemPrompt: "Du bist ein Immobilien-Investment-Berater. Antworte nur mit der Einschätzung.", maxTokens: 280 }
  );
  return raw.trim();
}

/**
 * Refinanzierungs-Einschätzung — Umschuldung lohnenswert?
 */
export async function suggestRefinancingInterpretation(ctx: {
  loanCount: number;
  refinanceableCount: number;
  totalAnnualSavings: number;
  newRate: number;
}): Promise<string> {
  const prompt = `Refinanzierungs-Szenario:
- ${ctx.refinanceableCount} von ${ctx.loanCount} Darlehen umschuldbar (aktuell höher als ${ctx.newRate}%)
- Potenzielle Jahresersparnis: ~${ctx.totalAnnualSavings.toFixed(0)} €

Gib eine kurze Einschätzung (2–3 Sätze): Lohnt sich die Umschuldung? Was beachten? Auf Deutsch. Sachlich.`;

  const raw = await completeDeepSeekChat(
    [{ role: "user", content: prompt }],
    { systemPrompt: "Du bist ein Finanzierungs-Berater. Antworte nur mit der Einschätzung.", maxTokens: 200 }
  );
  return raw.trim();
}

/**
 * Mietspiegel-Check Interpretation — Einschätzung ob Miete marktgerecht und Potenzial.
 */
export async function suggestMietspiegelInterpretation(ctx: {
  propertyName: string;
  currentRentPerSqm: number;
  mietspiegelPerSqm: number;
  status: "unter" | "über" | "marktgerecht";
  potentialMonthly?: number;
}): Promise<string> {
  const prompt = `Objekt "${ctx.propertyName}":
- Aktuelle Kaltmiete: ${ctx.currentRentPerSqm.toFixed(2)} €/m²
- Mietspiegel/ortsüblich: ~${ctx.mietspiegelPerSqm.toFixed(2)} €/m²
- Status: ${ctx.status === "unter" ? "unter Markt" : ctx.status === "über" ? "über Markt" : "marktgerecht"}
${ctx.potentialMonthly !== undefined && ctx.potentialMonthly > 0 ? `- Potenzial (Mieterhöhung): ~${ctx.potentialMonthly.toFixed(0)} €/Monat` : ""}

Gib eine kurze Einschätzung (1–3 Sätze): Ist die Miete marktgerecht? Gibt es Handlungsspielraum (§558 BGB)? Auf Deutsch. Sachlich.`;

  const raw = await completeDeepSeekChat(
    [{ role: "user", content: prompt }],
    { systemPrompt: "Du bist ein Mietrecht- und Immobilien-Experte. Antworte nur mit der Einschätzung.", maxTokens: 200 }
  );
  return raw.trim();
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
