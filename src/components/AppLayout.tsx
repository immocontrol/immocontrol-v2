import { ReactNode, useState, useEffect, useCallback, useRef, useLayoutEffect, memo } from "react";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";
import { useLocation, Link, useParams, useNavigate } from "react-router-dom";
import { LayoutDashboard, Calculator, Building2, LogOut, Settings, Users, Command, Landmark, CalendarDays, CheckSquare, Sun, Moon, Monitor, Search, FileText, Receipt, FileBarChart, Sparkles, MoreHorizontal, Target, Handshake, FolderOpen, Wrench, ChevronDown } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useTheme } from "@/hooks/useTheme";
import { useProperties } from "@/context/PropertyContext";
import { NotificationBell } from "@/components/NotificationBell";
import BackToTop from "@/components/BackToTop";
import ScrollProgress from "@/components/ScrollProgress";
import KeyboardShortcuts from "@/components/KeyboardShortcuts";
import { KeyboardShortcutHelp } from "@/components/KeyboardShortcutHelp";
import ImmoAIBubble from "@/components/ImmoAIBubble";
import { Button } from "@/components/ui/button";
import { GlobalSearch } from "@/components/GlobalSearch";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { toast } from "sonner";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { generateTempId, isEqual } from "@/lib/formatters";

/* Grouped navigation: primary items shown directly, grouped items in dropdowns */
interface NavItem {
  path: string;
  label: string;
  icon: typeof LayoutDashboard;
  shortcut: string;
}
interface NavGroup {
  label: string;
  icon: typeof LayoutDashboard;
  items: NavItem[];
}
type NavEntry = NavItem | NavGroup;
const isGroup = (e: NavEntry): e is NavGroup => "items" in e;

const navEntries: NavEntry[] = [
  { path: "/", label: "Portfolio", icon: LayoutDashboard, shortcut: "1" },
  {
    label: "Finanzen", icon: Landmark,
    items: [
      { path: "/darlehen", label: "Darlehen", icon: Landmark, shortcut: "2" },
      { path: "/mietuebersicht", label: "Mieten", icon: Receipt, shortcut: "3" },
      { path: "/berichte", label: "Berichte", icon: FileBarChart, shortcut: "7" },
    ],
  },
  {
    label: "Verwaltung", icon: FileText,
    items: [
      { path: "/vertraege", label: "Verträge", icon: FileText, shortcut: "4" },
      { path: "/kontakte", label: "Kontakte", icon: Users, shortcut: "5" },
      { path: "/aufgaben", label: "Aufgaben", icon: CheckSquare, shortcut: "6" },
      { path: "/dokumente", label: "Dokumente", icon: FolderOpen, shortcut: "" },
      { path: "/wartungsplaner", label: "Wartung", icon: Wrench, shortcut: "" },
    ],
  },
  {
    label: "Akquise", icon: Target,
    items: [
      { path: "/crm", label: "CRM", icon: Target, shortcut: "8" },
      { path: "/deals", label: "Deals", icon: Handshake, shortcut: "0" },
    ],
  },
  { path: "/einstellungen", label: "Settings", icon: Settings, shortcut: "9" },
];

/* Flat list for keyboard shortcuts, mobile nav and dot indicator */
const navItems: NavItem[] = navEntries.flatMap(e => isGroup(e) ? e.items : [e]);

/* Desktop top-level entries for dot positioning: groups map to their trigger button index */
const desktopTopLevelEntries = navEntries.map((entry, idx) => ({
  idx,
  isGroup: isGroup(entry),
  paths: isGroup(entry) ? entry.items.map(i => i.path) : [(entry as NavItem).path],
}));

interface AppLayoutProps {
  children: ReactNode;
}

/* OPT-25: Keyboard shortcut map for quick lookup */
const SHORTCUT_MAP: Record<string, string> = {};
navItems.forEach(n => { SHORTCUT_MAP[n.shortcut] = n.path; });

/* OPT-26: Route matching helper */
const isRouteActive = (itemPath: string, currentPath: string): boolean =>
  itemPath === "/" ? currentPath === "/" : currentPath.startsWith(itemPath);

/* OPT-27: Navigation item count */
const NAV_ITEM_COUNT = navItems.length;


const AppLayout = ({ children }: AppLayoutProps) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const { theme, setTheme } = useTheme();
  const { getProperty } = useProperties();
  const isOnline = useOnlineStatus();
  const desktopNavRef = useRef<HTMLElement>(null);
  const mobileNavRef = useRef<HTMLDivElement>(null);
  /* OPT-46: generateTempId for stable session tag */
  const sessionIdRef = useRef<string>(generateTempId());
  const [dotStyle, setDotStyle] = useState<React.CSSProperties>({});
  const [mobileDotStyle, setMobileDotStyle] = useState<React.CSSProperties>({});

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

  // Breadcrumb
  const propertyMatch = location.pathname.match(/^\/objekt\/(.+)$/);
  const propertyName = propertyMatch ? getProperty(propertyMatch[1])?.name : null;

  const breadcrumb = (() => {
    const current = navItems.find(n => n.path === location.pathname);
    if (propertyName) {
      return (
        <div className="hidden md:flex items-center gap-1.5 text-sm text-muted-foreground breadcrumb-nav">
          <span>/</span>
          <Link to="/" className="hover:text-foreground transition-colors">Portfolio</Link>
          <span>/</span>
          <span className="text-foreground font-medium truncate max-w-[200px]">{propertyName}</span>
        </div>
      );
    }
    if (current && location.pathname !== "/") {
      return (
        <div className="hidden md:flex items-center gap-1.5 text-sm text-muted-foreground breadcrumb-nav">
          <span>/</span>
          <span className="text-foreground font-medium">{current.label}</span>
        </div>
      );
    }
    return null;
  })();

  // Keyboard shortcuts
  const navigateTo = useCallback((path: string) => {
    navigate(path);
  }, [navigate]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      // removed quick todo shortcut
      if (!e.altKey || e.ctrlKey || e.metaKey) return;
      /* OPT-25: O(1) keyboard shortcut lookup */
      const path = SHORTCUT_MAP[e.key];
      if (path) {
        e.preventDefault();
        navigateTo(path);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [navigateTo]);

  // Sliding indicator for desktop nav — positions under top-level buttons/links
  const updateDotPosition = useCallback(() => {
    if (!desktopNavRef.current) return;
    /* Find which top-level entry (button or link) contains the active route */
    const activeTopLevel = desktopTopLevelEntries.find(e =>
      e.paths.some(p => isRouteActive(p, location.pathname))
    );
    if (!activeTopLevel) {
      setDotStyle((prev) => (isEqual(prev, { opacity: 0 }) ? prev : { opacity: 0 }));
      return;
    }

    /* Query only top-level nav triggers (links and group buttons marked with data-nav-top) */
    const topLevelElements = desktopNavRef.current.querySelectorAll<HTMLElement>("[data-nav-top]");
    const activeEl = topLevelElements[activeTopLevel.idx];
    if (!activeEl) return;
    const navRect = desktopNavRef.current.getBoundingClientRect();
    const elRect = activeEl.getBoundingClientRect();

    const next: React.CSSProperties = {
      left: elRect.left - navRect.left + elRect.width / 2 - 3,
      opacity: 1,
      transition: "left 300ms cubic-bezier(0.34, 1.56, 0.64, 1), opacity 200ms ease",
    };

    /* OPT-45: isEqual to avoid unnecessary style updates */
    setDotStyle((prev) => (isEqual(prev, next) ? prev : next));
  }, [location.pathname]);

  // Sliding indicator for mobile nav
  const updateMobileDotPosition = useCallback(() => {
    if (!mobileNavRef.current) return;
    /* OPT-26: use route matching helper */
    const activeIdx = navItems.findIndex((item) => isRouteActive(item.path, location.pathname));
    if (activeIdx === -1) {
      setMobileDotStyle((prev) => (isEqual(prev, { opacity: 0 }) ? prev : { opacity: 0 }));
      return;
    }

    const links = mobileNavRef.current.querySelectorAll<HTMLAnchorElement>("a[data-nav-link]");
    const activeLink = links[activeIdx];
    if (!activeLink) return;
    const navRect = mobileNavRef.current.getBoundingClientRect();
    const linkRect = activeLink.getBoundingClientRect();

    const next: React.CSSProperties = {
      left: linkRect.left - navRect.left + linkRect.width / 2 - 2,
      opacity: 1,
      transition: "left 300ms cubic-bezier(0.34, 1.56, 0.64, 1), opacity 200ms ease",
    };

    /* OPT-45: isEqual to avoid unnecessary style updates */
    setMobileDotStyle((prev) => (isEqual(prev, next) ? prev : next));
  }, [location.pathname]);

  useLayoutEffect(() => {
    updateDotPosition();
    updateMobileDotPosition();
  }, [location.pathname, updateDotPosition, updateMobileDotPosition]);

  useEffect(() => {
    window.addEventListener("resize", updateDotPosition);
    window.addEventListener("resize", updateMobileDotPosition);
    return () => {
      window.removeEventListener("resize", updateDotPosition);
      window.removeEventListener("resize", updateMobileDotPosition);
    };
  }, [updateDotPosition, updateMobileDotPosition]);

  return (
    <div data-session-id={sessionIdRef.current} className="min-h-screen bg-background flex flex-col theme-transition-smooth dark-mode-contrast">
      {!isOnline && (
        <div className="offline-banner" role="alert">⚠️ Keine Internetverbindung – Änderungen werden nicht gespeichert</div>
      )}
      <a href="#main-content" className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[100] focus:bg-primary focus:text-primary-foreground focus:px-4 focus:py-2 focus:rounded-md focus:text-sm focus:font-medium">
        Zum Inhalt springen
      </a>
      <ScrollProgress />
      <KeyboardShortcuts />
      {/* UI-6/UI-27: glass-header + page-header */}
      <header className="sticky top-0 z-50 border-b border-border bg-background/80 backdrop-blur-xl glass-header page-header">
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
            <nav ref={desktopNavRef} className="hidden md:flex items-center gap-0.5 relative" role="navigation" aria-label={"Hauptnavigation (" + NAV_ITEM_COUNT + ")"}>
              {navEntries.map((entry) => {
                if (isGroup(entry)) {
                  const groupActive = entry.items.some(i => isRouteActive(i.path, location.pathname));
                  return (
                    <div key={entry.label} className="relative group">
                      <button
                        data-nav-top
                        className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-all touch-target ${
                          groupActive ? "bg-primary/10 text-primary" : "text-muted-foreground hover:text-foreground hover:bg-secondary"
                        }`}
                      >
                        <entry.icon className="h-4 w-4" />
                        {entry.label}
                        <ChevronDown className="h-3 w-3 opacity-50" />
                      </button>
                      <div className="absolute top-full left-0 mt-1 min-w-[180px] bg-popover border border-border rounded-lg shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50">
                        {entry.items.map((item) => {
                          const isActive = isRouteActive(item.path, location.pathname);
                          return (
                            <Link
                              key={item.path}
                              to={item.path}
                              aria-current={isActive ? "page" : undefined}
                              className={`flex items-center gap-2 px-3 py-2 text-sm font-medium transition-colors first:rounded-t-lg last:rounded-b-lg ${
                                isActive ? "bg-primary/10 text-primary" : "text-foreground hover:bg-secondary"
                              }`}
                            >
                              <item.icon className="h-4 w-4" />
                              {item.label}
                              {item.shortcut && <kbd className="ml-auto px-1 py-0.5 rounded bg-muted text-[10px] text-muted-foreground">Alt+{item.shortcut}</kbd>}
                            </Link>
                          );
                        })}
                      </div>
                    </div>
                  );
                }
                const isActive = isRouteActive(entry.path, location.pathname);
                return (
                  <Tooltip key={entry.path}>
                    <TooltipTrigger asChild>
                      <Link
                        to={entry.path}
                        data-nav-top
                        data-nav-link
                        aria-current={isActive ? "page" : undefined}
                        className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all relative touch-target focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2 ${
                          isActive
                            ? "bg-primary/10 text-primary"
                            : "text-muted-foreground hover:text-foreground hover:bg-secondary"
                        }`}
                      >
                        <entry.icon className="h-4 w-4" />
                        {entry.label}
                      </Link>
                    </TooltipTrigger>
                    <TooltipContent side="bottom" className="text-xs tooltip-arrow dropdown-enter">
                      {entry.label} {entry.shortcut && <kbd className="ml-1 px-1 py-0.5 rounded bg-muted text-[10px]">Alt+{entry.shortcut}</kbd>}
                    </TooltipContent>
                  </Tooltip>
                );
              })}
              {/* Sliding dot indicator */}
              <span
                className="absolute -bottom-[9px] w-1.5 h-1.5 rounded-full bg-primary pointer-events-none"
                style={dotStyle}
              />
            </nav>
            <div className="flex items-center gap-1.5 ml-2">
              <GlobalSearch />
              {/* Quick theme toggle */}
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-muted-foreground hover:text-foreground toggle-animated"
                onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
                aria-label={theme === "dark" ? "Helles Design" : "Dunkles Design"}
              >
                {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
              </Button>
              <KeyboardShortcutHelp />
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

      <main id="main-content" className="flex-1 container py-6 pb-24 md:pb-6">
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
      <ImmoAIBubble />

      {/* Mobile nav with sliding dot */}
      {/* IMP-43: Ensure mobile nav items never overflow the viewport */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-background/90 backdrop-blur-xl md:hidden safe-area-bottom mobile-bottom-safe overflow-x-hidden" role="navigation" aria-label="Mobile Navigation">
        <div ref={mobileNavRef} className="flex items-center justify-around py-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] relative min-w-0">
          {navItems.map((item) => {
            const isActive = isRouteActive(item.path, location.pathname);
            return (
              <Link
                key={item.path}
                to={item.path}
                data-nav-link
                aria-current={isActive ? "page" : undefined}
                className={`flex flex-col items-center gap-0.5 px-4 py-1.5 rounded-lg text-xs font-medium transition-colors relative nav-label-mobile touch-target ${
                  isActive ? "text-primary" : "text-muted-foreground"
                }`}
              >
                <item.icon className="h-5 w-5" />
                {item.label}
              </Link>
            );
          })}
          {/* Mobile sliding dot */}
          <span
            className="absolute -top-1 w-1 h-1 rounded-full bg-primary pointer-events-none"
            style={mobileDotStyle}
          />
        </div>
      </nav>
    </div>
  );
};

export default AppLayout;
