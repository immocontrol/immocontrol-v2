/**
 * Kündigungsschreiben-Vorlage: Formular für Vermieter/Mieter/Adresse,
 * gewünschtes Vertragsende und Kündigungsfrist → PDF erzeugen und optional in Dokumente speichern.
 */
import { useState, useCallback, useMemo } from "react";
import { FileText, Download, Save, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { useProperties } from "@/context/PropertyContext";
import { supabase } from "@/integrations/supabase/client";
import { queryKeys } from "@/lib/queryKeys";
import { useQueryClient } from "@tanstack/react-query";
import { formatDate } from "@/lib/formatters";
import { loadJsPDF } from "@/lib/lazyImports";

function getNoticeDeadline(desiredEnd: Date, noticeMonths: number): Date {
  const d = new Date(desiredEnd);
  d.setMonth(d.getMonth() - noticeMonths);
  return d;
}

export function KuendigungsschreibenLetter() {
  const { user } = useAuth();
  const { properties } = useProperties();
  const qc = useQueryClient();
  const [landlordName, setLandlordName] = useState("");
  const [landlordAddress, setLandlordAddress] = useState("");
  const [tenantName, setTenantName] = useState("");
  const [tenantAddress, setTenantAddress] = useState("");
  const [objectAddress, setObjectAddress] = useState("");
  const [noticeMonths, setNoticeMonths] = useState(3);
  const [desiredEndStr, setDesiredEndStr] = useState("");
  const [savePropertyId, setSavePropertyId] = useState<string>("");
  const [saving, setSaving] = useState(false);

  const desiredEnd = useMemo(() => {
    if (!desiredEndStr || desiredEndStr.length < 10) return null;
    const d = new Date(desiredEndStr);
    return Number.isNaN(d.getTime()) ? null : d;
  }, [desiredEndStr]);

  const noticeDeadline = useMemo(() => {
    if (!desiredEnd || noticeMonths < 1) return null;
    return getNoticeDeadline(desiredEnd, noticeMonths);
  }, [desiredEnd, noticeMonths]);

  const canGenerate = tenantName.trim() && desiredEnd && noticeMonths >= 1;

  const buildPDF = useCallback(async (): Promise<{ doc: InstanceType<Awaited<ReturnType<typeof loadJsPDF>>>; fileName: string }> => {
    const JsPDF = await loadJsPDF();
    const today = new Date().toLocaleDateString("de-DE", { day: "2-digit", month: "long", year: "numeric" });
    const endDateFormatted = desiredEnd ? new Date(desiredEnd).toLocaleDateString("de-DE", { day: "2-digit", month: "long", year: "numeric" }) : "";
    const deadlineFormatted = noticeDeadline ? new Date(noticeDeadline).toLocaleDateString("de-DE", { day: "2-digit", month: "long", year: "numeric" }) : "";

    const doc = new JsPDF({ format: "a4" });
    const margin = 25;
    let y = margin;

    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text(landlordName || "[Vermieter Name]", margin, y); y += 5;
    doc.text(landlordAddress || "[Vermieter Adresse]", margin, y); y += 12;
    doc.text(tenantName, margin, y); y += 5;
    doc.text(tenantAddress || "[Mieteradresse]", margin, y); y += 12;
    doc.text(today, 190 - doc.getTextWidth(today), y); y += 15;

    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text("Kündigung des Mietverhältnisses", margin, y); y += 12;

    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text(`Sehr geehrte/r ${tenantName},`, margin, y); y += 8;
    const intro = doc.splitTextToSize(
      "hiermit kündige ich das Mietverhältnis über die von Ihnen bewohnte Wohnung" +
      (objectAddress ? ` (${objectAddress})` : "") +
      " ordentlich zum nächstzulässigen Termin.",
      160
    );
    doc.text(intro, margin, y); y += intro.length * 5 + 8;

    doc.setFont("helvetica", "bold");
    doc.text(`Ende des Mietverhältnisses: ${endDateFormatted}`, margin, y); y += 8;
    doc.setFont("helvetica", "normal");
    doc.text(`Kündigungsfrist: ${noticeMonths} Monat${noticeMonths !== 1 ? "e" : ""} zum Monatsende.`, margin, y); y += 6;
    doc.text(`Diese Kündigung muss Ihnen spätestens bis zum ${deadlineFormatted} zugegangen sein.`, margin, y); y += 12;

    const closing = doc.splitTextToSize(
      "Bitte bestätigen Sie den Erhalt dieser Kündigung und den Räumungstermin. Die Schlüsselübergabe erfolgt zum vereinbarten Termin.",
      160
    );
    doc.text(closing, margin, y); y += closing.length * 5 + 10;
    doc.text("Mit freundlichen Grüßen", margin, y); y += 20;
    doc.text("_________________________________", margin, y); y += 6;
    doc.text(`${landlordName || "[Vermieter]"}, ${today}`, margin, y);

    doc.setFontSize(8);
    doc.setTextColor(150);
    doc.text("Erstellt mit ImmoControl · Kündigungsschreiben Mietvertrag", margin, 285);

    const safeName = tenantName.replace(/\s+/g, "_").replace(/[^a-zA-ZäöüÄÖÜß0-9_-]/g, "");
    const fileName = `Kuendigung_${safeName}_${desiredEndStr || "Ende"}.pdf`;
    return { doc, fileName };
  }, [landlordName, landlordAddress, tenantName, tenantAddress, objectAddress, noticeMonths, desiredEnd, desiredEndStr, noticeDeadline]);

  const handleDownload = useCallback(async () => {
    if (!canGenerate) {
      toast.error("Bitte Mieter und gewünschtes Vertragsende angeben.");
      return;
    }
    try {
      const { doc, fileName } = await buildPDF();
      doc.save(fileName);
      toast.success("Kündigungsschreiben heruntergeladen");
    } catch (e) {
      toast.error("PDF konnte nicht erstellt werden.");
      console.error(e);
    }
  }, [canGenerate, buildPDF]);

  const handleSaveToDocuments = useCallback(async () => {
    if (!user || !canGenerate) {
      toast.error("Bitte Mieter und gewünschtes Vertragsende angeben.");
      return;
    }
    const propertyId = savePropertyId || null;
    if (!propertyId) {
      toast.error("Bitte ein Objekt zum Speichern des Dokuments auswählen.");
      return;
    }
    setSaving(true);
    try {
      const { doc, fileName } = await buildPDF();
      const out = doc.output("blob");
      const blob = out instanceof Promise ? await out : out;
      const filePath = `${user.id}/${propertyId}/${Date.now()}_${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from("property-documents")
        .upload(filePath, blob, { contentType: "application/pdf" });

      if (uploadError) throw uploadError;

      const { error: dbError } = await supabase.from("property_documents").insert({
        user_id: user.id,
        property_id: propertyId,
        file_name: fileName,
        file_path: filePath,
        file_size: blob.size,
        file_type: "application/pdf",
        category: "Kündigung",
      } as never);

      if (dbError) throw dbError;

      qc.invalidateQueries({ queryKey: queryKeys.documents.byProperty(propertyId) });
      qc.invalidateQueries({ queryKey: ["all_documents"] });
      toast.success("Kündigungsschreiben in Dokumente gespeichert.");
    } catch (e) {
      toast.error("Speichern fehlgeschlagen.");
      console.error(e);
    } finally {
      setSaving(false);
    }
  }, [user, canGenerate, savePropertyId, buildPDF, qc]);

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <FileText className="h-4 w-4" /> Kündigungsschreiben
        </CardTitle>
        <p className="text-xs text-muted-foreground text-wrap-safe">
          Vorlage für eine ordentliche Kündigung des Mietverhältnisses. PDF erzeugen oder direkt in die Objekt-Dokumente speichern.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label className="text-xs">Vermieter (Name)</Label>
            <Input
              value={landlordName}
              onChange={(e) => setLandlordName(e.target.value)}
              placeholder="Max Mustermann"
              className="h-9"
              aria-label="Vermieter Name"
            />
          </div>
          <div className="space-y-2">
            <Label className="text-xs">Vermieter (Adresse)</Label>
            <Input
              value={landlordAddress}
              onChange={(e) => setLandlordAddress(e.target.value)}
              placeholder="Musterstraße 1, 12345 Stadt"
              className="h-9"
              aria-label="Vermieter Adresse"
            />
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label className="text-xs">Mieter (Name) *</Label>
            <Input
              value={tenantName}
              onChange={(e) => setTenantName(e.target.value)}
              placeholder="Anna Mieterin"
              className="h-9"
              aria-label="Mieter Name"
            />
          </div>
          <div className="space-y-2">
            <Label className="text-xs">Mieter (Adresse)</Label>
            <Input
              value={tenantAddress}
              onChange={(e) => setTenantAddress(e.target.value)}
              placeholder="Wohnadresse"
              className="h-9"
              aria-label="Mieter Adresse"
            />
          </div>
        </div>
        <div className="space-y-2">
          <Label className="text-xs">Objektadresse (Mietobjekt)</Label>
          <Input
            value={objectAddress}
            onChange={(e) => setObjectAddress(e.target.value)}
            placeholder="z.B. Musterweg 5, 12345 Stadt"
            className="h-9"
            aria-label="Objektadresse"
          />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label className="text-xs">Kündigungsfrist (Monate)</Label>
            <Input
              type="number"
              min={1}
              max={24}
              value={noticeMonths}
              onChange={(e) => setNoticeMonths(Math.max(1, Math.min(24, Number(e.target.value) || 1)))}
              className="h-9"
              aria-label="Kündigungsfrist"
            />
          </div>
          <div className="space-y-2">
            <Label className="text-xs">Gewünschtes Vertragsende *</Label>
            <Input
              type="date"
              value={desiredEndStr}
              onChange={(e) => setDesiredEndStr(e.target.value)}
              className="h-9"
              aria-label="Gewünschtes Vertragsende"
            />
          </div>
        </div>
        {noticeDeadline && (
          <p className="text-xs text-muted-foreground">
            Kündigung spätestens einreichen bis: <strong className="text-foreground">{formatDate(noticeDeadline.toISOString().slice(0, 10))}</strong>
          </p>
        )}
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" size="sm" onClick={handleDownload} disabled={!canGenerate} aria-label="PDF herunterladen">
            <Download className="h-4 w-4 mr-1" /> PDF herunterladen
          </Button>
          {properties.length > 0 && (
            <>
              <Select value={savePropertyId || "_none"} onValueChange={(v) => setSavePropertyId(v === "_none" ? "" : v)}>
                <SelectTrigger className="w-[180px] h-9 text-xs">
                  <SelectValue placeholder="Objekt wählen …" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="_none" className="text-xs">Objekt wählen …</SelectItem>
                  {properties.map((p) => (
                    <SelectItem key={p.id} value={p.id} className="text-xs">{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                type="button"
                size="sm"
                onClick={handleSaveToDocuments}
                disabled={!canGenerate || !savePropertyId || saving}
                aria-label="In Dokumente speichern"
              >
                {saving ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Save className="h-4 w-4 mr-1" />}
                In Dokumente speichern
              </Button>
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
