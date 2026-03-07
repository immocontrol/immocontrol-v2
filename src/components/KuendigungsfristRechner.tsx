/**
 * Kündigungsfrist-Rechner: Ermittelt das späteste Datum, bis zu dem eine Kündigung
 * eingereicht werden muss, um ein gewünschtes Vertragsende zu erreichen.
 * Relevant für Vermieter und Immobilieninvestoren (Mietverträge, Kündigungsfristen).
 */
import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { CalendarClock, Calculator } from "lucide-react";
import { formatDate } from "@/lib/formatters";

function parseDate(s: string): Date | null {
  if (!s || s.length < 10) return null;
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Berechnet: Gewünschtes Enddatum minus Kündigungsfrist (Monate) = spätestes Kündigungsdatum */
function getNoticeDeadline(desiredEnd: Date, noticeMonths: number): Date {
  const d = new Date(desiredEnd);
  d.setMonth(d.getMonth() - noticeMonths);
  return d;
}

export function KuendigungsfristRechner() {
  const [noticeMonths, setNoticeMonths] = useState(3);
  const [desiredEndStr, setDesiredEndStr] = useState("");

  const desiredEnd = useMemo(() => parseDate(desiredEndStr), [desiredEndStr]);
  const noticeDeadline = useMemo(() => {
    if (!desiredEnd || noticeMonths < 1) return null;
    return getNoticeDeadline(desiredEnd, noticeMonths);
  }, [desiredEnd, noticeMonths]);

  const isValid = desiredEnd != null && noticeMonths >= 1;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <Calculator className="h-4 w-4" /> Kündigungsfrist-Rechner
        </CardTitle>
        <p className="text-xs text-muted-foreground text-wrap-safe">
          Ermittelt, bis wann Sie spätestens kündigen müssen, um ein gewünschtes Vertragsende zu erreichen (z. B. Mietvertrag, 3 Monate zum Monatsende).
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label className="text-xs">Kündigungsfrist (Monate)</Label>
            <Input
              type="number"
              min={1}
              max={24}
              value={noticeMonths}
              onChange={(e) => setNoticeMonths(Math.max(1, Math.min(24, Number(e.target.value) || 1)))}
              className="h-9 touch-target min-h-[44px] sm:min-h-[36px]"
              aria-label="Kündigungsfrist in Monaten"
            />
          </div>
          <div className="space-y-2">
            <Label className="text-xs">Gewünschtes Vertragsende</Label>
            <Input
              type="date"
              value={desiredEndStr}
              onChange={(e) => setDesiredEndStr(e.target.value)}
              className="h-9 touch-target min-h-[44px] sm:min-h-[36px]"
              aria-label="Gewünschtes Vertragsende"
            />
          </div>
        </div>
        {isValid && noticeDeadline && (
          <div className="rounded-lg border border-border bg-muted/40 p-3 flex items-start gap-2">
            <CalendarClock className="h-4 w-4 shrink-0 mt-0.5 text-primary" />
            <div className="text-sm text-wrap-safe">
              <p className="font-medium text-foreground">Kündigung spätestens einreichen bis</p>
              <p className="text-primary font-semibold mt-0.5">{formatDate(noticeDeadline.toISOString().slice(0, 10))}</p>
              <p className="text-xs text-muted-foreground mt-1">
                Bei {noticeMonths} Monat{noticeMonths !== 1 ? "en" : ""} Kündigungsfrist und gewünschtem Ende am {formatDate(desiredEndStr)}.
              </p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
