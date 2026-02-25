import { useMemo } from "react";
import { Leaf, AlertTriangle, CheckCircle, Info } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { useProperties } from "@/context/PropertyContext";

const ENERGY_CLASS_LIMITS: Record<string, { max: number; label: string }> = {
  "A+": { max: 30, label: "Passivhaus" },
  "A": { max: 50, label: "Niedrigenergie" },
  "B": { max: 75, label: "Gut" },
  "C": { max: 100, label: "Durchschnitt" },
  "D": { max: 130, label: "Verbesserungsbedürftig" },
  "E": { max: 160, label: "Sanierungsbedarf" },
  "F": { max: 200, label: "Hoher Sanierungsbedarf" },
  "G": { max: 250, label: "Dringend sanieren" },
  "H": { max: 999, label: "Energetisch mangelhaft" },
};

const GEGComplianceChecker = () => {
  const { user } = useAuth();
  const { properties } = useProperties();

  const { data: certificates = [] } = useQuery({
    queryKey: ["geg_certificates"],
    queryFn: async () => {
      const { data } = await supabase.from("energy_certificates").select("*");
      return data || [];
    },
    enabled: !!user,
  });

  const analysis = useMemo(() => {
    return properties.map(p => {
      const cert = certificates.find(c => c.property_id === p.id);
      const yearBuilt = p.yearBuilt || 1970;
      const needsAction = yearBuilt < 1980 && (!cert || !cert.energy_class || ["F", "G", "H"].includes(cert.energy_class));
      const hasCert = !!cert;
      const certExpired = cert?.expiry_date ? new Date(cert.expiry_date) < new Date() : false;
      const heatingBan2026 = yearBuilt < 1990; // Simplified: old buildings may need heating replacement
      return {
        name: p.name,
        yearBuilt,
        hasCert,
        certExpired,
        energyClass: cert?.energy_class || null,
        energyValue: cert?.energy_value || null,
        needsAction,
        heatingBan2026,
      };
    });
  }, [properties, certificates]);

  const issueCount = analysis.filter(a => a.needsAction || a.certExpired || !a.hasCert).length;

  if (properties.length === 0) return null;

  return (
    <div className="gradient-card rounded-xl border border-border p-5">
      <h3 className="text-sm font-semibold flex items-center gap-2 mb-3">
        <Leaf className="h-4 w-4 text-profit" /> GEG-Compliance
        {issueCount > 0 && (
          <span className="text-[10px] bg-gold/15 text-gold px-1.5 py-0.5 rounded-full font-bold">{issueCount} Hinweise</span>
        )}
      </h3>
      <div className="space-y-2">
        {analysis.map((a, i) => (
          <div key={i} className="flex items-center justify-between text-xs p-2 rounded-lg hover:bg-secondary/30 transition-colors">
            <div className="flex items-center gap-2 min-w-0">
              {a.needsAction || a.certExpired ? (
                <AlertTriangle className="h-3.5 w-3.5 text-gold shrink-0" />
              ) : !a.hasCert ? (
                <Info className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              ) : (
                <CheckCircle className="h-3.5 w-3.5 text-profit shrink-0" />
              )}
              <span className="font-medium truncate">{a.name}</span>
              <span className="text-muted-foreground">BJ {a.yearBuilt}</span>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {a.energyClass ? (
                <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${
                  ["A+", "A", "B"].includes(a.energyClass) ? "bg-profit/15 text-profit" :
                  ["C", "D"].includes(a.energyClass) ? "bg-gold/15 text-gold" :
                  "bg-loss/15 text-loss"
                }`}>
                  {a.energyClass}
                </span>
              ) : (
                <span className="text-[10px] text-muted-foreground">Kein Ausweis</span>
              )}
              {a.certExpired && <span className="text-[10px] text-loss">Abgelaufen</span>}
            </div>
          </div>
        ))}
      </div>
      <p className="text-[9px] text-muted-foreground mt-3">GEG: Ab 2024 Pflicht zu 65% erneuerbarer Heizung bei Neueinbau. Energieausweis bei Verkauf/Vermietung Pflicht.</p>
    </div>
  );
};

export default GEGComplianceChecker;