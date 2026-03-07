import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

type ChatMessage = { role: "system" | "user" | "assistant"; content: string };

interface PropertyRow {
  name?: string;
  address?: string;
  location?: string;
  type?: string;
  ownership?: string;
  units?: number | string | null;
  sqm?: number | string | null;
  year_built?: number | string | null;
  purchase_price?: number | string | null;
  purchase_date?: string | null;
  current_value?: number | string | null;
  monthly_rent?: number | string | null;
  monthly_expenses?: number | string | null;
  monthly_credit_rate?: number | string | null;
  monthly_cashflow?: number | string | null;
  remaining_debt?: number | string | null;
  interest_rate?: number | string | null;
}

interface TenantRow {
  first_name?: string;
  last_name?: string;
  unit_label?: string | null;
  email?: string | null;
  phone?: string | null;
  move_in_date?: string | null;
  move_out_date?: string | null;
  monthly_rent?: number | string | null;
  deposit?: number | string | null;
  is_active?: boolean | null;
  properties?: { name?: string | null } | null;
}

interface LoanRow {
  bank_name?: string;
  loan_amount?: number | string | null;
  remaining_balance?: number | string | null;
  interest_rate?: number | string | null;
  repayment_rate?: number | string | null;
  monthly_payment?: number | string | null;
  fixed_interest_until?: string | null;
  start_date?: string | null;
  end_date?: string | null;
  properties?: { name?: string | null } | null;
}

interface TodoRow {
  title?: string;
  priority?: number | string | null;
  due_date?: string | null;
}

interface TicketRow {
  status?: string;
  priority?: string;
  title?: string;
  properties?: { name?: string | null } | null;
  tenants?: { first_name?: string | null; last_name?: string | null } | null;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Get user auth token
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Nicht authentifiziert" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Nicht authentifiziert" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { messages } = (await req.json()) as { messages: ChatMessage[] };

    // Fetch user's portfolio data for context
    const [propertiesRes, tenantsRes, loansRes, todosRes, ticketsRes, dealsRes, viewingsRes, contactsRes, rentPaymentsRes] = await Promise.all([
      supabase.from("properties").select("*").order("name"),
      supabase.from("tenants").select("*, properties(name, address)").order("last_name"),
      supabase.from("loans").select("*, properties(name)").order("created_at", { ascending: false }),
      supabase.from("todos").select("*").eq("completed", false).order("priority").limit(20),
      supabase.from("tickets").select("*, properties(name), tenants(first_name, last_name)").order("created_at", { ascending: false }).limit(20),
      supabase.from("deals").select("id, title, address, stage, purchase_price, expected_rent, sqm, units").order("created_at", { ascending: false }).limit(20),
      supabase.from("property_viewings").select("id, title, address, rating, notes, pro_points, contra_points, visited_at").order("visited_at", { ascending: false, nullsFirst: false }).limit(15),
      supabase.from("contacts").select("id, name, company, category").is("deleted_at", null).order("name").limit(50),
      supabase.from("rent_payments").select("id, amount, status, due_date, tenant_id, property_id").in("status", ["pending", "overdue"]).order("due_date", { ascending: true }).limit(30),
    ]);

    const properties = (propertiesRes.data || []) as PropertyRow[];
    const tenants = (tenantsRes.data || []) as TenantRow[];
    const loans = (loansRes.data || []) as LoanRow[];
    const todos = (todosRes.data || []) as TodoRow[];
    const tickets = (ticketsRes.data || []) as TicketRow[];
    const deals = (dealsRes.data || []) as Array<{ title?: string; address?: string; stage?: string; purchase_price?: number; expected_rent?: number }>;
    const viewings = (viewingsRes.data || []) as Array<{ title?: string; address?: string; rating?: number; notes?: string; pro_points?: string; contra_points?: string }>;
    const contacts = (contactsRes.data || []) as Array<{ name?: string; company?: string | null; category?: string }>;
    const rentPayments = (rentPaymentsRes.data || []) as Array<{ amount?: number; status?: string; due_date?: string; tenant_id?: string; property_id?: string }>;

    const today = new Date().toISOString().split("T")[0];

    // Build rich context
    const portfolioContext = `
## Heutiges Datum: ${today}

## Portfolio-Übersicht (${properties.length} Objekte)
${properties.map((p) => `
### ${p.name ?? "k.A."}
- Adresse: ${p.address ?? "k.A."}, ${p.location ?? "k.A."}
- Typ: ${p.type ?? "k.A."} | Eigentum: ${p.ownership ?? "k.A."}
- Einheiten: ${p.units ?? "k.A."} | Fläche: ${p.sqm ?? "k.A."} qm | Baujahr: ${p.year_built ?? "k.A."}
- Kaufpreis: ${Number(p.purchase_price ?? 0).toLocaleString("de-DE")} € (Kaufdatum: ${p.purchase_date ?? "k.A."})
- Aktueller Wert: ${Number(p.current_value ?? 0).toLocaleString("de-DE")} €
- Monatliche Miete: ${Number(p.monthly_rent ?? 0).toLocaleString("de-DE")} €
- Monatliche Ausgaben: ${Number(p.monthly_expenses ?? 0).toLocaleString("de-DE")} €
- Kreditrate: ${Number(p.monthly_credit_rate ?? 0).toLocaleString("de-DE")} €
- Cashflow: ${Number(p.monthly_cashflow ?? 0).toLocaleString("de-DE")} €
- Restschuld: ${Number(p.remaining_debt ?? 0).toLocaleString("de-DE")} €
- Zinssatz: ${Number(p.interest_rate ?? 0)}%
`).join("")}

## Mieter (${tenants.length})
${tenants.map((t) => {
  const moveIn = t.move_in_date ? new Date(t.move_in_date) : null;
  const todayDate = new Date();
  const wohnDauer = moveIn ? Math.floor((todayDate.getTime() - moveIn.getTime()) / (1000 * 60 * 60 * 24 * 30.44)) : null;
  return `
- ${(t.first_name || "").trim()} ${(t.last_name || "").trim()} | Objekt: ${t.properties?.name || "k.A."}
  - Wohnung/Einheit: ${t.unit_label || "k.A."}
  - Email: ${t.email || "k.A."} | Tel: ${t.phone || "k.A."}
  - Einzug: ${t.move_in_date || "k.A."}${wohnDauer !== null ? ` (seit ca. ${wohnDauer} Monaten)` : ""}
  - Auszug: ${t.move_out_date || "kein Auszug geplant"}
  - Monatliche Miete: ${t.monthly_rent ? Number(t.monthly_rent).toLocaleString("de-DE") + " €" : "k.A."}
  - Kaution: ${t.deposit ? Number(t.deposit).toLocaleString("de-DE") + " €" : "k.A."}
  - Status: ${t.is_active ? "Aktiv" : "Inaktiv"}`;
}).join("")}

## Darlehen (${loans.length})
${loans.map((l) => `
- ${l.bank_name ?? "k.A."} | Objekt: ${l.properties?.name || "k.A."}
  - Darlehenssumme: ${Number(l.loan_amount ?? 0).toLocaleString("de-DE")} €
  - Restschuld: ${Number(l.remaining_balance ?? 0).toLocaleString("de-DE")} €
  - Zinssatz: ${Number(l.interest_rate ?? 0)}% | Tilgung: ${Number(l.repayment_rate ?? 0)}%
  - Rate: ${Number(l.monthly_payment ?? 0).toLocaleString("de-DE")} €/Monat
  - Zinsbindung bis: ${l.fixed_interest_until || "k.A."}
  - Laufzeit: ${l.start_date || "k.A."} – ${l.end_date || "k.A."}
`).join("")}

## Offene Aufgaben (${todos.length})
${todos.map((t) => `- [P${t.priority ?? "?"}] ${t.title ?? "k.A."}${t.due_date ? ` (fällig: ${t.due_date})` : ""}`).join("\n")}

## Tickets (${tickets.length})
${tickets.map((t) => {
  const tenantName = t.tenants ? `${t.tenants.first_name ?? ""} ${t.tenants.last_name ?? ""}`.trim() : "";
  const propName = t.properties?.name || "";
  return `- [${t.status ?? "?"}/${t.priority ?? "?"}] ${t.title ?? "k.A."} – ${propName}${tenantName ? ` (${tenantName})` : ""}`;
}).join("\n")}

## Deals (${deals.length})
${deals.map((d) => `- ${d.title ?? "k.A."} | ${d.address ?? ""} | Stage: ${d.stage ?? "?"} | Kaufpreis: ${Number(d.purchase_price ?? 0).toLocaleString("de-DE")} € | Miete: ${Number(d.expected_rent ?? 0).toLocaleString("de-DE")} €/Monat`).join("\n")}

## Besichtigungen (${viewings.length})
${viewings.map((v) => `- ${v.title ?? "k.A."} | Bewertung: ${v.rating ?? "–"}/5 | Pro: ${(v.pro_points ?? "").slice(0, 80)} | Kontra: ${(v.contra_points ?? "").slice(0, 80)}`).join("\n")}

## Kontakte (${contacts.length})
${contacts.map((c) => `- ${c.name ?? "k.A."} | ${c.company ?? ""} | ${c.category ?? ""}`).join("\n")}

## Offene/Überfällige Mietzahlungen (${rentPayments.length})
${rentPayments.map((p) => `- ${Number(p.amount ?? 0).toLocaleString("de-DE")} € | Fällig: ${p.due_date ?? "k.A."} | Status: ${p.status ?? "?"}`).join("\n")}
`.trim();

    const systemPrompt = `Du bist "Immo AI", ein intelligenter Immobilien-Assistent für einen deutschen Immobilieninvestor. Du hast Zugriff auf das komplette Portfolio des Nutzers.

WICHTIGE REGELN:
- Antworte immer auf Deutsch
- Nutze die Portfolio-Daten um präzise, datenbasierte Antworten zu geben
- Berechne Kennzahlen wie Rendite, Wohndauer, Mietanpassungstermine etc. selbst
- Bei Fragen zu Mietanpassungen: In Deutschland darf die Miete frühestens 15 Monate nach Einzug oder letzter Erhöhung angepasst werden (§ 558 BGB), max. 20% in 3 Jahren (Kappungsgrenze, in Ballungsräumen 15%)
- Bei Fragen zur Selbstauskunft: Gib eine strukturierte Antwort mit den relevanten Daten
- Formatiere Geldbeträge immer mit Tausendertrennzeichen und €-Zeichen
- Sei freundlich, professionell und hilfreich
- Wenn du etwas nicht aus den Daten ablesen kannst, sage es ehrlich
- Nutze Markdown für übersichtliche Formatierung

PORTFOLIO-DATEN DES NUTZERS:
${portfolioContext}`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          ...messages,
        ],
        stream: true,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Zu viele Anfragen, bitte warte einen Moment." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "AI-Kontingent aufgebraucht. Bitte Credits aufladen." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      return new Response(JSON.stringify({ error: "AI-Fehler aufgetreten" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("immo-ai-chat error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unbekannter Fehler" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
