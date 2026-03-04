/**
 * IMP20-17: Dokument-Vollständigkeitsprüfung pro Objekt
 * PropertyDetail: Checklist of standard docs (Grundbuchauszug, Teilungserklärung, Energieausweis, etc.)
 */
import { memo, useMemo } from "react";
import { FileCheck, CheckCircle2, Circle, AlertTriangle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

const REQUIRED_DOCUMENTS = [
  { key: "grundbuchauszug", label: "Grundbuchauszug", category: "grundbuch" },
  { key: "teilungserklaerung", label: "Teilungserklärung", category: "teilung" },
  { key: "energieausweis", label: "Energieausweis", category: "energie" },
  { key: "gebaeudeversicherung", label: "Gebäudeversicherung", category: "versicherung" },
  { key: "mietvertrag", label: "Mietvertrag", category: "mietvertrag" },
  { key: "kaufvertrag", label: "Kaufvertrag", category: "kaufvertrag" },
  { key: "grundriss", label: "Grundriss", category: "grundriss" },
  { key: "betriebskosten", label: "Betriebskostenabrechnung", category: "betriebskosten" },
  { key: "hausgeld", label: "Hausgeldabrechnung", category: "hausgeld" },
  { key: "protokoll", label: "WEG-Versammlungsprotokoll", category: "protokoll" },
] as const;

interface DokumentVollstaendigkeitProps {
  propertyId: string;
  propertyName?: string;
  compact?: boolean;
}

const DokumentVollstaendigkeit = memo(({ propertyId, propertyName, compact = false }: DokumentVollstaendigkeitProps) => {
  const { user } = useAuth();

  const { data: documents = [] } = useQuery({
    queryKey: ["doc_completeness", propertyId],
    queryFn: async () => {
      const { data } = await supabase
        .from("documents")
        .select("id, category, file_name")
        .eq("property_id", propertyId);
      return (data || []) as Array<{ id: string; category: string; file_name: string }>;
    },
    enabled: !!user && !!propertyId,
  });

  const checklist = useMemo(() => {
    return REQUIRED_DOCUMENTS.map(doc => {
      const found = documents.some(d =>
        d.category?.toLowerCase().includes(doc.category) ||
        d.file_name?.toLowerCase().includes(doc.category)
      );
      return { ...doc, found };
    });
  }, [documents]);

  const completedCount = checklist.filter(c => c.found).length;
  const totalCount = checklist.length;
  const completionPct = Math.round((completedCount / totalCount) * 100);

  if (compact) {
    return (
      <div className="flex items-center gap-2">
        <FileCheck className={`h-3.5 w-3.5 ${completionPct >= 80 ? "text-profit" : completionPct >= 50 ? "text-gold" : "text-loss"}`} />
        <span className="text-[10px] font-medium">{completedCount}/{totalCount} Dokumente</span>
        <div className="w-12 h-1.5 bg-secondary rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full ${completionPct >= 80 ? "bg-profit" : completionPct >= 50 ? "bg-gold" : "bg-loss"}`}
            style={{ width: `${completionPct}%` }}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="gradient-card rounded-xl border border-border p-4 animate-fade-in">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <FileCheck className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-semibold">Dokumenten-Check</h3>
          {propertyName && <span className="text-[10px] text-muted-foreground">{propertyName}</span>}
        </div>
        <Badge
          className={`text-[10px] h-5 ${
            completionPct >= 80 ? "bg-profit/20 text-profit" :
            completionPct >= 50 ? "bg-gold/20 text-gold" :
            "bg-loss/20 text-loss"
          }`}
        >
          {completedCount}/{totalCount} ({completionPct}%)
        </Badge>
      </div>

      {/* Progress bar */}
      <div className="w-full h-2 bg-secondary rounded-full mb-3 overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${
            completionPct >= 80 ? "bg-profit" : completionPct >= 50 ? "bg-gold" : "bg-loss"
          }`}
          style={{ width: `${completionPct}%` }}
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
        {checklist.map(item => (
          <div key={item.key} className="flex items-center gap-2 p-1.5 rounded text-xs">
            {item.found ? (
              <CheckCircle2 className="h-3.5 w-3.5 text-profit shrink-0" />
            ) : (
              <Circle className="h-3.5 w-3.5 text-muted-foreground/40 shrink-0" />
            )}
            <span className={item.found ? "text-foreground" : "text-muted-foreground"}>
              {item.label}
            </span>
          </div>
        ))}
      </div>

      {completionPct < 100 && (
        <div className="mt-3 p-2 rounded-lg bg-gold/10 border border-gold/20 flex items-center gap-2">
          <AlertTriangle className="h-3 w-3 text-gold shrink-0" />
          <p className="text-[10px] text-gold">
            {totalCount - completedCount} Dokument{totalCount - completedCount !== 1 ? "e" : ""} fehlen noch
          </p>
        </div>
      )}
    </div>
  );
});
DokumentVollstaendigkeit.displayName = "DokumentVollstaendigkeit";

export { DokumentVollstaendigkeit };
