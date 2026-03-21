/**
 * Öffentliche Seite: Mieter unterschreibt Mietvertrag per Link (Token in URL).
 * Erreichbar ohne Login. Zeigt Vertragsinhalt und Unterschriften-Pad bzw. Bestätigung.
 */
import { useEffect, useState, useRef, useCallback } from "react";
import { useParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Building2, FileText, Loader2, PenLine, CheckCircle2 } from "lucide-react";
import { ROUTES } from "@/lib/routes";
import { toast } from "sonner";
import { formatCurrency } from "@/lib/formatters";

interface ContractData {
  landlordName?: string;
  landlordAddress?: string;
  tenantName?: string;
  address?: string;
  startDate?: string;
  coldRent?: number;
  nkPrepayment?: number;
  deposit?: number;
  noticeMonths?: number;
}

interface ContractSignPayload {
  id: string;
  property_id: string;
  tenant_id: string;
  type: string;
  contract_data: ContractData;
  tenant_signed_at: string | null;
  created_at: string;
  property_address?: string;
  tenant_name?: string;
}

export default function ContractSignPage() {
  const { token } = useParams<{ token: string }>();
  const [data, setData] = useState<ContractSignPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [signing, setSigning] = useState(false);
  const [signed, setSigned] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const isDrawing = useRef(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = "#000000";
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
  }, [data]);

  useEffect(() => {
    if (!token) {
      setLoading(false);
      return;
    }
    const run = async () => {
      const { data: result, error } = await supabase.rpc("get_contract_by_token", { _token: token });
      if (error) {
        toast.error("Vertrag konnte nicht geladen werden.");
        setLoading(false);
        return;
      }
      setData(result as ContractSignPayload);
      if (result?.tenant_signed_at) setSigned(true);
      setLoading(false);
    };
    run();
  }, [token]);

  const clearCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (ctx) {
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.strokeStyle = "#000000";
      ctx.lineWidth = 2;
    }
  }, []);

  const getSignatureData = useCallback((): string | null => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    try {
      return canvas.toDataURL("image/png");
    } catch {
      return null;
    }
  }, []);

  const handleConfirm = async () => {
    if (!token || signing) return;
    setSigning(true);
    const sig = getSignatureData();
    const { data: ok, error } = await supabase.rpc("sign_contract_by_token", {
      _token: token,
      _signature_data: sig || null,
    });
    if (error || !ok) {
      toast.error("Unterschrift konnte nicht gespeichert werden.");
      setSigning(false);
      return;
    }
    setSigned(true);
    setData((prev) => (prev ? { ...prev, tenant_signed_at: new Date().toISOString() } : null));
    toast.success("Sie haben den Mietvertrag unterschrieben.");
    setSigning(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!token || !data) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6 text-center">
        <FileText className="h-12 w-12 text-muted-foreground mb-4" />
        <h1 className="text-xl font-semibold mb-2">Link ungültig</h1>
        <p className="text-muted-foreground text-sm max-w-sm">
          Dieser Link ist abgelaufen oder ungültig. Bitte wenden Sie sich an Ihren Vermieter.
        </p>
        <Link to={ROUTES.AUTH} className="mt-4 text-sm text-primary underline">Zur Anmeldung</Link>
      </div>
    );
  }

  const cd = data.contract_data || {};

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card">
        <div className="container flex h-14 items-center justify-between">
          <div className="flex items-center gap-2">
            <Building2 className="h-6 w-6 text-primary" />
            <span className="font-semibold">ImmoControl – Mietvertrag</span>
          </div>
        </div>
      </header>

      <main className="container max-w-2xl py-8 px-4">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Mietvertrag – zur Unterschrift
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-2 text-sm">
              <p><strong>Vermieter:</strong> {cd.landlordName || "–"}</p>
              <p><strong>Mieter:</strong> {cd.tenantName || data.tenant_name || "–"}</p>
              <p className="col-span-2"><strong>Mietobjekt:</strong> {cd.address || data.property_address || "–"}</p>
              <p><strong>Mietbeginn:</strong> {cd.startDate ? new Date(cd.startDate).toLocaleDateString("de-DE") : "–"}</p>
              <p><strong>Kaltmiete:</strong> {cd.coldRent != null ? formatCurrency(cd.coldRent) + "/Monat" : "–"}</p>
              <p><strong>NK-Vorauszahlung:</strong> {cd.nkPrepayment != null ? formatCurrency(cd.nkPrepayment) + "/Monat" : "–"}</p>
              <p><strong>Kaution:</strong> {cd.deposit != null ? formatCurrency(cd.deposit) : "–"}</p>
              <p><strong>Kündigungsfrist:</strong> {cd.noticeMonths != null ? cd.noticeMonths + " Monate zum Monatsende" : "–"}</p>
            </div>

            {signed ? (
              <div className="flex items-center gap-2 rounded-lg bg-primary/10 text-primary p-3">
                <CheckCircle2 className="h-5 w-5 shrink-0" />
                <span className="text-sm font-medium">
                  Sie haben diesen Mietvertrag am {data.tenant_signed_at ? new Date(data.tenant_signed_at).toLocaleDateString("de-DE", { day: "2-digit", month: "long", year: "numeric" }) : ""} unterschrieben.
                </span>
              </div>
            ) : (
              <>
                <div className="rounded-lg border border-amber-200 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-800 p-3 text-xs text-amber-900 dark:text-amber-200 text-wrap-safe">
                  Bitte prüfen Sie die Angaben. Mit der Unterschrift bestätigen Sie den Vertragsinhalt. Sie können optional unten mit der Maus oder dem Finger unterschreiben.
                </div>

                <div className="space-y-2">
                  <Label className="text-xs">Unterschrift (optional – sonst reicht Bestätigung)</Label>
                  <div className="overflow-hidden rounded-xl border border-border/80 bg-white">
                    <canvas
                      ref={canvasRef}
                      width={400}
                      height={120}
                      className="w-full max-w-full touch-none block"
                      style={{ touchAction: "none" }}
                      onMouseDown={(e) => {
                        isDrawing.current = true;
                        const ctx = canvasRef.current?.getContext("2d");
                        if (ctx) {
                          ctx.beginPath();
                          ctx.moveTo(e.nativeEvent.offsetX, e.nativeEvent.offsetY);
                        }
                      }}
                      onMouseMove={(e) => {
                        if (!isDrawing.current) return;
                        const ctx = canvasRef.current?.getContext("2d");
                        if (ctx) {
                          ctx.lineTo(e.nativeEvent.offsetX, e.nativeEvent.offsetY);
                          ctx.stroke();
                        }
                      }}
                      onMouseUp={() => { isDrawing.current = false; }}
                      onMouseLeave={() => { isDrawing.current = false; }}
                      onTouchStart={(e) => {
                        e.preventDefault();
                        isDrawing.current = true;
                        const ctx = canvasRef.current?.getContext("2d");
                        const rect = canvasRef.current?.getBoundingClientRect();
                        const t = e.touches[0];
                        if (ctx && rect) {
                          const x = t.clientX - rect.left;
                          const y = t.clientY - rect.top;
                          ctx.beginPath();
                          ctx.moveTo(x, y);
                        }
                      }}
                      onTouchMove={(e) => {
                        e.preventDefault();
                        if (!isDrawing.current) return;
                        const ctx = canvasRef.current?.getContext("2d");
                        const rect = canvasRef.current?.getBoundingClientRect();
                        const t = e.touches[0];
                        if (ctx && rect) {
                          const x = t.clientX - rect.left;
                          const y = t.clientY - rect.top;
                          ctx.lineTo(x, y);
                          ctx.stroke();
                        }
                      }}
                      onTouchEnd={() => { isDrawing.current = false; }}
                    />
                    <div className="p-1 border-t border-border flex justify-end">
                      <Button type="button" variant="ghost" size="sm" className="text-xs" onClick={clearCanvas}>
                        Löschen
                      </Button>
                    </div>
                  </div>
                  <p className="text-[10px] text-muted-foreground">Zeichenfläche: Mit Maus oder Finger unterschreiben. Ohne Unterschrift wird nur das Bestätigungsdatum gespeichert.</p>
                </div>

                <Button onClick={handleConfirm} disabled={signing} className="w-full gap-2">
                  {signing ? <Loader2 className="h-4 w-4 animate-spin" /> : <PenLine className="h-4 w-4" />}
                  Vertrag unterschreiben & bestätigen
                </Button>
              </>
            )}
          </CardContent>
        </Card>

        <p className="text-center text-xs text-muted-foreground mt-6">
          <Link to={ROUTES.AUTH} className="underline hover:text-foreground">Zur Anmeldung</Link>
        </p>
      </main>
    </div>
  );
}
