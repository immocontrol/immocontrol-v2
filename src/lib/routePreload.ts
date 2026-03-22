/**
 * Route preload: Preload lazy route chunks on nav link hover (300ms) for faster navigation.
 * Uses same import paths as App.tsx to share chunks.
 */
import { ROUTES } from "./routes";

const PRELOAD_DELAY_MS = 300;

export const routePreloadMap: Record<string, () => Promise<unknown>> = {
  [ROUTES.HOME]: () => import("@/pages/Newsticker"),
  [ROUTES.PORTFOLIO]: () => import("@/pages/Dashboard"),
  [ROUTES.OBJEKTE]: () => import("@/pages/ObjekteList"),
  [ROUTES.LOANS]: () => import("@/pages/Loans"),
  [ROUTES.FORECAST]: () => import("@/pages/CashForecast"),
  [ROUTES.STEUER_COCKPIT]: () => import("@/pages/SteuerCockpitPage"),
  [ROUTES.REFINANZIERUNG]: () => import("@/pages/RefinanzierungPage"),
  [ROUTES.STRESS_TEST]: () => import("@/pages/StressTestPage"),
  [ROUTES.DIVERSIFIKATION]: () => import("@/pages/DiversifikationPage"),
  [ROUTES.MIETSPIEGEL]: () => import("@/pages/MietspiegelPage"),
  [ROUTES.KPI_ZEITREISE]: () => import("@/pages/KpiZeitreisePage"),
  [ROUTES.CONTACTS]: () => import("@/pages/Contacts"),
  [ROUTES.TODOS]: () => import("@/pages/Todos"),
  [ROUTES.BENACHRICHTIGUNGEN]: () => import("@/pages/BenachrichtigungenPage"),
  [ROUTES.SYNDICATION]: () => import("@/pages/SyndicationPage"),
  [ROUTES.ANALYSE]: () => import("@/pages/AnalysisCalculator"),
  [ROUTES.SETTINGS]: () => import("@/pages/Settings"),
  [ROUTES.DEALS]: () => import("@/pages/Deals"),
  [ROUTES.DEAL_BENCHMARK]: () => import("@/pages/DealBenchmarkPage"),
  [ROUTES.BESICHTIGUNGEN]: () => import("@/pages/Besichtigungen"),
  [ROUTES.CRM]: () => import("@/pages/CRM"),
  [ROUTES.DOKUMENTE]: () => import("@/pages/Dokumente"),
  [ROUTES.WARTUNG]: () => import("@/pages/Wartungsplaner"),
  [ROUTES.NEWSTICKER]: () => import("@/pages/Newsticker"),
  [ROUTES.BEWERTUNG]: () => import("@/pages/ImmobilienBewertung"),
  [ROUTES.NK]: () => import("@/pages/Nebenkosten"),
  [ROUTES.REPORTS]: () => import("@/pages/Berichte"),
  [ROUTES.RENT]: () => import("@/pages/Mietuebersicht"),
  [ROUTES.AI]: () => import("@/pages/ImmoAI"),
  [ROUTES.CONTRACTS]: () => import("@/pages/Vertraege"),
  [ROUTES.FINANZIERUNG]: () => import("@/pages/FinanzierungsCockpit"),
  [ROUTES.MIETEN_BETRIEB]: () => import("@/pages/MietenBetriebPage"),
  [ROUTES.ANALYSE_RISIKO]: () => import("@/pages/AnalyseRisikoPage"),
  [ROUTES.VERTRAEGE_KONTAKTE]: () => import("@/pages/VertraegeKontaktePage"),
  [ROUTES.AUFGABEN_DOKUMENTE]: () => import("@/pages/AufgabenDokumentePage"),
  [ROUTES.DEALS_BEWERTUNG]: () => import("@/pages/DealsBewertungPage"),
  [ROUTES.PERSONAL_DASHBOARD]: () => import("@/pages/Dashboard"),
  [ROUTES.ERFOLGE]: () => import("@/pages/Erfolge"),
  [ROUTES.HOCKEY_STICK]: () => import("@/pages/HockeyStickPage"),
};

let preloadTimer: ReturnType<typeof setTimeout> | null = null;

export function scheduleRoutePreload(path: string): void {
  if (preloadTimer) clearTimeout(preloadTimer);
  const fn = routePreloadMap[path];
  if (!fn) return;
  preloadTimer = setTimeout(() => {
    preloadTimer = null;
    fn();
  }, PRELOAD_DELAY_MS);
}

export function cancelRoutePreload(): void {
  if (preloadTimer) {
    clearTimeout(preloadTimer);
    preloadTimer = null;
  }
}
