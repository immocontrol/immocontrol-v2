/* #1: Extracted from Dashboard.tsx — Widget grid with drag & drop reordering */
import React from "react";
import { GripVertical } from "lucide-react";
import { WidgetErrorBoundary } from "@/components/WidgetErrorBoundary";
import PortfolioGoals from "@/components/PortfolioGoals";
import PortfolioForecast from "@/components/PortfolioForecast";
import RenditeRanking from "@/components/RenditeRanking";
import DiversifikationsScore from "@/components/DiversifikationsScore";
import WasserfallChart from "@/components/WasserfallChart";
import SteuerHelfer from "@/components/SteuerHelfer";
import TilgungsProgress from "@/components/TilgungsProgress";
import QuickNoteWidget from "@/components/QuickNoteWidget";
import OccupancyTracker from "@/components/OccupancyTracker";
import MietpreisbremseChecker from "@/components/MietpreisbremseChecker";
import GrundsteuerCalculator from "@/components/GrundsteuerCalculator";
import CashReserveWidget from "@/components/CashReserveWidget";
import LoanRefinancingCalc from "@/components/LoanRefinancingCalc";
import VacancyCostCalc from "@/components/VacancyCostCalc";
import MortgageStressTest from "@/components/MortgageStressTest";
import GEGComplianceChecker from "@/components/GEGComplianceChecker";
import PortfolioMilestones from "@/components/PortfolioMilestones";
import TaxDeadlineReminder from "@/components/TaxDeadlineReminder";
import RenovationROICalc from "@/components/RenovationROICalc";
import HausgeldTracker from "@/components/HausgeldTracker";
import AnnualSummaryCard from "@/components/AnnualSummaryCard";
import DebtEquityWidget from "@/components/DebtEquityWidget";
import YieldHeatmap from "@/components/YieldHeatmap";
import PortfolioTypeChart from "@/components/PortfolioTypeChart";
import TenantLeaseAlerts from "@/components/TenantLeaseAlerts";
import NetWorthTracker from "@/components/NetWorthTracker";
import CashflowPerSqmWidget from "@/components/CashflowPerSqmWidget";
import RentCollectionChart from "@/components/RentCollectionChart";
import ExpenseCategoryBreakdown from "@/components/ExpenseCategoryBreakdown";
import YearOverYear from "@/components/YearOverYear";
import ContractExpiryCountdown from "@/components/ContractExpiryCountdown";
import MaintenanceCostTrend from "@/components/MaintenanceCostTrend";
import PortfolioAllocationWidget from "@/components/PortfolioAllocationWidget";
import BudgetVsActual from "@/components/BudgetVsActual";
import LoanAmortizationMini from "@/components/LoanAmortizationMini";
import PortfolioHistorie from "@/components/PortfolioHistorie";
import ReportingDashboard from "@/components/ReportingDashboard";
import KPIAlerts from "@/components/KPIAlerts";
import DashboardActionCenter from "@/components/DashboardActionCenter";
import PortfolioHealthScore from "@/components/PortfolioHealthScore";
import InterestRateMonitor from "@/components/InterestRateMonitor";
import { CashflowScenarios } from "@/components/CashflowScenarios";
import { BreakEvenAnalysis } from "@/components/BreakEvenAnalysis";
import { DSCRWidget } from "@/components/DSCRWidget";
import { BulkRentAdjustment } from "@/components/BulkRentAdjustment";
import { RecurringTodos } from "@/components/RecurringTodos";
import { AutoNebenkosten } from "@/components/AutoNebenkosten";
import { ContractTemplates } from "@/components/ContractTemplates";
import { TaxYearOverview } from "@/components/TaxYearOverview";
import { AuditLog } from "@/components/AuditLog";
import { DataBackup } from "@/components/DataBackup";

export type WidgetId = "health" | "stats" | "occupancy" | "heatmap" | "typeChart" | "goals" | "forecast" | "rendite" | "wasserfall" | "diversifikation" | "tilgung" | "steuer" | "annual" | "cashReserve" | "stress" | "milestones" | "tax" | "geg" | "mietpreisbremse" | "refinancing" | "grundsteuer" | "hausgeld" | "vacancy" | "renovation" | "budget" | "rentCollection" | "yoy" | "contractExpiry" | "expense" | "maintenance" | "allocation" | "amortization" | "debtEquity" | "netWorth" | "leaseAlerts" | "actions" | "historie" | "reporting" | "kpiAlerts" | "zinsmonitor" | "cashflowScenarios" | "breakEven" | "dscr" | "bulkRent" | "recurringTodos" | "autoNebenkosten" | "contractTemplates" | "taxYear" | "auditLog" | "dataBackup";

export const defaultWidgetOrder: WidgetId[] = [
  "health", "actions", "kpiAlerts",
  "stats", "occupancy", "heatmap", "typeChart", "allocation",
  "goals", "rendite", "diversifikation", "wasserfall", "yoy", "forecast",
  "debtEquity", "netWorth", "tilgung", "amortization", "cashReserve", "budget",
  "stress", "refinancing",
  "rentCollection", "expense", "annual", "hausgeld", "vacancy", "renovation",
  "steuer", "tax", "geg", "grundsteuer", "mietpreisbremse", "leaseAlerts", "contractExpiry", "maintenance", "milestones",
  "historie", "reporting",
  "zinsmonitor", "cashflowScenarios", "breakEven", "dscr",
  "bulkRent", "recurringTodos", "autoNebenkosten", "contractTemplates",
  "taxYear", "auditLog", "dataBackup",
];

const FULL_WIDTH_WIDGETS = new Set<WidgetId>(["health", "occupancy", "heatmap", "leaseAlerts", "actions", "historie", "reporting", "kpiAlerts", "bulkRent", "auditLog"]);

interface Property {
  id: string;
  name: string;
  units: number;
  monthlyRent: number;
}

interface DashboardWidgetGridProps {
  widgetOrder: WidgetId[];
  widgetDrag: {
    dragIdx: number | null;
    overIdx: number | null;
    isDragging: boolean;
    containerRef: React.RefObject<HTMLDivElement | null>;
    getHandleProps: (idx: number) => Record<string, unknown>;
    getItemProps: (idx: number) => Record<string, unknown>;
  };
  isWidgetDragOverview: boolean;
  stats: {
    totalValue: number;
    totalDebt: number;
    totalCashflow: number;
    totalRent: number;
    totalUnits: number;
    equity: number;
    propertyCount: number;
  };
  totalMonthlyExpenses: number;
  totalMonthlyCreditRate: number;
  vacancyRate: number;
  properties: Property[];
  allTenants: { property_id: string; is_active: boolean; monthly_rent: number }[];
}

function getWidgetContent(
  wId: WidgetId,
  props: DashboardWidgetGridProps,
): React.ReactNode {
  const { stats, totalMonthlyExpenses, totalMonthlyCreditRate, vacancyRate, properties, allTenants } = props;
  switch (wId) {
    case "health": return <PortfolioHealthScore totalValue={stats.totalValue} totalDebt={stats.totalDebt} totalCashflow={stats.totalCashflow} totalRent={stats.totalRent} totalExpenses={totalMonthlyExpenses} totalCreditRate={totalMonthlyCreditRate} vacancyRate={vacancyRate} propertyCount={stats.propertyCount} />;
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
    case "recurringTodos": return <RecurringTodos />;
    case "autoNebenkosten": return <AutoNebenkosten />;
    case "contractTemplates": return <ContractTemplates />;
    case "taxYear": return <TaxYearOverview />;
    case "auditLog": return <AuditLog />;
    case "dataBackup": return <DataBackup />;
    default: return <QuickNoteWidget />;
  }
}

export const DashboardWidgetGrid: React.FC<DashboardWidgetGridProps> = (props) => {
  const { widgetOrder, widgetDrag, isWidgetDragOverview } = props;

  return (
    <div
      ref={widgetDrag.containerRef}
      className={`grid md:grid-cols-2 gap-3 transition-transform duration-300 origin-top ${isWidgetDragOverview ? "scale-[0.92] opacity-90" : ""}`}
    >
      {widgetOrder.map((wId, idx) => {
        const isDragging = widgetDrag.dragIdx === idx;
        const isOver = widgetDrag.overIdx === idx;
        const widgetContent = getWidgetContent(wId, props);
        if (widgetContent === null) return null;
        const fullWidth = FULL_WIDTH_WIDGETS.has(wId);
        return (
          <div
            key={wId}
            {...widgetDrag.getItemProps(idx)}
            className={`relative group transition-all duration-200 rounded-xl ${
              fullWidth ? "md:col-span-2" : ""
            } ${
              isDragging ? "opacity-50 scale-[0.96]" : ""
            } ${
              isOver && !isDragging ? "ring-2 ring-primary/40 ring-offset-2 ring-offset-background" : ""
            }`}
          >
            <div
              {...widgetDrag.getHandleProps(idx)}
              className="absolute top-2 right-2 z-10 opacity-60 sm:opacity-0 group-hover:opacity-100 transition-opacity cursor-grab active:cursor-grabbing bg-background/80 backdrop-blur-sm rounded-md p-1.5 border border-border/50"
              aria-label="Ziehen zum Umsortieren"
            >
              <GripVertical className="h-4 w-4 text-muted-foreground" />
            </div>
            <WidgetErrorBoundary name={wId}>
              {widgetContent}
            </WidgetErrorBoundary>
          </div>
        );
      })}
    </div>
  );
};
