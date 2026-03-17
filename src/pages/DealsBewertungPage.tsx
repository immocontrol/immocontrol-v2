import { lazy, Suspense, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Target } from "lucide-react";

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
      <div className="min-w-0">
        <h1 className="text-xl sm:text-2xl font-bold tracking-tight flex items-center gap-2">
          <Target className="h-6 w-6 text-primary" />
          Deals & Bewertung
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          CRM-Leads, Deal-Pipeline, Benchmark und Schnellbewertung an einem Ort
        </p>
      </div>
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
