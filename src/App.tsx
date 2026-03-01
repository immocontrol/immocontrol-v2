import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { ThemeProvider } from "@/hooks/useTheme";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import { PropertyProvider } from "@/context/PropertyContext";
import AppLayout from "@/components/AppLayout";
import ScrollToTop from "@/components/ScrollToTop";
import PageTransition from "@/components/PageTransition";
import React, { lazy, Suspense, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import ErrorBoundary from "@/components/ErrorBoundary";
import { CommandPalette } from "@/components/CommandPalette";

/* OPT-40: Route path constants */
const ROUTES = {
  HOME: "/",
  AUTH: "/auth",
  ONBOARDING: "/onboarding",
  SETTINGS: "/einstellungen",
  CONTACTS: "/kontakte",
  TODOS: "/aufgaben",
  LOANS: "/darlehen",
  DEALS: "/deals",
  CRM: "/crm",
  REPORTS: "/berichte",
  RENT: "/mietuebersicht",
  CONTRACTS: "/vertraege",
  FORECAST: "/forecast",
  AI: "/immo-ai",
  NK: "/nebenkosten",
  ANALYSE: "/analyse",
  PROPERTY: "/objekt",
  INVITATION: "/einladung",
} as const;

/* OPT-41: App version constant */
const APP_VERSION = "2.0.0";

/* OPT-42: Feature flags for gradual rollout */
const FEATURES = {
  AI_CHAT: true,
  CRM_SEARCH: true,
  BUILDING_ESTIMATION: true,
  SOFT_DELETE: true,
  DARK_MODE: true,
} as const;

// Lazy imports with preloading
const dashboardImport = () => import("@/pages/Dashboard");
const propertyDetailImport = () => import("@/pages/PropertyDetail");
const analysisImport = () => import("@/pages/AnalysisCalculator");
const authImport = () => import("@/pages/Auth");
const settingsImport = () => import("@/pages/Settings");
const contactsImport = () => import("@/pages/Contacts");
const tenantPortalImport = () => import("@/pages/TenantPortal");
const handworkerPortalImport = () => import("@/pages/HandworkerPortal");
const einladungImport = () => import("@/pages/Einladung");
const notFoundImport = () => import("@/pages/NotFound");
const loansImport = () => import("@/pages/Loans");
const cashForecastImport = () => import("@/pages/CashForecast");
const todosImport = () => import("@/pages/Todos");
const onboardingImport = () => import("@/pages/Onboarding");
const nebenkostenImport = () => import("@/pages/Nebenkosten");
const berichteImport = () => import("@/pages/Berichte");
const mietuebersichtImport = () => import("@/pages/Mietuebersicht");
const immoAIImport = () => import("@/pages/ImmoAI");
const vertraegeImport = () => import("@/pages/Vertraege");
const crmImport = () => import("@/pages/CRM");
const dealsImport = () => import("@/pages/Deals");

const Dashboard = lazy(dashboardImport);
const PropertyDetail = lazy(propertyDetailImport);
const AnalysisCalculator = lazy(analysisImport);
const Auth = lazy(authImport);
const Settings = lazy(settingsImport);
const Contacts = lazy(contactsImport);
const TenantPortal = lazy(tenantPortalImport);
const HandworkerPortal = lazy(handworkerPortalImport);
const Einladung = lazy(einladungImport);
const NotFound = lazy(notFoundImport);
const Loans = lazy(loansImport);
const CashForecast = lazy(cashForecastImport);
const Todos = lazy(todosImport);
const Onboarding = lazy(onboardingImport);
const Nebenkosten = lazy(nebenkostenImport);
const Berichte = lazy(berichteImport);
const Mietuebersicht = lazy(mietuebersichtImport);
const ImmoAI = lazy(immoAIImport);
const Vertraege = lazy(vertraegeImport);
const CRM = lazy(crmImport);
const Deals = lazy(dealsImport);

// Preload all routes after initial render to eliminate loading on tab switch
const preloadRoutes = () => {
  dashboardImport();
  propertyDetailImport();
  analysisImport();
  settingsImport();
  contactsImport();
  loansImport();
  cashForecastImport();
  todosImport();
  notFoundImport();
  nebenkostenImport();
  berichteImport();
  mietuebersichtImport();
  vertraegeImport();
  crmImport();
  dealsImport();
};

const PageLoader = () => (
  <div className="min-h-screen bg-background flex items-center justify-center">
    <div className="animate-pulse text-muted-foreground">Laden...</div>
  </div>
);

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,
      gcTime: 10 * 60_000,
      refetchOnWindowFocus: false,
      refetchOnReconnect: true,
      retry: 1,
    },
    mutations: {
      retry: 0,
    },
  },
});

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Laden...</div>
      </div>
    );
  }
  if (!user) return <Navigate to={ROUTES.AUTH} replace />;
  return <>{children}</>;
};

const RoleRouter = () => {
  const { user, loading } = useAuth();
  const [role, setRole] = useState<string | null>(null);
  const [roleLoading, setRoleLoading] = useState(true);
  const [onboardingDone, setOnboardingDone] = useState<boolean | null>(null);

  useEffect(() => {
    const fetchRole = async () => {
      if (!user) {
        setRoleLoading(false);
        return;
      }
      try {
        const { data } = await supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", user.id)
          .maybeSingle();
        setRole(data?.role ?? "landlord");
      } catch {
        setRole("landlord");
      } finally {
        setRoleLoading(false);
      }
    };
    fetchRole();
  }, [user]);

  useEffect(() => {
    const checkOnboarding = async () => {
      if (!user) {
        setOnboardingDone(true);
        return;
      }
      try {
        const { data } = await supabase
          .from("profiles")
          .select("onboarding_completed")
          .eq("user_id", user.id)
          .maybeSingle();
        setOnboardingDone((data as any)?.onboarding_completed ?? false);
      } catch {
        setOnboardingDone(true);
      }
    };
    checkOnboarding();
  }, [user]);

  // Preload all routes eagerly
  useEffect(() => {
    preloadRoutes();
  }, []);

  if (loading || roleLoading || onboardingDone === null) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Laden...</div>
      </div>
    );
  }

  if (!user) return <Navigate to={ROUTES.AUTH} replace />;

  // Show onboarding if not completed
  if (!onboardingDone) {
    return <Onboarding />;
  }

  // Tenant portal
  if (role === "tenant") {
    return <TenantPortal />;
  }

  // Handworker portal
  if (role === "handworker") {
    return <HandworkerPortal />;
  }

  return (
    <AppLayout>
      <PageTransition>
        <Routes>
          <Route path={ROUTES.HOME} element={<Dashboard />} />
          <Route path={`${ROUTES.PROPERTY}/:id`} element={<PropertyDetail />} />
          <Route path={ROUTES.LOANS} element={<Loans />} />
          <Route path={ROUTES.FORECAST} element={<CashForecast />} />
          <Route path={ROUTES.ANALYSE} element={<AnalysisCalculator />} />
          <Route path={ROUTES.CONTACTS} element={<Contacts />} />
          <Route path={ROUTES.TODOS} element={<Todos />} />
          <Route path={ROUTES.NK} element={<Nebenkosten />} />
          <Route path={ROUTES.REPORTS} element={<Berichte />} />
          <Route path={ROUTES.RENT} element={<Mietuebersicht />} />
          <Route path={ROUTES.AI} element={<ImmoAI />} />
          <Route path={ROUTES.CONTRACTS} element={<Vertraege />} />
          <Route path={ROUTES.CRM} element={<CRM />} />
          <Route path={ROUTES.DEALS} element={<Deals />} />
          <Route path={ROUTES.SETTINGS} element={<Settings />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </PageTransition>
    </AppLayout>
  );
};

const App = () => {
  React.useEffect(() => {
    const handler = (e: PromiseRejectionEvent) => {
      console.error("Unhandled rejection:", e.reason);
      e.preventDefault();
    };
    window.addEventListener("unhandledrejection", handler);
    return () => window.removeEventListener("unhandledrejection", handler);
  }, []);

  return (
    <ThemeProvider defaultTheme="dark">
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <PropertyProvider>
            <TooltipProvider delayDuration={1500}>
              <Toaster />
              <Sonner />
              <BrowserRouter>
                <ScrollToTop />
                <CommandPalette />
                <ErrorBoundary>
                  <Suspense fallback={<PageLoader />}>
                    <Routes>
                      <Route path={ROUTES.AUTH} element={<Auth />} />
                      <Route path={ROUTES.INVITATION} element={<Einladung />} />
                      <Route path="/*" element={<RoleRouter />} />
                    </Routes>
                  </Suspense>
                </ErrorBoundary>
              </BrowserRouter>
            </TooltipProvider>
          </PropertyProvider>
        </AuthProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
};

export default App;
