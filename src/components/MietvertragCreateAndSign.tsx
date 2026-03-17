/**
 * Mietvertrag aus der App ausstellen und zur digitalen Unterschrift an den Mieter senden.
 * Erzeugt Vertragsdaten + optional PDF, speichert in contract_signature_requests, Link zum Unterschreiben.
 */
import { useState, useCallback } from "react";
import { FileText, Copy, Check, Send, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { useProperties } from "@/context/PropertyContext";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ROUTES } from "@/lib/routes";
import { queryKeys } from "@/lib/queryKeys";
import { formatCurrency } from "@/lib/formatters";
import { loadJsPDF } from "@/lib/lazyImports";

export function MietvertragCreateAndSign() {
  const { user } = useAuth();
  const { properties } = useProperties();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [landlordName, setLandlordName] = useState("");
  const [landlordAddress, setLandlordAddress] = useState("");
  const [propertyId, setPropertyId] = useState("");
  const [tenantId, setTenantId] = useState("");
  const [tenantName, setTenantName] = useState("");
  const [address, setAddress] = useState("");
  const [startDate, setStartDate] = useState("");
  const [coldRent, setColdRent] = useState("");
  const [nkPrepayment, setNkPrepayment] = useState("");
  const [deposit, setDeposit] = useState("");
  const [noticeMonths, setNoticeMonths] = useState(3);
  const [lastLink, setLastLink] = useState<string | null>(null);
  const [linkCopied, setLinkCopied] = useState(false);

  const { data: tenants = [] } = useQuery({
    queryKey: ["tenants", propertyId],
    queryFn: async () => {
      const { data } = await supabase
        .from("tenants")
        .select("id, first_name, last_name, property_id, monthly_rent, deposit")
        .eq("property_id", propertyId)
        .eq("is_active", true);
      return (data || []) as Array<{ id: string; first_name: string; last_name: string; property_id: string; monthly_rent: number | null; deposit: number | null }>;
    },
    enabled: !!propertyId,
  });

  const selectedProperty = properties.find((p) => p.id === propertyId);
  const selectedTenant = tenants.find((t) => t.id === tenantId);

  const contractData = {
    landlordName,
    landlordAddress,
    tenantName: tenantName || (selectedTenant ? `${selectedTenant.first_name} ${selectedTenant.last_name}`.trim() : ""),
    address: address || selectedProperty?.address || "",
    startDate,
    coldRent: coldRent ? Number(coldRent) : selectedTenant?.monthly_rent ?? 0,
    nkPrepayment: nkPrepayment ? Number(nkPrepayment) : 0,
    deposit: deposit ? Number(deposit) : (selectedTenant?.deposit ?? 0) || (selectedTenant?.monthly_rent ?? 0) * 3,
    noticeMonths,
  };

  const canSend = propertyId && tenantId && contractData.tenantName && startDate && contractData.coldRent > 0;

  const sendMutation = useMutation({
    mutationFn: async () => {
      if (!user?.id || !propertyId || !tenantId) throw new Error("Objekt und Mieter auswählen.");
      const { data, error } = await supabase
        .from("contract_signature_requests")
        .insert({
          property_id: propertyId,
          tenant_id: tenantId,
          created_by: user.id,
          type: "mietvertrag",
          contract_data: contractData,
        })
        .select("id, confirm_token")
        .single();
      if (error) throw error;
      return data as { id: string; confirm_token: string };
    },
    onSuccess: (data) => {
      const base = typeof window !== "undefined" ? window.location.origin : "";
      const link = `${base}${ROUTES.CONTRACT_SIGN}/${data.confirm_token}`;
      setLastLink(link);
      qc.invalidateQueries({ queryKey: queryKeys.contractSignatureRequests.all });
      qc.invalidateQueries({ queryKey: queryKeys.contractSignatureRequests.byProperty(propertyId) });
      toast.success("Mietvertrag zur Unterschrift freigegeben. Link an den Mieter senden.");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Speichern fehlgeschlagen."),
  });

  const buildPdfBlob = useCallback(async (): Promise<{ blob: Blob; fileName: string } | null> => {
    try {
      const JsPDF = await loadJsPDF();
      const doc = new JsPDF({ format: "a4" });
      const margin = 25;
      const pageW = doc.internal.pageSize.getWidth();
      let y = margin;
      const lineH = 6;
      const today = new Date().toLocaleDateString("de-DE", { day: "2-digit", month: "long", year: "numeric" });
      const startFormatted = startDate ? new Date(startDate).toLocaleDateString("de-DE", { day: "2-digit", month: "long", year: "numeric" }) : "";

      doc.setFontSize(16);
      doc.setFont("helvetica", "bold");
      doc.text("Mietvertrag", margin, y); y += lineH + 6;
      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      doc.text(`Zwischen ${landlordName || "[Vermieter]"} („Vermieter") und ${contractData.tenantName} („Mieter").`, margin, y); y += lineH + 4;
      doc.setFont("helvetica", "bold");
      doc.text("§ 1 Mietobjekt", margin, y); y += lineH;
      doc.setFont("helvetica", "normal");
      doc.text(`Vermietet wird: ${address || "[Adresse]"}.`, margin, y); y += lineH + 4;
      doc.setFont("helvetica", "bold");
      doc.text("§ 2 Mietdauer", margin, y); y += lineH;
      doc.setFont("helvetica", "normal");
      doc.text(`Beginn: ${startFormatted}. Das Mietverhältnis wird auf unbestimmte Zeit geschlossen.`, margin, y); y += lineH + 4;
      doc.setFont("helvetica", "bold");
      doc.text("§ 3 Miete", margin, y); y += lineH;
      doc.setFont("helvetica", "normal");
      doc.text(`Kaltmiete: ${formatCurrency(contractData.coldRent)}/Monat. Nebenkosten-Vorauszahlung: ${formatCurrency(contractData.nkPrepayment)}/Monat.`, margin, y); y += lineH + 4;
      doc.setFont("helvetica", "bold");
      doc.text("§ 4 Kaution", margin, y); y += lineH;
      doc.setFont("helvetica", "normal");
      doc.text(`Kaution: ${formatCurrency(contractData.deposit)}.`, margin, y); y += lineH + 4;
      doc.setFont("helvetica", "bold");
      doc.text("§ 5 Kündigung", margin, y); y += lineH;
      doc.setFont("helvetica", "normal");
      doc.text(`Kündigungsfrist: ${noticeMonths} Monate zum Monatsende (§ 573c BGB).`, margin, y); y += lineH + 12;
      doc.setDrawColor(180);
      doc.line(margin, y, margin + 75, y); doc.line(pageW - margin - 75, y, pageW - margin, y); y += lineH;
      doc.setFontSize(9);
      doc.setTextColor(120);
      doc.text("Vermieter", margin, y); doc.text("Mieter", pageW - margin - 75, y);
      doc.setFontSize(8);
      doc.text(`Erstellt mit ImmoControl · ${today}`, margin, 285);
      doc.setTextColor(0);

      const out = doc.output("blob");
      const blob = out instanceof Promise ? await out : out;
      const safe = (contractData.tenantName || "Mieter").replace(/\s+/g, "_").replace(/[^a-zA-ZäöüÄÖÜß0-9_-]/g, "");
      return { blob, fileName: `Mietvertrag_${safe}_${startDate || "Datum"}.pdf` };
    } catch (e) {
      toast.error("PDF konnte nicht erstellt werden.");
      console.error(e);
      return null;
    }
  }, [landlordName, contractData, address, startDate, noticeMonths]);

  const handlePdfDownload = useCallback(async () => {
    if (!canSend) {
      toast.error("Bitte alle Pflichtfelder ausfüllen.");
      return;
    }
    const result = await buildPdfBlob();
    if (!result) return;
    const url = URL.createObjectURL(result.blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = result.fileName;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("PDF heruntergeladen.");
  }, [canSend, buildPdfBlob]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5">
          <FileText className="h-3.5 w-3.5" /> Mietvertrag erstellen & zur Unterschrift
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto overflow-x-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" /> Mietvertrag ausstellen
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {lastLink && (
            <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 space-y-2">
              <p className="text-xs font-medium">Link zum Unterschreiben (an Mieter senden):</p>
              <div className="flex gap-2">
                <Input readOnly value={lastLink} className="text-xs font-mono flex-1 min-w-0" />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="shrink-0 gap-1"
                  onClick={() => {
                    navigator.clipboard.writeText(lastLink);
                    setLinkCopied(true);
                    toast.success("Link kopiert.");
                    setTimeout(() => setLinkCopied(false), 2000);
                  }}
                >
                  {linkCopied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                  {linkCopied ? "Kopiert" : "Kopieren"}
                </Button>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Vermieter (Name)</Label>
              <Input value={landlordName} onChange={(e) => setLandlordName(e.target.value)} placeholder="Name" className="h-9 text-sm" />
            </div>
            <div className="space-y-1 sm:col-span-2">
              <Label className="text-xs">Vermieter (Adresse)</Label>
              <Input value={landlordAddress} onChange={(e) => setLandlordAddress(e.target.value)} placeholder="Straße, PLZ Ort" className="h-9 text-sm" />
            </div>
            <div className="space-y-1 sm:col-span-2">
              <Label className="text-xs">Objekt</Label>
              <Select value={propertyId} onValueChange={(v) => { setPropertyId(v); setTenantId(""); setAddress(properties.find((p) => p.id === v)?.address || ""); }}>
                <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Objekt wählen" /></SelectTrigger>
                <SelectContent>
                  {properties.map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.name || p.address || p.id}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1 sm:col-span-2">
              <Label className="text-xs">Mieter</Label>
              <Select
                value={tenantId}
                onValueChange={(v) => {
                  setTenantId(v);
                  const t = tenants.find((x) => x.id === v);
                  setTenantName(t ? `${t.first_name} ${t.last_name}`.trim() : "");
                }}
              >
                <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Mieter wählen" /></SelectTrigger>
                <SelectContent>
                  {tenants.map((t) => (
                    <SelectItem key={t.id} value={t.id}>{t.first_name} {t.last_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Mieter (Anzeige)</Label>
              <Input value={tenantName} onChange={(e) => setTenantName(e.target.value)} placeholder="Name" className="h-9 text-sm" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Objektadresse</Label>
              <Input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Adresse" className="h-9 text-sm" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Mietbeginn *</Label>
              <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="h-9 text-sm" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Kaltmiete (€/Monat) *</Label>
              <Input
                type="number"
                min={0}
                step={0.01}
                value={coldRent}
                onChange={(e) => setColdRent(e.target.value)}
                placeholder={selectedTenant?.monthly_rent ? String(selectedTenant.monthly_rent) : ""}
                className="h-9 text-sm"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">NK-Vorauszahlung (€/Monat)</Label>
              <Input type="number" min={0} step={0.01} value={nkPrepayment} onChange={(e) => setNkPrepayment(e.target.value)} className="h-9 text-sm" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Kaution (€)</Label>
              <Input
                type="number"
                min={0}
                step={0.01}
                value={deposit}
                onChange={(e) => setDeposit(e.target.value)}
                placeholder={selectedTenant?.deposit ? String(selectedTenant.deposit) : ""}
                className="h-9 text-sm"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Kündigungsfrist (Monate)</Label>
              <Input type="number" min={1} max={24} value={noticeMonths} onChange={(e) => setNoticeMonths(Math.max(1, Math.min(24, Number(e.target.value) || 3)))} className="h-9 text-sm" />
            </div>
          </div>

          <div className="flex flex-col gap-2 pt-2">
            <Button
              onClick={() => sendMutation.mutate()}
              disabled={sendMutation.isPending || !canSend}
              className="w-full gap-1.5"
            >
              {sendMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              Zur Unterschrift freigeben & Link erstellen
            </Button>
            <p className="text-[10px] text-muted-foreground text-wrap-safe">
              Nach dem Freigeben: Link kopieren und an den Mieter senden. Der Mieter öffnet den Link und kann den Vertrag digital unterschreiben.
            </p>
            <Button variant="outline" size="sm" onClick={handlePdfDownload} disabled={!canSend} className="gap-1.5">
              <FileText className="h-3.5 w-3.5" /> PDF herunterladen
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
