import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { ThemeProvider } from "@/hooks/useTheme";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import { PropertyProvider } from "@/context/PropertyContext";
import AppLayout from "@/components/AppLayout";
import ScrollToTop from "@/components/ScrollToTop";
import PageTransition from "@/components/PageTransition";
import React, { lazy, Suspense, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import ErrorBoundary from "@/components/ErrorBoundary";
import { ConfigErrorScreen } from "@/components/ConfigErrorScreen";
import { isSupabaseConfigured } from "@/integrations/supabase/client";
import { CommandPalette } from "@/components/CommandPalette";
import { ErrorInterceptor } from "@/components/ErrorScanner";
import { AccessibilityProvider } from "@/components/AccessibilityProvider";
import { useBackgroundSync } from "@/hooks/useOfflineCache";
import { queryKeys } from "@/lib/queryKeys";
import { KeyboardShortcutOverlay } from "@/components/KeyboardShortcutOverlay";
import { useStaleDataWarning } from "@/hooks/useStaleDataWarning";
import { PrivacyProvider } from "@/components/PrivacyMode";
import { OnboardingTour } from "@/components/OnboardingTour";
import { NotificationPreferencesProvider } from "@/context/NotificationPreferencesContext";
import { MobileImprovementsProvider } from "@/components/mobile/MobileImprovementsProvider";

import { ROUTES } from "@/lib/routes";

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
const passwordResetImport = () => import("@/pages/PasswordReset");
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
const dokumenteImport = () => import("@/pages/Dokumente");
const wartungsplanerImport = () => import("@/pages/Wartungsplaner");
const hockeyStickImport = () => import("@/pages/HockeyStickPage");
const newstickerImport = () => import("@/pages/Newsticker");
const bewertungImport = () => import("@/pages/ImmobilienBewertung");
const objekteListImport = () => import("@/pages/ObjekteList");
const besichtigungenImport = () => import("@/pages/Besichtigungen");
const finanzierungsCockpitImport = () => import("@/pages/FinanzierungsCockpit");

const Dashboard = lazy(dashboardImport);
const PropertyDetail = lazy(propertyDetailImport);
const AnalysisCalculator = lazy(analysisImport);
const Auth = lazy(authImport);
const Settings = lazy(settingsImport);
const Contacts = lazy(contactsImport);
const TenantPortal = lazy(tenantPortalImport);
const HandworkerPortal = lazy(handworkerPortalImport);
const Einladung = lazy(einladungImport);
const PasswordReset = lazy(passwordResetImport);
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
const Dokumente = lazy(dokumenteImport);
const Wartungsplaner = lazy(wartungsplanerImport);
const HockeyStickPage = lazy(hockeyStickImport);
const Newsticker = lazy(newstickerImport);
const ImmobilienBewertung = lazy(bewertungImport);
const ObjekteList = lazy(objekteListImport);
const Besichtigungen = lazy(besichtigungenImport);
const FinanzierungsCockpit = lazy(finanzierungsCockpitImport);

/* BUG-6: Fix double-loading when switching tabs — preload all lazy routes eagerly after initial render
   so that subsequent tab switches render instantly from cache without triggering a second Suspense fallback */
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
  dokumenteImport();
  wartungsplanerImport();
  hockeyStickImport();
  newstickerImport();
  bewertungImport();
  objekteListImport();
  besichtigungenImport();
  finanzierungsCockpitImport();
  onboardingImport();
};

const PageLoader = () => (
  <div className="min-h-screen bg-background flex items-center justify-center" role="status" aria-live="polite" aria-label="Seite wird geladen">
    <div className="animate-pulse text-muted-foreground">Laden...</div>
  </div>
);

/* #7: React Query with exponential backoff retry logic
   #20: refetchOnWindowFocus enabled for stale-data awareness */
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,
      gcTime: 10 * 60_000,
      refetchOnWindowFocus: true,
      refetchOnReconnect: true,
      retry: 3,
      retryDelay: (attemptIndex) => Math.min(1000 * Math.pow(2, attemptIndex), 30_000),
    },
    mutations: {
      retry: 0,
    },
  },
});

/* IMP-5: Configure staleTime per entity type — slow-changing data stays fresh longer */
queryClient.setQueryDefaults(queryKeys.properties.all, { staleTime: 5 * 60_000 });
queryClient.setQueryDefaults(queryKeys.loans.all, { staleTime: 5 * 60_000 });
queryClient.setQueryDefaults(queryKeys.contacts.all, { staleTime: 3 * 60_000 });
queryClient.setQueryDefaults(queryKeys.deals.all, { staleTime: 2 * 60_000 });
queryClient.setQueryDefaults(queryKeys.forecast.all, { staleTime: 5 * 60_000 });
/* FUND-14: Add missing query defaults for todos and maintenance — prevents over-fetching */
queryClient.setQueryDefaults(queryKeys.todos.base, { staleTime: 60_000 });
queryClient.setQueryDefaults(queryKeys.maintenance.all, { staleTime: 5 * 60_000 });
queryClient.setQueryDefaults(queryKeys.maintenance.allList, { staleTime: 5 * 60_000 });
queryClient.setQueryDefaults(["documents"], { staleTime: 2 * 60_000 });
queryClient.setQueryDefaults(["tickets"], { staleTime: 2 * 60_000 });
queryClient.setQueryDefaults(queryKeys.viewings.all, { staleTime: 2 * 60_000 });

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center" role="status" aria-live="polite" aria-label="Laden">
        <div className="animate-pulse text-muted-foreground">Laden...</div>
      </div>
    );
  }
  if (!user) {
    try { sessionStorage.setItem("immocontrol_return_url", window.location.pathname + window.location.search); } catch { /* ignore */ }
    return <Navigate to={ROUTES.AUTH} replace />;
  }
  return <>{children}</>;
};

const RoleRouter = () => {
  const { user, loading } = useAuth();
  const { pathname } = useLocation();
  const [role, setRole] = useState<string | null>(null);
  const [roleLoading, setRoleLoading] = useState(true);
  const [onboardingDone, setOnboardingDone] = useState<boolean | null>(null);

  /* OFFLINE-5: Activate background sync for offline mutations */
  useBackgroundSync();

  /* #20: Show stale-data warning when tab regains focus after inactivity */
  useStaleDataWarning();

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
        /* FIX-36: Replace `as any` with proper typed cast */
        setOnboardingDone((data as { onboarding_completed?: boolean } | null)?.onboarding_completed ?? false);
      } catch {
        setOnboardingDone(true);
      }
    };
    checkOnboarding();
  }, [user]);

  /* BUG-6: Preload routes on demand — delay 3s to prioritise initial paint, then preload likely next routes */
  useEffect(() => {
    const timer = setTimeout(preloadRoutes, 3000);
    return () => clearTimeout(timer);
  }, []);

  if (loading || roleLoading || onboardingDone === null) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center" role="status" aria-live="polite" aria-label="Laden">
        <div className="animate-pulse text-muted-foreground">Laden...</div>
      </div>
    );
  }

  if (!user) return <Navigate to={ROUTES.AUTH} replace />;

  /* When onboarding not done: redirect to onboarding only if not already there,
     so that the Route for ONBOARDING can render; otherwise we’d only redirect and never show the page. */
  if (!onboardingDone && pathname !== ROUTES.ONBOARDING) {
    return <Navigate to={ROUTES.ONBOARDING} replace />;
  }

  if (role === "tenant") {
    return <Navigate to={ROUTES.TENANT_PORTAL} replace />;
  }

  if (role === "handworker") {
    return <Navigate to={ROUTES.HANDWORKER_PORTAL} replace />;
  }

  /* Default page redirect: if user has configured a default page and is on "/",
     redirect to that page instead. Placed AFTER tenant/handworker checks so
     those users always see their portals regardless of localStorage state. */
  const defaultPage = (() => {
    try { return localStorage.getItem("immocontrol_default_page"); } catch { return null; }
  })();
  if (defaultPage && defaultPage !== "/" && window.location.pathname === "/") {
    return <Navigate to={defaultPage} replace />;
  }

  return (
    <AppLayout>
      <PageTransition>
        <Routes>
          <Route path={ROUTES.ONBOARDING} element={<ErrorBoundary><Onboarding /></ErrorBoundary>} />
          <Route path={`${ROUTES.TENANT_PORTAL}/*`} element={<ErrorBoundary><TenantPortal /></ErrorBoundary>} />
          <Route path={`${ROUTES.HANDWORKER_PORTAL}/*`} element={<ErrorBoundary><HandworkerPortal /></ErrorBoundary>} />
          <Route path={ROUTES.HOME} element={<ErrorBoundary><Dashboard /></ErrorBoundary>} />
          <Route path={ROUTES.PERSONAL_DASHBOARD} element={<ErrorBoundary><Dashboard mode="personal" /></ErrorBoundary>} />
          <Route path={ROUTES.OBJEKTE} element={<ErrorBoundary><ObjekteList /></ErrorBoundary>} />
          <Route path={`${ROUTES.PROPERTY}/:id`} element={<ErrorBoundary><PropertyDetail /></ErrorBoundary>} />
          <Route path={ROUTES.FINANZIERUNG} element={<ErrorBoundary><FinanzierungsCockpit /></ErrorBoundary>} />
          <Route path={ROUTES.LOANS} element={<ErrorBoundary><Loans /></ErrorBoundary>} />
          <Route path={ROUTES.FORECAST} element={<ErrorBoundary><CashForecast /></ErrorBoundary>} />
          <Route path={ROUTES.ANALYSE} element={<ErrorBoundary><AnalysisCalculator /></ErrorBoundary>} />
          <Route path={ROUTES.CONTACTS} element={<ErrorBoundary><Contacts /></ErrorBoundary>} />
          <Route path={ROUTES.TODOS} element={<ErrorBoundary><Todos /></ErrorBoundary>} />
          <Route path={ROUTES.NK} element={<ErrorBoundary><Nebenkosten /></ErrorBoundary>} />
          <Route path={ROUTES.REPORTS} element={<ErrorBoundary><Berichte /></ErrorBoundary>} />
          <Route path={ROUTES.RENT} element={<ErrorBoundary><Mietuebersicht /></ErrorBoundary>} />
          <Route path={ROUTES.AI} element={<ErrorBoundary><ImmoAI /></ErrorBoundary>} />
          <Route path={ROUTES.CONTRACTS} element={<ErrorBoundary><Vertraege /></ErrorBoundary>} />
          <Route path={ROUTES.CRM} element={<ErrorBoundary><CRM /></ErrorBoundary>} />
          <Route path={ROUTES.DEALS} element={<ErrorBoundary><Deals /></ErrorBoundary>} />
          <Route path={ROUTES.BESICHTIGUNGEN} element={<ErrorBoundary><Besichtigungen /></ErrorBoundary>} />
          <Route path={ROUTES.DOKUMENTE} element={<ErrorBoundary><Dokumente /></ErrorBoundary>} />
          <Route path={ROUTES.WARTUNG} element={<ErrorBoundary><Wartungsplaner /></ErrorBoundary>} />
          <Route path={ROUTES.HOCKEY_STICK} element={<ErrorBoundary><HockeyStickPage /></ErrorBoundary>} />
          <Route path={ROUTES.NEWSTICKER} element={<ErrorBoundary><Newsticker /></ErrorBoundary>} />
          <Route path={ROUTES.BEWERTUNG} element={<ErrorBoundary><ImmobilienBewertung /></ErrorBoundary>} />
          <Route path={ROUTES.SETTINGS} element={<ErrorBoundary><Settings /></ErrorBoundary>} />
          <Route path="*" element={<ErrorBoundary><NotFound /></ErrorBoundary>} />
        </Routes>
      </PageTransition>
    </AppLayout>
  );
};

/* Error capture unified: ErrorInterceptor (ErrorScanner) handles error/unhandledrejection
   and forwards to trackError. Single source of truth, no duplicate listeners. */

const App = () => {

  if (!isSupabaseConfigured()) {
    return (
      <ThemeProvider defaultTheme="dark">
        <ConfigErrorScreen />
      </ThemeProvider>
    );
  }

  return (
    <ThemeProvider defaultTheme="dark">
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <PropertyProvider>
            <NotificationPreferencesProvider>
            <AccessibilityProvider>
            <PrivacyProvider>
            {/* MOB-IMPROVE: Global mobile improvements provider */}
            <MobileImprovementsProvider>
            {/* UI-UPDATE-1: 1s tooltip delay on all action icons */}
            <TooltipProvider delayDuration={1000}>
              <Toaster />
              <ErrorInterceptor />
              <BrowserRouter>
                <ScrollToTop />
                <CommandPalette />
                  <KeyboardShortcutOverlay />
                  <OnboardingTour />
                  <ErrorBoundary>
                  <Suspense fallback={<PageLoader />}>
                    <Routes>
                      <Route path={ROUTES.AUTH} element={<Auth />} />
                      <Route path={ROUTES.INVITATION} element={<Einladung />} />
                      <Route path={ROUTES.PASSWORD_RESET} element={<PasswordReset />} />
                      <Route path="/*" element={<RoleRouter />} />
                    </Routes>
                  </Suspense>
                </ErrorBoundary>
              </BrowserRouter>
            </TooltipProvider>
            </MobileImprovementsProvider>
            </PrivacyProvider>
            </AccessibilityProvider>
            </NotificationPreferencesProvider>
          </PropertyProvider>
        </AuthProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
};

export default App;
