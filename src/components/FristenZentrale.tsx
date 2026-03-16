/**
 * Fristen-Zentrale — zentrale Übersicht aller relevanten Fristen für Immobilieninvestoren.
 * Bündelt: Mietvertragsende, Kündigungsfrist, Zinsbindung, Mieterhöhung §558 BGB, Dokumente, Versicherungen, Service-Verträge.
 */
import { useMemo } from "react";
import { Link } from "react-router-dom";
import { Calendar, FileText, Landmark, Shield, Wrench, AlertTriangle, ChevronRight, TrendingUp } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useProperties } from "@/context/PropertyContext";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { fromTable } from "@/lib/typedSupabase";
import { ROUTES } from "@/lib/routes";
import { formatDate } from "@/lib/formatters";
import { cn } from "@/lib/utils";

type DeadlineType = "vertrag" | "kuendigung" | "zinsbindung" | "mieterhoehung" | "dokument" | "versicherung" | "service";

interface DeadlineItem {
  id: string;
  type: DeadlineType;
  label: string;
  subLabel?: string;
  date: string;
  daysLeft: number;
  link: string;
  propertyId?: string;
}

const LIMIT = 12;
const HORIZON_DAYS = 365;

function daysLeft(dateStr: string): number {
  return Math.ceil((new Date(dateStr).getTime() - Date.now()) / 86400000);
}

export default function FristenZentrale() {
  const { user } = useAuth();
  const { getProperty } = useProperties();

  const { data: contracts = [] } = useQuery({
    queryKey: ["fristen_contracts"],
    queryFn: async () => {
      const { data } = await supabase
        .from("contracts")
        .select("id, property_id, end_date, notice_period_months, is_indefinite, status")
        .eq("status", "active")
        .not("end_date", "is", null)
        .order("end_date");
      return (data || []) as Array<{ id: string; property_id: string; end_date: string; notice_period_months: number; is_indefinite: boolean; status: string }>;
    },
    enabled: !!user,
  });

  const { data: loans = [] } = useQuery({
    queryKey: ["fristen_loans"],
    queryFn: async () => {
      const { data } = await supabase
        .from("loans")
        .select("id, property_id, bank_name, fixed_interest_until")
        .not("fixed_interest_until", "is", null)
        .order("fixed_interest_until");
      return (data || []) as Array<{ id: string; property_id: string; bank_name: string; fixed_interest_until: string }>;
    },
    enabled: !!user,
  });

  const { data: docExpiries = [] } = useQuery({
    queryKey: ["fristen_doc_expiry"],
    queryFn: async () => {
      if (!user) return [];
      const { data } = await fromTable("document_expiries")
        .select("id, property_id, name, expiry_date")
        .eq("user_id", user.id)
        .order("expiry_date");
      return (data || []) as Array<{ id: string; property_id: string; name: string; expiry_date: string }>;
    },
    enabled: !!user,
  });

  const { data: insurances = [] } = useQuery({
    queryKey: ["fristen_insurances"],
    queryFn: async () => {
      if (!user) return [];
      const { data } = await fromTable("property_insurances")
        .select("id, property_id, provider, type, renewal_date")
        .eq("user_id", user.id)
        .not("renewal_date", "is", null)
        .order("renewal_date");
      return (data || []) as Array<{ id: string; property_id: string; provider: string; type: string; renewal_date: string }>;
    },
    enabled: !!user,
  });

  const { data: mietvertraege = [] } = useQuery({
    queryKey: ["fristen_mietvertraege"],
    queryFn: async () => {
      const { data } = await supabase
        .from("mietvertraege")
        .select("id, property_id, tenant_name, unit_number, contract_start, last_rent_increase, rent_increase_type")
        .order("contract_start");
      return (data || []) as Array<{
        id: string; property_id: string; tenant_name?: string; unit_number?: string;
        contract_start: string; last_rent_increase: string | null; rent_increase_type: string;
      }>;
    },
    enabled: !!user,
  });

  const { data: serviceContracts = [] } = useQuery({
    queryKey: ["fristen_service"],
    queryFn: async () => {
      if (!user) return [];
      const { data } = await fromTable("service_contracts")
        .select("id, property_id, provider_name, service_type, end_date")
        .eq("user_id", user.id)
        .not("end_date", "is", null)
        .order("end_date");
      return (data || []) as Array<{ id: string; property_id: string; provider_name: string; service_type: string; end_date: string }>;
    },
    enabled: !!user,
  });

  const items = useMemo((): DeadlineItem[] => {
    const list: DeadlineItem[] = [];

    contracts.forEach((c) => {
      const d = daysLeft(c.end_date);
      if (d > -30 && d <= HORIZON_DAYS) {
        const prop = getProperty(c.property_id);
        list.push({
          id: `c-${c.id}`,
          type: "vertrag",
          label: `Mietvertrag endet`,
          subLabel: prop?.name ?? c.property_id,
          date: c.end_date,
          daysLeft: d,
          link: ROUTES.CONTRACTS,
          propertyId: c.property_id,
        });
      }
      if (!c.is_indefinite && c.notice_period_months > 0) {
        const end = new Date(c.end_date);
        end.setMonth(end.getMonth() - c.notice_period_months);
        const noticeDate = end.toISOString().slice(0, 10);
        const dNotice = daysLeft(noticeDate);
        if (dNotice > -30 && dNotice <= HORIZON_DAYS && dNotice < daysLeft(c.end_date)) {
          const prop = getProperty(c.property_id);
          list.push({
            id: `k-${c.id}`,
            type: "kuendigung",
            label: `Kündigung spätestens bis`,
            subLabel: prop?.name ?? c.property_id,
            date: noticeDate,
            daysLeft: dNotice,
            link: ROUTES.CONTRACTS,
            propertyId: c.property_id,
          });
        }
      }
    });

    loans.forEach((l) => {
      const d = daysLeft(l.fixed_interest_until);
      if (d > -30 && d <= HORIZON_DAYS) {
        const prop = getProperty(l.property_id);
        list.push({
          id: `l-${l.id}`,
          type: "zinsbindung",
          label: `Zinsbindung endet (${l.bank_name})`,
          subLabel: prop?.name ?? l.property_id,
          date: l.fixed_interest_until,
          daysLeft: d,
          link: ROUTES.LOANS,
          propertyId: l.property_id,
        });
      }
    });

    docExpiries.forEach((d) => {
      const dl = daysLeft(d.expiry_date);
      if (dl > -30 && dl <= HORIZON_DAYS) {
        const prop = getProperty(d.property_id);
        list.push({
          id: `doc-${d.id}`,
          type: "dokument",
          label: d.name,
          subLabel: prop?.name ?? d.property_id,
          date: d.expiry_date,
          daysLeft: dl,
          link: `${ROUTES.PROPERTY}/${d.property_id}`,
          propertyId: d.property_id,
        });
      }
    });

    insurances.forEach((i) => {
      const d = daysLeft(i.renewal_date);
      if (d > -30 && d <= HORIZON_DAYS) {
        const prop = getProperty(i.property_id);
        list.push({
          id: `ins-${i.id}`,
          type: "versicherung",
          label: `${i.type} (${i.provider})`,
          subLabel: prop?.name ?? i.property_id,
          date: i.renewal_date,
          daysLeft: d,
          link: `${ROUTES.PROPERTY}/${i.property_id}`,
          propertyId: i.property_id,
        });
      }
    });

    // Mieterhöhung §558 BGB — 15 Monate seit letzter Erhöhung (oder 12 Monate seit Vertragsbeginn)
    const COOLDOWN_MONTHS = 15;
    const INCREASE_HORIZON_DAYS = 120;
    mietvertraege.forEach((m) => {
      let nextDate: Date;
      if (m.last_rent_increase) {
        nextDate = new Date(m.last_rent_increase);
        nextDate.setMonth(nextDate.getMonth() + COOLDOWN_MONTHS);
      } else {
        nextDate = new Date(m.contract_start);
        nextDate.setMonth(nextDate.getMonth() + 12);
      }
      const dateStr = nextDate.toISOString().slice(0, 10);
      const d = daysLeft(dateStr);
      if (d > -30 && d <= INCREASE_HORIZON_DAYS) {
        const prop = getProperty(m.property_id);
        list.push({
          id: `mh-${m.id}`,
          type: "mieterhoehung",
          label: "Mieterhöhung möglich (§558 BGB)",
          subLabel: [prop?.name ?? m.property_id, m.tenant_name, m.unit_number].filter(Boolean).join(" · ") || (prop?.name ?? m.property_id),
          date: dateStr,
          daysLeft: d,
          link: ROUTES.RENT,
          propertyId: m.property_id,
        });
      }
    });

    serviceContracts.forEach((s) => {
      const d = daysLeft(s.end_date);
      if (d > -30 && d <= HORIZON_DAYS) {
        const prop = getProperty(s.property_id);
        list.push({
          id: `svc-${s.id}`,
          type: "service",
          label: `${s.service_type} (${s.provider_name})`,
          subLabel: prop?.name ?? s.property_id,
          date: s.end_date,
          daysLeft: d,
          link: `${ROUTES.PROPERTY}/${s.property_id}`,
          propertyId: s.property_id,
        });
      }
    });

    return list
      .sort((a, b) => a.daysLeft - b.daysLeft)
      .slice(0, LIMIT);
  }, [contracts, loans, mietvertraege, docExpiries, insurances, serviceContracts, getProperty]);

  const zinsbindungProminent = useMemo(() => {
    return loans
      .filter((l) => {
        const d = daysLeft(l.fixed_interest_until);
        return d > -30 && d <= HORIZON_DAYS;
      })
      .sort((a, b) => daysLeft(a.fixed_interest_until) - daysLeft(b.fixed_interest_until))
      .slice(0, 5)
      .map((l) => ({
        id: l.id,
        bank_name: l.bank_name,
        property_id: l.property_id,
        propertyName: getProperty(l.property_id)?.name ?? l.property_id,
        date: l.fixed_interest_until,
        daysLeft: daysLeft(l.fixed_interest_until),
      }));
  }, [loans, getProperty]);

  const typeIcon: Record<DeadlineType, React.ReactNode> = {
    vertrag: <FileText className="h-3.5 w-3.5 shrink-0" />,
    kuendigung: <AlertTriangle className="h-3.5 w-3.5 shrink-0" />,
    zinsbindung: <Landmark className="h-3.5 w-3.5 shrink-0" />,
    mieterhoehung: <TrendingUp className="h-3.5 w-3.5 shrink-0" />,
    dokument: <FileText className="h-3.5 w-3.5 shrink-0" />,
    versicherung: <Shield className="h-3.5 w-3.5 shrink-0" />,
    service: <Wrench className="h-3.5 w-3.5 shrink-0" />,
  };

  if (items.length === 0) {
    return (
      <div className="gradient-card rounded-xl border border-border p-5 animate-fade-in">
        <h3 className="text-sm font-semibold mb-1 flex items-center gap-2">
          <Calendar className="h-4 w-4 text-muted-foreground" /> Fristen-Zentrale
        </h3>
        <p className="text-[10px] text-muted-foreground">
          Keine Fristen in den nächsten 12 Monaten. Verträge, Darlehen, Dokumente und Versicherungen werden hier gebündelt.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Link to={ROUTES.CONTRACTS} className="text-xs text-primary hover:underline flex items-center gap-0.5">
            Verträge <ChevronRight className="h-3 w-3" />
          </Link>
          <Link to={ROUTES.LOANS} className="text-xs text-primary hover:underline flex items-center gap-0.5">
            Darlehen <ChevronRight className="h-3 w-3" />
          </Link>
          <Link to={ROUTES.BENACHRICHTIGUNGEN} className="text-xs text-primary hover:underline flex items-center gap-0.5">
            Fristen als Erinnerung <ChevronRight className="h-3 w-3" />
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="gradient-card rounded-xl border border-border p-5 animate-fade-in">
      <h3 className="text-sm font-semibold mb-1 flex items-center gap-2">
        <Calendar className="h-4 w-4 text-muted-foreground" /> Fristen-Zentrale
      </h3>
      <p className="text-[10px] text-muted-foreground mb-3">
        Nächste {items.length} Fristen (Verträge, Zinsbindung, Mieterhöhung §558, Dokumente, Versicherungen)
      </p>
      {zinsbindungProminent.length > 0 && (
        <div className="mb-4 rounded-xl border-2 border-primary/30 bg-primary/5 p-3 space-y-2">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-semibold flex items-center gap-1.5 text-primary">
              <Landmark className="h-4 w-4" /> Zinsbindungsende — Refinanzierung planen
            </span>
            <Link to={ROUTES.LOANS} className="text-[10px] text-primary hover:underline font-medium">
              Darlehen →
            </Link>
          </div>
          <ul className="space-y-1.5">
            {zinsbindungProminent.map((z) => (
              <li key={z.id} className="flex items-center justify-between text-xs">
                <span className="font-medium truncate max-w-[180px]">{z.propertyName} · {z.bank_name}</span>
                <span className={cn(
                  "shrink-0 font-semibold",
                  z.daysLeft <= 90 ? "text-loss" : "text-gold"
                )}>
                  {formatDate(z.date)} ({z.daysLeft} T)
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
      <ul className="space-y-2">
        {items.map((item) => {
          const isUrgent = item.daysLeft <= 30;
          const isSoon = item.daysLeft <= 90 && item.daysLeft > 30;
          return (
            <li key={item.id}>
              <Link
                to={item.link}
                className={cn(
                  "flex items-center gap-3 p-2 rounded-lg transition-colors hover:bg-secondary/50",
                  isUrgent && "bg-loss/5 border border-loss/20",
                  isSoon && "bg-gold/5 border border-gold/20"
                )}
              >
                <span className="text-muted-foreground">{typeIcon[item.type]}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium truncate">{item.label}</p>
                  {item.subLabel && (
                    <p className="text-[10px] text-muted-foreground truncate">{item.subLabel}</p>
                  )}
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-[10px] text-muted-foreground">{formatDate(item.date)}</p>
                  <span
                    className={cn(
                      "text-xs font-semibold",
                      isUrgent && "text-loss",
                      isSoon && "text-gold",
                      !isUrgent && !isSoon && "text-muted-foreground"
                    )}
                  >
                    {item.daysLeft < 0 ? "überfällig" : `${item.daysLeft} T`}
                  </span>
                </div>
                <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              </Link>
            </li>
          );
        })}
      </ul>
      <div className="mt-3 pt-2 border-t border-border flex flex-wrap gap-x-4 gap-y-1 text-[10px] text-muted-foreground">
        <Link to={ROUTES.CONTRACTS} className="hover:text-primary hover:underline">Verträge</Link>
        <Link to={ROUTES.LOANS} className="hover:text-primary hover:underline">Darlehen</Link>
        <Link to={ROUTES.OBJEKTE} className="hover:text-primary hover:underline">Objekte</Link>
        <Link to={ROUTES.BENACHRICHTIGUNGEN} className="hover:text-primary hover:underline">Fristen als Erinnerung → Benachrichtigungen</Link>
      </div>
    </div>
  );
}
