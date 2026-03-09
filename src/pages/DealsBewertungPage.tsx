import { lazy, Suspense, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const TAB_VALUES = ["crm", "deals", "benchmark", "bewertung"] as const;
const DEFAULT_TAB = "crm";

const CRM = lazy(() => import("@/pages/CRM"));
const Deals = lazy(() => import("@/pages/Deals"));
const DealBenchmarkPage = lazy(() => import("@/pages/DealBenchmarkPage"));
const ImmobilienBewertung = lazy(() => import("@/pages/ImmobilienBewertung"));

const TabFallback = () => (
  <div className="flex items-center justify-center min-h-[200px] text-muted-foreground">Laden…</div>
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
    <div className="space-y-4" role="main" aria-label="Deals und Bewertung">
      <Tabs value={value} onValueChange={onTabChange} className="w-full">
        <TabsList className="flex flex-wrap gap-1 h-auto p-1 bg-muted/80">
          <TabsTrigger value="crm" className="nav-label-wrap">CRM</TabsTrigger>
          <TabsTrigger value="deals" className="nav-label-wrap">Deals</TabsTrigger>
          <TabsTrigger value="benchmark" className="nav-label-wrap">Deal-Benchmark</TabsTrigger>
          <TabsTrigger value="bewertung" className="nav-label-wrap">Schnellbewertung</TabsTrigger>
        </TabsList>
        <TabsContent value="crm" className="mt-4 focus:outline-none">
          <Suspense fallback={<TabFallback />}>
            <CRM />
          </Suspense>
        </TabsContent>
        <TabsContent value="deals" className="mt-4 focus:outline-none">
          <Suspense fallback={<TabFallback />}>
            <Deals />
          </Suspense>
        </TabsContent>
        <TabsContent value="benchmark" className="mt-4 focus:outline-none">
          <Suspense fallback={<TabFallback />}>
            <DealBenchmarkPage />
          </Suspense>
        </TabsContent>
        <TabsContent value="bewertung" className="mt-4 focus:outline-none">
          <Suspense fallback={<TabFallback />}>
            <ImmobilienBewertung />
          </Suspense>
        </TabsContent>
      </Tabs>
    </div>
  );
}
