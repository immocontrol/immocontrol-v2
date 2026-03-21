/**
 * Öffentliche Seite: Mieter bestätigt Übergabeprotokoll per Link (Token in URL).
 * Erreichbar ohne Login. Nutzt Supabase RPC get_handover_by_token / confirm_handover_by_token.
 */
import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Building2, CheckCircle2, ClipboardList, Loader2 } from "lucide-react";
import { ROUTES } from "@/lib/routes";
import { toast } from "sonner";

const CONDITION_LABELS: Record<number, string> = {
  1: "Mangelhaft",
  2: "Ausreichend",
  3: "Befriedigend",
  4: "Gut",
  5: "Sehr gut",
};

const METER_LABELS: Record<string, string> = {
  strom: "Strom (kWh)",
  gas: "Gas (m³)",
  wasser: "Wasser (m³)",
  heizung: "Heizung",
};

interface ProtocolData {
  id: string;
  property_id: string;
  tenant_id: string;
  type: string;
  protocol_data: {
    tenant?: string;
    address?: string;
    date?: string;
    keysCount?: string;
    meterStand?: Record<string, string>;
    rooms?: Array<{
      name: string;
      condition: number;
      notes: string;
      items: Array<{ name: string; ok: boolean; note: string }>;
    }>;
    generalNotes?: string;
  };
  tenant_confirmed_at: string | null;
  created_at: string;
  property_address?: string;
  tenant_name?: string;
}

export default function HandoverConfirmPage() {
  const { token } = useParams<{ token: string }>();
  const [data, setData] = useState<ProtocolData | null>(null);
  const [loading, setLoading] = useState(true);
  const [confirming, setConfirming] = useState(false);
  const [confirmed, setConfirmed] = useState(false);

  useEffect(() => {
    if (!token) {
      setLoading(false);
      return;
    }
    const run = async () => {
      const { data: result, error } = await supabase.rpc("get_handover_by_token", {
        _token: token,
      });
      if (error) {
        toast.error("Protokoll konnte nicht geladen werden.");
        setLoading(false);
        return;
      }
      setData(result as ProtocolData);
      if (result?.tenant_confirmed_at) setConfirmed(true);
      setLoading(false);
    };
    run();
  }, [token]);

  const handleConfirm = async () => {
    if (!token || confirming) return;
    setConfirming(true);
    const { data: ok, error } = await supabase.rpc("confirm_handover_by_token", {
      _token: token,
      _signature_data: null,
    });
    if (error || !ok) {
      toast.error("Bestätigung fehlgeschlagen.");
      setConfirming(false);
      return;
    }
    setConfirmed(true);
    setData((prev) => (prev ? { ...prev, tenant_confirmed_at: new Date().toISOString() } : null));
    toast.success("Sie haben das Übergabeprotokoll bestätigt.");
    setConfirming(false);
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
        <ClipboardList className="h-12 w-12 text-muted-foreground mb-4" />
        <h1 className="text-xl font-semibold mb-2">Link ungültig</h1>
        <p className="text-muted-foreground text-sm max-w-sm">
          Dieser Link ist abgelaufen oder ungültig. Bitte wenden Sie sich an Ihren Vermieter.
        </p>
      </div>
    );
  }

  const pd = data.protocol_data || {};
  const rooms = pd.rooms || [];

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card">
        <div className="container flex h-14 items-center justify-between">
          <div className="flex items-center gap-2">
            <Building2 className="h-6 w-6 text-primary" />
            <span className="font-semibold">ImmoControl – Übergabeprotokoll</span>
          </div>
        </div>
      </header>

      <main className="container max-w-2xl py-8 px-4">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ClipboardList className="h-5 w-5" />
              Wohnungsübergabeprotokoll – {data.type === "auszug" ? "Auszug" : "Einzug"}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-2 text-sm">
              <p><strong>Mieter:</strong> {pd.tenant || data.tenant_name || "–"}</p>
              <p><strong>Objekt:</strong> {pd.address || data.property_address || "–"}</p>
              <p><strong>Datum:</strong> {pd.date ? new Date(pd.date).toLocaleDateString("de-DE") : "–"}</p>
              <p><strong>Schlüssel:</strong> {pd.keysCount ?? "–"} Stück</p>
            </div>

            {pd.meterStand && Object.entries(pd.meterStand).some(([, v]) => v != null && String(v).trim() !== "") && (
              <div>
                <h3 className="text-sm font-semibold mb-1">Zählerstände</h3>
                <ul className="text-sm text-muted-foreground space-y-0.5">
                  {Object.entries(pd.meterStand)
                    .filter(([, v]) => v != null && String(v).trim() !== "")
                    .map(([k, v]) => (
                      <li key={k}>{METER_LABELS[k] || k}: {String(v)}</li>
                    ))}
                </ul>
              </div>
            )}

            {rooms.map((room, ri) => (
              <div key={ri} className="surface-section p-3">
                <p className="font-medium text-sm">{room.name} – {CONDITION_LABELS[room.condition] || ""}</p>
                <ul className="mt-1 text-xs text-muted-foreground space-y-0.5">
                  {room.items?.map((item, ii) => (
                    <li key={ii}>{item.name}: {item.ok ? "✓ OK" : "✗ Mangel"} {item.note ? `(${item.note})` : ""}</li>
                  ))}
                </ul>
                {room.notes ? <p className="mt-1 text-xs italic">{room.notes}</p> : null}
              </div>
            ))}

            {pd.generalNotes ? <p className="text-sm"><strong>Anmerkungen:</strong> {pd.generalNotes}</p> : null}

            {confirmed ? (
              <div className="flex items-center gap-2 rounded-lg bg-primary/10 text-primary p-3">
                <CheckCircle2 className="h-5 w-5 shrink-0" />
                <span className="text-sm font-medium">
                  Sie haben dieses Protokoll am {data.tenant_confirmed_at ? new Date(data.tenant_confirmed_at).toLocaleDateString("de-DE", { day: "2-digit", month: "long", year: "numeric" }) : ""} bestätigt.
                </span>
              </div>
            ) : (
              <>
                <div className="rounded-lg border border-amber-200 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-800 p-3 text-xs text-amber-900 dark:text-amber-200 text-wrap-safe">
                  Mit der Bestätigung erkennen Sie den dokumentierten Zustand der Wohnung (Räume, Zählerstände, Schlüssel) zum angegebenen Zeitpunkt an. Bitte prüfen Sie die Angaben vor dem Bestätigen.
                </div>
                <Button onClick={handleConfirm} disabled={confirming} className="w-full gap-2">
                  {confirming ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                  Inhalt bestätigen
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
