import { lazy, Suspense, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FileText } from "lucide-react";
import { PageHeader, PageHeaderDescription, PageHeaderMain, PageHeaderTitle } from "@/components/ui/page-header";

const TAB_VALUES = ["vertraege", "kontakte"] as const;
const DEFAULT_TAB = "vertraege";

const Vertraege = lazy(() => import("@/pages/Vertraege"));
const Contacts = lazy(() => import("@/pages/Contacts"));

const TabFallback = () => (
  <div className="flex items-center justify-center min-h-[280px] text-muted-foreground" role="status" aria-label="Tab wird geladen">Laden…</div>
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
    <div className="space-y-4 min-w-0" role="main" aria-label="Verträge und Kontakte">
      <PageHeader>
        <PageHeaderMain>
          <PageHeaderTitle>
            <FileText className="h-6 w-6 text-primary shrink-0" />
            Verträge & Kontakte
          </PageHeaderTitle>
          <PageHeaderDescription>
            Mietverträge, Rechnungen, Dienstleister und dein Kontaktverzeichnis
          </PageHeaderDescription>
        </PageHeaderMain>
      </PageHeader>
      <Tabs value={value} onValueChange={onTabChange} className="w-full min-w-0">
        <TabsList className="flex flex-wrap gap-1 h-auto p-1 bg-muted/80 w-full sm:w-auto" role="tablist" aria-label="Bereiche">
          <TabsTrigger value="vertraege" className="nav-label-wrap" role="tab" aria-selected={value === "vertraege"}>Verträge</TabsTrigger>
          <TabsTrigger value="kontakte" className="nav-label-wrap" role="tab" aria-selected={value === "kontakte"}>Kontakte</TabsTrigger>
        </TabsList>
        <TabsContent value="vertraege" className="mt-4 focus:outline-none min-w-0">
          <Suspense fallback={<TabFallback />}>
            <Vertraege />
          </Suspense>
        </TabsContent>
        <TabsContent value="kontakte" className="mt-4 focus:outline-none min-w-0">
          <Suspense fallback={<TabFallback />}>
            <Contacts />
          </Suspense>
        </TabsContent>
      </Tabs>
    </div>
  );
}
