/**
 * DashboardWidgetGrid — extracted from Dashboard.tsx (Fix 3: Split large files).
 * Renders the unified drag-and-drop widget grid for the personal dashboard.
 * Mobile: long-press on the whole tile starts drag (iOS-style).
 */
import { lazy, Suspense, useMemo, useRef, useCallback } from "react";
import { GripVertical } from "lucide-react";
import { WidgetErrorBoundary } from "@/components/WidgetErrorBoundary";
/* useDragReorder return type inferred from the hook */

/* Lazy-loaded chart components */
const PortfolioChart = lazy(() => import("@/components/PortfolioChart"));
const CashflowChart = lazy(() => import("@/components/CashflowChart"));
const MonthlyOverviewChart = lazy(() => import("@/components/MonthlyOverviewChart"));
const PropertyMap = lazy(() => import("@/components/PropertyMap"));

/* Eagerly-loaded widget components */
import PortfolioHealthScore from "@/components/PortfolioHealthScore";
import OccupancyTracker from "@/components/OccupancyTracker";
import YieldHeatmap from "@/components/YieldHeatmap";
import PortfolioTypeChart from "@/components/PortfolioTypeChart";
import PortfolioGoals from "@/components/PortfolioGoals";
import PortfolioForecast from "@/components/PortfolioForecast";
import RenditeRanking from "@/components/RenditeRanking";
import WasserfallChart from "@/components/WasserfallChart";
import DiversifikationsScore from "@/components/DiversifikationsScore";
import TilgungsProgress from "@/components/TilgungsProgress";
import SteuerHelfer from "@/components/SteuerHelfer";
import AnnualSummaryCard from "@/components/AnnualSummaryCard";
import CashReserveWidget from "@/components/CashReserveWidget";
import MortgageStressTest from "@/components/MortgageStressTest";
import PortfolioMilestones from "@/components/PortfolioMilestones";
import TaxDeadlineReminder from "@/components/TaxDeadlineReminder";
import GEGComplianceChecker from "@/components/GEGComplianceChecker";
import MietpreisbremseChecker from "@/components/MietpreisbremseChecker";
import LoanRefinancingCalc from "@/components/LoanRefinancingCalc";
import GrundsteuerCalculator from "@/components/GrundsteuerCalculator";
import HausgeldTracker from "@/components/HausgeldTracker";
import VacancyCostCalc from "@/components/VacancyCostCalc";
import RenovationROICalc from "@/components/RenovationROICalc";
import BudgetVsActual from "@/components/BudgetVsActual";
import RentCollectionChart from "@/components/RentCollectionChart";
import YearOverYear from "@/components/YearOverYear";
import ContractExpiryCountdown from "@/components/ContractExpiryCountdown";
import ExpenseCategoryBreakdown from "@/components/ExpenseCategoryBreakdown";
import MaintenanceCostTrend from "@/components/MaintenanceCostTrend";
import PortfolioAllocationWidget from "@/components/PortfolioAllocationWidget";
import LoanAmortizationMini from "@/components/LoanAmortizationMini";
import DebtEquityWidget from "@/components/DebtEquityWidget";
import NetWorthTracker from "@/components/NetWorthTracker";
import TenantLeaseAlerts from "@/components/TenantLeaseAlerts";
import DashboardActionCenter from "@/components/DashboardActionCenter";
import PortfolioHistorie from "@/components/PortfolioHistorie";
import ReportingDashboard from "@/components/ReportingDashboard";
import KPIAlerts from "@/components/KPIAlerts";
import CashflowPerSqmWidget from "@/components/CashflowPerSqmWidget";
import InterestRateMonitor from "@/components/InterestRateMonitor";
import { CashflowScenarios } from "@/components/CashflowScenarios";
import { BreakEvenAnalysis } from "@/components/BreakEvenAnalysis";
import { DSCRWidget } from "@/components/DSCRWidget";
import { BulkRentAdjustment } from "@/components/BulkRentAdjustment";
import QuickNoteWidget from "@/components/QuickNoteWidget";

/* IMP20 widgets */
import { SteuerCockpit } from "@/components/SteuerCockpit";
import { MonatsabschlussWidget } from "@/components/MonatsabschlussWidget";
import { CashflowKalender } from "@/components/CashflowKalender";
import { AutomaticMahnungen } from "@/components/AutomaticMahnungen";
import { IndexMietanpassung } from "@/components/IndexMietanpassung";
import { AutoTodoGenerator } from "@/components/AutoTodoGenerator";
import { CrmFollowUpReminder } from "@/components/CrmFollowUpReminder";
import { DatenGesundheitscheck } from "@/components/DatenGesundheitscheck";
import { WartungskostenPrognose } from "@/components/WartungskostenPrognose";
import { PortfolioStresstest } from "@/components/PortfolioStresstest";

/* INHALT-1 to INHALT-20: 20 große inhaltliche Verbesserungen */
import { VermoegensuebersichtV2 } from "@/components/VermoegensuebersichtV2";
import { SteuerJahresabschluss } from "@/components/SteuerJahresabschluss";
import { FinanzierungsVergleich } from "@/components/FinanzierungsVergleich";
import { ImmobilienScoring } from "@/components/ImmobilienScoring";
import { ExitStrategiePlaner } from "@/components/ExitStrategiePlaner";
import { IntelligentNKAbrechnung } from "@/components/IntelligentNKAbrechnung";
import { MieterKommunikation } from "@/components/MieterKommunikation";
import { KautionsManagement } from "@/components/KautionsManagement";
import { LeerstandskostenAnalyse } from "@/components/LeerstandskostenAnalyse";
import { MietpreisCheck } from "@/components/MietpreisCheck";
import { CashflowWasserfall } from "@/components/CashflowWasserfall";
import { PortfolioBenchmark } from "@/components/PortfolioBenchmark";
import { SzenarioSimulation } from "@/components/SzenarioSimulation";
import { MonatsabschlussWorkflow } from "@/components/MonatsabschlussWorkflow";
import { SteuerOptimierung } from "@/components/SteuerOptimierung";
import { DealBewertungsScorecard } from "@/components/DealBewertungsScorecard";
import { DueDiligenceCheckliste } from "@/components/DueDiligenceCheckliste";
import { AngebotsGenerator } from "@/components/AngebotsGenerator";
import { InstandhaltungsRuecklagePlaner } from "@/components/InstandhaltungsRuecklagePlaner";
import { HandwerkerAusschreibung } from "@/components/HandwerkerAusschreibung";
import FristenZentrale from "@/components/FristenZentrale";

export type WidgetId =
  | "health" | "stats" | "occupancy" | "heatmap" | "typeChart" | "goals"
  | "forecast" | "rendite" | "wasserfall" | "diversifikation" | "tilgung"
  | "steuer" | "annual" | "cashReserve" | "stress" | "milestones" | "tax"
  | "geg" | "mietpreisbremse" | "refinancing" | "grundsteuer" | "hausgeld"
  | "vacancy" | "renovation" | "budget" | "rentCollection" | "yoy"
  | "contractExpiry" | "expense" | "maintenance" | "allocation" | "amortization"
  | "debtEquity" | "netWorth" | "leaseAlerts" | "actions" | "historie"
  | "reporting" | "kpiAlerts" | "zinsmonitor" | "cashflowScenarios"
  | "breakEven" | "dscr" | "bulkRent"
  | "chart_cashflow" | "chart_monthly" | "chart_portfolio" | "chart_map"
  | "steuerCockpit" | "monatsabschluss" | "cashflowKalender" | "mahnungen"
  | "indexMiete" | "autoTodos" | "crmFollowUp" | "datenCheck"
  | "wartungsprognose" | "portfolioStress"
  /* INHALT-1 to INHALT-20 */
  | "vermoegenV2" | "steuerJahresabschluss" | "finanzierungsVergleich"
  | "immobilienScoring" | "exitStrategie" | "nkAbrechnung"
  | "mieterKommunikation" | "kautionsManagement" | "leerstandskosten"
  | "mietpreisCheck" | "cashflowWasserfall" | "portfolioBenchmark"
  | "szenarioSimulation" | "monatsabschlussWorkflow" | "steuerOptimierung"
  | "dealScorecard" | "dueDiligence" | "angebotsGenerator"
  | "instandhaltungsRuecklage" | "handwerkerAusschreibung"
  | "fristenZentrale";

export const DEFAULT_WIDGET_ORDER: WidgetId[] = [
  "chart_cashflow", "chart_monthly", "chart_portfolio", "chart_map",
  "health", "actions", "kpiAlerts",
  "stats", "occupancy", "heatmap", "typeChart", "allocation",
  "goals", "rendite", "diversifikation", "wasserfall", "yoy", "forecast",
  "debtEquity", "netWorth", "tilgung", "amortization", "cashReserve", "budget",
  "stress", "refinancing",
  "rentCollection", "expense", "annual", "hausgeld", "vacancy", "renovation",
  "zinsmonitor", "cashflowScenarios", "breakEven", "dscr", "bulkRent",
  "steuer", "tax", "geg", "grundsteuer", "mietpreisbremse", "leaseAlerts", "contractExpiry", "fristenZentrale", "maintenance", "milestones",
  "historie", "reporting",
  "steuerCockpit", "monatsabschluss", "cashflowKalender", "mahnungen",
  "indexMiete", "autoTodos", "crmFollowUp", "datenCheck",
  "wartungsprognose", "portfolioStress",
  /* INHALT-1 to INHALT-20 */
  "vermoegenV2", "steuerJahresabschluss", "finanzierungsVergleich",
  "immobilienScoring", "exitStrategie", "nkAbrechnung",
  "mieterKommunikation", "kautionsManagement", "leerstandskosten",
  "mietpreisCheck", "cashflowWasserfall", "portfolioBenchmark",
  "szenarioSimulation", "monatsabschlussWorkflow", "steuerOptimierung",
  "dealScorecard", "dueDiligence", "angebotsGenerator",
  "instandhaltungsRuecklage", "handwerkerAusschreibung",
  "fristenZentrale",
];

export const WIDGET_LABELS: Record<WidgetId, string> = {
  health: "Portfolio Health Score", stats: "Statistiken", occupancy: "Belegungsquote",
  heatmap: "Heatmap", typeChart: "Objekttypen", goals: "Ziele", forecast: "Prognose",
  rendite: "Rendite-Optimierer", wasserfall: "Wasserfall-Diagramm", diversifikation: "Diversifikation",
  tilgung: "Tilgungsfortschritt", steuer: "Steuer-Optimierung", annual: "Jahresübersicht",
  cashReserve: "Cash-Reserve", stress: "Stresstest", milestones: "Meilensteine",
  tax: "Steuerübersicht", geg: "GEG-Check", mietpreisbremse: "Mietpreisbremse",
  refinancing: "Refinanzierung", grundsteuer: "Grundsteuer", hausgeld: "Hausgeld",
  vacancy: "Leerstand", renovation: "Renovierung", budget: "Budget",
  rentCollection: "Mieteinzug", yoy: "Jahresvergleich", contractExpiry: "Vertragsablauf",
  expense: "Ausgaben", maintenance: "Wartung", allocation: "Allokation",
  amortization: "Amortisation", debtEquity: "Fremd-/Eigenkapital", netWorth: "Nettovermögen",
  leaseAlerts: "Mietvertrags-Alerts", actions: "Quick Actions", historie: "Historie",
  reporting: "Reporting", kpiAlerts: "KPI-Alerts", zinsmonitor: "Zinsmonitor",
  cashflowScenarios: "Cashflow-Szenarien", breakEven: "Break-Even", dscr: "DSCR",
  bulkRent: "Mietanpassung",
  chart_cashflow: "Cashflow-Übersicht", chart_monthly: "Monatsübersicht",
  chart_portfolio: "Portfolio-Verteilung", chart_map: "Standortkarte",
  steuerCockpit: "Steuer-Cockpit", monatsabschluss: "Monatsabschluss",
  cashflowKalender: "Cashflow-Kalender", mahnungen: "Mahnungen",
  indexMiete: "Index-Mietanpassung", autoTodos: "Auto-Todos",
  crmFollowUp: "CRM Follow-Up", datenCheck: "Daten-Check",
  wartungsprognose: "Wartungsprognose", portfolioStress: "Portfolio-Stresstest",
  /* INHALT-1 to INHALT-20 */
  vermoegenV2: "Vermögensübersicht 2.0", steuerJahresabschluss: "Steuer-Jahresabschluss",
  finanzierungsVergleich: "Finanzierungsvergleich", immobilienScoring: "Immobilien-Scoring",
  exitStrategie: "Exit-Strategie-Planer", nkAbrechnung: "NK-Abrechnung",
  mieterKommunikation: "Mieter-Kommunikation", kautionsManagement: "Kautions-Management",
  leerstandskosten: "Leerstandskosten", mietpreisCheck: "Mietpreis-Check",
  cashflowWasserfall: "Cashflow-Wasserfall", portfolioBenchmark: "Portfolio-Benchmark",
  szenarioSimulation: "Szenario-Simulation", monatsabschlussWorkflow: "Monatsabschluss-Workflow",
  steuerOptimierung: "Steuer-Optimierung", dealScorecard: "Deal-Scorecard",
  dueDiligence: "Due Diligence", angebotsGenerator: "Angebots-Generator",
  instandhaltungsRuecklage: "Instandhaltungs-Rücklage", handwerkerAusschreibung: "Handwerker-Ausschreibung",
  fristenZentrale: "Fristen-Zentrale",
};

const FULL_WIDTH_WIDGETS = new Set<WidgetId>([
  "health", "occupancy", "heatmap", "leaseAlerts", "actions",
  "historie", "reporting", "kpiAlerts", "bulkRent", "chart_monthly", "chart_map",
]);

const ChartFallback = () => (
  <div className="h-64 bg-secondary/50 rounded-xl animate-pulse" />
);

interface WidgetContentProps {
  wId: WidgetId;
  stats: {
    totalValue: number;
    totalDebt: number;
    totalCashflow: number;
    totalRent: number;
    totalUnits: number;
    equity: number;
  };
  totalMonthlyExpenses: number;
  totalMonthlyCreditRate: number;
  vacancyRate: number;
  propertyCount: number;
  properties: Array<{ id: string; name: string; units: number; monthlyRent: number; monthlyExpenses: number; monthlyCreditRate: number; monthlyCashflow: number; purchasePrice: number; currentValue: number; remainingDebt: number; interestRate: number; sqm: number; yearBuilt: number; ownership: string; address: string | null; type: string }>;
  allTenants: Array<{ property_id: string; is_active: boolean; monthly_rent: number }>;
}

function renderWidgetContent({
  wId, stats, totalMonthlyExpenses, totalMonthlyCreditRate, vacancyRate,
  propertyCount, properties, allTenants,
}: WidgetContentProps): React.ReactNode | null {
  switch (wId) {
    case "chart_cashflow": return <Suspense fallback={<ChartFallback />}><CashflowChart /></Suspense>;
    case "chart_monthly": return <Suspense fallback={<ChartFallback />}><MonthlyOverviewChart /></Suspense>;
    case "chart_portfolio": return <Suspense fallback={<ChartFallback />}><PortfolioChart /></Suspense>;
    case "chart_map": return <Suspense fallback={<ChartFallback />}><PropertyMap /></Suspense>;
    case "health": return <PortfolioHealthScore totalValue={stats.totalValue} totalDebt={stats.totalDebt} totalCashflow={stats.totalCashflow} totalRent={stats.totalRent} totalExpenses={totalMonthlyExpenses} totalCreditRate={totalMonthlyCreditRate} vacancyRate={vacancyRate} propertyCount={propertyCount} />;
    case "occupancy": return allTenants.length > 0 ? <OccupancyTracker properties={properties.map(p => ({ id: p.id, name: p.name, units: p.units, monthlyRent: p.monthlyRent }))} tenants={allTenants} /> : null;
    case "heatmap": return <YieldHeatmap properties={properties} />;
    case "typeChart": return <PortfolioTypeChart properties={properties} />;
    case "goals": return <PortfolioGoals currentStats={{ totalValue: stats.totalValue, totalCashflow: stats.totalCashflow, totalUnits: stats.totalUnits, equity: stats.equity }} />;
    case "forecast": return <PortfolioForecast />;
    case "rendite": return <RenditeRanking />;
    case "wasserfall": return <WasserfallChart />;
    case "diversifikation": return <DiversifikationsScore />;
    case "tilgung": return <TilgungsProgress />;
    case "steuer": return <SteuerHelfer />;
    case "annual": return <AnnualSummaryCard />;
    case "cashReserve": return <CashReserveWidget />;
    case "stress": return <MortgageStressTest />;
    case "milestones": return <PortfolioMilestones />;
    case "tax": return <TaxDeadlineReminder />;
    case "geg": return <GEGComplianceChecker />;
    case "mietpreisbremse": return <MietpreisbremseChecker />;
    case "refinancing": return <LoanRefinancingCalc />;
    case "grundsteuer": return <GrundsteuerCalculator />;
    case "hausgeld": return <HausgeldTracker />;
    case "vacancy": return <VacancyCostCalc />;
    case "renovation": return <RenovationROICalc />;
    case "budget": return <BudgetVsActual />;
    case "rentCollection": return <RentCollectionChart />;
    case "yoy": return <YearOverYear />;
    case "contractExpiry": return <ContractExpiryCountdown />;
    case "expense": return <ExpenseCategoryBreakdown />;
    case "maintenance": return <MaintenanceCostTrend />;
    case "allocation": return <PortfolioAllocationWidget />;
    case "amortization": return <LoanAmortizationMini />;
    case "debtEquity": return <DebtEquityWidget totalValue={stats.totalValue} totalDebt={stats.totalDebt} equity={stats.equity} />;
    case "netWorth": return <NetWorthTracker currentEquity={stats.equity} totalValue={stats.totalValue} totalDebt={stats.totalDebt} />;
    case "leaseAlerts": return <TenantLeaseAlerts propertyNames={Object.fromEntries(properties.map(p => [p.id, p.name]))} />;
    case "actions": return <DashboardActionCenter />;
    case "historie": return <PortfolioHistorie />;
    case "reporting": return <ReportingDashboard />;
    case "kpiAlerts": return <KPIAlerts />;
    case "stats": return <CashflowPerSqmWidget properties={properties} />;
    case "zinsmonitor": return <InterestRateMonitor />;
    case "cashflowScenarios": return <CashflowScenarios />;
    case "breakEven": return <BreakEvenAnalysis />;
    case "dscr": return <DSCRWidget />;
    case "bulkRent": return <BulkRentAdjustment />;
    /* IMP20 widgets */
    case "steuerCockpit": return <SteuerCockpit />;
    case "monatsabschluss": return <MonatsabschlussWidget />;
    case "cashflowKalender": return <CashflowKalender />;
    case "mahnungen": return <AutomaticMahnungen />;
    case "indexMiete": return <IndexMietanpassung />;
    case "autoTodos": return <AutoTodoGenerator />;
    case "crmFollowUp": return <CrmFollowUpReminder />;
    case "datenCheck": return <DatenGesundheitscheck />;
    case "wartungsprognose": return <WartungskostenPrognose />;
    case "portfolioStress": return <PortfolioStresstest />;
    /* INHALT-1 to INHALT-20 */
    case "vermoegenV2": return <VermoegensuebersichtV2 />;
    case "steuerJahresabschluss": return <SteuerJahresabschluss />;
    case "finanzierungsVergleich": return <FinanzierungsVergleich />;
    case "immobilienScoring": return <ImmobilienScoring />;
    case "exitStrategie": return <ExitStrategiePlaner />;
    case "nkAbrechnung": return <IntelligentNKAbrechnung />;
    case "mieterKommunikation": return <MieterKommunikation />;
    case "kautionsManagement": return <KautionsManagement />;
    case "leerstandskosten": return <LeerstandskostenAnalyse />;
    case "mietpreisCheck": return <MietpreisCheck />;
    case "cashflowWasserfall": return <CashflowWasserfall />;
    case "portfolioBenchmark": return <PortfolioBenchmark />;
    case "szenarioSimulation": return <SzenarioSimulation />;
    case "monatsabschlussWorkflow": return <MonatsabschlussWorkflow />;
    case "steuerOptimierung": return <SteuerOptimierung />;
    case "dealScorecard": return <DealBewertungsScorecard />;
    case "dueDiligence": return <DueDiligenceCheckliste />;
    case "angebotsGenerator": return <AngebotsGenerator />;
    case "instandhaltungsRuecklage": return <InstandhaltungsRuecklagePlaner />;
    case "handwerkerAusschreibung": return <HandwerkerAusschreibung />;
    case "fristenZentrale": return <FristenZentrale />;
    default: return <QuickNoteWidget />;
  }
}

interface DragReorder {
  dragIdx: number | null;
  overIdx: number | null;
  isDragging: boolean;
  containerRef: React.RefObject<HTMLDivElement | null>;
  getHandleProps: (idx: number) => Record<string, unknown>;
  getItemProps: (idx: number) => Record<string, never>;
  getPreviewOrder: () => unknown[];
  startDrag: (idx: number) => void;
}

interface DashboardWidgetGridProps {
  widgetOrder: WidgetId[];
  widgetDrag: DragReorder;
  isWidgetDragOverview: boolean;
  stats: WidgetContentProps["stats"] & { totalExpenses: number; totalCreditRate: number; propertyCount: number };
  vacancyRate: number;
  properties: WidgetContentProps["properties"];
  allTenants: WidgetContentProps["allTenants"];
}

export function DashboardWidgetGrid({
  widgetOrder, widgetDrag, isWidgetDragOverview,
  stats, vacancyRate, properties, allTenants,
}: DashboardWidgetGridProps) {
  /* iOS-style: use preview order during drag so items visually shift in real-time */
  const displayOrder = widgetDrag.isDragging
    ? (widgetDrag.getPreviewOrder() as WidgetId[])
    : widgetOrder;

  /* STRONG-19: Memoize visibleWidgets — prevents re-running renderWidgetContent for every widget on each render */
  const visibleWidgets = useMemo(() => displayOrder.filter(wId => {
    const content = renderWidgetContent({
      wId, stats, totalMonthlyExpenses: stats.totalExpenses,
      totalMonthlyCreditRate: stats.totalCreditRate,
      vacancyRate, propertyCount: stats.propertyCount,
      properties, allTenants,
    });
    return content !== null;
  }), [displayOrder, stats, vacancyRate, properties, allTenants]);

  /* Map from original widgetOrder index for drag props */
  const originalIdxOf = (wId: WidgetId) => widgetOrder.indexOf(wId);

  const LONG_PRESS_MS = 400;

  return (
    <div>
      <p className="text-[10px] font-normal text-muted-foreground mb-2">Ziehen zum Umsortieren</p>
      <div
        ref={widgetDrag.containerRef}
        className={`grid md:grid-cols-2 gap-3 auto-rows-auto transition-all duration-300 origin-top ${
          isWidgetDragOverview
            ? "scale-[0.85] opacity-80 bg-secondary/20 rounded-2xl p-3 ring-2 ring-primary/20"
            : ""
        }`}
        role="list"
        aria-label="Dashboard Widgets"
      >
        {visibleWidgets.map((wId) => {
          const origIdx = originalIdxOf(wId);
          const isDraggedItem = widgetDrag.dragIdx === origIdx;
          const widgetContent = renderWidgetContent({
            wId, stats, totalMonthlyExpenses: stats.totalExpenses,
            totalMonthlyCreditRate: stats.totalCreditRate,
            vacancyRate, propertyCount: stats.propertyCount,
            properties, allTenants,
          });
          const fullWidth = FULL_WIDTH_WIDGETS.has(wId);
          return (
            <WidgetCardWithLongPress
              key={wId}
              origIdx={origIdx}
              isDraggedItem={isDraggedItem}
              fullWidth={fullWidth}
              widgetId={wId}
              widgetLabel={WIDGET_LABELS[wId] || wId}
              widgetDrag={widgetDrag}
              isWidgetDragOverview={isWidgetDragOverview}
              longPressMs={LONG_PRESS_MS}
            >
              {widgetContent}
            </WidgetCardWithLongPress>
          );
        })}
      </div>
    </div>
  );
}

/** Single widget card with long-press-to-drag on touch (iOS-style). */
function WidgetCardWithLongPress({
  origIdx,
  isDraggedItem,
  fullWidth,
  widgetId,
  widgetLabel,
  widgetDrag,
  isWidgetDragOverview,
  longPressMs,
  children,
}: {
  origIdx: number;
  isDraggedItem: boolean;
  fullWidth: boolean;
  widgetId: WidgetId;
  widgetLabel: string;
  widgetDrag: DragReorder;
  isWidgetDragOverview: boolean;
  longPressMs: number;
  children: React.ReactNode;
}) {
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearLongPress = useCallback(() => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  }, []);

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (e.pointerType !== "touch" || widgetDrag.isDragging) return;
      longPressTimerRef.current = setTimeout(() => {
        longPressTimerRef.current = null;
        widgetDrag.startDrag(origIdx);
        if (navigator.vibrate) navigator.vibrate(30);
      }, longPressMs);
    },
    [origIdx, longPressMs, widgetDrag],
  );

  const onPointerUp = useCallback(() => clearLongPress(), [clearLongPress]);
  const onPointerLeave = useCallback(() => clearLongPress(), [clearLongPress]);
  const onPointerCancel = useCallback(() => clearLongPress(), [clearLongPress]);

  return (
            <div
              data-drag-idx={origIdx}
              {...widgetDrag.getItemProps(origIdx)}
              role="listitem"
              aria-label={widgetLabel}
              onPointerDown={onPointerDown}
              onPointerUp={onPointerUp}
              onPointerLeave={onPointerLeave}
              onPointerCancel={onPointerCancel}
              className={`relative group rounded-xl ${
                fullWidth ? "md:col-span-2" : ""
              } ${
                isDraggedItem
                  ? "opacity-50 scale-[0.95] shadow-2xl ring-2 ring-primary/50 z-20 transition-transform duration-75"
                  : "transition-all duration-300 ease-out"
              }`}
            >
              <div
                {...widgetDrag.getHandleProps(origIdx)}
                className="absolute top-2 right-2 z-10 opacity-60 sm:opacity-0 group-hover:opacity-100 transition-opacity cursor-grab active:cursor-grabbing bg-background/80 backdrop-blur-sm rounded-md p-1.5 border border-border/50"
                aria-label="Ziehen zum Umsortieren"
              >
                <GripVertical className="h-4 w-4 text-muted-foreground" />
              </div>
              {isWidgetDragOverview && (
                <div className="absolute inset-x-0 bottom-0 z-10 bg-gradient-to-t from-background/90 to-transparent p-2 rounded-b-xl">
                  <span className="text-[10px] font-semibold text-foreground">{widgetLabel}</span>
                </div>
              )}
              <WidgetErrorBoundary name={widgetId}>
                {children}
              </WidgetErrorBoundary>
            </div>
  );
}
