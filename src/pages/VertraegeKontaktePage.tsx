import { lazy, Suspense, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const TAB_VALUES = ["vertraege", "kontakte"] as const;
const DEFAULT_TAB = "vertraege";

const Vertraege = lazy(() => import("@/pages/Vertraege"));
const Contacts = lazy(() => import("@/pages/Contacts"));

const TabFallback = () => (
  <div className="flex items-center justify-center min-h-[200px] text-muted-foreground">Laden…</div>
);

export default function VertraegeKontaktePage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const tab = (searchParams.get("tab") as (typeof TAB_VALUES)[number]) || DEFAULT_TAB;
  const value = TAB_VALUES.includes(tab) ? tab : DEFAULT_TAB;

  useEffect(() => {
    document.title = "Verträge & Kontakte – ImmoControl";
  }, []);

  const onTabChange = (v: string) => {
    setSearchParams(v ? { tab: v } : {}, { replace: true });
  };

  return (
    <div className="space-y-4" role="main" aria-label="Verträge und Kontakte">
      <Tabs value={value} onValueChange={onTabChange} className="w-full">
        <TabsList className="flex flex-wrap gap-1 h-auto p-1 bg-muted/80">
          <TabsTrigger value="vertraege" className="nav-label-wrap">Verträge</TabsTrigger>
          <TabsTrigger value="kontakte" className="nav-label-wrap">Kontakte</TabsTrigger>
        </TabsList>
        <TabsContent value="vertraege" className="mt-4 focus:outline-none">
          <Suspense fallback={<TabFallback />}>
            <Vertraege />
          </Suspense>
        </TabsContent>
        <TabsContent value="kontakte" className="mt-4 focus:outline-none">
          <Suspense fallback={<TabFallback />}>
            <Contacts />
          </Suspense>
        </TabsContent>
      </Tabs>
    </div>
  );
}
