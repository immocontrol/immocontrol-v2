/**
 * DashboardWidgetGrid — extracted from Dashboard.tsx (Fix 3: Split large files).
 * Renders the unified drag-and-drop widget grid for the personal dashboard.
 */
import { lazy, Suspense } from "react";
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
  | "chart_cashflow" | "chart_monthly" | "chart_portfolio" | "chart_map";

export const DEFAULT_WIDGET_ORDER: WidgetId[] = [
  "chart_cashflow", "chart_monthly", "chart_portfolio", "chart_map",
  "health", "actions", "kpiAlerts",
  "stats", "occupancy", "heatmap", "typeChart", "allocation",
  "goals", "rendite", "diversifikation", "wasserfall", "yoy", "forecast",
  "debtEquity", "netWorth", "tilgung", "amortization", "cashReserve", "budget",
  "stress", "refinancing",
  "rentCollection", "expense", "annual", "hausgeld", "vacancy", "renovation",
  "zinsmonitor", "cashflowScenarios", "breakEven", "dscr", "bulkRent",
  "steuer", "tax", "geg", "grundsteuer", "mietpreisbremse", "leaseAlerts", "contractExpiry", "maintenance", "milestones",
  "historie", "reporting",
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

  /* Pre-filter widgets that return null to prevent grid gaps */
  const visibleWidgets = displayOrder.filter(wId => {
    const content = renderWidgetContent({
      wId, stats, totalMonthlyExpenses: stats.totalExpenses,
      totalMonthlyCreditRate: stats.totalCreditRate,
      vacancyRate, propertyCount: stats.propertyCount,
      properties, allTenants,
    });
    return content !== null;
  });

  /* Map from original widgetOrder index for drag props */
  const originalIdxOf = (wId: WidgetId) => widgetOrder.indexOf(wId);

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
            <div
              key={wId}
              data-drag-idx={origIdx}
              {...widgetDrag.getItemProps(origIdx)}
              role="listitem"
              aria-label={WIDGET_LABELS[wId] || wId}
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
                  <span className="text-[10px] font-semibold text-foreground">{WIDGET_LABELS[wId] || wId}</span>
                </div>
              )}
              <WidgetErrorBoundary name={wId}>
                {widgetContent}
              </WidgetErrorBoundary>
            </div>
          );
        })}
      </div>
    </div>
  );
}
