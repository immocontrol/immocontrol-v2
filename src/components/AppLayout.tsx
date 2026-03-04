import { ReactNode, useState, useEffect, useCallback, useRef, useLayoutEffect, memo, useMemo } from "react";
import { useOnlineStatusNotifications } from "@/hooks/useOnlineStatus";
import { useLocation, Link, useParams, useNavigate } from "react-router-dom";
import { LayoutDashboard, Calculator, Building2, LogOut, Settings, Users, Command, Landmark, CalendarDays, CheckSquare, Sun, Moon, Monitor, Search, FileText, Receipt, FileBarChart, Sparkles, MoreHorizontal, Target, Handshake, FolderOpen, Wrench, ChevronDown, TrendingUp } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useTheme } from "@/hooks/useTheme";
import { useProperties } from "@/context/PropertyContext";
import { NotificationBell } from "@/components/NotificationBell";
import BackToTop from "@/components/BackToTop";
import ScrollProgress from "@/components/ScrollProgress";
import KeyboardShortcuts from "@/components/KeyboardShortcuts";
import ImmoAIBubble from "@/components/ImmoAIBubble";
import { Button } from "@/components/ui/button";
import { GlobalSearch } from "@/components/GlobalSearch";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { toast } from "sonner";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { generateTempId, isEqual } from "@/lib/formatters";
import { useGlobalAutoSave } from "@/hooks/useAutoSave";
import { useQueryClient } from "@tanstack/react-query";
import { migrateLocalStorageToSupabase } from "@/hooks/useSupabaseStorage";
import { useRealtimeSync } from "@/hooks/useRealtimeSync";
import { logger } from "@/lib/logger";
import { usePullToRefresh } from "@/hooks/usePullToRefresh";
import { useEnterToNext } from "@/hooks/useEnterToNext";
import { scheduleAutoBackup } from "@/lib/autoBackup";
import { OfflineIndicator } from "@/components/OfflineIndicator";
import { useScrollPosition } from "@/hooks/useScrollPosition";

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

/* Item 2: Menüpunkte umsortiert — Rechner, Nebenkosten & Cashflow-Prognose zu Finanzen hinzugefügt */
const navEntries: NavEntry[] = [
  { path: "/", label: "Portfolio", icon: LayoutDashboard, shortcut: "1" },
  { path: "/dashboard", label: "Dashboard", icon: Sparkles, shortcut: "" },
  {
    label: "Finanzen", icon: Landmark,
    items: [
      { path: "/darlehen", label: "Darlehen", icon: Landmark, shortcut: "2" },
      { path: "/mietuebersicht", label: "Mieten", icon: Receipt, shortcut: "3" },
      { path: "/nebenkosten", label: "Nebenkosten", icon: Receipt, shortcut: "" },
      { path: "/forecast", label: "Cashflow-Prognose", icon: Calculator, shortcut: "" },
      { path: "/berichte", label: "Berichte", icon: FileBarChart, shortcut: "7" },
      { path: "/analyse", label: "Rechner", icon: Calculator, shortcut: "" },
      { path: "/hockey-stick", label: "Hockey Stick Simulator", icon: TrendingUp, shortcut: "" },
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
  /* Settings moved to header icon bar — no longer a nav entry */
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

/* OPT-25: Default keyboard shortcut map for quick lookup */
const DEFAULT_SHORTCUT_MAP: Record<string, string> = {};
navItems.forEach(n => { if (n.shortcut) DEFAULT_SHORTCUT_MAP[`Alt+${n.shortcut}`] = n.path; });

/* Map action labels to paths for custom shortcut resolution */
const ACTION_TO_PATH: Record<string, string> = {
  "Navigation: Portfolio": "/",
  "Navigation: Dashboard": "/dashboard",
  "Navigation: Darlehen": "/darlehen",
  "Navigation: Mieten": "/mietuebersicht",
  "Navigation: Verträge": "/vertraege",
  "Navigation: Kontakte": "/kontakte",
  "Navigation: Aufgaben": "/aufgaben",
  "Navigation: Berichte": "/berichte",
  "Navigation: CRM": "/crm",
  "Navigation: Deals": "/deals",
  "Navigation: Hockey Stick Simulator": "/hockey-stick",
  "Navigation: Einstellungen": "/einstellungen",
};

/** Normalize a combo string to canonical modifier order: ctrl+alt+shift+key */
function normalizeCombo(raw: string): string {
  const parts = raw.toLowerCase().replace(/\s/g, "").split("+");
  const modifiers: string[] = [];
  const keys: string[] = [];
  for (const p of parts) {
    if (p === "ctrl" || p === "meta") { if (!modifiers.includes("ctrl")) modifiers.push("ctrl"); }
    else if (p === "alt") { if (!modifiers.includes("alt")) modifiers.push("alt"); }
    else if (p === "shift") { if (!modifiers.includes("shift")) modifiers.push("shift"); }
    else keys.push(p);
  }
  /* Canonical order: ctrl → alt → shift → key */
  const ordered: string[] = [];
  if (modifiers.includes("ctrl")) ordered.push("ctrl");
  if (modifiers.includes("alt")) ordered.push("alt");
  if (modifiers.includes("shift")) ordered.push("shift");
  return [...ordered, ...keys].join("+");
}

/** Load custom shortcuts from localStorage and build combo→path map */
function buildShortcutMap(): Record<string, string> {
  try {
    const stored = localStorage.getItem("immocontrol_shortcuts");
    if (stored) {
      const custom = JSON.parse(stored) as Record<string, string>;
      const map: Record<string, string> = {};
      for (const [action, combo] of Object.entries(custom)) {
        const path = ACTION_TO_PATH[action];
        if (path && combo) {
          map[normalizeCombo(combo)] = path;
        }
      }
      if (Object.keys(map).length > 0) return map;
    }
  } catch { /* ignore corrupt localStorage */ }
  /* Fallback to defaults */
  const map: Record<string, string> = {};
  for (const [combo, path] of Object.entries(DEFAULT_SHORTCUT_MAP)) {
    map[normalizeCombo(combo)] = path;
  }
  return map;
}

/* UPD-46: Route matching helper with exact match for root path */
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
  const isOnline = useOnlineStatusNotifications();
  const desktopNavRef = useRef<HTMLElement>(null);
  const mobileNavRef = useRef<HTMLDivElement>(null);
  /* OPT-46: generateTempId for stable session tag */
  const sessionIdRef = useRef<string>(generateTempId());
  const [dotStyle, setDotStyle] = useState<React.CSSProperties>({});
  const [mobileDotStyle, setMobileDotStyle] = useState<React.CSSProperties>({});

  /* Auto-save global state every 10 seconds to protect against crashes */
  useGlobalAutoSave();

  /* FIX: Global Enter → next field on mobile keyboard */
  const { handleKeyDown: enterToNextHandler } = useEnterToNext();

  /* #11: Pull-to-Refresh for mobile — invalidates all queries on pull gesture */
  const qc = useQueryClient();
  const { indicatorRef: pullIndicatorRef } = usePullToRefresh({
    onRefresh: async () => {
      await qc.invalidateQueries();
      toast.success("Daten aktualisiert");
    },
  });

  /* REALTIME-7: Multi-device sync — invalidates React Query cache on remote changes */
  useRealtimeSync();

  /* UX-20: Remember scroll position on navigation — restores scroll when navigating back */
  useScrollPosition();

  /* Improvement 17: Auto backup scheduling — backs up localStorage data every hour */
  useEffect(() => {
    const cleanup = scheduleAutoBackup(() => {
      const data: Record<string, unknown> = {};
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith("immo") && !key.startsWith("immocontrol_backup")) {
          try { data[key] = JSON.parse(localStorage.getItem(key) || ""); } catch { data[key] = localStorage.getItem(key); }
        }
      }
      return data;
    }, 60 * 60 * 1000); // 1 hour
    return cleanup;
  }, []);

  /* MIGRATE-3: One-time localStorage → Supabase migration on login */
  const migrationDoneRef = useRef(false);
  useEffect(() => {
    if (!user || migrationDoneRef.current) return;
    migrationDoneRef.current = true;
    migrateLocalStorageToSupabase(user.id).then((count) => {
      if (count > 0) logger.info(`${count} localStorage keys migrated to Supabase`, "Migration");
    });
  }, [user]);

  /* BUG-5: Track dropdown open state for click-based dropdowns (fixes hidden dropdowns) */
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);

  /* BUG-9: Auto-fade bottom menu on scroll — track scroll direction */
  const [mobileNavVisible, setMobileNavVisible] = useState(true);
  const [mobileMoreOpen, setMobileMoreOpen] = useState(false);
  /* Mobile grouped nav: which group is expanded (shows sub-items above bottom bar) */
  const [mobileActiveGroup, setMobileActiveGroup] = useState<string | null>(null);
  const lastScrollY = useRef(0);
  const scrollTicking = useRef(false);

  useEffect(() => {
    const onScroll = () => {
      /* FIX: Skip scroll-based nav visibility updates when an input/textarea is focused
         to prevent re-renders that steal focus on mobile keyboards */
      const active = document.activeElement;
      if (active && (active.tagName === "INPUT" || active.tagName === "TEXTAREA" || active.tagName === "SELECT" || (active as HTMLElement).isContentEditable)) {
        return;
      }
      if (scrollTicking.current) return;
      scrollTicking.current = true;
      requestAnimationFrame(() => {
        const currentY = window.scrollY;
        if (currentY > lastScrollY.current + 10 && currentY > 60) {
          setMobileNavVisible(false); // scrolling down
        } else if (currentY < lastScrollY.current - 10 || currentY <= 10) {
          setMobileNavVisible(true); // scrolling up or at top
        }
        lastScrollY.current = currentY;
        scrollTicking.current = false;
      });
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  /* BUG-5: Close dropdown when clicking outside */
  useEffect(() => {
    if (!openDropdown) return;
    const handleClick = () => setOpenDropdown(null);
    document.addEventListener("click", handleClick);
    return () => document.removeEventListener("click", handleClick);
  }, [openDropdown]);

  /* UPD-47: Safe logout with error handling */
  const handleLogout = async () => {
    try {
      await signOut();
      toast.success("Abgemeldet");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Abmeldung fehlgeschlagen");
    }
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

  /* IMPROVE-11: Memoize breadcrumb to avoid unnecessary re-renders on each location change */
  const breadcrumb = useMemo(() => {
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
  }, [location.pathname, propertyName]);

  // Keyboard shortcuts — load custom shortcuts from localStorage
  const navigateTo = useCallback((path: string) => {
    navigate(path);
  }, [navigate]);

  /* Rebuild shortcut map when Settings saves to localStorage */
  const shortcutMapRef = useRef<Record<string, string>>(buildShortcutMap());
  useEffect(() => {
    const onRebuild = () => { shortcutMapRef.current = buildShortcutMap(); };
    const onStorage = (e: StorageEvent) => {
      if (e.key === "immocontrol_shortcuts") onRebuild();
    };
    window.addEventListener("storage", onStorage);
    /* CustomEvent dispatched by Settings.tsx saveCustomShortcuts — works same-tab */
    window.addEventListener("shortcuts-updated", onRebuild);
    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("shortcuts-updated", onRebuild);
    };
  }, []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;

      /* Build normalised combo string from the event */
      const parts: string[] = [];
      if (e.ctrlKey || e.metaKey) parts.push("ctrl");
      if (e.altKey) parts.push("alt");
      if (e.shiftKey) parts.push("shift");
      const key = e.key.length === 1 ? e.key.toUpperCase() : e.key;
      if (!["Control", "Alt", "Shift", "Meta"].includes(e.key)) parts.push(key.toLowerCase());
      const combo = parts.join("+");

      const path = shortcutMapRef.current[combo];
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
    /* FIX-1/FIX-2: Use navEntries (top-level) instead of navItems (flat) for mobile dot.
       The mobile nav renders navEntries directly — groups as buttons, items as links.
       Only direct NavItem links get data-nav-link, so we find the matching entry index
       among non-group entries and query the corresponding DOM element. */
    let activeEntryIdx = -1;
    let isInGroup = false;
    for (let i = 0; i < navEntries.length; i++) {
      const entry = navEntries[i];
      if (isGroup(entry)) {
        if (entry.items.some(item => isRouteActive(item.path, location.pathname))) {
          isInGroup = true;
          break;
        }
      } else {
        if (isRouteActive(entry.path, location.pathname)) {
          activeEntryIdx = i;
          break;
        }
      }
    }
    /* If the active route is inside a group, hide the mobile dot (group button has no dot) */
    if (isInGroup || activeEntryIdx === -1) {
      setMobileDotStyle((prev) => (isEqual(prev, { opacity: 0 }) ? prev : { opacity: 0 }));
      return;
    }

    const links = mobileNavRef.current.querySelectorAll<HTMLAnchorElement>("a[data-nav-link]");
    /* Find which data-nav-link index corresponds to this navEntries index.
       Direct NavItems are rendered before/between groups, count only non-group entries up to activeEntryIdx. */
    let linkIdx = 0;
    for (let i = 0; i < activeEntryIdx; i++) {
      if (!isGroup(navEntries[i])) linkIdx++;
    }
    if (linkIdx >= links.length) {
      setMobileDotStyle((prev) => (isEqual(prev, { opacity: 0 }) ? prev : { opacity: 0 }));
      return;
    }
    const activeLink = links[linkIdx];
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
    /* FIX: Mobile keyboard open triggers resize → state updates → re-render → focus loss.
       Skip dot position updates when an input/textarea/select is focused (keyboard is open). */
    const safeUpdateDot = () => {
      const active = document.activeElement;
      if (active && (active.tagName === "INPUT" || active.tagName === "TEXTAREA" || active.tagName === "SELECT" || (active as HTMLElement).isContentEditable)) {
        return;
      }
      updateDotPosition();
    };
    const safeUpdateMobileDot = () => {
      const active = document.activeElement;
      if (active && (active.tagName === "INPUT" || active.tagName === "TEXTAREA" || active.tagName === "SELECT" || (active as HTMLElement).isContentEditable)) {
        return;
      }
      updateMobileDotPosition();
    };
    window.addEventListener("resize", safeUpdateDot);
    window.addEventListener("resize", safeUpdateMobileDot);
    return () => {
      window.removeEventListener("resize", safeUpdateDot);
      window.removeEventListener("resize", safeUpdateMobileDot);
    };
  }, [updateDotPosition, updateMobileDotPosition]);

  return (
    <div data-session-id={sessionIdRef.current} className="min-h-screen bg-background flex flex-col theme-transition-smooth dark-mode-contrast">
      {/* STR-11: Improved offline banner with auto-dismiss and reconnect detection */}
      {!isOnline && (
        <div className="offline-banner animate-fade-in" role="alert" aria-live="assertive">
          <span className="inline-flex items-center gap-2">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-loss/75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-loss"></span>
            </span>
            Keine Internetverbindung – Lokale Änderungen werden beim Reconnect synchronisiert
          </span>
        </div>
      )}
      <a href="#main-content" className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[100] focus:bg-primary focus:text-primary-foreground focus:px-4 focus:py-2 focus:rounded-md focus:text-sm focus:font-medium">
        Zum Inhalt springen
      </a>
      {/* #11: Pull-to-refresh indicator */}
      <div
        ref={pullIndicatorRef}
        className="fixed top-0 left-1/2 z-[300] bg-primary text-primary-foreground rounded-full w-10 h-10 flex items-center justify-center shadow-lg pointer-events-none"
        style={{ opacity: 0, transform: "translateX(-50%) translateY(-40px)" }}
        aria-hidden
      >
        <svg className="h-5 w-5 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 12a9 9 0 1 1-6.219-8.56" /></svg>
      </div>
      <ScrollProgress />
      <KeyboardShortcuts />
      {/* UI-6/UI-27: glass-header + page-header */}
      <header className="sticky top-0 z-[150] border-b border-border bg-background/80 backdrop-blur-xl glass-header page-header overflow-visible">
        <div className="container flex h-14 items-center justify-between overflow-visible">
          <div className="flex items-center gap-3">
            <Link to="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity" aria-label="ImmoControl Home">
              <Building2 className="h-6 w-6 text-primary" />
              <span className="text-lg font-bold tracking-tight hidden sm:inline">ImmoControl</span>
              <span className="text-lg font-bold tracking-tight sm:hidden">IC</span>
            </Link>
            {breadcrumb}
          </div>
          <div className="flex items-center gap-1 overflow-visible">
            <nav ref={desktopNavRef} className="hidden md:flex items-center gap-0.5 relative overflow-visible" role="navigation" aria-label={"Hauptnavigation (" + NAV_ITEM_COUNT + ")"}>
              {navEntries.map((entry) => {
                if (isGroup(entry)) {
                  const groupActive = entry.items.some(i => isRouteActive(i.path, location.pathname));
                  return (
                    <div key={entry.label} className="relative">
                      {/* BUG-5: Click-based dropdown instead of hover-only — fixes hidden dropdowns */}
                      <button
                        data-nav-top
                        onClick={(e) => { e.stopPropagation(); setOpenDropdown(openDropdown === entry.label ? null : entry.label); }}
                        className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-all touch-target ${
                          groupActive ? "bg-primary/10 text-primary" : "text-muted-foreground hover:text-foreground hover:bg-secondary"
                        }`}
                      >
                        <entry.icon className="h-4 w-4" />
                        {entry.label}
                        <ChevronDown className={`h-3 w-3 transition-transform duration-200 ${openDropdown === entry.label ? "rotate-180 opacity-100" : "opacity-50"}`} />
                      </button>
                      <div className={`absolute top-full left-0 mt-1 min-w-[180px] bg-popover border border-border rounded-lg shadow-lg transition-all duration-200 z-[300] ${
                        openDropdown === entry.label ? "opacity-100 visible translate-y-0" : "opacity-0 invisible -translate-y-1"
                      }`}>
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
              <NotificationBell />
              <Tooltip>
                <TooltipTrigger asChild>
                  <Link to="/einstellungen" className="inline-flex items-center justify-center h-8 w-8 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors" aria-label="Einstellungen">
                    <Settings className="h-4 w-4" />
                  </Link>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="text-xs">Einstellungen</TooltipContent>
              </Tooltip>
              <div className="flex items-center gap-2">
                <Avatar className="h-7 w-7">
                  <AvatarImage src={avatarUrl} alt={displayName} />
                  <AvatarFallback className="text-[10px] bg-primary/10 text-primary">
                    {initials}
                  </AvatarFallback>
                </Avatar>
                <span className="text-sm font-medium hidden lg:block max-w-[120px] truncate">
                  {displayName}
                </span>
              </div>
              <Button variant="ghost" size="icon" onClick={handleLogout} className="text-muted-foreground hover:text-foreground h-8 w-8">
                <LogOut className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* IMP-41-3: Offline indicator banner — persistent visual feedback when no connection */}
      {!isOnline && (
        <div className="bg-destructive/10 border-b border-destructive/20 px-4 py-2 text-center text-xs text-destructive font-medium flex items-center justify-center gap-2" role="alert">
          <span className="w-2 h-2 rounded-full bg-destructive animate-pulse" />
          Keine Internetverbindung — Änderungen werden lokal gespeichert
        </div>
      )}

      {/* FIX: Global Enter → next field handler for mobile keyboard navigation */}
      <main id="main-content" className="flex-1 container py-6 pb-24 md:pb-6" onKeyDown={enterToNextHandler}>
        {children}
      </main>

      {/* IMPROVE-12: Add role="contentinfo" to footer for screen reader landmark */}
      <footer className="hidden md:block border-t border-border/50 py-3" role="contentinfo">
        <div className="container flex items-center justify-between text-[10px] text-muted-foreground">
          {/* IMPROVE-13: Show nav item count for transparency */}
          <span>© {new Date().getFullYear()} ImmoControl · {NAV_ITEM_COUNT} Bereiche</span>
          <span>
            {new Date().toLocaleDateString("de-DE", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
          </span>
        </div>
      </footer>

      <BackToTop />
      <ImmoAIBubble />

      {/* UX-7: Enhanced offline indicator with reconnection feedback */}
      <OfflineIndicator />

      {/* Mobile nav — 5 grouped tabs with expandable sub-items */}
      <nav
        className={`fixed bottom-0 left-0 right-0 z-[200] border-t border-border bg-background/95 backdrop-blur-xl md:hidden safe-area-bottom mobile-bottom-safe transition-all duration-300 ${
          mobileNavVisible ? "translate-y-0 opacity-100" : "translate-y-full opacity-0"
        }`}
        role="navigation"
        aria-label="Mobile Navigation"
        style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
      >
          {/* MOBILE-FIX-1: Sub-items panel — compact grid layout to prevent overlap */}
          {mobileActiveGroup && (() => {
            const group = navEntries.find(e => isGroup(e) && e.label === mobileActiveGroup) as NavGroup | undefined;
            if (!group) return null;
            return (
              /* UPD-12: Use sub-nav-slide-in animation */
              <div className="border-b border-border bg-background/95 backdrop-blur-xl px-3 py-2 sub-nav-slide-in">
                  <div className="grid grid-cols-3 gap-2">
                    {group.items.map((item, idx) => {
                      const isActive = isRouteActive(item.path, location.pathname);
                      return (
                        <Link
                          key={item.path}
                          to={item.path}
                          onClick={() => setMobileActiveGroup(null)}
                          className={`flex flex-col items-center gap-1 px-2 py-2.5 rounded-xl text-[10px] font-medium transition-all duration-200 ${
                            isActive
                              ? "bg-primary/12 text-primary shadow-sm border border-primary/20"
                              : "text-muted-foreground hover:bg-secondary/60 hover:text-foreground border border-transparent"
                          }`}
                          style={{ animationDelay: `${idx * 30}ms` }}
                        >
                          <div className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all ${
                            isActive ? "bg-primary/15 text-primary" : "bg-secondary/50 text-muted-foreground"
                          }`}>
                            <item.icon className="h-4 w-4" />
                          </div>
                          <span className="truncate max-w-full leading-tight">{item.label}</span>
                        </Link>
                      );
                    })}
                  </div>
              </div>
            );
          })()}
        {/* MOBILE-FIX-2: Bottom tab bar — evenly spaced with proper sizing */}
        <div ref={mobileNavRef} className="flex items-center justify-around py-1 relative">
          {navEntries.map((entry) => {
            if (isGroup(entry)) {
              const groupActive = entry.items.some(i => isRouteActive(i.path, location.pathname));
              const isExpanded = mobileActiveGroup === entry.label;
              return (
                <button
                  key={entry.label}
                  onClick={() => setMobileActiveGroup(isExpanded ? null : entry.label)}
                  className={`flex flex-col items-center justify-center gap-0.5 min-w-0 flex-1 py-1 rounded-lg text-[10px] font-medium transition-all relative ${
                    groupActive || isExpanded ? "text-primary" : "text-muted-foreground"
                  } ${isExpanded ? "scale-105" : ""}`}
                >
                  <entry.icon className="h-4 w-4" />
                  <span className="truncate max-w-[52px] leading-tight">{entry.label}</span>
                  {isExpanded && <span className="absolute -top-0.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-primary animate-pulse" />}
                </button>
              );
            }
            const item = entry as NavItem;
            const isActive = isRouteActive(item.path, location.pathname);
            return (
              <Link
                key={item.path}
                to={item.path}
                data-nav-link
                onClick={() => setMobileActiveGroup(null)}
                aria-current={isActive ? "page" : undefined}
                className={`flex flex-col items-center justify-center gap-0.5 min-w-0 flex-1 py-1 rounded-lg text-[10px] font-medium transition-all relative ${
                  isActive ? "text-primary" : "text-muted-foreground"
                }`}
              >
                <item.icon className="h-4 w-4" />
                <span className="truncate max-w-[52px] leading-tight">{item.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
};

export default AppLayout;
