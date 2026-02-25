import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import ContractManagement from "@/components/ContractManagement";
import InvoiceManagement from "@/components/InvoiceManagement";
import OwnerMeetings from "@/components/OwnerMeetings";
import ServiceContracts from "@/components/ServiceContracts";
import { FileText, Receipt, Users, Wrench } from "lucide-react";

const Vertraege = () => {
  return (
    <div className="space-y-6 max-w-5xl mx-auto" role="main">
      <div>
        <h1 className="text-2xl font-bold">Verträge & Verwaltung</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Mietverträge, Rechnungen, Eigentümerversammlungen und Dienstleisterverträge verwalten
        </p>
      </div>

      <Tabs defaultValue="vertraege" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="vertraege" className="flex items-center gap-1.5 text-xs">
            <FileText className="h-3.5 w-3.5" /> Mietverträge
          </TabsTrigger>
          <TabsTrigger value="rechnungen" className="flex items-center gap-1.5 text-xs">
            <Receipt className="h-3.5 w-3.5" /> Rechnungen
          </TabsTrigger>
          <TabsTrigger value="versammlungen" className="flex items-center gap-1.5 text-xs">
            <Users className="h-3.5 w-3.5" /> ETV
          </TabsTrigger>
          <TabsTrigger value="dienstleister" className="flex items-center gap-1.5 text-xs">
            <Wrench className="h-3.5 w-3.5" /> Dienstleister
          </TabsTrigger>
        </TabsList>
        <TabsContent value="vertraege"><ContractManagement /></TabsContent>
        <TabsContent value="rechnungen"><InvoiceManagement /></TabsContent>
        <TabsContent value="versammlungen"><OwnerMeetings /></TabsContent>
        <TabsContent value="dienstleister"><ServiceContracts /></TabsContent>
      </Tabs>
    </div>
  );
};

export default Vertraege;
