import { lazy, Suspense, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Target } from "lucide-react";
import { PageHeader, PageHeaderDescription, PageHeaderMain, PageHeaderTitle } from "@/components/ui/page-header";

const TAB_VALUES = ["crm", "deals", "benchmark", "bewertung"] as const;
const DEFAULT_TAB = "crm";

const CRM = lazy(() => import("@/pages/CRM"));
const Deals = lazy(() => import("@/pages/Deals"));
const DealBenchmarkPage = lazy(() => import("@/pages/DealBenchmarkPage"));
const ImmobilienBewertung = lazy(() => import("@/pages/ImmobilienBewertung"));

const TabFallback = () => (
  <div className="flex items-center justify-center min-h-[280px] text-muted-foreground" role="status" aria-label="Tab wird geladen">Laden…</div>
);

export default function DealsBewertungPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const tab = (searchParams.get("tab") as (typeof TAB_VALUES)[number]) || DEFAULT_TAB;
  const value = TAB_VALUES.includes(tab) ? tab : DEFAULT_TAB;

  useEffect(() => {
    document.title = "Deals & Bewertung – ImmoControl";
  }, []);

  const onTabChange = (v: string) => {
    setSearchParams(v ? { tab: v } : {}, { replace: true });
  };

  return (
    <div className="space-y-4 min-w-0" role="main" aria-label="Deals und Bewertung">
      <PageHeader>
        <PageHeaderMain>
          <PageHeaderTitle>
            <Target className="h-6 w-6 text-primary shrink-0" />
            Deals & Bewertung
          </PageHeaderTitle>
          <PageHeaderDescription>
            CRM-Leads, Deal-Pipeline, Benchmark und Schnellbewertung an einem Ort
          </PageHeaderDescription>
        </PageHeaderMain>
      </PageHeader>
      <Tabs value={value} onValueChange={onTabChange} className="w-full min-w-0">
        <TabsList className="flex flex-wrap gap-1 h-auto p-1 bg-muted/80 w-full sm:w-auto" role="tablist" aria-label="Bereiche">
          <TabsTrigger value="crm" className="nav-label-wrap" role="tab" aria-selected={value === "crm"}>CRM</TabsTrigger>
          <TabsTrigger value="deals" className="nav-label-wrap" role="tab" aria-selected={value === "deals"}>Deals</TabsTrigger>
          <TabsTrigger value="benchmark" className="nav-label-wrap" role="tab" aria-selected={value === "benchmark"}>Deal-Benchmark</TabsTrigger>
          <TabsTrigger value="bewertung" className="nav-label-wrap" role="tab" aria-selected={value === "bewertung"}>Schnellbewertung</TabsTrigger>
        </TabsList>
        <TabsContent value="crm" className="mt-4 focus:outline-none min-w-0">
          <Suspense fallback={<TabFallback />}>
            <CRM />
          </Suspense>
        </TabsContent>
        <TabsContent value="deals" className="mt-4 focus:outline-none min-w-0">
          <Suspense fallback={<TabFallback />}>
            <Deals />
          </Suspense>
        </TabsContent>
        <TabsContent value="benchmark" className="mt-4 focus:outline-none min-w-0">
          <Suspense fallback={<TabFallback />}>
            <DealBenchmarkPage />
          </Suspense>
        </TabsContent>
        <TabsContent value="bewertung" className="mt-4 focus:outline-none min-w-0">
          <Suspense fallback={<TabFallback />}>
            <ImmobilienBewertung />
          </Suspense>
        </TabsContent>
      </Tabs>
    </div>
  );
}
