import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Wrench, LogOut, ClipboardList, User, CheckCircle2, Clock, AlertTriangle, BarChart3, Euro, Building2, Phone, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toastSuccess } from "@/lib/toastMessages";
import { HandworkerTickets } from "@/components/TicketSystem";
import { formatCurrency } from "@/lib/formatters";

type Tab = "dashboard" | "tickets" | "profile";

interface TicketSummary {
  open: number;
  inProgress: number;
  resolved: number;
  totalCost: number;
  avgResolutionDays: number;
}

const HandworkerPortal = () => {
  const { user, signOut } = useAuth();
  const [activeTab, setActiveTab] = useState<Tab>("dashboard");
  const [profile, setProfile] = useState<{ display_name: string | null } | null>(null);
  const [stats, setStats] = useState<TicketSummary>({ open: 0, inProgress: 0, resolved: 0, totalCost: 0, avgResolutionDays: 0 });
  const [propertyCount, setPropertyCount] = useState(0);
  const [categoryBreakdown, setCategoryBreakdown] = useState<Record<string, number>>({});

  useEffect(() => {
    const prev = document.title;
    document.title = "Handwerkerportal – ImmoControl";
    return () => { document.title = prev; };
  }, []);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("profiles")
      .select("display_name")
      .eq("user_id", user.id)
      .single()
      .then(({ data }) => { if (data) setProfile(data); });

    // Fetch ticket statistics
    supabase
      .from("tickets")
      .select("id, status, actual_cost, created_at, updated_at, category, priority, property_id, properties:property_id(name, address)")
      .eq("assigned_to_user_id", user.id)
      .then(({ data }) => {
        if (!data) return;
        const resolved = data.filter(t => t.status === "resolved" || t.status === "closed");
        const totalCost = resolved.reduce((s, t) => s + Number(t.actual_cost || 0), 0);
        const avgDays = resolved.length > 0
          ? resolved.reduce((s, t) => {
              const created = new Date(t.created_at).getTime();
              const updated = new Date(t.updated_at).getTime();
              return s + (updated - created) / (1000 * 60 * 60 * 24);
            }, 0) / resolved.length
          : 0;
        setStats({
          open: data.filter(t => t.status === "open").length,
          inProgress: data.filter(t => t.status === "in_progress").length,
          resolved: resolved.length,
          totalCost,
          avgResolutionDays: Math.round(avgDays),
        });
        // Synergy 9: Count unique properties
        const propertySet = new Set(data.map(t => t.property_id));
        setPropertyCount(propertySet.size);
        // Synergy 10: Category breakdown
        const cats: Record<string, number> = {};
        data.filter(t => t.status === "open" || t.status === "in_progress").forEach(t => {
          cats[t.category] = (cats[t.category] || 0) + 1;
        });
        setCategoryBreakdown(cats);
      });
  }, [user]);

  const displayName = profile?.display_name || user?.email || "Handwerker";
  const totalTickets = stats.open + stats.inProgress + stats.resolved;
  // Improvement 11: Completion rate
  const completionRate = totalTickets > 0 ? Math.round((stats.resolved / totalTickets) * 100) : 0;

  const tabs: { key: Tab; label: string; icon: typeof ClipboardList }[] = [
    { key: "dashboard", label: "Übersicht", icon: BarChart3 },
    { key: "tickets", label: "Aufträge", icon: ClipboardList },
    { key: "profile", label: "Profil", icon: User },
  ];

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-border bg-background/80 backdrop-blur-xl">
        <div className="container flex h-14 items-center justify-between">
          <div className="flex items-center gap-2">
            <Wrench className="h-6 w-6 text-primary" />
            <span className="text-lg font-bold tracking-tight">Handwerkerportal</span>
            {/* Improvement 11: Completion badge */}
            {totalTickets > 0 && (
              <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${completionRate >= 70 ? "bg-profit/15 text-profit" : completionRate >= 40 ? "bg-gold/15 text-gold" : "bg-secondary text-muted-foreground"}`}>
                {completionRate}% ✓
              </span>
            )}
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm text-muted-foreground hidden sm:block">{displayName}</span>
            <Button variant="ghost" size="icon" aria-label="Abmelden" onClick={() => { signOut(); toastSuccess("Abgemeldet"); }}>
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>

      {/* Tab Navigation */}
      <div className="border-b border-border bg-background/50">
        <div className="container">
          <nav className="flex gap-1 overflow-x-auto py-1 scrollbar-hide">
            {tabs.map(t => (
              <button
                key={t.key}
                onClick={() => setActiveTab(t.key)}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
                  activeTab === t.key ? "bg-primary/10 text-primary" : "text-muted-foreground hover:text-foreground hover:bg-secondary"
                }`}
              >
                <t.icon className="h-4 w-4" />
                {t.label}
                {t.key === "tickets" && stats.open + stats.inProgress > 0 && (
                  <span className="text-[10px] bg-gold/15 text-gold px-1.5 py-0.5 rounded-full font-bold">
                    {stats.open + stats.inProgress}
                  </span>
                )}
              </button>
            ))}
          </nav>
        </div>
      </div>

      <main className="flex-1 container py-6 max-w-3xl pb-24 md:pb-6">
        {/* DASHBOARD TAB */}
        {activeTab === "dashboard" && (
          <div className="space-y-4">
            {/* Welcome */}
            <div className="gradient-card rounded-xl border border-border p-5 animate-fade-in">
              <h2 className="text-lg font-bold mb-1">Hallo, {displayName}! 🔧</h2>
              <p className="text-sm text-muted-foreground">
                Deine Auftragsübersicht auf einen Blick.
              </p>
            </div>

            {/* Urgent tickets alert */}
            {stats.open > 0 && (
              <div className="bg-gold/10 border border-gold/20 rounded-xl p-4 flex items-center gap-3 animate-fade-in [animation-delay:25ms]">
                <AlertTriangle className="h-5 w-5 text-gold shrink-0" />
                <div className="flex-1">
                  <div className="text-sm font-semibold text-gold">{stats.open} neue(r) Auftrag/Aufträge</div>
                  <div className="text-xs text-gold/80">Warten auf Bearbeitung</div>
                </div>
                <Button size="sm" variant="outline" className="shrink-0 text-xs border-gold/30 text-gold hover:bg-gold/10" onClick={() => setActiveTab("tickets")}>
                  Ansehen
                </Button>
              </div>
            )}

            {/* Stats grid */}
            <div className="grid grid-cols-2 gap-3">
              <div className="gradient-card rounded-xl border border-border p-4 animate-fade-in [animation-delay:50ms]">
                <div className="flex items-center gap-2 mb-1">
                  <Clock className="h-4 w-4 text-gold" />
                  <span className="text-xs text-muted-foreground">Offen</span>
                </div>
                <div className="text-2xl font-bold text-gold">{stats.open}</div>
                <div className="text-xs text-muted-foreground">Aufträge</div>
              </div>
              <div               className="gradient-card rounded-xl border border-border p-4 animate-fade-in [animation-delay:100ms]">
                              <div className="flex items-center gap-2 mb-1">
                                <Wrench className="h-4 w-4 text-primary" />
                  <span className="text-xs text-muted-foreground">In Bearbeitung</span>
                </div>
                <div className="text-2xl font-bold text-primary">{stats.inProgress}</div>
                <div className="text-xs text-muted-foreground">Aufträge</div>
              </div>
              <div className="gradient-card rounded-xl border border-border p-4 animate-fade-in [animation-delay:150ms]">
                <div className="flex items-center gap-2 mb-1">
                  <CheckCircle2 className="h-4 w-4 text-profit" />
                  <span className="text-xs text-muted-foreground">Erledigt</span>
                </div>
                <div className="text-2xl font-bold text-profit">{stats.resolved}</div>
                <div className="text-xs text-muted-foreground">Aufträge</div>
              </div>
              <div className="gradient-card rounded-xl border border-border p-4 animate-fade-in [animation-delay:200ms]">
                <div className="flex items-center gap-2 mb-1">
                  <Euro className="h-4 w-4 text-muted-foreground" />
                  <span className="text-xs text-muted-foreground">Umsatz</span>
                </div>
                <div className="text-2xl font-bold">{formatCurrency(stats.totalCost)}</div>
                <div className="text-xs text-muted-foreground">Gesamtkosten</div>
              </div>
            </div>

            {/* Performance */}
            {totalTickets > 0 && (
              <div               className="gradient-card rounded-xl border border-border p-5 animate-fade-in [animation-delay:250ms]">
                              <h3 className="text-sm font-semibold mb-3">Performance</h3>
                <div className="space-y-3">
                  <div>
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="text-muted-foreground">Erledigungsrate</span>
                      <span className="font-medium">{totalTickets > 0 ? Math.round((stats.resolved / totalTickets) * 100) : 0}%</span>
                    </div>
                    <div className="h-2 bg-secondary rounded-full overflow-hidden">
                      <div
                        className="h-full bg-profit rounded-full transition-all duration-1000"
                        style={{ width: `${totalTickets > 0 ? (stats.resolved / totalTickets) * 100 : 0}%` }}
                      />
                    </div>
                  </div>
                  {stats.avgResolutionDays > 0 && (
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">Ø Bearbeitungszeit</span>
                      <span className="font-medium">{stats.avgResolutionDays} Tage</span>
                    </div>
                  )}
                  {stats.resolved > 0 && stats.totalCost > 0 && (
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">Ø Kosten pro Auftrag</span>
                      <span className="font-medium">{formatCurrency(stats.totalCost / stats.resolved)}</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Synergy 9: Property count */}
            {propertyCount > 0 && (
              <div className="gradient-card rounded-xl border border-border p-4 flex items-center gap-3 animate-fade-in [animation-delay:275ms]">
                <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                  <Building2 className="h-4 w-4 text-primary" />
                </div>
                <div className="flex-1">
                  <div className="text-sm font-semibold">{propertyCount} Objekt(e)</div>
                  <div className="text-xs text-muted-foreground">Aufträge aus verschiedenen Immobilien</div>
                </div>
              </div>
            )}

            {/* Synergy 10: Category breakdown */}
            {Object.keys(categoryBreakdown).length > 0 && (
              <div               className="gradient-card rounded-xl border border-border p-5 animate-fade-in [animation-delay:300ms]">
                              <h3 className="text-sm font-semibold mb-3">Offene Aufträge nach Typ</h3>
                <div className="flex flex-wrap gap-2">
                  {Object.entries(categoryBreakdown).map(([cat, count]) => {
                    const icons: Record<string, string> = { repair: "🔧", damage: "⚠️", maintenance: "🛠️", question: "❓", other: "📋" };
                    return (
                      <div key={cat} className="flex items-center gap-1.5 bg-secondary/50 rounded-lg px-3 py-2">
                        <span className="text-sm">{icons[cat] || "📋"}</span>
                        <span className="text-xs font-medium">{count}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Quick action */}
            <button
              onClick={() => setActiveTab("tickets")}
                            className="w-full gradient-card rounded-xl border border-border p-4 flex items-center gap-3 hover:border-primary/30 transition-colors animate-fade-in [animation-delay:350ms]"
            >
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                <ClipboardList className="h-5 w-5 text-primary" />
              </div>
              <div className="flex-1 text-left">
                <div className="text-sm font-semibold">Alle Aufträge anzeigen</div>
                <div className="text-xs text-muted-foreground">{totalTickets} Aufträge insgesamt</div>
              </div>
            </button>
          </div>
        )}

        {/* TICKETS TAB */}
        {activeTab === "tickets" && <HandworkerTickets />}

        {/* PROFILE TAB */}
        {activeTab === "profile" && (
          <div className="space-y-4">
            <div className="gradient-card rounded-xl border border-border p-5 animate-fade-in">
              <h2 className="text-sm font-semibold mb-4 flex items-center gap-2">
                <User className="h-4 w-4 text-muted-foreground" /> Mein Profil
              </h2>
              <div className="flex items-center gap-4 mb-4">
                <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center text-xl font-bold text-primary">
                  <Wrench className="h-8 w-8" />
                </div>
                <div>
                  <h3 className="text-lg font-bold">{displayName}</h3>
                  <p className="text-sm text-muted-foreground">Handwerker</p>
                  {user?.email && <p className="text-xs text-muted-foreground">{user.email}</p>}
                </div>
              </div>

              {/* Performance summary */}
              {totalTickets > 0 && (
                <div className="border-t border-border pt-4 mt-4">
                  <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Statistiken</h4>
                  <div className="grid grid-cols-3 gap-3 text-center">
                    <div>
                      <div className="text-lg font-bold">{totalTickets}</div>
                      <div className="text-[10px] text-muted-foreground">Aufträge gesamt</div>
                    </div>
                    <div>
                      <div className="text-lg font-bold text-profit">{stats.resolved}</div>
                      <div className="text-[10px] text-muted-foreground">Erledigt</div>
                    </div>
                    <div>
                      <div className="text-lg font-bold">{formatCurrency(stats.totalCost)}</div>
                      <div className="text-[10px] text-muted-foreground">Umsatz</div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div             className="gradient-card rounded-xl border border-border p-5 animate-fade-in [animation-delay:100ms]">
                          <div className="flex items-center justify-between">
                            <div>
                              <h2 className="text-sm font-semibold">Abmelden</h2>
                  <p className="text-xs text-muted-foreground mt-0.5">Vom Handwerkerportal abmelden</p>
                </div>
                <Button variant="destructive" size="sm" onClick={() => { signOut(); toastSuccess("Abgemeldet"); }}>
                  <LogOut className="h-4 w-4 mr-1.5" /> Abmelden
                </Button>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Mobile bottom nav */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-background/90 backdrop-blur-xl md:hidden safe-area-bottom">
        <div className="flex items-center justify-around py-2 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
          {tabs.map((t) => (
            <button
              key={t.key}
              onClick={() => setActiveTab(t.key)}
              className={`flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors relative ${
                activeTab === t.key ? "text-primary" : "text-muted-foreground"
              }`}
            >
              <t.icon className="h-5 w-5" />
              <span className="text-[10px]">{t.label}</span>
              {t.key === "tickets" && stats.open + stats.inProgress > 0 && (
                <span className="absolute -top-0.5 right-0.5 text-[8px] bg-gold text-white px-1 py-0.5 rounded-full font-bold min-w-[14px] text-center">
                  {stats.open + stats.inProgress}
                </span>
              )}
            </button>
          ))}
        </div>
      </nav>
    </div>
  );
};

export default HandworkerPortal;
