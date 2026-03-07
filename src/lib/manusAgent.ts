/**
 * ManusAgentService — Core API client for Manus AI integration
 * 
 * Handles task creation, polling, file upload, and result retrieval.
 * API docs: https://open.manus.im/
 * 
 * Architecture (Tier 2 Security):
 * - PRIMARY: Supabase Edge Function "manus-proxy" — API key stays server-side
 * - FALLBACK: Direct Manus API calls if a local key is set in localStorage
 *   (for development / offline testing only)
 * 
 * Features using this service:
 * - MANUS-1: S-ImmoPreisfinder Browser Automation
 * - MANUS-2: Deep Research / Marktanalyse
 * - MANUS-3: Expose-Analyse & Deal-Scoring
 * - MANUS-4: Steuer-Optimierung & Anlage V
 * - MANUS-5: Due Diligence Automatisierung
 * - MANUS-6: Newsticker Intelligence
 * - MANUS-7: Finanzierungs-Optimierung
 * - MANUS-8: Telegram Bot Enhancement
 */

import { supabase } from "@/integrations/supabase/client";

const MANUS_API_BASE = "https://api.manus.im/v1";

/* ─── Types ─── */

export type ManusTaskStatus = "pending" | "running" | "completed" | "failed";
export type ManusTaskMode = "chat" | "adaptive" | "agent";
export type ManusAgentProfile = "speed" | "quality";

export interface ManusTask {
  task_id: string;
  status: ManusTaskStatus;
  output?: string;
  error?: string;
  created_at?: string;
  updated_at?: string;
}

export interface ManusFile {
  file_id: string;
  filename: string;
  download_url?: string;
}

export interface ManusTaskOptions {
  prompt: string;
  taskMode?: ManusTaskMode;
  agentProfile?: ManusAgentProfile;
  fileIds?: string[];
  connectorIds?: string[];
}

export interface ManusTaskResult {
  task: ManusTask;
  files: ManusFile[];
}

/* ─── API Key Management ─── */

const MANUS_KEY_STORAGE = "immocontrol_manus_api_key";

/** Whether the server-side proxy is configured (cached after first check) */
let _proxyConfigured: boolean | null = null;

/** Check if the Supabase Edge Function proxy has MANUS_API_KEY configured */
export async function isProxyConfigured(): Promise<boolean> {
  if (_proxyConfigured !== null) return _proxyConfigured;
  try {
    const { data, error } = await supabase.functions.invoke("manus-proxy", {
      body: { action: "ping" },
    });
    _proxyConfigured = !error && data?.configured === true;
  } catch {
    _proxyConfigured = false;
  }
  return _proxyConfigured;
}

/** Reset the cached proxy status (e.g. after config changes) */
export function resetProxyCache(): void {
  _proxyConfigured = null;
}

/**
 * Get the local Manus API key (localStorage / env var).
 * Only used as fallback when the server-side proxy is NOT configured.
 */
export function getManusApiKey(): string {
  // 1. Check environment variable (dev only)
  const envKey = import.meta.env.VITE_MANUS_API_KEY;
  if (envKey) return envKey;
  // 2. Check localStorage (fallback)
  return localStorage.getItem(MANUS_KEY_STORAGE) || "";
}

export function setManusApiKey(key: string): void {
  localStorage.setItem(MANUS_KEY_STORAGE, key);
}

/**
 * Returns true if Manus is available — either via server proxy or local key.
 * For synchronous checks (UI rendering), this checks the local key only.
 * Use `isManusAvailable()` for async check that includes proxy.
 */
export function hasManusApiKey(): boolean {
  // If proxy was confirmed configured, always true
  if (_proxyConfigured === true) return true;
  return getManusApiKey().length > 0;
}

/** Async check: proxy OR local key available */
export async function isManusAvailable(): Promise<boolean> {
  if (getManusApiKey().length > 0) return true;
  return isProxyConfigured();
}

/* ─── API Helpers ─── */

/** Whether to route through the proxy for the current request */
function shouldProxy(): boolean {
  // If no local key, must use proxy
  if (!getManusApiKey()) return true;
  // If local key exists, use direct (faster, no round-trip via Supabase)
  return false;
}

function getHeaders(): Record<string, string> {
  const key = getManusApiKey();
  if (!key) throw new Error("Manus API Key nicht konfiguriert. Bitte in Einstellungen → Manus AI hinterlegen.");
  return {
    "Authorization": `Bearer ${key}`,
    "Content-Type": "application/json",
  };
}

/** Retry helper for transient failures (network, 5xx) */
async function withRetry<T>(
  fn: () => Promise<T>,
  maxAttempts = 3,
): Promise<T> {
  let lastErr: Error | null = null;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err instanceof Error ? err : new Error(String(err));
      const msg = lastErr.message;
      const isRetryable =
        msg.includes("Failed to fetch") ||
        msg.includes("NetworkError") ||
        msg.includes("Timeout") ||
        msg.includes("ECONNRESET") ||
        msg.includes("503") ||
        msg.includes("502") ||
        msg.includes("504") ||
        msg.includes("Manus Proxy Fehler");
      const isClientError = /40[0-9]/.test(msg) || msg.includes("401") || msg.includes("403");
      if (!isRetryable || isClientError || attempt === maxAttempts) {
        throw lastErr;
      }
      const delayMs = Math.min(1000 * Math.pow(2, attempt - 1), 8000);
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }
  throw lastErr ?? new Error("Manus Anfrage fehlgeschlagen");
}

/** Direct Manus API request (uses local key) */
async function directApiRequest<T>(path: string, options?: RequestInit): Promise<T> {
  const fn = async () => {
    const res = await fetch(`${MANUS_API_BASE}${path}`, {
      ...options,
      headers: { ...getHeaders(), ...options?.headers },
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`Manus API Fehler (${res.status}): ${body || res.statusText}`);
    }
    return res.json();
  };
  return withRetry(fn);
}

/** Proxy API request via Supabase Edge Function (key stays server-side) */
async function proxyApiRequest<T>(body: Record<string, unknown>): Promise<T> {
  const fn = async () => {
    const { data, error } = await supabase.functions.invoke("manus-proxy", {
      body,
    });
    if (error) {
      throw new Error(`Manus Proxy Fehler: ${error.message}`);
    }
    if (data?.error) {
      throw new Error(data.error);
    }
    return data as T;
  };
  return withRetry(fn);
}

/* ─── Core API Methods ─── */

/** Create a new Manus task */
export async function createTask(options: ManusTaskOptions): Promise<ManusTask> {
  if (shouldProxy()) {
    return proxyApiRequest<ManusTask>({
      action: "createTask",
      prompt: options.prompt,
      taskMode: options.taskMode || "agent",
      agentProfile: options.agentProfile || "quality",
      fileIds: options.fileIds,
      connectorIds: options.connectorIds,
    });
  }
  const body: Record<string, unknown> = {
    prompt: options.prompt,
    task_mode: options.taskMode || "agent",
    agent_profile: options.agentProfile || "quality",
  };
  if (options.fileIds?.length) {
    body.file_ids = options.fileIds;
  }
  if (options.connectorIds?.length) {
    body.connector_ids = options.connectorIds;
  }
  return directApiRequest<ManusTask>("/tasks", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

/** Get task status and output */
export async function getTask(taskId: string): Promise<ManusTask> {
  if (shouldProxy()) {
    return proxyApiRequest<ManusTask>({ action: "getTask", taskId });
  }
  return directApiRequest<ManusTask>(`/tasks/${taskId}`);
}

/** List output files for a task */
export async function listTaskFiles(taskId: string): Promise<ManusFile[]> {
  if (shouldProxy()) {
    const data = await proxyApiRequest<{ files: ManusFile[] }>({ action: "listFiles", taskId });
    return data.files || [];
  }
  const data = await directApiRequest<{ files: ManusFile[] }>(`/tasks/${taskId}/files`);
  return data.files || [];
}

/** Upload a file and get a file_id */
export async function uploadFile(file: File): Promise<ManusFile> {
  // Step 1: Get presigned upload URL
  let presigned: { upload_url: string; file_id: string };
  if (shouldProxy()) {
    presigned = await proxyApiRequest<{ upload_url: string; file_id: string }>({
      action: "uploadFile",
      filename: file.name,
      contentType: file.type || "application/octet-stream",
    });
  } else {
    presigned = await directApiRequest<{ upload_url: string; file_id: string }>("/files", {
      method: "POST",
      body: JSON.stringify({ filename: file.name, content_type: file.type || "application/octet-stream" }),
    });
  }

  // Step 2: Upload file to presigned URL (direct to storage, no key needed)
  await fetch(presigned.upload_url, {
    method: "PUT",
    body: file,
    headers: { "Content-Type": file.type || "application/octet-stream" },
  });

  return { file_id: presigned.file_id, filename: file.name };
}

/** Poll task until completion or timeout */
export async function pollTask(
  taskId: string,
  onUpdate?: (task: ManusTask) => void,
  timeoutMs = 600_000,
  intervalMs = 3_000,
): Promise<ManusTask> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const task = await getTask(taskId);
    onUpdate?.(task);
    if (task.status === "completed" || task.status === "failed") {
      return task;
    }
    await new Promise(r => setTimeout(r, intervalMs));
  }
  throw new Error("Manus Task Timeout — Aufgabe dauert zu lange.");
}

/** Create task, poll until done, return result with files */
export async function runTask(
  options: ManusTaskOptions,
  onUpdate?: (task: ManusTask) => void,
): Promise<ManusTaskResult> {
  const task = await createTask(options);
  onUpdate?.(task);
  const completed = await pollTask(task.task_id, onUpdate);
  if (completed.status === "failed") {
    throw new Error(completed.error || "Manus Task fehlgeschlagen.");
  }
  const files = await listTaskFiles(completed.task_id).catch(() => []);
  return { task: completed, files };
}

/* ─── Pre-built Prompt Templates ─── */

/** MANUS-1: S-ImmoPreisfinder form automation prompt */
export function buildSparkassePrompt(data: {
  address: string;
  plz: string;
  ort: string;
  wohnflaeche: number;
  grundstueckFlaeche: number;
  baujahr: number;
  zimmer: number;
  immobilientyp: string;
  zustand: string;
  ausstattung: string;
}): string {
  return `Gehe zur Sparkasse S-ImmoPreisfinder Webseite: https://www.spk-barnim.de/de/home/immobilien0/s-immopreisfinder.html?n=true&stref=hnav

Fülle das Formular mit folgenden Daten aus:
- Adresse: ${data.address}
- PLZ: ${data.plz}
- Ort: ${data.ort}
- Objektart: ${data.immobilientyp}
- Wohnfläche: ${data.wohnflaeche} m²
- Grundstücksfläche: ${data.grundstueckFlaeche} m²
- Baujahr: ${data.baujahr}
- Zimmer: ${data.zimmer}
- Zustand: ${data.zustand}
- Ausstattung: ${data.ausstattung}

Klicke auf "Bewertung starten" oder den entsprechenden Submit-Button.
Extrahiere den geschätzten Marktwert / Immobilienwert aus dem Ergebnis.

Gib das Ergebnis als JSON zurück im Format:
{
  "marktwert": <Zahl in Euro>,
  "preis_pro_qm": <Zahl in Euro>,
  "preisrange_min": <Zahl>,
  "preisrange_max": <Zahl>,
  "bewertungsdatum": "<Datum>",
  "quelle": "Sparkasse S-ImmoPreisfinder / iib Institut",
  "details": "<Weitere Details falls vorhanden>"
}

Falls das Formular eine E-Mail-Adresse erfordert oder nicht direkt ein Ergebnis anzeigt, beschreibe was passiert ist und gib die verfügbaren Informationen zurück.`;
}

/** MANUS-2: Market research prompt */
export function buildMarktanalysePrompt(data: {
  city: string;
  district?: string;
  propertyType?: string;
  rooms?: number;
}): string {
  const location = data.district ? `${data.district}, ${data.city}` : data.city;
  const type = data.propertyType || "Wohnimmobilien";
  const roomFilter = data.rooms ? `mit ${data.rooms} Zimmern` : "";

  return `Recherchiere aktuelle Immobilien-Marktdaten für ${location} (Deutschland) — ${type} ${roomFilter}.

Finde folgende Informationen:
1. Aktuelle durchschnittliche Mietpreise (€/m² kalt)
2. Aktuelle durchschnittliche Kaufpreise (€/m²)
3. Preisentwicklung der letzten 12 Monate (Trend)
4. Mietrendite-Durchschnitt in der Region
5. Leerstandsquote
6. Geplante Neubauprojekte
7. Infrastruktur-Entwicklungen (ÖPNV, Schulen, etc.)
8. Prognose für die nächsten 6-12 Monate

Nutze aktuelle Quellen wie:
- Immobilienscout24, Immowelt, Homeday
- Statistisches Bundesamt / Landesamt
- IW Köln, empirica, bulwiengesa
- Lokale Medien und Marktberichte

Gib das Ergebnis als JSON zurück:
{
  "location": "${location}",
  "datum": "<aktuelles Datum>",
  "mietpreis_qm": { "min": <Zahl>, "avg": <Zahl>, "max": <Zahl> },
  "kaufpreis_qm": { "min": <Zahl>, "avg": <Zahl>, "max": <Zahl> },
  "mietrendite_avg": <Prozent als Zahl>,
  "preistrend_12m": "<+X% oder -X%>",
  "leerstandsquote": <Prozent als Zahl>,
  "neubauprojekte": ["<Projekt 1>", "<Projekt 2>"],
  "infrastruktur": ["<Entwicklung 1>", "<Entwicklung 2>"],
  "prognose": "<Freitext-Prognose>",
  "quellen": ["<Quelle 1>", "<Quelle 2>"]
}`;
}

/** MANUS-3: Expose analysis prompt */
export function buildExposeAnalysePrompt(data: {
  address: string;
  kaufpreis: number;
  wohnflaeche: number;
  baujahr: number;
  zimmer: number;
  kaltmiete: number;
  immobilientyp: string;
}): string {
  return `Analysiere folgendes Immobilien-Exposé und vergleiche mit aktuellen Marktdaten:

Objektdaten:
- Adresse: ${data.address}
- Kaufpreis: ${data.kaufpreis.toLocaleString("de-DE")} €
- Wohnfläche: ${data.wohnflaeche} m²
- Baujahr: ${data.baujahr}
- Zimmer: ${data.zimmer}
- Kaltmiete: ${data.kaltmiete.toLocaleString("de-DE")} €/Monat
- Typ: ${data.immobilientyp}

Aufgaben:
1. Vergleiche den Kaufpreis mit aktuellen Marktpreisen in der Region
2. Berechne und bewerte die Brutto-Mietrendite
3. Schätze den Ertragswert basierend auf der Miete
4. Identifiziere Risiken (Baujahr, Lage, Zustand)
5. Gib eine Deal-Bewertung ab (1-10 Score)
6. Liste Pro- und Contra-Argumente auf

Recherchiere aktuelle Vergleichspreise auf ImmoScout24, Immowelt etc.

Gib das Ergebnis als JSON zurück:
{
  "deal_score": <1-10>,
  "deal_bewertung": "<Sehr gut / Gut / Durchschnitt / Unter Markt / Finger weg>",
  "marktpreis_schaetzung": <Zahl in Euro>,
  "preis_differenz_prozent": <+/- Prozent>,
  "brutto_rendite": <Prozent>,
  "netto_rendite_geschaetzt": <Prozent>,
  "ertragswert_schaetzung": <Zahl in Euro>,
  "pro": ["<Argument 1>", "<Argument 2>"],
  "contra": ["<Argument 1>", "<Argument 2>"],
  "risiken": ["<Risiko 1>", "<Risiko 2>"],
  "empfehlung": "<Freitext>",
  "vergleichspreise_qm": { "min": <Zahl>, "avg": <Zahl>, "max": <Zahl> },
  "quellen": ["<Quelle 1>"]
}`;
}

/** MANUS-4: Tax optimization prompt */
export function buildSteuerOptimierungPrompt(data: {
  properties: Array<{
    name: string;
    kaufpreis: number;
    baujahr: number;
    kaufdatum: string;
    jahresmiete: number;
    wohnflaeche: number;
  }>;
  ownership: string;
}): string {
  const propList = data.properties.map((p, i) =>
    `${i + 1}. ${p.name}: Kaufpreis ${p.kaufpreis.toLocaleString("de-DE")} €, Baujahr ${p.baujahr}, Kauf ${p.kaufdatum}, Jahresmiete ${p.jahresmiete.toLocaleString("de-DE")} €, ${p.wohnflaeche} m²`
  ).join("\n");

  return `Prüfe die Immobilien-Steuerstrategie und finde Optimierungspotential.

Portfolio (${data.ownership}):
${propList}

Aufgaben:
1. Prüfe AfA-Sätze (2% linear, 2,5% vor 1925, Sonder-AfA §7b EStG)
2. Prüfe ob Erhaltungsaufwand vs. Herstellungskosten optimal genutzt werden
3. Recherchiere aktuelle Steuerurteile und BMF-Schreiben zu Immobilien (2024-2026)
4. Prüfe Werbungskosten-Optimierung (Fahrtkosten, Zinsen, Versicherungen)
5. Bewerte ob §23 EStG Spekulationsfrist relevant ist
6. Prüfe Möglichkeit der verbilligten Vermietung (§21 Abs. 2 EStG — 50%/66% Grenze)
7. Gib konkrete Handlungsempfehlungen

Gib das Ergebnis als JSON zurück:
{
  "optimierungspotential_jaehrlich": <geschätzte Euro>,
  "afa_status": [{"immobilie": "<Name>", "aktueller_satz": <Prozent>, "empfohlen": <Prozent>, "sonder_afa_moeglich": <boolean>}],
  "empfehlungen": [{"titel": "<Titel>", "beschreibung": "<Details>", "potenzial_euro": <Zahl>, "prioritaet": "hoch|mittel|niedrig"}],
  "aktuelle_urteile": [{"gericht": "<Gericht>", "datum": "<Datum>", "az": "<Aktenzeichen>", "relevanz": "<Kurzfassung>"}],
  "warnungen": ["<Warnung 1>"],
  "quellen": ["<Quelle>"]
}`;
}

/** MANUS-5: Due diligence prompt */
export function buildDueDiligencePrompt(data: {
  address: string;
  plz: string;
  ort: string;
  kaufpreis?: number;
  immobilientyp?: string;
}): string {
  return `Erstelle einen Due-Diligence-Bericht für folgende Immobilie:

Adresse: ${data.address}
PLZ/Ort: ${data.plz} ${data.ort}
${data.kaufpreis ? `Kaufpreis: ${data.kaufpreis.toLocaleString("de-DE")} €` : ""}
${data.immobilientyp ? `Typ: ${data.immobilientyp}` : ""}

Recherchiere und prüfe:
1. **Lage-Analyse**: Mikro- und Makrolage, ÖPNV, Infrastruktur, Schulen, Einkaufen
2. **Bebauungsplan**: Geltender B-Plan, Art der baulichen Nutzung, GRZ/GFZ, Aufstockungs-/Anbaupotential
3. **Altlasten**: Recherche im Altlastenkataster / Bodenbelastungskataster
4. **Denkmalschutz**: Prüfung ob Denkmalschutz besteht (Denkmalliste)
5. **Hochwasser/Überschwemmung**: Hochwasserrisiko-Karte prüfen
6. **Bodenrichtwert**: Aktueller BRW aus BORIS
7. **Mietspiegel**: Aktueller Mietspiegel für die Region
8. **Marktvergleich**: Vergleichspreise in der Umgebung
9. **Erschließung**: Straßenausbaubeiträge, Kanalisation
10. **Soziale Faktoren**: Kriminalitätsstatistik, Einwohnerentwicklung

Gib das Ergebnis als JSON zurück:
{
  "adresse": "${data.address}",
  "gesamtbewertung": "<Gut / Mittel / Riskant>",
  "score": <1-100>,
  "lage": {"mikro": "<Bewertung>", "makro": "<Bewertung>", "oepnv": "<Details>", "infrastruktur": "<Details>"},
  "bebauungsplan": {"nutzungsart": "<Art>", "grz": <Zahl>, "gfz": <Zahl>, "potential": "<Beschreibung>"},
  "altlasten": {"status": "<Keine bekannt / Verdacht / Belastet>", "details": "<Details>"},
  "denkmalschutz": {"status": "<Ja / Nein / Unklar>", "details": "<Details>"},
  "hochwasser": {"risiko": "<Kein / Gering / Mittel / Hoch>", "zone": "<Zone>"},
  "bodenrichtwert": <Euro pro m²>,
  "mietspiegel": {"min": <Euro>, "avg": <Euro>, "max": <Euro>},
  "marktvergleich": {"preis_qm_min": <Zahl>, "preis_qm_avg": <Zahl>, "preis_qm_max": <Zahl>},
  "risiken": [{"kategorie": "<Kategorie>", "schwere": "niedrig|mittel|hoch", "beschreibung": "<Details>"}],
  "chancen": ["<Chance 1>", "<Chance 2>"],
  "empfehlung": "<Freitext>",
  "quellen": ["<Quelle 1>"]
}`;
}

/** MANUS-6: Newsticker intelligence prompt */
export function buildNewstickerIntelligencePrompt(data: {
  recentHeadlines: string[];
  portfolioCities: string[];
}): string {
  return `Analysiere die aktuellen Immobilien-Nachrichten und erstelle ein wöchentliches Markt-Briefing.

Aktuelle Schlagzeilen aus meinem Newsticker:
${data.recentHeadlines.map((h, i) => `${i + 1}. ${h}`).join("\n")}

Mein Portfolio-Fokus: ${data.portfolioCities.join(", ")}

Aufgaben:
1. Fasse die wichtigsten Marktentwicklungen dieser Woche zusammen
2. Identifiziere Trends und Muster
3. Bewerte Auswirkungen auf Immobilien-Investments in den genannten Städten
4. Gib konkrete Handlungsempfehlungen für mein Portfolio
5. Identifiziere Chancen und Risiken
6. Recherchiere ergänzende Informationen die in meinem Newsticker fehlen

Gib das Ergebnis als JSON zurück:
{
  "zusammenfassung": "<3-5 Sätze Wochenzusammenfassung>",
  "top_trends": [{"trend": "<Trend>", "bedeutung": "<Hoch/Mittel/Gering>", "details": "<Details>"}],
  "portfolio_auswirkungen": [{"stadt": "<Stadt>", "auswirkung": "<Positiv/Neutral/Negativ>", "details": "<Details>"}],
  "handlungsempfehlungen": [{"empfehlung": "<Empfehlung>", "prioritaet": "hoch|mittel|niedrig", "begruendung": "<Begründung>"}],
  "chancen": ["<Chance 1>"],
  "risiken": ["<Risiko 1>"],
  "fehlende_infos": ["<Info die recherchiert werden sollte>"],
  "stimmung_gesamt": "<Bullish / Neutral / Bearish>",
  "datum": "<aktuelles Datum>"
}`;
}

/** MANUS-7: Financing optimization prompt */
export function buildFinanzierungPrompt(data: {
  loans: Array<{
    bank: string;
    restschuld: number;
    zinssatz: number;
    zinsbindung_bis: string;
    tilgung: number;
  }>;
  gesamtPortfolioWert?: number;
}): string {
  const loanList = data.loans.map((l, i) =>
    `${i + 1}. ${l.bank}: Restschuld ${l.restschuld.toLocaleString("de-DE")} €, Zins ${l.zinssatz}%, Tilgung ${l.tilgung}%, Zinsbindung bis ${l.zinsbindung_bis}`
  ).join("\n");

  return `Vergleiche aktuelle Baufinanzierungskonditionen und erstelle Refinanzierungs-Empfehlungen.

Bestehende Darlehen:
${loanList}
${data.gesamtPortfolioWert ? `\nGesamter Portfoliowert: ${data.gesamtPortfolioWert.toLocaleString("de-DE")} €` : ""}

Aufgaben:
1. Recherchiere aktuelle Bauzinsen bei den Top-10 Banken in Deutschland
2. Vergleiche meine bestehenden Konditionen mit dem Markt
3. Identifiziere Refinanzierungs-Potential (besonders bei Darlehen mit hohem Zinssatz)
4. Berechne mögliche monatliche Ersparnisse
5. Prüfe Sondertilgungs-Optionen
6. Bewerte Forward-Darlehen für auslaufende Zinsbindungen

Nutze aktuelle Quellen: Interhyp, Dr. Klein, Check24, Baufi24, Banken-Webseiten

Gib das Ergebnis als JSON zurück:
{
  "aktuelle_marktzinsen": {"5_jahre": <Zahl>, "10_jahre": <Zahl>, "15_jahre": <Zahl>, "20_jahre": <Zahl>},
  "top_anbieter": [{"bank": "<Bank>", "zins_10j": <Zahl>, "besonderheiten": "<Details>"}],
  "refinanzierung_empfehlungen": [
    {
      "darlehen_nr": <Nummer>,
      "aktueller_zins": <Zahl>,
      "empfohlener_zins": <Zahl>,
      "monatliche_ersparnis": <Euro>,
      "jaehrliche_ersparnis": <Euro>,
      "empfohlene_bank": "<Bank>",
      "aktion": "<Umschulden / Forward-Darlehen / Abwarten>",
      "begruendung": "<Details>"
    }
  ],
  "gesamt_einsparpotential_monatlich": <Euro>,
  "gesamt_einsparpotential_jaehrlich": <Euro>,
  "sondertilgung_empfehlung": "<Freitext>",
  "markteinschaetzung": "<Freitext — Zinsprognose>",
  "quellen": ["<Quelle>"],
  "datum": "<aktuelles Datum>"
}`;
}

/* ─── Result Cache ─── */

const CACHE_PREFIX = "manus_result_";

export function cacheResult(key: string, data: unknown): void {
  try {
    localStorage.setItem(`${CACHE_PREFIX}${key}`, JSON.stringify({
      data,
      timestamp: Date.now(),
    }));
  } catch {
    // localStorage full — ignore
  }
}

export function getCachedResult<T>(key: string, maxAgeMs = 24 * 60 * 60 * 1000): T | null {
  try {
    const raw = localStorage.getItem(`${CACHE_PREFIX}${key}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { data: T; timestamp: number };
    if (Date.now() - parsed.timestamp > maxAgeMs) {
      localStorage.removeItem(`${CACHE_PREFIX}${key}`);
      return null;
    }
    return parsed.data;
  } catch {
    return null;
  }
}

/** Parse JSON from Manus output (handles markdown code fences) */
export function parseManusJson<T>(output: string): T | null {
  try {
    // Try direct parse
    return JSON.parse(output);
  } catch {
    // Try extracting from markdown code fence
    const match = output.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (match) {
      try {
        return JSON.parse(match[1].trim());
      } catch {
        return null;
      }
    }
    // Try finding first { ... } block
    const braceMatch = output.match(/\{[\s\S]*\}/);
    if (braceMatch) {
      try {
        return JSON.parse(braceMatch[0]);
      } catch {
        return null;
      }
    }
    return null;
  }
}
