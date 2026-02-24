import { ReactNode, useState, useEffect, useCallback } from "react";
import { useLocation, Link, useParams, useNavigate } from "react-router-dom";
import { LayoutDashboard, Calculator, Building2, LogOut, Settings, Users, Command, Landmark, CalendarDays, CheckSquare } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useProperties } from "@/context/PropertyContext";
import { NotificationBell } from "@/components/NotificationBell";
import BackToTop from "@/components/BackToTop";
import ScrollProgress from "@/components/ScrollProgress";
import KeyboardShortcuts from "@/components/KeyboardShortcuts";
import GlobalQuickTodo from "@/components/GlobalQuickTodo";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { toast } from "sonner";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

const navItems = [
  { path: "/", label: "Portfolio", icon: LayoutDashboard, shortcut: "1" },
  { path: "/darlehen", label: "Darlehen", icon: Landmark, shortcut: "2" },
  { path: "/forecast", label: "Forecast", icon: CalendarDays, shortcut: "3" },
  { path: "/kontakte", label: "Kontakte", icon: Users, shortcut: "4" },
  { path: "/aufgaben", label: "Aufgaben", icon: CheckSquare, shortcut: "5" },
  { path: "/analyse", label: "Analyse", icon: Calculator, shortcut: "6" },
  { path: "/einstellungen", label: "Einstellungen", icon: Settings, shortcut: "7" },
];

interface AppLayoutProps {
  children: ReactNode;
}

const AppLayout = ({ children }: AppLayoutProps) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const { getProperty } = useProperties();

  const handleLogout = async () => {
    await signOut();
    toast.success("Abgemeldet");
  };

  const avatarUrl = user?.user_metadata?.avatar_url || user?.user_metadata?.picture;
  const displayName = user?.user_metadata?.full_name || user?.user_metadata?.display_name || user?.email?.split("@")[0] || "";
  const initials = displayName
    .split(" ")
    .map((n: string) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  // Improvement 17: Breadcrumb for property detail
  const propertyMatch = location.pathname.match(/^\/objekt\/(.+)$/);
  const propertyName = propertyMatch ? getProperty(propertyMatch[1])?.name : null;

  const breadcrumb = (() => {
    const current = navItems.find(n => n.path === location.pathname);
    if (propertyName) {
      return (
        <div className="hidden md:flex items-center gap-1.5 text-sm text-muted-foreground">
          <span>/</span>
          <Link to="/" className="hover:text-foreground transition-colors">Portfolio</Link>
          <span>/</span>
          <span className="text-foreground font-medium truncate max-w-[200px]">{propertyName}</span>
        </div>
      );
    }
    if (current && location.pathname !== "/") {
      return (
        <div className="hidden md:flex items-center gap-1.5 text-sm text-muted-foreground">
          <span>/</span>
          <span className="text-foreground font-medium">{current.label}</span>
        </div>
      );
    }
    return null;
  })();

  // Improvement: Alt+number keyboard shortcuts for navigation
  const navigateTo = useCallback((path: string) => {
    navigate(path);
  }, [navigate]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      if (e.key === "q" && !e.altKey && !e.ctrlKey && !e.metaKey) {
        document.querySelector<HTMLButtonElement>("[data-global-quick-todo]")?.click();
        return;
      }
      if (!e.altKey || e.ctrlKey || e.metaKey) return;
      const item = navItems.find(n => n.shortcut === e.key);
      if (item) {
        e.preventDefault();
        navigateTo(item.path);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [navigateTo]);

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <ScrollProgress />
      <KeyboardShortcuts />
      <header className="sticky top-0 z-50 border-b border-border bg-background/80 backdrop-blur-xl">
        <div className="container flex h-14 items-center justify-between">
          <div className="flex items-center gap-3">
            <Link to="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity" aria-label="ImmoControl Home">
              <Building2 className="h-6 w-6 text-primary" />
              <span className="text-lg font-bold tracking-tight hidden sm:inline">ImmoControl</span>
              <span className="text-lg font-bold tracking-tight sm:hidden">IC</span>
            </Link>
            {breadcrumb}
          </div>
          <div className="flex items-center gap-1">
            <nav className="hidden md:flex items-center gap-1" role="navigation" aria-label="Hauptnavigation">
              {navItems.map((item) => {
                const isActive = item.path === "/" ? location.pathname === "/" : location.pathname.startsWith(item.path);
                return (
                  <Tooltip key={item.path}>
                    <TooltipTrigger asChild>
                      <Link
                        to={item.path}
                        className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all relative ${
                          isActive
                            ? "bg-primary/10 text-primary"
                            : "text-muted-foreground hover:text-foreground hover:bg-secondary"
                        }`}
                      >
                        <item.icon className="h-4 w-4" />
                        {item.label}
                        {isActive && (
                          <span className="absolute -bottom-[9px] left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full bg-primary" />
                        )}
                      </Link>
                    </TooltipTrigger>
                    <TooltipContent side="bottom" className="text-xs">
                      {item.label} <kbd className="ml-1 px-1 py-0.5 rounded bg-muted text-[10px]">Alt+{item.shortcut}</kbd>
                    </TooltipContent>
                  </Tooltip>
                );
              })}
            </nav>
            <div className="flex items-center gap-1.5 ml-2">
              <NotificationBell />
              <Link to="/einstellungen" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
                <Avatar className="h-7 w-7">
                  <AvatarImage src={avatarUrl} alt={displayName} />
                  <AvatarFallback className="text-[10px] bg-primary/10 text-primary">
                    {initials}
                  </AvatarFallback>
                </Avatar>
                <span className="text-sm font-medium hidden lg:block max-w-[120px] truncate">
                  {displayName}
                </span>
              </Link>
              <Button variant="ghost" size="icon" onClick={handleLogout} className="text-muted-foreground hover:text-foreground h-8 w-8">
                <LogOut className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="flex-1 container py-6 pb-24 md:pb-6">
        {children}
      </main>

      <footer className="hidden md:block border-t border-border/50 py-3">
        <div className="container flex items-center justify-between text-[10px] text-muted-foreground">
          <span>© {new Date().getFullYear()} ImmoControl</span>
          <span>
            {new Date().toLocaleDateString("de-DE", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
          </span>
        </div>
      </footer>

      <BackToTop />
      <GlobalQuickTodo />

      {/* 4. Mobile nav with active label */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-background/90 backdrop-blur-xl md:hidden safe-area-bottom" role="navigation" aria-label="Mobile Navigation">
        <div className="flex items-center justify-around py-2 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
          {navItems.map((item) => {
            const isActive = item.path === "/" ? location.pathname === "/" : location.pathname.startsWith(item.path);
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`flex flex-col items-center gap-0.5 px-4 py-1.5 rounded-lg text-xs font-medium transition-colors relative ${
                  isActive ? "text-primary" : "text-muted-foreground"
                }`}
              >
                <item.icon className="h-5 w-5" />
                {item.label}
                {isActive && (
                  <span className="absolute -top-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-primary" />
                )}
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
};

export default AppLayout;
