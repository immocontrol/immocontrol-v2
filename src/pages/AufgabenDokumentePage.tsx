import { lazy, Suspense, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CheckSquare } from "lucide-react";

const TAB_VALUES = ["aufgaben", "dokumente", "wartung"] as const;
const DEFAULT_TAB = "aufgaben";

const Todos = lazy(() => import("@/pages/Todos"));
const Dokumente = lazy(() => import("@/pages/Dokumente"));
const Wartungsplaner = lazy(() => import("@/pages/Wartungsplaner"));

const TabFallback = () => (
  <div className="flex items-center justify-center min-h-[280px] text-muted-foreground" role="status" aria-label="Tab wird geladen">Laden…</div>
);

export default function AufgabenDokumentePage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const tab = (searchParams.get("tab") as (typeof TAB_VALUES)[number]) || DEFAULT_TAB;
  const value = TAB_VALUES.includes(tab) ? tab : DEFAULT_TAB;

  useEffect(() => {
    document.title = "Aufgaben & Dokumente – ImmoControl";
  }, []);

  const onTabChange = (v: string) => {
    setSearchParams(v ? { tab: v } : {}, { replace: true });
  };

  return (
    <div className="space-y-4 min-w-0" role="main" aria-label="Aufgaben und Dokumente">
      <div className="min-w-0">
        <h1 className="text-xl sm:text-2xl font-bold tracking-tight flex items-center gap-2">
          <CheckSquare className="h-6 w-6 text-primary shrink-0" />
          Aufgaben & Dokumente
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Todos, Dokumente und Wartungsplanung an einem Ort
        </p>
      </div>
      <Tabs value={value} onValueChange={onTabChange} className="w-full min-w-0">
        <TabsList className="flex flex-wrap gap-1 h-auto p-1 bg-muted/80 w-full sm:w-auto" role="tablist" aria-label="Bereiche">
          <TabsTrigger value="aufgaben" className="nav-label-wrap" role="tab" aria-selected={value === "aufgaben"}>Aufgaben</TabsTrigger>
          <TabsTrigger value="dokumente" className="nav-label-wrap" role="tab" aria-selected={value === "dokumente"}>Dokumente</TabsTrigger>
          <TabsTrigger value="wartung" className="nav-label-wrap" role="tab" aria-selected={value === "wartung"}>Wartung</TabsTrigger>
        </TabsList>
        <TabsContent value="aufgaben" className="mt-4 focus:outline-none min-w-0">
          <Suspense fallback={<TabFallback />}>
            <Todos />
          </Suspense>
        </TabsContent>
        <TabsContent value="dokumente" className="mt-4 focus:outline-none min-w-0">
          <Suspense fallback={<TabFallback />}>
            <Dokumente />
          </Suspense>
        </TabsContent>
        <TabsContent value="wartung" className="mt-4 focus:outline-none min-w-0">
          <Suspense fallback={<TabFallback />}>
            <Wartungsplaner />
          </Suspense>
        </TabsContent>
      </Tabs>
    </div>
  );
}
