import { lazy, Suspense, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const TAB_VALUES = ["aufgaben", "dokumente", "wartung"] as const;
const DEFAULT_TAB = "aufgaben";

const Todos = lazy(() => import("@/pages/Todos"));
const Dokumente = lazy(() => import("@/pages/Dokumente"));
const Wartungsplaner = lazy(() => import("@/pages/Wartungsplaner"));

const TabFallback = () => (
  <div className="flex items-center justify-center min-h-[200px] text-muted-foreground">Laden…</div>
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
    <div className="space-y-4" role="main" aria-label="Aufgaben und Dokumente">
      <Tabs value={value} onValueChange={onTabChange} className="w-full">
        <TabsList className="flex flex-wrap gap-1 h-auto p-1 bg-muted/80">
          <TabsTrigger value="aufgaben" className="nav-label-wrap">Aufgaben</TabsTrigger>
          <TabsTrigger value="dokumente" className="nav-label-wrap">Dokumente</TabsTrigger>
          <TabsTrigger value="wartung" className="nav-label-wrap">Wartung</TabsTrigger>
        </TabsList>
        <TabsContent value="aufgaben" className="mt-4 focus:outline-none">
          <Suspense fallback={<TabFallback />}>
            <Todos />
          </Suspense>
        </TabsContent>
        <TabsContent value="dokumente" className="mt-4 focus:outline-none">
          <Suspense fallback={<TabFallback />}>
            <Dokumente />
          </Suspense>
        </TabsContent>
        <TabsContent value="wartung" className="mt-4 focus:outline-none">
          <Suspense fallback={<TabFallback />}>
            <Wartungsplaner />
          </Suspense>
        </TabsContent>
      </Tabs>
    </div>
  );
}
