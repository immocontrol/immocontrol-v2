import { lazy, Suspense, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ROUTES } from "@/lib/routes";

const TAB_VALUES = ["mieten", "nebenkosten", "cashflow"] as const;
const DEFAULT_TAB = "mieten";

const Mietuebersicht = lazy(() => import("@/pages/Mietuebersicht"));
const Nebenkosten = lazy(() => import("@/pages/Nebenkosten"));
const CashForecast = lazy(() => import("@/pages/CashForecast"));

const TabFallback = () => (
  <div className="flex items-center justify-center min-h-[200px] text-muted-foreground">Laden…</div>
);

export default function MietenBetriebPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const tab = (searchParams.get("tab") as (typeof TAB_VALUES)[number]) || DEFAULT_TAB;
  const value = TAB_VALUES.includes(tab) ? tab : DEFAULT_TAB;

  useEffect(() => {
    document.title = "Mieten & Betrieb – ImmoControl";
  }, []);

  const onTabChange = (v: string) => {
    setSearchParams(v ? { tab: v } : {}, { replace: true });
  };

  return (
    <div className="space-y-4" role="main" aria-label="Mieten und Betrieb">
      <Tabs value={value} onValueChange={onTabChange} className="w-full">
        <TabsList className="flex flex-wrap gap-1 h-auto p-1 bg-muted/80">
          <TabsTrigger value="mieten" className="nav-label-wrap">Mieten</TabsTrigger>
          <TabsTrigger value="nebenkosten" className="nav-label-wrap">Nebenkosten</TabsTrigger>
          <TabsTrigger value="cashflow" className="nav-label-wrap">Cashflow-Prognose</TabsTrigger>
        </TabsList>
        <TabsContent value="mieten" className="mt-4 focus:outline-none">
          <Suspense fallback={<TabFallback />}>
            <Mietuebersicht />
          </Suspense>
        </TabsContent>
        <TabsContent value="nebenkosten" className="mt-4 focus:outline-none">
          <Suspense fallback={<TabFallback />}>
            <Nebenkosten />
          </Suspense>
        </TabsContent>
        <TabsContent value="cashflow" className="mt-4 focus:outline-none">
          <Suspense fallback={<TabFallback />}>
            <CashForecast />
          </Suspense>
        </TabsContent>
      </Tabs>
    </div>
  );
}
