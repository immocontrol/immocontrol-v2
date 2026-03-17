import { lazy, Suspense, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Receipt } from "lucide-react";
import { ROUTES } from "@/lib/routes";

const TAB_VALUES = ["mieten", "nebenkosten", "cashflow"] as const;
const DEFAULT_TAB = "mieten";

const Mietuebersicht = lazy(() => import("@/pages/Mietuebersicht"));
const Nebenkosten = lazy(() => import("@/pages/Nebenkosten"));
const CashForecast = lazy(() => import("@/pages/CashForecast"));

const TabFallback = () => (
  <div className="flex items-center justify-center min-h-[280px] text-muted-foreground" role="status" aria-label="Tab wird geladen">Laden…</div>
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
    <div className="space-y-4 min-w-0" role="main" aria-label="Mieten und Betrieb">
      <div className="min-w-0">
        <h1 className="text-xl sm:text-2xl font-bold tracking-tight flex items-center gap-2">
          <Receipt className="h-6 w-6 text-primary shrink-0" />
          Mieten & Betrieb
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Mieten, Nebenkosten und Cashflow-Prognose an einem Ort
        </p>
      </div>
      <Tabs value={value} onValueChange={onTabChange} className="w-full min-w-0">
        <TabsList className="flex flex-wrap gap-1 h-auto p-1 bg-muted/80 w-full sm:w-auto" role="tablist" aria-label="Bereiche">
          <TabsTrigger value="mieten" className="nav-label-wrap" role="tab" aria-selected={value === "mieten"}>Mieten</TabsTrigger>
          <TabsTrigger value="nebenkosten" className="nav-label-wrap" role="tab" aria-selected={value === "nebenkosten"}>Nebenkosten</TabsTrigger>
          <TabsTrigger value="cashflow" className="nav-label-wrap" role="tab" aria-selected={value === "cashflow"}>Cashflow-Prognose</TabsTrigger>
        </TabsList>
        <TabsContent value="mieten" className="mt-4 focus:outline-none min-w-0">
          <Suspense fallback={<TabFallback />}>
            <Mietuebersicht />
          </Suspense>
        </TabsContent>
        <TabsContent value="nebenkosten" className="mt-4 focus:outline-none min-w-0">
          <Suspense fallback={<TabFallback />}>
            <Nebenkosten />
          </Suspense>
        </TabsContent>
        <TabsContent value="cashflow" className="mt-4 focus:outline-none min-w-0">
          <Suspense fallback={<TabFallback />}>
            <CashForecast />
          </Suspense>
        </TabsContent>
      </Tabs>
    </div>
  );
}
