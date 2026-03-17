/**
 * Finanzierungs-Cockpit — zentrale Übersicht für neue Finanzierungen.
 * Bündelt: Objektübersicht mit Mieten, Kredite, Konten/Vermögen, Link zur Selbstauskunft,
 * Unterlagen-Checkliste pro Objekt (Exposé, Energieausweis, Grundrisse, Mieterliste, Flurkarte, Altlastenauskunft).
 */
import { useState, useMemo, useCallback, useEffect } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  Building2,
  Landmark,
  Wallet,
  FileText,
  FileStack,
  CheckCircle,
  Circle,
  ExternalLink,
  Download,
  ChevronDown,
  ChevronUp,
  Banknote,
  PiggyBank,
  TrendingUp,
  Shield,
  Receipt,
  RefreshCw,
  ShieldAlert,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useProperties } from "@/context/PropertyContext";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ROUTES, propertyDetail } from "@/lib/routes";
import { formatCurrency } from "@/lib/formatters";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SelbstauskunftGenerator } from "@/components/SelbstauskunftGenerator";
import { EmptyState } from "@/components/EmptyState";
import { cn } from "@/lib/utils";

const FINANCING_ASSETS_KEY = "immo-financing-assets";

interface FinancingAssets {
  giro: string;
  tagesgeld: string;
  depot: string;
  lebensversicherung: string;
  bauspar: string;
}

const defaultAssets: FinancingAssets = {
  giro: "",
  tagesgeld: "",
  depot: "",
  lebensversicherung: "",
  bauspar: "",
};

const PAGE_TITLE = "Finanzierungs-Cockpit – ImmoControl";

/** Unterlagen, die Banken oft für Finanzierungen verlangen */
const UNTERLAGEN_CATEGORIES = [
  { id: "expose", label: "Exposé", categoryMatch: /exposé|expose|angebot/i },
  { id: "energieausweis", label: "Energieausweis", categoryMatch: /energie|ausweis/i },
  { id: "grundrisse", label: "Grundrisse", categoryMatch: /grundriss|grundrisse/i },
  { id: "mieterliste", label: "Mieterliste / Mietverträge", categoryMatch: /mietvertrag|mieter|mietliste/i },
  { id: "flurkarte", label: "Flurkarte / Lageplan", categoryMatch: /flur|lageplan|grundbuch/i },
  { id: "altlasten", label: "Altlastenauskunft", categoryMatch: /altlast|bodengutacht/i },
  { id: "sonstige", label: "Sonstige Unterlagen", categoryMatch: /sonst|other/i },
] as const;

function loadAssets(): FinancingAssets {
  try {
    const raw = localStorage.getItem(FINANCING_ASSETS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<FinancingAssets>;
      return { ...defaultAssets, ...parsed };
    }
  } catch { /* ignore */ }
  return defaultAssets;
}

function saveAssets(data: FinancingAssets) {
  try {
    localStorage.setItem(FINANCING_ASSETS_KEY, JSON.stringify(data));
  } catch { /* ignore */ }
}

export default function FinanzierungsCockpit() {
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const { properties, stats } = useProperties();
  const [assets, setAssets] = useState<FinancingAssets>(loadAssets);
  const [selectedPropertyId, setSelectedPropertyId] = useState<string>("");
  const [expandedSection, setExpandedSection] = useState<string | null>("objekte");

  /* Pre-select property from URL ?property= (deep link from PropertyDetail) */
  useEffect(() => {
    const prop = searchParams.get("property");
    if (prop) setSelectedPropertyId(prop);
  }, [searchParams]);

  useEffect(() => {
    saveAssets(assets);
  }, [assets]);

  useEffect(() => {
    const prev = document.title;
    document.title = PAGE_TITLE;
    return () => { document.title = prev; };
  }, []);

  const { data: loans = [] } = useQuery({
    queryKey: ["financing_loans", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data } = await supabase
        .from("loans")
        .select("id, property_id, bank_name, remaining_balance, monthly_payment, interest_rate, fixed_interest_until, repayment_rate")
        .eq("user_id", user.id)
        .order("fixed_interest_until", { ascending: true });
      return (data || []) as Array<{
        id: string; property_id: string; bank_name: string; remaining_balance: number;
        monthly_payment: number; interest_rate: number; fixed_interest_until: string | null; repayment_rate: number;
      }>;
    },
    enabled: !!user,
  });

  const { data: tenants = [] } = useQuery({
    queryKey: ["financing_tenants"],
    queryFn: async () => {
      const { data } = await supabase
        .from("tenants")
        .select("id, property_id, first_name, last_name, monthly_rent, is_active")
        .eq("is_active", true);
      return (data || []) as Array<{ id: string; property_id: string; first_name: string; last_name: string; monthly_rent: number; is_active: boolean }>;
    },
    enabled: !!user,
  });

  const { data: bankAccounts = [] } = useQuery({
    queryKey: ["financing_bank_accounts", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data } = await supabase.from("bank_accounts").select("id, name, bank_name, iban").eq("user_id", user.id).order("name");
      return (data || []) as Array<{ id: string; name: string; bank_name: string | null; iban: string | null }>;
    },
    enabled: !!user,
  });

  const { data: propertyDocs = [] } = useQuery({
    queryKey: ["financing_docs", selectedPropertyId],
    queryFn: async () => {
      if (!selectedPropertyId) return [];
      const { data } = await supabase
        .from("property_documents")
        .select("id, category, file_name")
        .eq("property_id", selectedPropertyId);
      return (data || []) as Array<{ id: string; category: string; file_name: string }>;
    },
    enabled: !!user && !!selectedPropertyId,
  });

  const objekteMitMiete = useMemo(() => {
    return properties.map((p) => {
      const propTenants = tenants.filter((t) => t.property_id === p.id);
      const actualRent = propTenants.reduce((s, t) => s + (t.monthly_rent || 0), 0);
      return {
        ...p,
        actualRent,
        tenantCount: propTenants.length,
      };
    });
  }, [properties, tenants]);

  const loansWithProperty = useMemo(() => {
    return loans.map((l) => ({
      ...l,
      propertyName: properties.find((p) => p.id === l.property_id)?.name ?? "–",
    }));
  }, [loans, properties]);

  const unterlagenStatus = useMemo(() => {
    return UNTERLAGEN_CATEGORIES.map((u) => {
      const hasDoc = propertyDocs.some((d) => u.categoryMatch.test(d.category) || d.category === u.id);
      return { ...u, hasDoc };
    });
  }, [propertyDocs]);

  const updateAsset = useCallback((key: keyof FinancingAssets, value: string) => {
    setAssets((prev) => ({ ...prev, [key]: value }));
  }, []);

  const totalAssets =
    [assets.giro, assets.tagesgeld, assets.depot, assets.lebensversicherung, assets.bauspar].reduce(
      (s, v) => s + (parseFloat(String(v).replace(",", ".")) || 0),
      0
    );

  const Section = ({
    id,
    title,
    icon: Icon,
    children,
  }: {
    id: string;
    title: string;
    icon: React.ElementType;
    children: React.ReactNode;
  }) => {
    const isExpanded = expandedSection === id;
    return (
      <Card className="min-w-0">
        <CardHeader className="p-0">
          <button
            type="button"
            className="w-full cursor-pointer py-4 px-6 text-left flex items-center justify-between gap-2 hover:bg-muted/30 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-t-lg"
            onClick={() => setExpandedSection(isExpanded ? null : id)}
            aria-expanded={isExpanded}
            aria-controls={`section-content-${id}`}
            id={`section-toggle-${id}`}
          >
            <CardTitle className="text-base flex items-center gap-2 font-semibold">
              <Icon className="h-4 w-4 text-muted-foreground shrink-0" />
              <span className="text-wrap-safe break-words">{title}</span>
            </CardTitle>
            <span className="shrink-0" aria-hidden>
              {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </span>
          </button>
        </CardHeader>
        {isExpanded && (
          <CardContent id={`section-content-${id}`} aria-labelledby={`section-toggle-${id}`} className="pt-0">
            {children}
          </CardContent>
        )}
      </Card>
    );
  };

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-4xl mx-auto min-w-0 overflow-x-hidden" id="main-content" role="main" aria-label="Finanzierungs-Cockpit">
      <div className="min-w-0">
        <h1 className="text-xl sm:text-2xl font-bold tracking-tight flex items-center gap-2">
          <Wallet className="h-6 w-6 text-primary shrink-0" />
          Finanzierungs-Cockpit
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Alle Daten an einem Ort für neue Finanzierungen. Objektübersicht, Kredite und Vermögen werden aus der App übernommen; Kontostände und Unterlagen-Checkliste kannst du hier pflegen.
        </p>
      </div>

      <div className="flex flex-wrap gap-2 min-w-0">
        <SelbstauskunftGenerator />
        <Button variant="outline" size="sm" asChild className="touch-target min-h-[44px]">
          <Link to={ROUTES.LOANS} className="gap-1.5">
            <Landmark className="h-3.5 w-3.5 shrink-0" /> Darlehen
          </Link>
        </Button>
        <Button variant="outline" size="sm" asChild className="touch-target min-h-[44px]">
          <Link to={ROUTES.OBJEKTE} className="gap-1.5">
            <Building2 className="h-3.5 w-3.5 shrink-0" /> Objekte
          </Link>
        </Button>
        <Button variant="outline" size="sm" asChild className="touch-target min-h-[44px]">
          <Link to={ROUTES.DOKUMENTE} className="gap-1.5">
            <FileStack className="h-3.5 w-3.5 shrink-0" /> Dokumente
          </Link>
        </Button>
        <Button variant="outline" size="sm" asChild className="touch-target min-h-[44px]">
          <Link to={ROUTES.STEUER_COCKPIT} className="gap-1.5">
            <Receipt className="h-3.5 w-3.5 shrink-0" /> Steuer-Cockpit
          </Link>
        </Button>
        <Button variant="outline" size="sm" asChild className="touch-target min-h-[44px]">
          <Link to={ROUTES.REFINANZIERUNG} className="gap-1.5">
            <RefreshCw className="h-3.5 w-3.5 shrink-0" /> Refinanzierung
          </Link>
        </Button>
        <Button variant="outline" size="sm" asChild className="touch-target min-h-[44px]">
          <Link to={ROUTES.STRESS_TEST} aria-label="Stress-Test" className="gap-1.5">
            <ShieldAlert className="h-3.5 w-3.5 shrink-0" /> Stress-Test
          </Link>
        </Button>
        <Button variant="outline" size="sm" asChild className="touch-target min-h-[44px]">
          <Link to={ROUTES.RENT} className="gap-1.5">
            <Receipt className="h-3.5 w-3.5 shrink-0" /> Mietübersicht
          </Link>
        </Button>
        <Button variant="outline" size="sm" asChild className="touch-target min-h-[44px]">
          <Link to={`${ROUTES.RENT}?tab=bank`} aria-label="Bank-Abgleich (Mietübersicht)" className="gap-1.5">
            <Wallet className="h-3.5 w-3.5 shrink-0" /> Bank-Abgleich
          </Link>
        </Button>
      </div>

      {/* Quick-Stats: Portfolio auf einen Blick */}
      {properties.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3 min-w-0" aria-label="Finanzübersicht">
          <div className="gradient-card rounded-xl border border-border p-3">
            <div className="text-[10px] text-muted-foreground uppercase tracking-wider">Gesamtwert</div>
            <div className="text-base font-bold tabular-nums">{formatCurrency(stats.totalValue)}</div>
          </div>
          <div className="gradient-card rounded-xl border border-border p-3">
            <div className="text-[10px] text-muted-foreground uppercase tracking-wider">Eigenkapital</div>
            <div className="text-base font-bold tabular-nums text-profit">{formatCurrency(stats.equity)}</div>
          </div>
          <div className="gradient-card rounded-xl border border-border p-3">
            <div className="text-[10px] text-muted-foreground uppercase tracking-wider">Gesamtschuld</div>
            <div className="text-base font-bold tabular-nums">{formatCurrency(stats.totalDebt)}</div>
          </div>
          <div className="gradient-card rounded-xl border border-border p-3" title="Loan-to-Value: Darlehen in % des Objektwerts. Unter 60% gilt als solide.">
            <div className="text-[10px] text-muted-foreground uppercase tracking-wider">LTV</div>
            <div className="text-base font-bold tabular-nums">
              {stats.totalValue > 0 ? ((stats.totalDebt / stats.totalValue) * 100).toFixed(0) : "0"}%
            </div>
          </div>
          <div className="gradient-card rounded-xl border border-border p-3">
            <div className="text-[10px] text-muted-foreground uppercase tracking-wider">Kaltmiete/M</div>
            <div className="text-base font-bold tabular-nums">{formatCurrency(stats.totalRent)}</div>
          </div>
          <div className="gradient-card rounded-xl border border-border p-3">
            <div className="text-[10px] text-muted-foreground uppercase tracking-wider">Cashflow/M</div>
            <div className={`text-base font-bold tabular-nums ${stats.totalCashflow >= 0 ? "text-profit" : "text-loss"}`}>
              {formatCurrency(stats.totalCashflow)}
            </div>
          </div>
        </div>
      )}

      {/* 1. Objektübersicht mit aktuellen Mieten */}
      <Section id="objekte" title="Objektübersicht mit aktuellen Mieten" icon={Building2}>
        {objekteMitMiete.length === 0 ? (
          <EmptyState
            icon={Building2}
            title="Noch keine Objekte"
            description="Lege Objekte an, damit Wert, Mieten und Restschuld hier erscheinen."
            action={
              <Button variant="outline" size="sm" asChild className="touch-target min-h-[44px]">
                <Link to={ROUTES.OBJEKTE}>Objekte anlegen</Link>
              </Button>
            }
          />
        ) : (
          <div className="overflow-x-auto min-w-0">
            <table className="w-full text-sm min-w-[600px]">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-2 font-medium">Objekt</th>
                  <th className="text-right py-2 font-medium">Wert</th>
                  <th className="text-right py-2 font-medium">Miete (Soll)</th>
                  <th className="text-right py-2 font-medium">Miete (Ist)</th>
                  <th className="text-right py-2 font-medium">Mieter</th>
                  <th className="text-right py-2 font-medium">Restschuld</th>
                </tr>
              </thead>
              <tbody>
                {objekteMitMiete.map((p) => (
                  <tr key={p.id} className="border-b border-border/50">
                    <td className="py-2 min-w-0">
                      <Link to={propertyDetail(p.id)} className="text-primary hover:underline font-medium text-wrap-safe break-words">
                        {p.name}
                      </Link>
                    </td>
                    <td className="text-right tabular-nums">{formatCurrency(p.currentValue ?? 0)}</td>
                    <td className="text-right tabular-nums">{formatCurrency(p.monthlyRent ?? 0)}/M</td>
                    <td className="text-right tabular-nums">{formatCurrency(p.actualRent)}/M</td>
                    <td className="text-right">{p.tenantCount}</td>
                    <td className="text-right tabular-nums">{formatCurrency(p.remainingDebt ?? 0)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>

      {/* 2. Laufende Kredite */}
      <Section id="kredite" title="Laufende Kredite (Restschuld, Laufzeit, Rate)" icon={Landmark}>
        {loansWithProperty.length === 0 ? (
          <EmptyState
            icon={Landmark}
            title="Keine Darlehen"
            description="Darlehen zu Objekten anlegen – dann erscheinen Restschuld, Rate und Zinsbindung hier."
            action={
              <Button variant="outline" size="sm" asChild className="touch-target min-h-[44px]">
                <Link to={ROUTES.LOANS}>Darlehen anlegen</Link>
              </Button>
            }
          />
        ) : (
          <div className="overflow-x-auto min-w-0">
            <table className="w-full text-sm min-w-[520px]">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-2 font-medium">Bank / Objekt</th>
                  <th className="text-right py-2 font-medium">Restschuld</th>
                  <th className="text-right py-2 font-medium">Rate/M</th>
                  <th className="text-right py-2 font-medium">Zins</th>
                  <th className="text-right py-2 font-medium">Zinsbindung bis</th>
                </tr>
              </thead>
              <tbody>
                {loansWithProperty.map((l) => (
                  <tr key={l.id} className="border-b border-border/50">
                    <td className="py-2 min-w-0">
                      <span className="font-medium text-wrap-safe break-words block">{l.bank_name}</span>
                      <span className="text-muted-foreground text-xs text-wrap-safe break-words block">{l.propertyName}</span>
                    </td>
                    <td className="text-right tabular-nums">{formatCurrency(l.remaining_balance)}</td>
                    <td className="text-right tabular-nums">{formatCurrency(l.monthly_payment)}</td>
                    <td className="text-right tabular-nums">{l.interest_rate} %</td>
                    <td className="text-right tabular-nums">
                      {l.fixed_interest_until
                        ? new Date(l.fixed_interest_until).toLocaleDateString("de-DE", { month: "short", year: "numeric" })
                        : "–"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>

      {/* 3. Girokonto, Tagesgeld, Depot, Lebensversicherung */}
      <Section id="vermoegen" title="Konten & Vermögen (für Bank/Selbstauskunft)" icon={Wallet}>
        {bankAccounts.length > 0 && (
          <div className="mb-4">
            <p className="text-xs font-medium text-muted-foreground mb-2">Geführte Konten (IBAN)</p>
            <ul className="space-y-1 text-sm">
              {bankAccounts.map((a) => (
                <li key={a.id} className="flex items-center gap-2">
                  <Banknote className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  <span className="text-wrap-safe min-w-0">{a.name}</span>
                  {a.bank_name && <span className="text-muted-foreground shrink-0">({a.bank_name})</span>}
                  {a.iban && <span className="text-muted-foreground text-xs shrink-0">{a.iban.slice(-4)}</span>}
                </li>
              ))}
            </ul>
            <Button variant="ghost" size="sm" className="mt-2 text-xs gap-1" asChild>
              <Link to={`${ROUTES.RENT}?tab=bank`}>Bank-Abgleich → Transaktionen & Matching</Link>
            </Button>
          </div>
        )}
        <p className="text-xs text-muted-foreground mb-3">
          Salden/Stand für Selbstauskunft eintragen (werden lokal gespeichert):
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label className="text-xs flex items-center gap-1"><Banknote className="h-3 w-3" /> Girokonto (€)</Label>
            <Input
              type="text"
              inputMode="decimal"
              placeholder="0"
              value={assets.giro}
              onChange={(e) => updateAsset("giro", e.target.value)}
              className="h-9"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs flex items-center gap-1"><PiggyBank className="h-3 w-3" /> Tagesgeld (€)</Label>
            <Input
              type="text"
              inputMode="decimal"
              placeholder="0"
              value={assets.tagesgeld}
              onChange={(e) => updateAsset("tagesgeld", e.target.value)}
              className="h-9"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs flex items-center gap-1"><TrendingUp className="h-3 w-3" /> Depot / Wertpapiere (€)</Label>
            <Input
              type="text"
              inputMode="decimal"
              placeholder="0"
              value={assets.depot}
              onChange={(e) => updateAsset("depot", e.target.value)}
              className="h-9"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs flex items-center gap-1"><Shield className="h-3 w-3" /> Lebensversicherung (Rückkaufwert €)</Label>
            <Input
              type="text"
              inputMode="decimal"
              placeholder="0"
              value={assets.lebensversicherung}
              onChange={(e) => updateAsset("lebensversicherung", e.target.value)}
              className="h-9"
            />
          </div>
          <div className="space-y-1 sm:col-span-2">
            <Label className="text-xs">Bausparguthaben (€)</Label>
            <Input
              type="text"
              inputMode="decimal"
              placeholder="0"
              value={assets.bauspar}
              onChange={(e) => updateAsset("bauspar", e.target.value)}
              className="h-9"
            />
          </div>
        </div>
        {totalAssets > 0 && (
          <p className="text-sm font-medium mt-3 pt-3 border-t border-border">
            Summe Vermögen (aus Feldern): {formatCurrency(totalAssets)}
          </p>
        )}
      </Section>

      {/* 4. Selbstauskunft */}
      <Section id="selbstauskunft" title="Selbstauskunft für die Bank" icon={FileText}>
        <p className="text-sm text-muted-foreground mb-3">
          Vollständige Selbstauskunft (Persönliches, Vermögen, Einnahmen/Ausgaben) für Finanzierungsanträge. Der Generator wird automatisch vorausgefüllt mit:
        </p>
        <ul className="list-disc list-inside text-sm text-muted-foreground mb-3 space-y-1">
          <li>Mieteinnahmen und Kreditraten aus dieser App</li>
          <li>Konten & Vermögen aus den Feldern oben (Giro, Tagesgeld, Depot, Bauspar, Lebensversicherung)</li>
          <li>Profil-Daten (Name, E-Mail) nach Anmeldung</li>
        </ul>
        <p className="text-sm text-muted-foreground mb-3">
          Gehalt, Lebenshaltungskosten, Adresse, Kinder und Beruf im Generator ergänzen → PDF herunterladen (Felder im PDF bleiben editierbar). Im letzten Schritt optional: <strong>KI Zusammenfassung prüfen</strong> (banktauglicher Kurztext).
        </p>
        <SelbstauskunftGenerator />
      </Section>

      {/* 5. Unterlagen zum finanzierenden Objekt */}
      <Section id="unterlagen" title="Unterlagen zum Objekt (Exposé, Energieausweis, Grundrisse, …)" icon={CheckCircle}>
        <p className="text-sm text-muted-foreground mb-3">
          Prüfe, ob für das zu finanzierende Objekt alle üblichen Unterlagen vorhanden sind. Dokumente unter Objekt → Dokumente hochladen (Kategorie wird erkannt).
        </p>
        <div className="space-y-2 mb-4">
          <Label className="text-xs">Objekt wählen</Label>
          <Select value={selectedPropertyId} onValueChange={setSelectedPropertyId}>
            <SelectTrigger className="w-full sm:max-w-xs h-9">
              <SelectValue placeholder="Objekt wählen" />
            </SelectTrigger>
            <SelectContent>
              {properties.map((p) => (
                <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {selectedPropertyId && unterlagenStatus.some((u) => !u.hasDoc) && (
          <p className="text-sm text-muted-foreground mb-3 p-3 rounded-lg bg-muted/30 border border-border">
            Noch {unterlagenStatus.filter((u) => !u.hasDoc).length} Unterlage(n) fehlen – für die Bank besonders wichtig: Exposé, Energieausweis und Grundrisse zuerst ergänzen.
          </p>
        )}
        {selectedPropertyId ? (
          <ul className="space-y-2">
            {unterlagenStatus.map((u) => (
              <li
                key={u.id}
                className={cn(
                  "flex items-center gap-3 py-2 px-3 rounded-lg text-sm",
                  u.hasDoc ? "bg-profit/10 text-profit" : "bg-muted/50 text-muted-foreground"
                )}
              >
                {u.hasDoc ? <CheckCircle className="h-4 w-4 shrink-0" /> : <Circle className="h-4 w-4 shrink-0" />}
                <span>{u.label}</span>
                {u.hasDoc && (
                  <Link
                    to={propertyDetail(selectedPropertyId)}
                    className="ml-auto text-xs text-primary hover:underline flex items-center gap-0.5"
                  >
                    Vorhanden <ExternalLink className="h-3 w-3" />
                  </Link>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">Objekt auswählen, um den Unterlagen-Stand zu prüfen.</p>
        )}
        <Button variant="outline" size="sm" className="mt-3" asChild>
          <Link to={selectedPropertyId ? propertyDetail(selectedPropertyId) : ROUTES.OBJEKTE}>
            <FileText className="h-3.5 w-3.5 mr-1" />
            {selectedPropertyId ? "Dokumente zum Objekt" : "Zu den Objekten"}
          </Link>
        </Button>
      </Section>
    </div>
  );
}
