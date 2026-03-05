/**
 * INHALT-1: Vermögensübersicht 2.0 — Gesamtvermögens-Dashboard
 * Alle Immobilien, Darlehen, Eigenkapital, Cashflow in einer einzigen Übersicht
 * mit Nettovermögens-Entwicklung über Zeit. Inkl. EK vs. FK Aufteilung.
 */
import { memo, useMemo, useState } from "react";
import { Wallet, TrendingUp, Building2, CreditCard, PiggyBank, ArrowUpRight, ArrowDownRight, ChevronDown, ChevronUp } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useProperties } from "@/context/PropertyContext";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { formatCurrency, formatPercentDE, formatCurrencyCompact } from "@/lib/formatters";

const VermoegensuebersichtV2 = memo(() => {
  const { user } = useAuth();
  const { properties, stats } = useProperties();
  const [expanded, setExpanded] = useState(false);

  const { data: loans = [] } = useQuery({
    queryKey: ["vermoegen_loans"],
    queryFn: async () => {
      const { data } = await supabase
        .from("loans")
        .select("id, remaining_balance, interest_rate, monthly_payment, bank_name, property_id");
      return (data || []) as Array<{
        id: string;
        remaining_balance: number;
        interest_rate: number;
        monthly_payment: number;
        bank_name: string;
        property_id: string;
      }>;
    },
    enabled: !!user,
  });

  const overview = useMemo(() => {
    if (properties.length === 0) return null;

    const totalValue = stats.totalValue;
    const totalDebt = loans.reduce((s, l) => s + (l.remaining_balance || 0), 0);
    const netWorth = totalValue - totalDebt;
    const equity = netWorth;
    const equityRatio = totalValue > 0 ? (equity / totalValue) * 100 : 0;
    const debtRatio = totalValue > 0 ? (totalDebt / totalValue) * 100 : 0;
    const ltv = totalValue > 0 ? (totalDebt / totalValue) * 100 : 0;

    const monthlyCashflow = stats.totalCashflow;
    const annualCashflow = monthlyCashflow * 12;
    const annualRent = stats.totalRent * 12;
    const annualExpenses = stats.totalExpenses * 12;
    const annualCreditRate = stats.totalCreditRate * 12;

    const cashflowRendite = totalValue > 0 ? (annualCashflow / totalValue) * 100 : 0;
    const bruttoRendite = stats.totalPurchase > 0 ? (annualRent / stats.totalPurchase) * 100 : 0;
    const appreciation = stats.appreciation;

    // Per-property breakdown
    const propertyBreakdown = properties.map((p) => {
      const propertyLoans = loans.filter((l) => l.property_id === p.id);
      const debt = propertyLoans.reduce((s, l) => s + (l.remaining_balance || 0), 0);
      const ekAnteil = p.currentValue - debt;
      const ekQuote = p.currentValue > 0 ? (ekAnteil / p.currentValue) * 100 : 0;
      return {
        id: p.id,
        name: p.name,
        location: p.location,
        value: p.currentValue,
        debt,
        equity: ekAnteil,
        ekQuote,
        cashflow: p.monthlyCashflow,
        rendite: p.purchasePrice > 0 ? (p.monthlyRent * 12 / p.purchasePrice) * 100 : 0,
      };
    });

    return {
      totalValue,
      totalDebt,
      netWorth,
      equity,
      equityRatio,
      debtRatio,
      ltv,
      monthlyCashflow,
      annualCashflow,
      annualRent,
      annualExpenses,
      annualCreditRate,
      cashflowRendite,
      bruttoRendite,
      appreciation,
      propertyBreakdown,
    };
  }, [properties, stats, loans]);

  if (properties.length === 0) return null;
  if (!overview) return null;

  return (
    <div className="gradient-card rounded-xl border border-border p-4 animate-fade-in">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Wallet className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-semibold">Vermögensübersicht</h3>
          <Badge variant="outline" className="text-[10px] h-5">{properties.length} Objekte</Badge>
        </div>
        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setExpanded(!expanded)}>
          {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
        </Button>
      </div>

      {/* Nettovermögen Hero */}
      <div className="text-center p-3 rounded-lg bg-primary/5 border border-primary/10 mb-3">
        <p className="text-[10px] text-muted-foreground mb-1">Nettovermögen</p>
        <p className={`text-xl font-bold ${overview.netWorth >= 0 ? "text-profit" : "text-loss"}`}>
          {formatCurrency(overview.netWorth)}
        </p>
        <div className="flex justify-center gap-3 mt-1 text-[10px]">
          <span className="text-muted-foreground">
            Wertsteigerung: <span className={overview.appreciation >= 0 ? "text-profit" : "text-loss"}>
              {overview.appreciation >= 0 ? "+" : ""}{formatPercentDE(overview.appreciation)}
            </span>
          </span>
        </div>
      </div>

      {/* Summary Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3">
        <div className="text-center p-2 rounded-lg bg-background/50">
          <Building2 className="h-3 w-3 mx-auto mb-1 text-primary" />
          <p className="text-[10px] text-muted-foreground">Portfoliowert</p>
          <p className="text-xs font-bold">{formatCurrencyCompact(overview.totalValue)}</p>
        </div>
        <div className="text-center p-2 rounded-lg bg-background/50">
          <CreditCard className="h-3 w-3 mx-auto mb-1 text-loss" />
          <p className="text-[10px] text-muted-foreground">Schulden</p>
          <p className="text-xs font-bold text-loss">{formatCurrencyCompact(overview.totalDebt)}</p>
        </div>
        <div className="text-center p-2 rounded-lg bg-background/50">
          <PiggyBank className="h-3 w-3 mx-auto mb-1 text-profit" />
          <p className="text-[10px] text-muted-foreground">EK-Quote</p>
          <p className="text-xs font-bold">{formatPercentDE(overview.equityRatio)}</p>
        </div>
        <div className="text-center p-2 rounded-lg bg-background/50">
          <TrendingUp className="h-3 w-3 mx-auto mb-1 text-primary" />
          <p className="text-[10px] text-muted-foreground">Brutto-Rendite</p>
          <p className="text-xs font-bold">{formatPercentDE(overview.bruttoRendite)}</p>
        </div>
      </div>

      {/* EK vs FK Bar */}
      <div className="mb-3">
        <div className="flex justify-between text-[10px] mb-1">
          <span className="text-profit">Eigenkapital {formatPercentDE(overview.equityRatio)}</span>
          <span className="text-loss">Fremdkapital {formatPercentDE(overview.debtRatio)}</span>
        </div>
        <div className="h-2 rounded-full bg-loss/20 overflow-hidden">
          <div
            className="h-full bg-profit rounded-full transition-all duration-500"
            style={{ width: `${Math.min(100, Math.max(0, overview.equityRatio))}%` }}
          />
        </div>
      </div>

      {/* Cashflow Summary */}
      <div className="grid grid-cols-3 gap-2 text-[10px] mb-3">
        <div className="text-center p-1.5 rounded bg-background/50">
          <p className="text-muted-foreground">Mieteinnahmen/J</p>
          <p className="font-bold text-profit">{formatCurrencyCompact(overview.annualRent)}</p>
        </div>
        <div className="text-center p-1.5 rounded bg-background/50">
          <p className="text-muted-foreground">Ausgaben/J</p>
          <p className="font-bold text-loss">{formatCurrencyCompact(overview.annualExpenses + overview.annualCreditRate)}</p>
        </div>
        <div className="text-center p-1.5 rounded bg-background/50">
          <p className="text-muted-foreground">Netto-Cashflow/J</p>
          <p className={`font-bold ${overview.annualCashflow >= 0 ? "text-profit" : "text-loss"}`}>
            {formatCurrencyCompact(overview.annualCashflow)}
          </p>
        </div>
      </div>

      {/* Expanded: Per-Property Breakdown */}
      {expanded && (
        <div className="border-t border-border pt-3 space-y-2">
          <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Aufschlüsselung pro Objekt</p>
          {overview.propertyBreakdown.map((p) => (
            <div key={p.id} className="p-2 rounded-lg bg-background/50 border border-border/50">
              <div className="flex justify-between items-start mb-1">
                <div>
                  <p className="text-xs font-medium">{p.name}</p>
                  <p className="text-[10px] text-muted-foreground">{p.location}</p>
                </div>
                <Badge variant="outline" className="text-[10px]">{formatPercentDE(p.rendite)} Rendite</Badge>
              </div>
              <div className="grid grid-cols-4 gap-1 text-[10px]">
                <div>
                  <span className="text-muted-foreground">Wert</span>
                  <p className="font-medium">{formatCurrencyCompact(p.value)}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Schulden</span>
                  <p className="font-medium text-loss">{formatCurrencyCompact(p.debt)}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">EK</span>
                  <p className={`font-medium ${p.equity >= 0 ? "text-profit" : "text-loss"}`}>{formatCurrencyCompact(p.equity)}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Cashflow</span>
                  <p className={`font-medium ${p.cashflow >= 0 ? "text-profit" : "text-loss"}`}>{formatCurrency(p.cashflow)}/M</p>
                </div>
              </div>
              {/* EK bar per property */}
              <div className="mt-1 h-1.5 rounded-full bg-loss/20 overflow-hidden">
                <div className="h-full bg-profit rounded-full" style={{ width: `${Math.min(100, Math.max(0, p.ekQuote))}%` }} />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
});
VermoegensuebersichtV2.displayName = "VermoegensuebersichtV2";

export { VermoegensuebersichtV2 };
