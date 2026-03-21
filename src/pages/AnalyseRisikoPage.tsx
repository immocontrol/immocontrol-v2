import { lazy, Suspense, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ShieldAlert } from "lucide-react";
import { PageHeader, PageHeaderDescription, PageHeaderMain, PageHeaderTitle } from "@/components/ui/page-header";

const TAB_VALUES = [
  "stress-test",
  "diversifikation",
  "mietspiegel",
  "kpi",
  "berichte",
  "rechner",
  "hockey-stick",
] as const;
const DEFAULT_TAB = "stress-test";

const StressTestPage = lazy(() => import("@/pages/StressTestPage"));
const DiversifikationPage = lazy(() => import("@/pages/DiversifikationPage"));
const MietspiegelPage = lazy(() => import("@/pages/MietspiegelPage"));
const KpiZeitreisePage = lazy(() => import("@/pages/KpiZeitreisePage"));
const Berichte = lazy(() => import("@/pages/Berichte"));
const AnalysisCalculator = lazy(() => import("@/pages/AnalysisCalculator"));
const HockeyStickPage = lazy(() => import("@/pages/HockeyStickPage"));

const TabFallback = () => (
  <div className="flex items-center justify-center min-h-[280px] text-muted-foreground" role="status" aria-label="Tab wird geladen">Laden…</div>
);

export default function AnalyseRisikoPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const tab = (searchParams.get("tab") as (typeof TAB_VALUES)[number]) || DEFAULT_TAB;
  const value = TAB_VALUES.includes(tab) ? tab : DEFAULT_TAB;

  useEffect(() => {
    document.title = "Analyse & Risiko – ImmoControl";
  }, []);

  const onTabChange = (v: string) => {
    setSearchParams(v ? { tab: v } : {}, { replace: true });
  };

  return (
    <div className="space-y-4 min-w-0" role="main" aria-label="Analyse und Risiko">
      <PageHeader>
        <PageHeaderMain>
          <PageHeaderTitle>
            <ShieldAlert className="h-6 w-6 text-primary shrink-0" />
            Analyse & Risiko
          </PageHeaderTitle>
          <PageHeaderDescription>
            Stress-Test, Diversifikation, Mietspiegel, KPIs, Berichte und Rechner an einem Ort
          </PageHeaderDescription>
        </PageHeaderMain>
      </PageHeader>
      <Tabs value={value} onValueChange={onTabChange} className="w-full min-w-0">
        <TabsList className="flex flex-wrap gap-1 h-auto p-1 bg-muted/80 w-full sm:w-auto" role="tablist" aria-label="Bereiche">
          <TabsTrigger value="stress-test" className="nav-label-wrap" role="tab" aria-selected={value === "stress-test"}>Stress-Test</TabsTrigger>
          <TabsTrigger value="diversifikation" className="nav-label-wrap" role="tab" aria-selected={value === "diversifikation"}>Diversifikation</TabsTrigger>
          <TabsTrigger value="mietspiegel" className="nav-label-wrap" role="tab" aria-selected={value === "mietspiegel"}>Mietspiegel</TabsTrigger>
          <TabsTrigger value="kpi" className="nav-label-wrap" role="tab" aria-selected={value === "kpi"}>KPIs</TabsTrigger>
          <TabsTrigger value="berichte" className="nav-label-wrap" role="tab" aria-selected={value === "berichte"}>Berichte</TabsTrigger>
          <TabsTrigger value="rechner" className="nav-label-wrap" role="tab" aria-selected={value === "rechner"}>Rechner</TabsTrigger>
          <TabsTrigger value="hockey-stick" className="nav-label-wrap" role="tab" aria-selected={value === "hockey-stick"}>Hockey Stick</TabsTrigger>
        </TabsList>
        <TabsContent value="stress-test" className="mt-4 focus:outline-none min-w-0">
          <Suspense fallback={<TabFallback />}>
            <StressTestPage />
          </Suspense>
        </TabsContent>
        <TabsContent value="diversifikation" className="mt-4 focus:outline-none min-w-0">
          <Suspense fallback={<TabFallback />}>
            <DiversifikationPage />
          </Suspense>
        </TabsContent>
        <TabsContent value="mietspiegel" className="mt-4 focus:outline-none min-w-0">
          <Suspense fallback={<TabFallback />}>
            <MietspiegelPage />
          </Suspense>
        </TabsContent>
        <TabsContent value="kpi" className="mt-4 focus:outline-none min-w-0">
          <Suspense fallback={<TabFallback />}>
            <KpiZeitreisePage />
          </Suspense>
        </TabsContent>
        <TabsContent value="berichte" className="mt-4 focus:outline-none min-w-0">
          <Suspense fallback={<TabFallback />}>
            <Berichte />
          </Suspense>
        </TabsContent>
        <TabsContent value="rechner" className="mt-4 focus:outline-none min-w-0">
          <Suspense fallback={<TabFallback />}>
            <AnalysisCalculator />
          </Suspense>
        </TabsContent>
        <TabsContent value="hockey-stick" className="mt-4 focus:outline-none min-w-0">
          <Suspense fallback={<TabFallback />}>
            <HockeyStickPage />
          </Suspense>
        </TabsContent>
      </Tabs>
    </div>
  );
}
