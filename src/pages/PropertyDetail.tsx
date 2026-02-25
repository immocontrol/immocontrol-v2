import { useState, useRef, useEffect } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { ArrowLeft, MapPin, Calendar, Home, Landmark, TrendingUp, Wallet, Wrench, Trash2, Copy, ClipboardCopy, Clock, Euro, CreditCard, Users, Share2 } from "lucide-react";
import EditPropertyDialog from "@/components/EditPropertyDialog";
import StatCard from "@/components/StatCard";
import { useProperties } from "@/context/PropertyContext";
import PropertyDocuments from "@/components/PropertyDocuments";
import PropertyNotes from "@/components/PropertyNotes";
import TenantManagement from "@/components/TenantManagement";
import MessageCenter from "@/components/MessageCenter";
import { LandlordTickets } from "@/components/TicketSystem";
import { LandlordPayments } from "@/components/PaymentTracking";
import ActivityTimeline from "@/components/ActivityTimeline";
import QuickActions from "@/components/QuickActions";
import PropertyValueHistory from "@/components/PropertyValueHistory";
import RentIncreaseCalculator from "@/components/RentIncreaseCalculator";
import MaintenancePlanner from "@/components/MaintenancePlanner";
import InsuranceTracker from "@/components/InsuranceTracker";
import PropertyBenchmark from "@/components/PropertyBenchmark";
import ExpensePieChart from "@/components/ExpensePieChart";
import DocumentExpiryTracker from "@/components/DocumentExpiryTracker";
import MeterManagement from "@/components/MeterManagement";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { formatCurrency } from "@/lib/formatters";

// Property detail page

const PropertyDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { getProperty, deleteProperty, duplicateProperty } = useProperties();
  const property = getProperty(id || "");
  const [tenantVersion, setTenantVersion] = useState(0);
  const sectionRefs = useRef<Record<string, HTMLDivElement | null>>({});
  
  // Synergy 13: Fetch property-level synergy stats
  const [synergy, setSynergy] = useState({ openTickets: 0, overduePayments: 0, totalRepairCost: 0, activeTenants: 0, confirmedRevenue: 0 });
  useEffect(() => {
    if (!property) return;
    Promise.all([
      supabase.from("tickets").select("id, status, actual_cost, estimated_cost").eq("property_id", property.id).in("status", ["open", "in_progress"]),
      supabase.from("rent_payments").select("id, status, amount").eq("property_id", property.id),
      supabase.from("tenants").select("id").eq("property_id", property.id).eq("is_active", true),
    ]).then(([ticketsRes, paymentsRes, tenantsRes]) => {
      const tickets = ticketsRes.data || [];
      const payments = paymentsRes.data || [];
      setSynergy({
        openTickets: tickets.length,
        overduePayments: payments.filter(p => p.status === "overdue").length,
        totalRepairCost: tickets.reduce((s, t) => s + Number(t.actual_cost || t.estimated_cost || 0), 0),
        activeTenants: tenantsRes.data?.length || 0,
        confirmedRevenue: payments.filter(p => p.status === "confirmed").reduce((s, p) => s + Number(p.amount), 0),
      });
    }).catch(() => {});
  }, [property?.id, tenantVersion]);

  const scrollToSection = (section: string) => {
    sectionRefs.current[section]?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  if (!property) {
    return (
      <div className="text-center py-20">
        <p className="text-muted-foreground">Objekt nicht gefunden</p>
        <Link to="/" className="text-primary text-sm mt-2 inline-block">← Zurück</Link>
      </div>
    );
  }

  const bruttoRendite = property.purchasePrice > 0 ? ((property.monthlyRent * 12) / property.purchasePrice) * 100 : 0;
  const nettoRendite = property.purchasePrice > 0 ? (((property.monthlyRent - property.monthlyExpenses) * 12) / property.purchasePrice) * 100 : 0;
  const appreciation = property.purchasePrice > 0 ? ((property.currentValue - property.purchasePrice) / property.purchasePrice) * 100 : 0;
  const eigenkapital = property.purchasePrice - property.remainingDebt;
  const cashOnCash = eigenkapital > 0 ? ((property.monthlyCashflow * 12) / eigenkapital) * 100 : 0;
  const mietmultiplikator = property.monthlyRent > 0 ? property.purchasePrice / (property.monthlyRent * 12) : 0;
  const ltv = property.currentValue > 0 ? (property.remainingDebt / property.currentValue) * 100 : 0;

  // Besitzdauer
  const purchaseDate = new Date(property.purchaseDate);
  const now = new Date();
  const diffMs = now.getTime() - purchaseDate.getTime();
  const diffYears = Math.floor(diffMs / (1000 * 60 * 60 * 24 * 365.25));
  const diffMonths = Math.floor((diffMs % (1000 * 60 * 60 * 24 * 365.25)) / (1000 * 60 * 60 * 24 * 30.44));
  const besitzdauer = diffYears > 0 ? `${diffYears}J ${diffMonths}M` : `${diffMonths} Monate`;

  const copyAddress = () => {
    navigator.clipboard.writeText(property.address);
    toast.success("Adresse kopiert");
  };

  return (
    <div className="space-y-6 max-w-3xl mx-auto" role="main" aria-label={`Objektdetail: ${property.name}`}>
      <div className="flex items-center justify-between">
        <Link to="/" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="h-4 w-4" /> Portfolio
        </Link>
        <span className="text-[10px] text-muted-foreground hidden sm:inline">
          Besitzdauer: {besitzdauer}
        </span>
      </div>

      <div className="animate-fade-in">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold">{property.name}</h1>
            <button
              onClick={copyAddress}
              className="flex items-center gap-1 text-sm text-muted-foreground mt-1 hover:text-foreground transition-colors group/addr"
              title="Adresse kopieren"
            >
              <MapPin className="h-3.5 w-3.5" /> {property.address}
              <ClipboardCopy className="h-3 w-3 opacity-0 group-hover/addr:opacity-100 transition-opacity" />
            </button>
          </div>
          <div className="flex items-center gap-1">
            <QuickActions onScrollTo={scrollToSection} />
            <EditPropertyDialog property={property} />
            {/* Share/Copy property summary */}
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-muted-foreground hover:text-foreground"
              aria-label="Objektdaten teilen"
              onClick={() => {
                const summary = `📊 ${property.name}\n📍 ${property.address}\n💰 Wert: ${formatCurrency(property.currentValue)}\n🏠 Miete: ${formatCurrency(property.monthlyRent)}/M\n📈 Cashflow: ${formatCurrency(property.monthlyCashflow)}/M\n📊 Brutto-Rendite: ${bruttoRendite.toFixed(1)}%\n🏦 Restschuld: ${formatCurrency(property.remainingDebt)}`;
                navigator.clipboard.writeText(summary);
                toast.success("Objektzusammenfassung kopiert!");
              }}
            >
              <Share2 className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-muted-foreground hover:text-foreground"
              aria-label="Objekt duplizieren"
              onClick={async () => {
                await duplicateProperty(property.id);
                toast.success(`${property.name} wurde dupliziert`);
                navigate("/");
              }}
            >
              <Copy className="h-4 w-4" />
            </Button>
            <span className={`text-xs px-2.5 py-1 rounded-lg font-medium ${
              property.ownership === "egbr" ? "bg-gold/15 text-gold" : "bg-primary/15 text-primary"
            }`}>
              {property.ownership === "egbr" ? "eGbR" : "Privat"}
            </span>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-loss" aria-label="Objekt löschen">
                  <Trash2 className="h-4 w-4" />
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Objekt löschen?</AlertDialogTitle>
                  <AlertDialogDescription>
                    „{property.name}" wird unwiderruflich aus deinem Portfolio entfernt.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Abbrechen</AlertDialogCancel>
                  <AlertDialogAction
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    onClick={async () => {
                      await deleteProperty(property.id);
                      toast.success(`${property.name} wurde gelöscht.`);
                      navigate("/");
                    }}
                  >
                    Löschen
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 mt-3 text-xs text-muted-foreground">
          <span className="flex items-center gap-1"><Home className="h-3.5 w-3.5" /> {property.type} · {property.units} Einheiten</span>
          <span className="flex items-center gap-1"><Calendar className="h-3.5 w-3.5" /> Kauf: {new Date(property.purchaseDate).toLocaleDateString("de-DE")}</span>
          <span className="flex items-center gap-1"><Clock className="h-3.5 w-3.5" /> Im Besitz seit {besitzdauer}</span>
          <span>{property.sqm} m² · Baujahr {property.yearBuilt}</span>
        </div>
      </div>

      {/* Financials */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard
          label="Kaufpreis"
          value={formatCurrency(property.purchasePrice)}
          subValue={`${(property.purchasePrice / property.sqm).toFixed(0)} €/m²`}
          icon={<Landmark className="h-4 w-4" />}
          delay={100}
        />
        <StatCard
          label="Aktueller Wert"
          value={formatCurrency(property.currentValue)}
          subValue={`${appreciation >= 0 ? "+" : ""}${appreciation.toFixed(1)}%`}
          trend={appreciation >= 0 ? "up" : "down"}
          icon={<TrendingUp className="h-4 w-4" />}
          delay={150}
        />
        <StatCard
          label="Miete / Monat"
          value={formatCurrency(property.monthlyRent)}
          subValue={property.sqm > 0 ? `${(property.monthlyRent / property.sqm).toFixed(2)} €/m²` : undefined}
          icon={<Wallet className="h-4 w-4" />}
          delay={200}
        />
        <StatCard
          label="Cashflow / Monat"
          value={formatCurrency(property.monthlyCashflow)}
          subValue={`${formatCurrency(property.monthlyCashflow * 12)}/Jahr`}
          trend={property.monthlyCashflow >= 0 ? "up" : "down"}
          delay={250}
        />
      </div>

      {/* Rendite - Improvement 8: Traffic light colors */}
      <div className="gradient-card rounded-xl border border-border p-5 animate-fade-in" style={{ animationDelay: "300ms" }}>
        <h2 className="text-sm font-semibold mb-4">Renditekennzahlen</h2>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          {[
            { label: "Brutto-Rendite", value: bruttoRendite, format: (v: number) => `${v.toFixed(2)}%`, good: (v: number) => v >= 5, mid: (v: number) => v >= 3 },
            { label: "Netto-Rendite", value: nettoRendite, format: (v: number) => `${v.toFixed(2)}%`, good: (v: number) => v >= 3, mid: (v: number) => v >= 1.5 },
            { label: "Cash-on-Cash", value: cashOnCash, format: (v: number) => `${v.toFixed(2)}%`, good: (v: number) => v >= 5, mid: (v: number) => v >= 2 },
            { label: "Mietmultiplikator", value: mietmultiplikator, format: (v: number) => v > 0 ? `${v.toFixed(1)}x` : "–", good: (v: number) => v > 0 && v <= 20, mid: (v: number) => v > 0 && v <= 25 },
            { label: "LTV", value: ltv, format: (v: number) => `${v.toFixed(1)}%`, good: (v: number) => v <= 60, mid: (v: number) => v <= 80 },
          ].map((item) => (
            <div key={item.label} className="relative">
              <div className="text-xs text-muted-foreground mb-1">{item.label}</div>
              <div className={`text-xl font-bold ${item.good(item.value) ? "text-profit" : item.mid(item.value) ? "text-gold" : "text-loss"}`}>
                {item.format(item.value)}
              </div>
              {/* Improvement 8: Traffic light dot */}
              <div className={`absolute top-0 right-0 w-2 h-2 rounded-full ${item.good(item.value) ? "bg-profit" : item.mid(item.value) ? "bg-gold" : "bg-loss"}`} />
            </div>
          ))}
        </div>
      </div>

      {/* Finanzierung */}
      <div className="gradient-card rounded-xl border border-border p-5 animate-fade-in" style={{ animationDelay: "400ms" }}>
        <h2 className="text-sm font-semibold mb-4 flex items-center gap-2">
          <Landmark className="h-4 w-4 text-muted-foreground" /> Finanzierung
        </h2>
        <div className="space-y-3">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Restschuld</span>
            <span className="font-medium">{formatCurrency(property.remainingDebt)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Zinssatz</span>
            <span className="font-medium">{property.interestRate}%</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Kreditrate / Monat</span>
            <span className="font-medium">{formatCurrency(property.monthlyCreditRate)}</span>
          </div>
          <div className="h-2 bg-secondary rounded-full overflow-hidden mt-2">
            <div
              className="h-full bg-primary rounded-full progress-animated"
              style={{ width: `${property.purchasePrice > 0 ? ((property.purchasePrice - property.remainingDebt) / property.purchasePrice) * 100 : 0}%` }}
            />
          </div>
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>Getilgt</span>
            <span>{formatCurrency(property.purchasePrice - property.remainingDebt)}</span>
          </div>
        </div>
      </div>

      {/* Monthly breakdown */}
      <div className="gradient-card rounded-xl border border-border p-5 animate-fade-in" style={{ animationDelay: "500ms" }}>
        <h2 className="text-sm font-semibold mb-4 flex items-center gap-2">
          <Wrench className="h-4 w-4 text-muted-foreground" /> Monatliche Übersicht
        </h2>
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Mieteinnahmen</span>
            <span className="text-profit font-medium">+{formatCurrency(property.monthlyRent)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Kreditrate</span>
            <span className="text-loss font-medium">-{formatCurrency(property.monthlyCreditRate)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Bewirtschaftungskosten</span>
            <span className="text-loss font-medium">-{formatCurrency(property.monthlyExpenses)}</span>
          </div>
          <div className="border-t border-border pt-2 mt-2 flex justify-between text-sm font-semibold">
            <span>Cashflow</span>
            <div className="text-right">
              <span className={property.monthlyCashflow >= 0 ? "text-profit" : "text-loss"}>
                {formatCurrency(property.monthlyCashflow)}
              </span>
              <div className="text-[10px] text-muted-foreground font-normal">
                {formatCurrency(property.monthlyCashflow * 12)}/Jahr
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Synergy 14: Property-level action summary */}
      {(synergy.openTickets > 0 || synergy.overduePayments > 0 || synergy.totalRepairCost > 0) && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 animate-fade-in" style={{ animationDelay: "550ms" }}>
          <div className={`rounded-lg p-3 text-center ${synergy.openTickets > 0 ? "bg-gold/10 border border-gold/20" : "bg-secondary/50"}`}>
            <Wrench className={`h-4 w-4 mx-auto mb-1 ${synergy.openTickets > 0 ? "text-gold" : "text-muted-foreground"}`} />
            <div className={`text-lg font-bold ${synergy.openTickets > 0 ? "text-gold" : "text-muted-foreground"}`}>{synergy.openTickets}</div>
            <div className="text-[10px] text-muted-foreground">Offene Tickets</div>
          </div>
          <div className={`rounded-lg p-3 text-center ${synergy.overduePayments > 0 ? "bg-loss/10 border border-loss/20" : "bg-secondary/50"}`}>
            <CreditCard className={`h-4 w-4 mx-auto mb-1 ${synergy.overduePayments > 0 ? "text-loss" : "text-muted-foreground"}`} />
            <div className={`text-lg font-bold ${synergy.overduePayments > 0 ? "text-loss" : "text-muted-foreground"}`}>{synergy.overduePayments}</div>
            <div className="text-[10px] text-muted-foreground">Überfällig</div>
          </div>
          <div className="rounded-lg p-3 text-center bg-secondary/50">
            <Euro className="h-4 w-4 mx-auto mb-1 text-muted-foreground" />
            <div className="text-sm font-bold">{formatCurrency(synergy.totalRepairCost)}</div>
            <div className="text-[10px] text-muted-foreground">Wartungskosten</div>
          </div>
          <div className="rounded-lg p-3 text-center bg-profit/10 border border-profit/20">
            <Users className="h-4 w-4 mx-auto mb-1 text-profit" />
            <div className="text-lg font-bold text-profit">{synergy.activeTenants}</div>
            <div className="text-[10px] text-muted-foreground">Aktive Mieter</div>
          </div>
        </div>
      )}

      {/* Expense Pie Chart */}
      <ExpensePieChart
        monthlyRent={property.monthlyRent}
        monthlyCreditRate={property.monthlyCreditRate}
        monthlyExpenses={property.monthlyExpenses}
        monthlyCashflow={property.monthlyCashflow}
      />

      {/* Benchmark */}
      <PropertyBenchmark propertyId={property.id} />

      {/* Value History */}
      <PropertyValueHistory propertyId={property.id} currentValue={property.currentValue} purchasePrice={property.purchasePrice} />

      {/* Rent increase calculator + Maintenance */}
      <div className="flex items-center gap-2 flex-wrap">
        <RentIncreaseCalculator currentRent={property.monthlyRent} propertyName={property.name} />
      </div>

      {/* Maintenance Planner */}
      <MaintenancePlanner propertyId={property.id} />

      {/* Insurance Tracker */}
      <InsuranceTracker propertyId={property.id} />

      {/* Meter Management */}
      <MeterManagement propertyId={property.id} />

      {/* Document Expiry Tracker */}
      <DocumentExpiryTracker propertyId={property.id} />

      {/* Activity Timeline */}
      <ActivityTimeline propertyId={property.id} />

      {/* Tenants */}
      <TenantManagement propertyId={property.id} propertyName={property.name} propertyAddress={property.address} onTenantsChanged={() => setTenantVersion(v => v + 1)} />

      {/* Messages */}
      <div ref={el => { sectionRefs.current["messages"] = el; }}>
        <MessageCenter propertyId={property.id} key={`msg-${tenantVersion}`} />
      </div>

      {/* Tickets */}
      <div ref={el => { sectionRefs.current["tickets"] = el; }}>
        <LandlordTickets propertyId={property.id} />
      </div>

      {/* Payments */}
      <div ref={el => { sectionRefs.current["payments"] = el; }}>
        <LandlordPayments propertyId={property.id} />
      </div>

      {/* Notes */}
      <div ref={el => { sectionRefs.current["notes"] = el; }}>
        <PropertyNotes propertyId={property.id} />
      </div>

      {/* Documents */}
      <div ref={el => { sectionRefs.current["documents"] = el; }}>
        <PropertyDocuments propertyId={property.id} />
      </div>
    </div>
  );
};

export default PropertyDetail;
