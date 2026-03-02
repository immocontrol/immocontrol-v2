import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

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

    const { messages } = await req.json();

    // Fetch user's portfolio data for context
    const [propertiesRes, tenantsRes, loansRes, todosRes, ticketsRes] = await Promise.all([
      supabase.from("properties").select("*").order("name"),
      supabase.from("tenants").select("*, properties(name, address)").order("last_name"),
      supabase.from("loans").select("*, properties(name)").order("created_at", { ascending: false }),
      supabase.from("todos").select("*").eq("completed", false).order("priority").limit(20),
      supabase.from("tickets").select("*, properties(name), tenants(first_name, last_name)").order("created_at", { ascending: false }).limit(20),
    ]);

    const properties = propertiesRes.data || [];
    const tenants = tenantsRes.data || [];
    const loans = loansRes.data || [];
    const todos = todosRes.data || [];
    const tickets = ticketsRes.data || [];

    const today = new Date().toISOString().split("T")[0];

    // Build rich context
    const portfolioContext = `
## Heutiges Datum: ${today}

## Portfolio-Übersicht (${properties.length} Objekte)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
${properties.map((p: any) => `
### ${p.name}
- Adresse: ${p.address}, ${p.location}
- Typ: ${p.type} | Eigentum: ${p.ownership}
- Einheiten: ${p.units} | Fläche: ${p.sqm} qm | Baujahr: ${p.year_built}
- Kaufpreis: ${Number(p.purchase_price).toLocaleString("de-DE")} € (Kaufdatum: ${p.purchase_date})
- Aktueller Wert: ${Number(p.current_value).toLocaleString("de-DE")} €
- Monatliche Miete: ${Number(p.monthly_rent).toLocaleString("de-DE")} €
- Monatliche Ausgaben: ${Number(p.monthly_expenses).toLocaleString("de-DE")} €
- Kreditrate: ${Number(p.monthly_credit_rate).toLocaleString("de-DE")} €
- Cashflow: ${Number(p.monthly_cashflow).toLocaleString("de-DE")} €
- Restschuld: ${Number(p.remaining_debt).toLocaleString("de-DE")} €
- Zinssatz: ${Number(p.interest_rate)}%
`).join("")}

## Mieter (${tenants.length})
// eslint-disable-next-line @typescript-eslint/no-explicit-any
${tenants.map((t: any) => {
  const moveIn = t.move_in_date ? new Date(t.move_in_date) : null;
  const todayDate = new Date();
  const wohnDauer = moveIn ? Math.floor((todayDate.getTime() - moveIn.getTime()) / (1000 * 60 * 60 * 24 * 30.44)) : null;
  return `
- ${t.first_name} ${t.last_name} | Objekt: ${(t as any).properties?.name || "k.A."}
  - Wohnung/Einheit: ${t.unit_label || "k.A."}
  - Email: ${t.email || "k.A."} | Tel: ${t.phone || "k.A."}
  - Einzug: ${t.move_in_date || "k.A."}${wohnDauer !== null ? ` (seit ca. ${wohnDauer} Monaten)` : ""}
  - Auszug: ${t.move_out_date || "kein Auszug geplant"}
  - Monatliche Miete: ${t.monthly_rent ? Number(t.monthly_rent).toLocaleString("de-DE") + " €" : "k.A."}
  - Kaution: ${t.deposit ? Number(t.deposit).toLocaleString("de-DE") + " €" : "k.A."}
  - Status: ${t.is_active ? "Aktiv" : "Inaktiv"}`;
}).join("")}

## Darlehen (${loans.length})
// eslint-disable-next-line @typescript-eslint/no-explicit-any
${loans.map((l: any) => `
- ${l.bank_name} | Objekt: ${(l as any).properties?.name || "k.A."}
  - Darlehenssumme: ${Number(l.loan_amount).toLocaleString("de-DE")} €
  - Restschuld: ${Number(l.remaining_balance).toLocaleString("de-DE")} €
  - Zinssatz: ${Number(l.interest_rate)}% | Tilgung: ${Number(l.repayment_rate)}%
  - Rate: ${Number(l.monthly_payment).toLocaleString("de-DE")} €/Monat
  - Zinsbindung bis: ${l.fixed_interest_until || "k.A."}
  - Laufzeit: ${l.start_date || "k.A."} – ${l.end_date || "k.A."}
`).join("")}

## Offene Aufgaben (${todos.length})
// eslint-disable-next-line @typescript-eslint/no-explicit-any
${todos.map((t: any) => `- [P${t.priority}] ${t.title}${t.due_date ? ` (fällig: ${t.due_date})` : ""}`).join("\n")}

## Tickets (${tickets.length})
// eslint-disable-next-line @typescript-eslint/no-explicit-any
${tickets.map((t: any) => `- [${t.status}/${t.priority}] ${t.title} – ${(t as any).properties?.name || ""} (${(t as any).tenants ? `${(t as any).tenants.first_name} ${(t as any).tenants.last_name}` : ""})`).join("\n")}
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
