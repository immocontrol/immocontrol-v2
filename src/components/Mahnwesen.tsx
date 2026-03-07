import { useState, useMemo } from "react";
import { AlertTriangle, FileText, Mail, Clock, CheckCircle, XCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useProperties } from "@/context/PropertyContext";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { formatCurrency, formatDate } from "@/lib/formatters";
import { toast } from "sonner";

interface OverdueItem {
  id: string;
  tenant_name: string;
  property_name: string;
  amount: number;
  due_date: string;
  days_overdue: number;
  mahnstufe: number;
  tenant_email: string | null;
  /** Days until next escalation; null if at max stage */
  nextMahnungInDays: number | null;
}

const Mahnwesen = () => {
  const { user } = useAuth();
  const { properties } = useProperties();
  const [generatingId, setGeneratingId] = useState<string | null>(null);

  const { data: payments = [] } = useQuery({
    queryKey: ["mahnwesen_payments"],
    queryFn: async () => {
      const { data } = await supabase.from("rent_payments").select("*").eq("status", "overdue").order("due_date");
      return data || [];
    },
    enabled: !!user,
  });

  const { data: tenants = [] } = useQuery({
    queryKey: ["mahnwesen_tenants"],
    queryFn: async () => {
      const { data } = await supabase.from("tenants").select("*");
      return data || [];
    },
    enabled: !!user,
  });

  const overdueItems: OverdueItem[] = useMemo(() => {
    const today = new Date();
    return payments.map(p => {
      const tenant = tenants.find(t => t.id === p.tenant_id);
      const property = properties.find(pr => pr.id === p.property_id);
      const dueDate = new Date(p.due_date);
      const daysOverdue = Math.floor((today.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));
      const mahnstufe = daysOverdue <= 14 ? 1 : daysOverdue <= 30 ? 2 : 3;
      const nextMahnungInDays = mahnstufe === 1 ? 15 - daysOverdue : mahnstufe === 2 ? 31 - daysOverdue : null;
      return {
        id: p.id,
        tenant_name: tenant ? `${tenant.first_name} ${tenant.last_name}` : "–",
        property_name: property?.name || "–",
        amount: Number(p.amount),
        due_date: p.due_date,
        days_overdue: daysOverdue,
        mahnstufe,
        tenant_email: tenant?.email || null,
        nextMahnungInDays: nextMahnungInDays !== null && nextMahnungInDays > 0 ? nextMahnungInDays : null,
      };
    }).sort((a, b) => b.days_overdue - a.days_overdue);
  }, [payments, tenants, properties]);

  const totalOverdue = overdueItems.reduce((s, i) => s + i.amount, 0);
  const stufe1 = overdueItems.filter(i => i.mahnstufe === 1);
  const stufe2 = overdueItems.filter(i => i.mahnstufe === 2);
  const stufe3 = overdueItems.filter(i => i.mahnstufe === 3);

  const generateMahnung = (item: OverdueItem) => {
    setGeneratingId(item.id);
    const today = new Date().toLocaleDateString("de-DE");
    const frist = new Date(Date.now() + 14 * 86400000).toLocaleDateString("de-DE");
    const html = `<!DOCTYPE html><html lang="de"><head><meta charset="UTF-8"><title>Mahnung – ${item.tenant_name}</title>
<style>body{font-family:system-ui,sans-serif;padding:40px;color:#222;max-width:700px;margin:0 auto;line-height:1.6}
h1{font-size:20px;color:#d94040;border-bottom:2px solid #d94040;padding-bottom:8px}
.info{background:#fef2f2;border:1px solid #fecaca;border-radius:8px;padding:16px;margin:16px 0}
table{width:100%;border-collapse:collapse;margin:16px 0}th,td{padding:8px;text-align:left;border-bottom:1px solid #eee}
.footer{margin-top:40px;font-size:11px;color:#aaa;text-align:center}</style></head><body>
<p style="text-align:right;font-size:13px;color:#888">${today}</p>
<h1>⚠️ ${item.mahnstufe === 1 ? "Zahlungserinnerung" : item.mahnstufe === 2 ? "1. Mahnung" : "2. Mahnung (letzte Frist)"}</h1>
<p>Sehr geehrte/r <strong>${item.tenant_name}</strong>,</p>
<p>leider mussten wir feststellen, dass die folgende Zahlung bisher nicht bei uns eingegangen ist:</p>
<div class="info">
<table>
<tr><td><strong>Objekt</strong></td><td>${item.property_name}</td></tr>
<tr><td><strong>Fällig am</strong></td><td>${formatDate(item.due_date)}</td></tr>
<tr><td><strong>Betrag</strong></td><td><strong>${formatCurrency(item.amount)}</strong></td></tr>
<tr><td><strong>Überfällig seit</strong></td><td>${item.days_overdue} Tagen</td></tr>
</table>
</div>
${item.mahnstufe === 1 
  ? `<p>Wir bitten Sie, den ausstehenden Betrag bis zum <strong>${frist}</strong> auf unser Konto zu überweisen. Sollte sich Ihre Zahlung mit diesem Schreiben gekreuzt haben, betrachten Sie diese Erinnerung als gegenstandslos.</p>`
  : item.mahnstufe === 2 
    ? `<p>Trotz unserer Zahlungserinnerung ist der Betrag bisher nicht eingegangen. Wir fordern Sie hiermit auf, den Betrag bis zum <strong>${frist}</strong> zu begleichen. Bei weiterem Verzug behalten wir uns rechtliche Schritte vor.</p>`
    : `<p><strong>Letzte Frist:</strong> Trotz wiederholter Mahnung ist die Zahlung ausgeblieben. Wir setzen Ihnen hiermit eine letzte Frist bis zum <strong>${frist}</strong>. Nach Ablauf dieser Frist werden wir die Angelegenheit an einen Rechtsanwalt übergeben und ggf. die fristlose Kündigung des Mietverhältnisses gemäß § 543 BGB einleiten.</p>`
}
<p>Bei Fragen stehen wir Ihnen gerne zur Verfügung.</p>
<p>Mit freundlichen Grüßen</p>
<p class="footer">Erstellt mit ImmoControl · ${today}</p>
</body></html>`;
    const w = window.open("", "_blank");
    if (w) { w.document.write(html); w.document.close(); w.print(); }
    setGeneratingId(null);
    toast.success(`${item.mahnstufe === 1 ? "Zahlungserinnerung" : `Mahnung Stufe ${item.mahnstufe}`} erstellt`);
  };

  if (overdueItems.length === 0) {
    return (
      <div className="text-center py-12 animate-fade-in">
        <CheckCircle className="h-8 w-8 text-profit mx-auto mb-3" />
        <p className="text-sm font-medium">Keine überfälligen Zahlungen</p>
        <p className="text-xs text-muted-foreground mt-1">Alle Mieter zahlen pünktlich 🎉</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="gradient-card rounded-xl border border-border p-4">
          <div className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Überfällig gesamt</div>
          <div className="text-xl font-bold text-loss">{formatCurrency(totalOverdue)}</div>
          <div className="text-[10px] text-muted-foreground">{overdueItems.length} Zahlungen</div>
        </div>
        <div className="gradient-card rounded-xl border border-border p-4">
          <div className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Erinnerungen</div>
          <div className="text-xl font-bold text-gold">{stufe1.length}</div>
          <div className="text-[10px] text-muted-foreground">≤ 14 Tage</div>
        </div>
        <div className="gradient-card rounded-xl border border-border p-4">
          <div className="text-xs text-muted-foreground uppercase tracking-wider mb-1">1. Mahnung</div>
          <div className="text-xl font-bold text-orange-500">{stufe2.length}</div>
          <div className="text-[10px] text-muted-foreground">15-30 Tage</div>
        </div>
        <div className="gradient-card rounded-xl border border-border p-4">
          <div className="text-xs text-muted-foreground uppercase tracking-wider mb-1">2. Mahnung</div>
          <div className="text-xl font-bold text-loss">{stufe3.length}</div>
          <div className="text-[10px] text-muted-foreground">&gt; 30 Tage</div>
        </div>
      </div>

      {/* List */}
      <div className="space-y-2">
        {overdueItems.map(item => (
          <div key={item.id} className={`gradient-card rounded-xl border p-4 flex items-center gap-3 ${
            item.mahnstufe === 3 ? "border-loss/30" : item.mahnstufe === 2 ? "border-orange-500/30" : "border-gold/30"
          }`}>
            <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
              item.mahnstufe === 3 ? "bg-loss/10" : item.mahnstufe === 2 ? "bg-orange-500/10" : "bg-gold/10"
            }`}>
              <AlertTriangle className={`h-4 w-4 ${
                item.mahnstufe === 3 ? "text-loss" : item.mahnstufe === 2 ? "text-orange-500" : "text-gold"
              }`} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold truncate">{item.tenant_name}</span>
                <span className="text-[10px] bg-secondary px-1.5 py-0.5 rounded">{item.property_name}</span>
                <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${
                  item.mahnstufe === 3 ? "bg-loss/15 text-loss" : item.mahnstufe === 2 ? "bg-orange-500/15 text-orange-500" : "bg-gold/15 text-gold"
                }`}>
                  Stufe {item.mahnstufe}
                </span>
              </div>
              <div className="text-[11px] text-muted-foreground">
                Fällig: {formatDate(item.due_date)} · {item.days_overdue} Tage überfällig
                {item.nextMahnungInDays !== null && item.nextMahnungInDays <= 7 && (
                  <span className="ml-2 text-gold font-medium">
                    · In {item.nextMahnungInDays} Tag{item.nextMahnungInDays !== 1 ? "en" : ""} nächste Mahnung fällig
                  </span>
                )}
              </div>
            </div>
            <div className="text-right">
              <div className="text-sm font-semibold text-loss tabular-nums">{formatCurrency(item.amount)}</div>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="gap-1 shrink-0"
              onClick={() => generateMahnung(item)}
              disabled={generatingId === item.id}
            >
              <FileText className="h-3.5 w-3.5" />
              Mahnung
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
};

export default Mahnwesen;
