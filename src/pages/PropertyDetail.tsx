import { useState, useRef, useEffect, useMemo, useCallback } from "react";
import { useIsMobile } from "@/hooks/use-mobile";
import { MobilePropertyDetailTabs } from "@/components/mobile/MobilePropertyDetailTabs";
import { useParams, Link, useNavigate } from "react-router-dom";
import { ROUTES } from "@/lib/routes";
import { ArrowLeft, MapPin, Calendar, Home, Landmark, TrendingUp, Wallet, Wrench, Trash2, Copy, ClipboardCopy, Clock, Euro, CreditCard, Users, Share2, Percent, BarChart3, Camera, Receipt, Store, Handshake, Sparkles } from "lucide-react";
import EditPropertyDialog from "@/components/EditPropertyDialog";
import StatCard from "@/components/StatCard";
import { useProperties } from "@/context/PropertyContext";
import PropertyDocuments from "@/components/PropertyDocuments";
import PropertyNotes from "@/components/PropertyNotes";
import TenantManagement from "@/components/TenantManagement";
import MessageCenter from "@/components/MessageCenter";
import { LandlordTickets } from "@/components/TicketSystem";
import { LandlordPayments } from "@/components/PaymentTracking";
import ActivityTimeline from "@/components/ActivityTimeline";
import QuickActions from "@/components/QuickActions";
import PropertyValueHistory from "@/components/PropertyValueHistory";
import RentIncreaseCalculator from "@/components/RentIncreaseCalculator";
import MaintenancePlanner from "@/components/MaintenancePlanner";
import InsuranceTracker from "@/components/InsuranceTracker";
import PropertyBenchmark from "@/components/PropertyBenchmark";
import ExpensePieChart from "@/components/ExpensePieChart";
import DocumentExpiryTracker from "@/components/DocumentExpiryTracker";
import MeterManagement from "@/components/MeterManagement";
import AfACalculator from "@/components/AfACalculator";
import { Entwicklungsplan } from "@/components/Entwicklungsplan";
import KautionsOverview from "@/components/KautionsOverview";
import { HandoverProtocol } from "@/components/HandoverProtocol";
import ContractManagement from "@/components/ContractManagement";
import EnergyCertificateTracker from "@/components/EnergyCertificateTracker";
import ServiceContracts from "@/components/ServiceContracts";
import PropertyQuickSwitcher from "@/components/PropertyQuickSwitcher";
import DocumentTemplateGenerator from "@/components/DocumentTemplateGenerator";
import { RentIncreaseLetter } from "@/components/RentIncreaseLetter";
import { AnlageVExport } from "@/components/AnlageVExport";
import PropertyValuation from "@/components/PropertyValuation";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { formatCurrency } from "@/lib/formatters";
import { calcBruttoRendite, calcNettoRendite, calcMietmultiplikator, calcDSCR } from "@/lib/calculations";
import { getGebaeudeAnteil, getGrundUndBoden, getAnnualAfa, getAfaRatePercent, getSanierung15PercentBrutto } from "@/lib/afaSanierung";
import { useShare } from "@/components/mobile/MobileShareSheet";
import { isDeepSeekConfigured, suggestPropertySummary } from "@/integrations/ai/extractors";
import { handleError } from "@/lib/handleError";

// Property detail page

const PropertyDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const { share } = useShare();
  const { getProperty, deleteProperty, duplicateProperty } = useProperties();
  const property = getProperty(id || "");
  const [tenantVersion, setTenantVersion] = useState(0);
  const [aiSummaryLoading, setAiSummaryLoading] = useState(false);
  const sectionRefs = useRef<Record<string, HTMLDivElement | null>>({});
  
  // Synergy 13: Fetch property-level synergy stats + Besichtigungen (vernetzt Objekte mit Akquise)
  const [synergy, setSynergy] = useState({ openTickets: 0, overduePayments: 0, totalRepairCost: 0, activeTenants: 0, confirmedRevenue: 0, viewings: [] as { id: string; title: string; visited_at: string | null; deal_id: string | null }[] });
  useEffect(() => {
    if (!property) return;
    Promise.all([
      supabase.from("tickets").select("id, status, actual_cost, estimated_cost").eq("property_id", property.id).in("status", ["open", "in_progress"]),
      supabase.from("rent_payments").select("id, status, amount").eq("property_id", property.id),
      supabase.from("tenants").select("id").eq("property_id", property.id).eq("is_active", true),
      supabase.from("property_viewings").select("id, title, visited_at, deal_id").eq("property_id", property.id).order("visited_at", { ascending: false }).limit(5),
    ]).then(([ticketsRes, paymentsRes, tenantsRes, viewingsRes]) => {
      const tickets = ticketsRes.data || [];
      const payments = paymentsRes.data || [];
      const viewings = viewingsRes.data || [];
      setSynergy({
        openTickets: tickets.length,
        overduePayments: payments.filter(p => p.status === "overdue").length,
        totalRepairCost: tickets.reduce((s, t) => s + Number(t.actual_cost || t.estimated_cost || 0), 0),
        activeTenants: tenantsRes.data?.length || 0,
        confirmedRevenue: payments.filter(p => p.status === "confirmed").reduce((s, p) => s + Number(p.amount), 0),
        viewings: viewings.map(v => ({ id: v.id, title: v.title, visited_at: v.visited_at, deal_id: v.deal_id })),
      });
    }).catch(() => {});
  }, [property?.id, tenantVersion]);

  const scrollToSection = useCallback((section: string) => {
    sectionRefs.current[section]?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  /* STR-5: Dynamic document title for PropertyDetail — shows property name in browser tab */
  useEffect(() => {
    if (property) {
      document.title = `${property.name} – ImmoControl`;
    }
    return () => { document.title = "ImmoControl"; };
  }, [property?.name]);

  /* STR-15: Keyboard navigation between sections — Alt+1..7 to jump to sections */
  /* IMP20-6: Add Escape key to navigate back to portfolio */
  useEffect(() => {
    const sections = ["overview", "tenants", "messages", "tickets", "payments", "notes", "documents"];
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !e.altKey && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        navigate(ROUTES.HOME);
        return;
      }
      if (!e.altKey || e.ctrlKey || e.metaKey) return;
      const idx = parseInt(e.key) - 1;
      if (idx >= 0 && idx < sections.length) {
        e.preventDefault();
        scrollToSection(sections[idx]);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [scrollToSection, navigate]);

  /* STR-6: Memoize all expensive PropertyDetail calculations to prevent re-computation on every render
     NOTE: Hooks MUST be called before any early return to satisfy React Rules of Hooks */
  const calculatedMetrics = useMemo(() => {
    if (!property) return { bruttoRendite: 0, nettoRendite: 0, appreciation: 0, cashOnCash: 0, mietmultiplikator: 0, ltv: 0, dscr: 0, breakEvenOccupancy: 0, pricePerUnit: 0 };
    const bruttoRendite = calcBruttoRendite(property.purchasePrice, property.monthlyRent);
    const nettoRendite = calcNettoRendite(property.purchasePrice, property.monthlyRent, property.monthlyExpenses);
    const appreciation = property.purchasePrice > 0 ? ((property.currentValue - property.purchasePrice) / property.purchasePrice) * 100 : 0;
    const eigenkapital = property.purchasePrice - property.remainingDebt;
    const cashOnCash = eigenkapital > 0 ? ((property.monthlyCashflow * 12) / eigenkapital) * 100 : 0;
    const mietmultiplikator = calcMietmultiplikator(property.purchasePrice, property.monthlyRent);
    const ltv = property.currentValue > 0 ? (property.remainingDebt / property.currentValue) * 100 : 0;
    const dscr = calcDSCR(property.monthlyRent, property.monthlyExpenses, property.monthlyCreditRate);
    const breakEvenOccupancy = property.monthlyRent > 0 ? ((property.monthlyExpenses + property.monthlyCreditRate) / property.monthlyRent) * 100 : 0;
    const pricePerUnit = property.units > 0 ? property.purchasePrice / property.units : 0;
    return { bruttoRendite, nettoRendite, appreciation, cashOnCash, mietmultiplikator, ltv, dscr, breakEvenOccupancy, pricePerUnit };
  }, [property]);

  /* STR-7: Memoize besitzdauer calculation */
  const besitzdauer = useMemo(() => {
    if (!property) return "";
    const purchaseDate = new Date(property.purchaseDate);
    const now = new Date();
    const diffMs = now.getTime() - purchaseDate.getTime();
    const diffYears = Math.floor(diffMs / (1000 * 60 * 60 * 24 * 365.25));
    const diffMonths = Math.floor((diffMs % (1000 * 60 * 60 * 24 * 365.25)) / (1000 * 60 * 60 * 24 * 30.44));
    return diffYears > 0 ? `${diffYears}J ${diffMonths}M` : `${diffMonths} Monate`;
  }, [property?.purchaseDate]);

  if (!property) {
    return (
      <div className="text-center py-20">
        <p className="text-muted-foreground">Objekt nicht gefunden</p>
        <Link to={ROUTES.HOME} className="text-primary text-sm mt-2 inline-block">← Zurück</Link>
      </div>
    );
  }

  const { bruttoRendite, nettoRendite, appreciation, cashOnCash, mietmultiplikator, ltv, dscr, breakEvenOccupancy, pricePerUnit } = calculatedMetrics;

  const copyAddress = () => {
    navigator.clipboard.writeText(property.address).then(
      () => toast.success("Adresse kopiert"),
      () => toast.error("Kopieren fehlgeschlagen")
    );
  };

  return (
    <div className="space-y-6 max-w-3xl mx-auto" role="main" aria-label={`Objektdetail: ${property.name}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Link to={ROUTES.HOME} className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="h-4 w-4" /> Portfolio
          </Link>
          <PropertyQuickSwitcher currentPropertyId={property.id} />
        </div>
        <span className="text-[10px] text-muted-foreground hidden sm:inline">
          Besitzdauer: {besitzdauer}
        </span>
      </div>

      <div className="animate-fade-in">
        <div className="flex items-start justify-between">
          <div>
            {/* IMP-46: Truncate long property names on mobile to prevent overflow */}
            <h1 className="text-2xl font-bold truncate max-w-[250px] sm:max-w-none">{property.name}</h1>
            {/* UI-UPDATE-43: Tooltip on copy address action */}
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={copyAddress}
                  className="flex items-center gap-1 text-sm text-muted-foreground mt-1 hover:text-foreground transition-colors group/addr"
                >
                  <MapPin className="h-3.5 w-3.5" /> {property.address}
                  <ClipboardCopy className="h-3 w-3 opacity-0 group-hover/addr:opacity-100 transition-opacity" />
                </button>
              </TooltipTrigger>
              <TooltipContent>Adresse kopieren</TooltipContent>
            </Tooltip>
            {property.address?.trim() && (
              <>
                <Link
                  to={`${ROUTES.CRM_SCOUT}&q=${encodeURIComponent(property.address.trim())}`}
                  className="text-xs text-primary hover:underline inline-flex items-center gap-1 mt-1 touch-target min-h-[36px] sm:min-h-0"
                  aria-label="WGH in Umgebung suchen"
                >
                  <Store className="h-3 w-3 shrink-0" /> WGH in Umgebung
                </Link>
                <span className="text-muted-foreground/60 mx-1">·</span>
                <button
                  type="button"
                  onClick={() => navigate(ROUTES.DEALS, { state: { fromProperty: { title: property.name, address: property.address ?? "" } } })}
                  className="text-xs text-primary hover:underline inline-flex items-center gap-1 mt-1 touch-target min-h-[36px] sm:min-h-0"
                  aria-label="Deal mit diesem Objekt anlegen"
                >
                  <Handshake className="h-3 w-3 shrink-0" /> Deal anlegen
                </button>
              </>
            )}
          </div>
          <div className="flex items-center gap-1">
            <QuickActions onScrollTo={scrollToSection} onNavigate={(p) => navigate(p)} />
            <EditPropertyDialog property={property} />
            {/* Share/Copy property summary */}
            {/* UI-UPDATE-44: Tooltip on share property action */}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-muted-foreground hover:text-foreground"
                  aria-label="Objektdaten teilen"
                  onClick={() => {
                    const summary = `📊 ${property.name}\n📍 ${property.address}\n💰 Wert: ${formatCurrency(property.currentValue)}\n🏠 Miete: ${formatCurrency(property.monthlyRent)}/M\n📈 Cashflow: ${formatCurrency(property.monthlyCashflow)}/M\n📊 Brutto-Rendite: ${bruttoRendite.toFixed(1)}%\n🏦 Restschuld: ${formatCurrency(property.remainingDebt)}`;
                    share({ title: property.name, text: summary, url: window.location.href });
                  }}
                >
                  <Share2 className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Objektdaten teilen</TooltipContent>
            </Tooltip>
            {isDeepSeekConfigured() && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-muted-foreground hover:text-foreground"
                    aria-label="KI Kurzbewertung"
                    disabled={aiSummaryLoading}
                    onClick={async () => {
                      setAiSummaryLoading(true);
                      try {
                        const text = await suggestPropertySummary({
                          name: property.name,
                          address: property.address,
                          monthly_rent: property.monthlyRent,
                          purchase_price: property.purchasePrice,
                          sqm: property.sqm,
                          units: property.units,
                          notes: property.notes,
                        });
                        toast.success(text, { duration: 8000, description: "KI Kurzbewertung" });
                      } catch (e) {
                        handleError(e, { context: "ai", details: "suggestPropertySummary", showToast: true });
                      } finally {
                        setAiSummaryLoading(false);
                      }
                    }}
                  >
                    <Sparkles className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>KI Kurzbewertung</TooltipContent>
              </Tooltip>
            )}
            {/* UI-UPDATE-45: Tooltip on duplicate property action */}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-muted-foreground hover:text-foreground"
                  aria-label="Objekt duplizieren"
                  onClick={async () => {
                    await duplicateProperty(property.id);
                    toast.success(`${property.name} wurde dupliziert`);
                    navigate(ROUTES.HOME);
                  }}
                >
                  <Copy className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Objekt duplizieren</TooltipContent>
            </Tooltip>
            <span className={`text-xs px-2.5 py-1 rounded-lg font-medium ${
              property.ownership === "egbr" ? "bg-gold/15 text-gold" : "bg-primary/15 text-primary"
            }`}>
              {property.ownership === "egbr" ? "eGbR" : "Privat"}
            </span>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-loss" aria-label="Objekt löschen">
                  <Trash2 className="h-4 w-4" />
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Objekt löschen?</AlertDialogTitle>
                  <AlertDialogDescription>
                    „{property.name}" wird unwiderruflich aus deinem Portfolio entfernt.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Abbrechen</AlertDialogCancel>
                  <AlertDialogAction
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    onClick={async () => {
                      await deleteProperty(property.id);
                      toast.success(`${property.name} wurde gelöscht.`);
                      navigate(ROUTES.HOME);
                    }}
                  >
                    Löschen
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 mt-3 text-xs text-muted-foreground">
          <span className="flex items-center gap-1"><Home className="h-3.5 w-3.5" /> {property.type} · {property.units} Einheiten</span>
          <span className="flex items-center gap-1"><Calendar className="h-3.5 w-3.5" /> Kauf: {new Date(property.purchaseDate).toLocaleDateString("de-DE")}</span>
          <span className="flex items-center gap-1"><Clock className="h-3.5 w-3.5" /> Im Besitz seit {besitzdauer}</span>
          <span>{property.sqm} m² · Baujahr {property.yearBuilt}</span>
        </div>
      </div>

      {/* Financials — IMP-45: Add min-w-0 to stat cards grid to prevent overflow */}
      {/* UPD-6: Add stagger animation to property detail stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 min-w-0 card-stagger-enter">
        <StatCard
          label="Kaufpreis"
          value={formatCurrency(property.purchasePrice)}
          subValue={property.sqm > 0 ? `${(property.purchasePrice / property.sqm).toFixed(0)} €/m²` : undefined}
          icon={<Landmark className="h-4 w-4" />}
          delay={100}
        />
        <StatCard
          label="Aktueller Wert"
          value={formatCurrency(property.currentValue)}
          subValue={`${appreciation >= 0 ? "+" : ""}${appreciation.toFixed(1)}%`}
          trend={appreciation >= 0 ? "up" : "down"}
          icon={<TrendingUp className="h-4 w-4" />}
          delay={150}
        />
        <StatCard
          label="Miete / Monat"
          value={formatCurrency(property.monthlyRent)}
          subValue={property.sqm > 0 ? `${(property.monthlyRent / property.sqm).toFixed(2)} €/m²` : undefined}
          icon={<Wallet className="h-4 w-4" />}
          delay={200}
        />
        <StatCard
          label="Cashflow / Monat"
          value={formatCurrency(property.monthlyCashflow)}
          subValue={`${formatCurrency(property.monthlyCashflow * 12)}/Jahr`}
          trend={property.monthlyCashflow >= 0 ? "up" : "down"}
          delay={250}
        />
      </div>

      {/* Rendite - Improvement 8: Traffic light colors */}
      <div className="gradient-card rounded-xl border border-border p-5 animate-fade-in [animation-delay:300ms]">
        <h2 className="text-sm font-semibold mb-4">Renditekennzahlen</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: "Brutto-Rendite", value: bruttoRendite, format: (v: number) => `${v.toFixed(2)}%`, good: (v: number) => v >= 5, mid: (v: number) => v >= 3 },
            { label: "Netto-Rendite", value: nettoRendite, format: (v: number) => `${v.toFixed(2)}%`, good: (v: number) => v >= 3, mid: (v: number) => v >= 1.5 },
            { label: "Cash-on-Cash", value: cashOnCash, format: (v: number) => `${v.toFixed(2)}%`, good: (v: number) => v >= 5, mid: (v: number) => v >= 2 },
            { label: "Mietmultiplikator", value: mietmultiplikator, format: (v: number) => v > 0 ? `${v.toFixed(1)}x` : "–", good: (v: number) => v > 0 && v <= 20, mid: (v: number) => v > 0 && v <= 25 },
            { label: "LTV", value: ltv, format: (v: number) => `${v.toFixed(1)}%`, good: (v: number) => v <= 60, mid: (v: number) => v <= 80 },
            { label: "DSCR", value: dscr, format: (v: number) => v > 0 ? `${v.toFixed(2)}x` : "–", good: (v: number) => v >= 1.3, mid: (v: number) => v >= 1.0 },
            { label: "Break-Even", value: breakEvenOccupancy, format: (v: number) => `${v.toFixed(0)}%`, good: (v: number) => v <= 70, mid: (v: number) => v <= 90 },
            { label: "Preis/Einheit", value: pricePerUnit, format: (v: number) => formatCurrency(v), good: () => true, mid: () => false },
          ].map((item) => (
            <div key={item.label} className="relative">
              <div className="text-xs text-muted-foreground mb-1">{item.label}</div>
              <div className={`text-xl font-bold ${item.good(item.value) ? "text-profit" : item.mid(item.value) ? "text-gold" : "text-loss"}`}>
                {item.format(item.value)}
              </div>
              {/* Improvement 8: Traffic light dot */}
              <div className={`absolute top-0 right-0 w-2 h-2 rounded-full ${item.good(item.value) ? "bg-profit" : item.mid(item.value) ? "bg-gold" : "bg-loss"}`} />
            </div>
          ))}
        </div>
        <Link to={ROUTES.ANALYSE} className="text-xs text-primary hover:underline inline-flex items-center gap-1 mt-3 touch-target min-h-[36px] sm:min-h-0" aria-label="Zum Rechner und zur Analyse">
          <BarChart3 className="h-3 w-3 shrink-0" /> Rendite berechnen &amp; Szenarien
        </Link>
      </div>

      {/* Finanzierung */}
      <div className="gradient-card rounded-xl border border-border p-5 animate-fade-in [animation-delay:400ms]">
        <h2 className="text-sm font-semibold mb-4 flex items-center gap-2">
          <Landmark className="h-4 w-4 text-muted-foreground" /> Finanzierung
        </h2>
        <div className="space-y-3">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Restschuld</span>
            <span className="font-medium">{formatCurrency(property.remainingDebt)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Zinssatz</span>
            <span className="font-medium">{property.interestRate}%</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Kreditrate / Monat</span>
            <span className="font-medium">{formatCurrency(property.monthlyCreditRate)}</span>
          </div>
          <div className="h-2 bg-secondary rounded-full overflow-hidden mt-2">
            <div
              className="h-full bg-primary rounded-full progress-animated"
              style={{ width: `${property.purchasePrice > 0 ? ((property.purchasePrice - property.remainingDebt) / property.purchasePrice) * 100 : 0}%` }}
            />
          </div>
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>Getilgt</span>
            <span>{formatCurrency(property.purchasePrice - property.remainingDebt)}</span>
          </div>
          <div className="flex flex-wrap gap-3 mt-2">
            <Link to={`/darlehen${property?.id ? `?property=${property.id}` : ""}`} className="text-xs text-primary hover:underline inline-flex items-center gap-1 touch-target min-h-[36px]">
              Darlehen bearbeiten →
            </Link>
            <Link to={ROUTES.NK} className="text-xs text-primary hover:underline inline-flex items-center gap-1 touch-target min-h-[36px]">
              <Receipt className="h-3 w-3" /> Nebenkostenabrechnung
            </Link>
            {property?.id && (
              <Link to={`${ROUTES.RENT}?property=${property.id}`} className="text-xs text-primary hover:underline inline-flex items-center gap-1 touch-target min-h-[36px]" aria-label="Mietübersicht für dieses Objekt">
                Mietübersicht →
              </Link>
            )}
          </div>
        </div>
      </div>

      {/* AfA & 15%-Sanierungsregel */}
      {property.purchasePrice > 0 && (() => {
        const input = { purchasePrice: property.purchasePrice, yearBuilt: property.yearBuilt, buildingSharePercent: property.buildingSharePercent, restnutzungsdauer: property.restnutzungsdauer };
        const gebaeude = getGebaeudeAnteil(input);
        const grundBoden = getGrundUndBoden(input);
        const afaJahr = getAnnualAfa(input);
        const afaRate = getAfaRatePercent(input);
        const sanierungBrutto = getSanierung15PercentBrutto(input);
        return (
          <div className="gradient-card rounded-xl border border-border p-5 animate-fade-in [animation-delay:450ms]">
            <h2 className="text-sm font-semibold mb-4 flex items-center gap-2">
              <Percent className="h-4 w-4 text-muted-foreground" /> AfA & Sanierung
            </h2>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Grund und Boden</span>
                <span className="font-medium tabular-nums">{formatCurrency(grundBoden)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Gebäudeanteil ({property.buildingSharePercent ?? 80}%)</span>
                <span className="font-medium tabular-nums">{formatCurrency(gebaeude)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">AfA/Jahr ({afaRate.toFixed(1)}%)</span>
                <span className="font-medium tabular-nums text-profit">{formatCurrency(afaJahr)}</span>
              </div>
              <div className="pt-2 mt-2 border-t border-border">
                <div className="flex justify-between items-baseline gap-2">
                  <span className="text-muted-foreground text-xs">15%-Sanierungsregel (erste 3 Jahre)</span>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">Max. Sanierungskosten Brutto inkl. 19% MwSt.</p>
                <p className="font-semibold tabular-nums text-primary mt-0.5">{formatCurrency(sanierungBrutto)}</p>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Monthly breakdown */}
      <div className="gradient-card rounded-xl border border-border p-5 animate-fade-in [animation-delay:500ms]">
        <h2 className="text-sm font-semibold mb-4 flex items-center gap-2">
          <Wrench className="h-4 w-4 text-muted-foreground" /> Monatliche Übersicht
        </h2>
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Mieteinnahmen</span>
            <span className="text-profit font-medium">+{formatCurrency(property.monthlyRent)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Kreditrate</span>
            <span className="text-loss font-medium">-{formatCurrency(property.monthlyCreditRate)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Bewirtschaftungskosten</span>
            <span className="text-loss font-medium">-{formatCurrency(property.monthlyExpenses)}</span>
          </div>
          <div className="border-t border-border pt-2 mt-2 flex justify-between text-sm font-semibold">
            <span>Cashflow</span>
            <div className="text-right">
              <span className={property.monthlyCashflow >= 0 ? "text-profit" : "text-loss"}>
                {formatCurrency(property.monthlyCashflow)}
              </span>
              <div className="text-[10px] text-muted-foreground font-normal">
                {formatCurrency(property.monthlyCashflow * 12)}/Jahr
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Synergy: Besichtigungen für dieses Objekt — verbindet Objekte mit Akquise */}
      {synergy.viewings.length > 0 && (
        <div className="gradient-card rounded-xl border border-border p-5 animate-fade-in [animation-delay:550ms]">
          <h2 className="text-sm font-semibold mb-3 flex items-center gap-2">
            <Camera className="h-4 w-4 text-muted-foreground" /> Besichtigungen
          </h2>
          <div className="space-y-2">
            {synergy.viewings.map(v => (
              <div key={v.id} className="flex items-center justify-between gap-2 p-2 rounded-lg hover:bg-secondary/80 transition-colors group">
                <Link
                  to={`/besichtigungen?id=${v.id}`}
                  className="flex-1 flex items-center justify-between min-w-0"
                >
                  <span className="text-sm font-medium truncate">{v.title}</span>
                  <span className="text-xs text-muted-foreground shrink-0 ml-2">
                    {v.visited_at ? new Date(v.visited_at).toLocaleDateString("de-DE") : "–"}
                  </span>
                </Link>
                {v.deal_id && (
                  <Link
                    to={`/deals?id=${v.deal_id}`}
                    className="text-xs text-primary hover:underline shrink-0"
                    aria-label="Zum Deal"
                  >
                    Deal
                  </Link>
                )}
              </div>
            ))}
          </div>
          <Link to={ROUTES.BESICHTIGUNGEN} className="text-xs text-primary hover:underline mt-2 inline-block">
            Alle Besichtigungen →
          </Link>
        </div>
      )}

      {/* Synergy 14: Property-level action summary */}
      {(synergy.openTickets > 0 || synergy.overduePayments > 0 || synergy.totalRepairCost > 0) && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 animate-fade-in [animation-delay:550ms]">
          <div className={`rounded-lg p-3 text-center ${synergy.openTickets > 0 ? "bg-gold/10 border border-gold/20" : "bg-secondary/50"}`}>
            <Wrench className={`h-4 w-4 mx-auto mb-1 ${synergy.openTickets > 0 ? "text-gold" : "text-muted-foreground"}`} />
            <div className={`text-lg font-bold ${synergy.openTickets > 0 ? "text-gold" : "text-muted-foreground"}`}>{synergy.openTickets}</div>
            <div className="text-[10px] text-muted-foreground">Offene Tickets</div>
          </div>
          <div className={`rounded-lg p-3 text-center ${synergy.overduePayments > 0 ? "bg-loss/10 border border-loss/20" : "bg-secondary/50"}`}>
            <CreditCard className={`h-4 w-4 mx-auto mb-1 ${synergy.overduePayments > 0 ? "text-loss" : "text-muted-foreground"}`} />
            <div className={`text-lg font-bold ${synergy.overduePayments > 0 ? "text-loss" : "text-muted-foreground"}`}>{synergy.overduePayments}</div>
            <div className="text-[10px] text-muted-foreground">Überfällig</div>
          </div>
          <div className="rounded-lg p-3 text-center bg-secondary/50">
            <Euro className="h-4 w-4 mx-auto mb-1 text-muted-foreground" />
            <div className="text-sm font-bold">{formatCurrency(synergy.totalRepairCost)}</div>
            <div className="text-[10px] text-muted-foreground">Wartungskosten</div>
          </div>
          <div className="rounded-lg p-3 text-center bg-profit/10 border border-profit/20">
            <Users className="h-4 w-4 mx-auto mb-1 text-profit" />
            <div className="text-lg font-bold text-profit">{synergy.activeTenants}</div>
            <div className="text-[10px] text-muted-foreground">Aktive Mieter</div>
          </div>
        </div>
      )}

      {/* Expense Pie Chart */}
      <ExpensePieChart
        monthlyRent={property.monthlyRent}
        monthlyCreditRate={property.monthlyCreditRate}
        monthlyExpenses={property.monthlyExpenses}
        monthlyCashflow={property.monthlyCashflow}
      />

      {/* Feature 6: Automatische Wertermittlung */}
      <PropertyValuation
        propertyName={property.name}
        address={property.address}
        sqm={property.sqm}
        monthlyRent={property.monthlyRent}
        yearBuilt={property.yearBuilt}
        purchasePrice={property.purchasePrice}
        currentValue={property.currentValue}
        type={property.type}
      />

      {/* Benchmark */}
      <PropertyBenchmark propertyId={property.id} />

      {/* Feature 4: Steuer-Export Anlage V */}
      <AnlageVExport />

      {/* AfA Calculator */}
      <AfACalculator />

      {/* Kautions Overview */}
      <KautionsOverview propertyId={property.id} />

      {/* Value History */}
      <PropertyValueHistory propertyId={property.id} currentValue={property.currentValue} purchasePrice={property.purchasePrice} />

      {/* Entwicklungsplan: Mietanpassung + Modernisierung für Bankdarstellung */}
      <Entwicklungsplan
        property={{
          id: property.id,
          name: property.name,
          address: property.address,
          location: property.location,
          monthlyRent: property.monthlyRent,
          sqm: property.sqm,
          units: property.units,
          purchasePrice: property.purchasePrice,
          purchaseDate: property.purchaseDate,
          monthlyExpenses: property.monthlyExpenses,
          monthlyCreditRate: property.monthlyCreditRate,
        }}
        defaultOpen={true}
      />

      {/* Rent increase calculator + Maintenance + New tools */}
      <div className="flex items-center gap-2 flex-wrap">
        <RentIncreaseCalculator currentRent={property.monthlyRent} propertyName={property.name} />
        <RentIncreaseLetter />
        <HandoverProtocol />
        <DocumentTemplateGenerator />
      </div>

      {/* Maintenance Planner */}
      {!isMobile && <MaintenancePlanner propertyId={property.id} />}

      {/* Insurance Tracker */}
      <InsuranceTracker propertyId={property.id} />

      {/* Energy Certificate */}
      <EnergyCertificateTracker propertyId={property.id} />

      {/* Contracts */}
      <ContractManagement propertyId={property.id} />

      {/* Service Contracts */}
      {!isMobile && <ServiceContracts propertyId={property.id} />}

      {/* NOI & Cap Rate */}
      <div className="gradient-card rounded-xl border border-border p-5 animate-fade-in">
        <h2 className="text-sm font-semibold mb-3">Betriebskennzahlen</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {(() => {
            const noi = (property.monthlyRent - property.monthlyExpenses) * 12;
            const capRate = property.currentValue > 0 ? (noi / property.currentValue) * 100 : 0;
            const operatingRatio = property.monthlyRent > 0 ? (property.monthlyExpenses / property.monthlyRent) * 100 : 0;
            const rentPerUnit = property.units > 0 ? property.monthlyRent / property.units : 0;
            return [
              { label: "NOI (Netto-Betriebsergebnis)", value: formatCurrency(noi), good: noi > 0 },
              { label: "Cap Rate", value: `${capRate.toFixed(2)}%`, good: capRate >= 4 },
              { label: "Betriebskostenquote", value: `${operatingRatio.toFixed(0)}%`, good: operatingRatio <= 30 },
              { label: "Miete/Einheit", value: formatCurrency(rentPerUnit), good: true },
            ].map(item => (
              <div key={item.label}>
                <div className="text-xs text-muted-foreground mb-1">{item.label}</div>
                <div className={`text-lg font-bold ${item.good ? "text-profit" : "text-loss"}`}>{item.value}</div>
              </div>
            ));
          })()}
        </div>
      </div>

      {/* Meter Management */}
      {!isMobile && <MeterManagement propertyId={property.id} />}

      {/* Document Expiry Tracker */}
      {!isMobile && <DocumentExpiryTracker propertyId={property.id} />}

      {/* MOB-IMPROVE-2: Mobile Tab Navigation for sections below */}
      {isMobile ? (
        <MobilePropertyDetailTabs
          tabContent={{
            overview: (
              <div className="space-y-4">
                <ActivityTimeline propertyId={property.id} />
                <MeterManagement propertyId={property.id} />
                <DocumentExpiryTracker propertyId={property.id} />
              </div>
            ),
            tenants: (
              <div className="space-y-4">
                <TenantManagement propertyId={property.id} propertyName={property.name} propertyAddress={property.address} onTenantsChanged={() => setTenantVersion(v => v + 1)} />
                <div ref={el => { sectionRefs.current["messages"] = el; }}>
                  <MessageCenter propertyId={property.id} key={`msg-${tenantVersion}`} />
                </div>
                <div ref={el => { sectionRefs.current["payments"] = el; }}>
                  <LandlordPayments propertyId={property.id} />
                </div>
              </div>
            ),
            documents: (
              <div className="space-y-4">
                <div ref={el => { sectionRefs.current["documents"] = el; }}>
                  <PropertyDocuments propertyId={property.id} />
                </div>
                <div ref={el => { sectionRefs.current["notes"] = el; }}>
                  <PropertyNotes propertyId={property.id} />
                </div>
              </div>
            ),
            maintenance: (
              <div className="space-y-4">
                <div ref={el => { sectionRefs.current["tickets"] = el; }}>
                  <LandlordTickets propertyId={property.id} />
                </div>
                <MaintenancePlanner propertyId={property.id} />
                <div className="flex flex-wrap gap-2">
                  <Link to={ROUTES.WARTUNG} className="text-xs text-primary hover:underline">
                    Alle Wartungen im Wartungsplaner →
                  </Link>
                </div>
                <ServiceContracts propertyId={property.id} />
              </div>
            ),
          }}
          badges={{
            tenants: synergy.activeTenants,
            maintenance: synergy.openTickets,
          }}
        />
      ) : (
        <>
          {/* Activity Timeline */}
          <ActivityTimeline propertyId={property.id} />

          {/* Tenants */}
          <TenantManagement propertyId={property.id} propertyName={property.name} propertyAddress={property.address} onTenantsChanged={() => setTenantVersion(v => v + 1)} />

          {/* Messages */}
          <div ref={el => { sectionRefs.current["messages"] = el; }}>
            <MessageCenter propertyId={property.id} key={`msg-${tenantVersion}`} />
          </div>

          {/* Tickets */}
          <div ref={el => { sectionRefs.current["tickets"] = el; }}>
            <LandlordTickets propertyId={property.id} />
          </div>

          {/* Payments */}
          <div ref={el => { sectionRefs.current["payments"] = el; }}>
            <LandlordPayments propertyId={property.id} />
          </div>

          {/* Notes */}
          <div ref={el => { sectionRefs.current["notes"] = el; }}>
            <PropertyNotes propertyId={property.id} />
          </div>

          {/* Documents */}
          <div ref={el => { sectionRefs.current["documents"] = el; }}>
            <PropertyDocuments propertyId={property.id} />
          </div>
        </>
      )}
    </div>
  );
};

export default PropertyDetail;
