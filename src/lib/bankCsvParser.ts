/**
 * IMP-2: Extracted bank CSV/MT940/CAMT parsing utilities from BankMatching.tsx
 * Reduces BankMatching.tsx by ~300 lines and makes parsing logic independently testable.
 */

import { supabase } from "@/integrations/supabase/client";

/* ── MT940 (SWIFT) parser ─────────────────────────────────── */

export const parseMT940 = (text: string, userId: string, accountId: string | null): Record<string, unknown>[] => {
  const rows: Record<string, unknown>[] = [];
  const blocks = text.split(":61:").slice(1);
  for (const block of blocks) {
    try {
      const lines = block.split("\n");
      const line1 = lines[0] || "";
      const dateMatch = line1.match(/(\d{6})/);
      if (!dateMatch) continue;
      const yy = dateMatch[1].slice(0, 2);
      const mm = dateMatch[1].slice(2, 4);
      const dd = dateMatch[1].slice(4, 6);
      const year = parseInt(yy) > 50 ? `19${yy}` : `20${yy}`;
      const bookingDate = `${year}-${mm}-${dd}`;
      if (!/^\d{4}-\d{2}-\d{2}$/.test(bookingDate)) continue;
      const amountMatch = line1.match(/([CD])(\d+[,.]\d*)/);
      if (!amountMatch) continue;
      const isCredit = amountMatch[1] === "C";
      /* FIX-1: Use global /,/g to replace ALL commas */
      const amount = parseFloat(amountMatch[2].replace(/,/g, ".")) * (isCredit ? 1 : -1);
      const refLine = lines.find(l => l.startsWith(":86:"));
      const reference = refLine ? refLine.slice(4).trim() : null;
      rows.push({ user_id: userId, booking_date: bookingDate, amount, account_id: accountId, reference, booking_text: "MT940" });
    } catch { /* skip malformed */ }
  }
  return rows;
};

/* ── CAMT.053 XML parser ──────────────────────────────────── */

export const parseCAMT = (xml: string, userId: string, accountId: string | null): Record<string, unknown>[] => {
  const rows: Record<string, unknown>[] = [];
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(xml, "text/xml");
    const entries = doc.querySelectorAll("Ntry");
    entries.forEach(entry => {
      try {
        const amtEl = entry.querySelector("Amt");
        const dateEl = entry.querySelector("BookgDt Dt") || entry.querySelector("ValDt Dt");
        const cdtEl = entry.querySelector("CdtDbtInd");
        const refEl = entry.querySelector("RmtInf Ustrd") || entry.querySelector("AddtlNtryInf");
        const nameEl = entry.querySelector("RltdPties Dbtr Nm") || entry.querySelector("RltdPties Cdtr Nm");
        if (!amtEl || !dateEl) return;
        const amount = parseFloat(amtEl.textContent || "0") * (cdtEl?.textContent === "CRDT" ? 1 : -1);
        const bookingDate = dateEl.textContent || "";
        if (!/^\d{4}-\d{2}-\d{2}$/.test(bookingDate)) return;
        rows.push({
          user_id: userId,
          booking_date: bookingDate,
          amount,
          account_id: accountId,
          reference: refEl?.textContent || null,
          sender_receiver: nameEl?.textContent || null,
          booking_text: "CAMT",
        });
      } catch { /* skip */ }
    });
  } catch { /* skip */ }
  return rows;
};

/* ── Transaction categorization ───────────────────────────── */

export const categorizeTransaction = (description: string): string => {
  const desc = description.toLowerCase();
  if (desc.includes("miete") || desc.includes("miet")) return "Mieteinnahme";
  if (desc.includes("nebenkost") || desc.includes("nk")) return "Nebenkosten";
  if (desc.includes("versicher")) return "Versicherung";
  if (desc.includes("kredit") || desc.includes("darlehen") || desc.includes("tilg")) return "Kreditrate";
  if (desc.includes("repar") || desc.includes("wartung") || desc.includes("handwerk")) return "Instandhaltung";
  if (desc.includes("steuer") || desc.includes("grundst")) return "Steuern";
  return "Sonstiges";
};

/* ── CSV field definitions ────────────────────────────────── */

export const BANK_CSV_FIELDS = [
  { key: "date", label: "Buchungsdatum", required: true },
  { key: "amount", label: "Betrag (Signed)" },
  { key: "credit", label: "Haben (Eingang)" },
  { key: "debit", label: "Soll (Ausgang)" },
  { key: "name", label: "Empf\u00e4nger/Auftraggeber" },
  { key: "reference", label: "Verwendungszweck" },
  { key: "iban", label: "IBAN" },
  { key: "bic", label: "BIC" },
  { key: "text", label: "Buchungstext" },
] as const;

export const SKIP_VALUE = "__skip__";

/* ── Column mapping guesser ───────────────────────────────── */

export function guessBankMapping(headers: string[]): Record<string, string> {
  const mapping: Record<string, string> = {};
  const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9\u00e4\u00f6\u00fc]/g, "");
  const patterns: Record<string, string[]> = {
    date: ["buchung", "datum", "date", "valuta", "wertstellung"],
    amount: ["betrag", "amount", "umsatz"],
    credit: ["haben", "credit", "gutschrift", "eingang"],
    debit: ["soll", "debit", "lastschrift", "ausgang"],
    name: ["empf", "auftrag", "name", "sender", "beguenstigter", "zahlungspflichtiger"],
    reference: ["verwendung", "referenz", "reference", "zweck", "buchungsdetails"],
    iban: ["iban"],
    bic: ["bic", "swift"],
    text: ["buchungstext", "text", "type", "art"],
  };
  headers.forEach(header => {
    const n = norm(header);
    for (const [field, pats] of Object.entries(patterns)) {
      if (!mapping[field] && pats.some(p => n.includes(p))) {
        mapping[field] = header;
      }
    }
  });
  return mapping;
}

/* ── Delimiter detection ──────────────────────────────────── */

export function detectDelimiter(line: string): string {
  const counts: Record<string, number> = { ";": 0, ",": 0, "\t": 0 };
  let inQ = false;
  for (const ch of line) {
    if (ch === '"') inQ = !inQ;
    else if (!inQ && ch in counts) counts[ch]++;
  }
  if (counts[";"] >= counts[","] && counts[";"] >= counts["\t"]) return ";";
  if (counts["\t"] >= counts[","]) return "\t";
  return ",";
}

/* ── Header row detection ─────────────────────────────────── */

export function findHeaderRowIndex(lines: string[], delimiter: string): number {
  const headerKeywords = [
    "datum", "date", "betrag", "amount", "soll", "haben", "credit", "debit",
    "buchung", "valuta", "empfänger", "auftraggeber", "verwendungszweck",
    "reference", "iban", "bic", "konto", "umsatz", "buchungstext",
  ];
  for (let i = 0; i < Math.min(lines.length, 15); i++) {
    const cols = lines[i].split(delimiter).length;
    if (cols < 3) continue;
    const lower = lines[i].toLowerCase();
    if (headerKeywords.some(kw => lower.includes(kw))) return i;
  }
  return 0;
}

/* ── CSV parser ───────────────────────────────────────────── */

export function parseBankCsv(text: string, headerRowOverride?: number): { headers: string[]; rows: string[][]; headerRow: number } {
  const lines = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n").filter(l => l.trim());
  if (lines.length < 2) throw new Error("CSV ist leer");

  const delimiter = detectDelimiter(lines[0]);
  const headerIdx = headerRowOverride ?? findHeaderRowIndex(lines, delimiter);

  const parseRow = (line: string): string[] => {
    const result: string[] = [];
    let current = "";
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (inQuotes && line[i + 1] === '"') { current += '"'; i++; }
        else inQuotes = !inQuotes;
      } else if (ch === delimiter && !inQuotes) {
        result.push(current.trim());
        current = "";
      } else {
        current += ch;
      }
    }
    result.push(current.trim());
    return result.map(v => v.replace(/^"|"$/g, ""));
  };

  const headers = parseRow(lines[headerIdx]);
  const rows = lines.slice(headerIdx + 1).map(parseRow).filter(r => r.some(v => v.trim()));
  return { headers, rows, headerRow: headerIdx };
}

/* ── Date/amount helpers ──────────────────────────────────── */

export function toIsoDate(raw: string): string | null {
  const s = raw.trim();
  if (!s) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;

  const dot = s.match(/^(\d{1,2})\.(\d{1,2})\.(\d{2,4})$/);
  if (dot) {
    const d = dot[1].padStart(2, "0");
    const m = dot[2].padStart(2, "0");
    const y = dot[3].length === 2 ? `20${dot[3]}` : dot[3];
    return `${y}-${m}-${d}`;
  }

  const slash = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (slash) {
    const d = slash[1].padStart(2, "0");
    const m = slash[2].padStart(2, "0");
    const y = slash[3].length === 2 ? `20${slash[3]}` : slash[3];
    return `${y}-${m}-${d}`;
  }

  const parsed = new Date(s);
  if (!isNaN(parsed.getTime())) {
    const y = parsed.getFullYear();
    const m = String(parsed.getMonth() + 1).padStart(2, "0");
    const d = String(parsed.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }

  return null;
}

export function parseEuroAmount(raw: string): number | null {
  const s0 = raw.trim();
  if (!s0) return null;
  const negative = s0.includes("-") || (s0.includes("(") && s0.includes(")"));
  const cleaned = s0
    .replace(/[^0-9,.-]/g, "")
    .replace(/\.(?=\d{3}(\D|$))/g, "")
    .replace(/,/g, ".");
  const n = parseFloat(cleaned);
  if (isNaN(n)) return null;
  return negative ? -Math.abs(n) : n;
}

/* ── CSV import with mapping ──────────────────────────────── */

export async function importBankCsvWithMapping(args: {
  userId: string;
  accountId: string | null;
  headers: string[];
  rows: string[][];
  mapping: Record<string, string>;
}): Promise<number> {
  const { userId, accountId, headers, rows, mapping } = args;
  const idxForHeader = (header: string | undefined) => header ? headers.findIndex(h => h === header) : -1;

  const dateIdx = idxForHeader(mapping.date);
  const amountIdx = idxForHeader(mapping.amount);
  const creditIdx = idxForHeader(mapping.credit);
  const debitIdx = idxForHeader(mapping.debit);

  if (dateIdx < 0) throw new Error("Buchungsdatum ist erforderlich");
  if (amountIdx < 0 && creditIdx < 0 && debitIdx < 0) {
    throw new Error("Bitte Betrag oder Soll/Haben zuweisen");
  }

  const nameIdx = idxForHeader(mapping.name);
  const refIdx = idxForHeader(mapping.reference);
  const ibanIdx = idxForHeader(mapping.iban);
  const bicIdx = idxForHeader(mapping.bic);
  const textIdx = idxForHeader(mapping.text);

  const insertRows: Record<string, unknown>[] = [];

  for (const cols of rows) {
    const rawDate = cols[dateIdx] || "";
    const bookingDate = toIsoDate(rawDate);
    if (!bookingDate) continue;

    const signedAmount = amountIdx >= 0 ? parseEuroAmount(cols[amountIdx] || "") : null;
    const credit = creditIdx >= 0 ? parseEuroAmount(cols[creditIdx] || "") : null;
    const debit = debitIdx >= 0 ? parseEuroAmount(cols[debitIdx] || "") : null;

    let amount: number | null = signedAmount;
    if (amount === null) {
      const creditVal = credit ? Math.abs(credit) : 0;
      const debitVal = debit ? Math.abs(debit) : 0;
      if (creditVal || debitVal) amount = creditVal - debitVal;
    }

    if (amount === null || isNaN(amount)) continue;

    insertRows.push({
      user_id: userId,
      booking_date: bookingDate,
      amount,
      account_id: accountId,
      sender_receiver: nameIdx >= 0 ? (cols[nameIdx] || null) : null,
      reference: refIdx >= 0 ? (cols[refIdx] || null) : null,
      iban: ibanIdx >= 0 ? (cols[ibanIdx] || null) : null,
      bic: bicIdx >= 0 ? (cols[bicIdx] || null) : null,
      booking_text: textIdx >= 0 ? (cols[textIdx] || null) : null,
    });
  }

  if (insertRows.length === 0) throw new Error("Keine gültigen Transaktionen");

  const batchSize = 100;
  for (let i = 0; i < insertRows.length; i += batchSize) {
    const { error } = await supabase.from("bank_transactions").insert(insertRows.slice(i, i + batchSize));
    if (error) throw error;
  }

  return insertRows.length;
}
