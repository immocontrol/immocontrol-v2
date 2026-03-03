/** IMP-147: Hockey Stick Simulator engine — compound growth calculations for real estate portfolios */
/**
 * Hockey Stick Simulator engine — extracted from HockeyStickSimulator.tsx
 * Contains simulation logic, sensitivity analysis, scenarios, and types.
 */

/* ── Types ── */

export interface SimParams {
  startCapital: number;
  monthlyInvestment: number;
  annualReturn: number;
  annualAppreciation: number;
  inflationRate: number;
  taxRate: number;
  years: number;
  rentYield: number;
  leverageRatio: number;
  maintenancePct: number;
  vacancyRate: number;
  rentGrowthRate: number;
  managementFee: number;
  insurancePct: number;
  additionalProperties: number;
  propertyPurchaseInterval: number;
  renovationBudgetPct: number;
}

export interface Scenario {
  name: string;
  description: string;
  params: Partial<SimParams>;
}

export interface DataPoint {
  year: number;
  label: string;
  portfolioValue: number;
  equity: number;
  totalInvested: number;
  rentalIncome: number;
  netWorth: number;
  annualCashflow: number;
  debtRemaining: number;
  cashOnCash: number;
  ltv: number;
  numberOfProperties: number;
  monthlyNetRent: number;
  cumulativeMaintenance: number;
  realNetWorth: number;
}

export interface SavedProfile {
  name: string;
  params: SimParams;
  savedAt: string;
}

/* ── Constants ── */

export const DEFAULT_PARAMS: SimParams = {
  startCapital: 0, monthlyInvestment: 0, annualReturn: 0,
  annualAppreciation: 0, inflationRate: 0, taxRate: 0, years: 0,
  rentYield: 0, leverageRatio: 0, maintenancePct: 0,
  vacancyRate: 0, rentGrowthRate: 0, managementFee: 0,
  insurancePct: 0, additionalProperties: 0, propertyPurchaseInterval: 0,
  renovationBudgetPct: 0,
};

export const SCENARIOS: Scenario[] = [
  { name: "Konservativ", description: "Niedrige Rendite, wenig Fremdkapital", params: { annualAppreciation: 1.5, rentYield: 3.5, leverageRatio: 50, annualReturn: 4, vacancyRate: 5 } },
  { name: "Ausgewogen", description: "Typisches Immobilieninvestment", params: { annualAppreciation: 2, rentYield: 4, leverageRatio: 75, annualReturn: 5, vacancyRate: 3, maintenancePct: 1 } },
  { name: "Aggressiv", description: "Hoher Hebel, maximale Rendite", params: { leverageRatio: 85, annualAppreciation: 3, rentYield: 5, annualReturn: 4.5, monthlyInvestment: 2000, vacancyRate: 2 } },
  { name: "Cashflow-Fokus", description: "Maximaler Cashflow, wenig Wertsteigerung", params: { rentYield: 6, annualAppreciation: 1, leverageRatio: 60, maintenancePct: 1.5, vacancyRate: 4 } },
  { name: "Wachstum", description: "Fokus auf Wertsteigerung in Top-Lagen", params: { annualAppreciation: 4, rentYield: 2.5, leverageRatio: 70, startCapital: 100000, vacancyRate: 1 } },
  { name: "Einsteiger", description: "Erster Kauf mit kleinem Budget", params: { startCapital: 20000, monthlyInvestment: 500, leverageRatio: 80, years: 25, annualReturn: 4, rentYield: 4 } },
];

/* ── Simulation Engine ── */

export function simulate(params: SimParams): DataPoint[] {
  const data: DataPoint[] = [];
  const { startCapital, monthlyInvestment, annualReturn, annualAppreciation,
    inflationRate, taxRate, years, rentYield, leverageRatio, maintenancePct,
    vacancyRate, rentGrowthRate, managementFee, insurancePct,
    additionalProperties, propertyPurchaseInterval, renovationBudgetPct } = params;

  const leverage = leverageRatio / 100;
  const divider = 1 - leverage;
  const initialPropertyValue = startCapital / (divider > 0 ? divider : 0.01);
  const initialDebt = initialPropertyValue * leverage;
  const mApp = annualAppreciation / 100 / 12;
  const mRentYield = rentYield / 100 / 12;
  const mMaint = maintenancePct / 100 / 12;
  const mInflation = inflationRate / 100 / 12;
  const mInterest = annualReturn / 100 / 12;
  const tax = taxRate / 100;
  const vac = vacancyRate / 100;
  const mgmtRate = managementFee / 100;
  const ins = insurancePct / 100 / 12;
  const mRentGrowth = rentGrowthRate / 100 / 12;
  const mReno = renovationBudgetPct / 100 / 12;

  // suppress unused variable warning
  void mRentYield;

  let pv = initialPropertyValue, debt = initialDebt, invested = startCapital;
  let cumRent = 0, cumCF = 0, cumMaint = 0, nProps = 1, yrNet = 0;
  let baseMonthlyRent = initialPropertyValue * mRentYield;

  for (let y = 0; y <= years; y++) {
    const eq = pv - debt;
    const nw = eq + cumCF;
    const realNW = y === 0 ? nw : nw / Math.pow(1 + inflationRate / 100, y);
    const ltv = pv > 0 ? (debt / pv) * 100 : 0;
    const coc = invested > 0 ? (yrNet / invested) * 100 : 0;

    data.push({
      year: y, label: `Jahr ${y}`, portfolioValue: Math.round(pv),
      equity: Math.round(eq), totalInvested: Math.round(invested),
      rentalIncome: Math.round(cumRent), netWorth: Math.round(nw),
      annualCashflow: Math.round(yrNet), debtRemaining: Math.round(debt),
      cashOnCash: Math.round(coc * 10) / 10, ltv: Math.round(ltv * 10) / 10,
      numberOfProperties: nProps, monthlyNetRent: Math.round(yrNet / 12),
      cumulativeMaintenance: Math.round(cumMaint), realNetWorth: Math.round(realNW),
    });

    if (y >= years) break;

    if (additionalProperties > 0 && propertyPurchaseInterval > 0 && y > 0 && y % propertyPurchaseInterval === 0 && nProps < 1 + additionalProperties) {
      const npv = initialPropertyValue * Math.pow(1 + annualAppreciation / 100, y);
      pv += npv; debt += npv * leverage; invested += npv * (1 - leverage); nProps++;
    }

    yrNet = 0;
    for (let m = 0; m < 12; m++) {
      pv *= (1 + mApp);
      baseMonthlyRent *= (1 + mRentGrowth);
      const gross = baseMonthlyRent * nProps;
      const eff = gross * (1 - vac);
      const maint = pv * mMaint;
      const mgmtCost = eff * mgmtRate;
      const insCost = pv * ins;
      const reno = pv * mReno;
      const net = eff - maint - mgmtCost - insCost - reno;
      const afterTax = net > 0 ? net * (1 - tax) : net;
      cumRent += Math.max(0, afterTax);
      cumMaint += maint + reno;
      yrNet += afterTax;

      if (debt > 0) {
        const intPay = debt * mInterest;
        const prinPay = Math.min(debt, Math.max(0, monthlyInvestment - intPay));
        debt = Math.max(0, debt - prinPay);
        cumCF += afterTax - intPay;
      } else {
        pv += monthlyInvestment * 0.8;
        cumCF += afterTax;
      }
      invested += monthlyInvestment;
      pv *= (1 + mInflation * 0.1);
    }
  }
  return data;
}

/* ── Sensitivity Analysis ── */

export function sensitivityAnalysis(
  baseP: SimParams,
  key: keyof SimParams,
  vars: number[]
): { variation: number; netWorth: number }[] {
  return vars.map(v => {
    const r = simulate({ ...baseP, [key]: v });
    return { variation: v, netWorth: r[r.length - 1].netWorth };
  });
}

/* ── Profile persistence ── */

const PROF_KEY = "immo_hockey_stick_profiles";

export function loadProfiles(): SavedProfile[] {
  try {
    const s = localStorage.getItem(PROF_KEY);
    return s ? JSON.parse(s) as SavedProfile[] : [];
  } catch { return []; }
}

export function saveProfilesStore(p: SavedProfile[]): void {
  try { localStorage.setItem(PROF_KEY, JSON.stringify(p)); } catch { /* noop */ }
}

export type ChartView = "growth" | "cashflow" | "debt" | "comparison" | "table";
