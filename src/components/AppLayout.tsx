import { ReactNode, useState, useEffect, useCallback, useRef, useLayoutEffect, memo, useMemo } from "react";
import { useOnlineStatusNotifications } from "@/hooks/useOnlineStatus";
import { useLocation, Link, useParams, useNavigate } from "react-router-dom";
import { ROUTES } from "@/lib/routes";
import { scheduleRoutePreload, cancelRoutePreload } from "@/lib/routePreload";
import { LayoutDashboard, Calculator, Building2, LogOut, Settings, Users, Command, Landmark, CalendarDays, CheckSquare, Sun, Moon, Monitor, Search, FileText, Receipt, FileBarChart, Sparkles, MoreHorizontal, Target, Handshake, FolderOpen, Wrench, ChevronDown, TrendingUp, Newspaper } from "lucide-react";
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
import { RecentPropertiesNav } from "@/components/RecentPropertiesNav";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { toast } from "sonner";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { generateTempId, isEqual } from "@/lib/formatters";
import { useGlobalAutoSave } from "@/hooks/useAutoSave";
import { useQueryClient, useIsFetching } from "@tanstack/react-query";
import { migrateLocalStorageToSupabase } from "@/hooks/useSupabaseStorage";
import { useRealtimeSync } from "@/hooks/useRealtimeSync";
import { logger } from "@/lib/logger";
import { usePullToRefresh } from "@/hooks/usePullToRefresh";
import { PullToRefreshIndicator } from "@/components/PullToRefreshIndicator";
import { useIsMobile } from "@/hooks/use-mobile";
import { useInactivityHint } from "@/hooks/useInactivityHint";
import { useSessionIdleTimeout } from "@/hooks/useSessionIdleTimeout";
import { useEnterToNext } from "@/hooks/useEnterToNext";
import { useNotificationChecks } from "@/hooks/useNotificationChecks";
import { scheduleAutoBackup } from "@/lib/autoBackup";
import { OfflineIndicator } from "@/components/OfflineIndicator";
import { useScrollPosition } from "@/hooks/useScrollPosition";
import { PageProgressBar } from "@/components/PageProgressBar";
import { MobileOfflineQueue, MobileSearchOverlay, MobileAppUpdateBanner } from "@/components/mobile";
import { ActiveCallBar } from "@/components/ActiveCallBar";
import { GamificationNavChip } from "@/components/GamificationNavChip";
// NotificationCenter import removed — duplicate bell icon with NotificationBell

import {
  navEntries,
  navItems,
  desktopTopLevelEntries,
  isGroup,
  getGroupItems,
  isRouteActive,
  buildShortcutMap,
  ACTION_TO_PATH,
  NAV_ITEM_COUNT,
} from "@/components/appLayout/navConfig";

interface AppLayoutProps {
  children: ReactNode;
}

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

  useInactivityHint();
  useSessionIdleTimeout(signOut, !!user);

  /* Dokument- und Darlehens-Fristen → In-App + ggf. Browser-Benachrichtigungen */
  useNotificationChecks();

  /* #11: Pull-to-Refresh for mobile — content pulls down with finger (iOS-style), then refresh */
  const qc = useQueryClient();
  const isFetching = useIsFetching();
  const isMobile = useIsMobile();
  const mainContentRef = useRef<HTMLElement>(null);
  const { indicatorRef: pullIndicatorRef, indicator: pullIndicator } = usePullToRefresh({
    onRefresh: async () => {
      await qc.invalidateQueries();
      toast.success("Daten aktualisiert");
    },
    contentRef: isMobile ? mainContentRef : undefined,
    disabled: !isMobile,
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
  /* FUND-18: Add .catch() to prevent unhandled promise rejection if migration fails */
  const migrationDoneRef = useRef(false);
  useEffect(() => {
    if (!user || migrationDoneRef.current) return;
    migrationDoneRef.current = true;
    migrateLocalStorageToSupabase(user.id)
      .then((count) => {
        if (count > 0) logger.info(`${count} localStorage keys migrated to Supabase`, "Migration");
      })
      .catch((err) => {
        logger.warn(`Migration fehlgeschlagen: ${err instanceof Error ? err.message : String(err)}`, "Migration");
      });
  }, [user]);

  /* BUG-5: Track dropdown open state for click-based dropdowns (fixes hidden dropdowns) */
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);

  /* BUG-9: Auto-fade bottom menu on scroll — track scroll direction */
  const [mobileNavVisible, setMobileNavVisible] = useState(true);
  const [mobileMoreOpen, setMobileMoreOpen] = useState(false);
  /* MOB-15: Mobile search overlay state */
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
  /* Mobile grouped nav: which group is expanded (shows sub-items above bottom bar) */
  const [mobileActiveGroup, setMobileActiveGroup] = useState<string | null>(null);
  /* When opening search, remember which group was expanded so we can restore on close */
  const mobileActiveGroupBeforeSearchRef = useRef<string | null>(null);

  /* MOBILE-FIX-4/5: Swipe navigation between menus + group-first navigation
     - swipe left/right switches between top-level nav entries
     - when landing on a group, only expand its sub-items (no auto-navigation) */
  const touchStartRef = useRef<{ x: number; y: number; t: number } | null>(null);
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

  /* Refs für Schließen beim Verlassen (Maus außerhalb Trigger + Panel) */
  const openDropdownTriggerRef = useRef<HTMLButtonElement | null>(null);
  const openDropdownPanelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!openDropdown) return;
    const handleMove = (e: MouseEvent) => {
      const trigger = openDropdownTriggerRef.current;
      const panel = openDropdownPanelRef.current;
      const x = e.clientX;
      const y = e.clientY;
      const inTrigger = trigger && (() => {
        const r = trigger.getBoundingClientRect();
        return x >= r.left - 2 && x <= r.right + 2 && y >= r.top - 2 && y <= r.bottom + 2;
      })();
      const inPanel = panel && (() => {
        const r = panel.getBoundingClientRect();
        return x >= r.left - 2 && x <= r.right + 2 && y >= r.top - 2 && y <= r.bottom + 2;
      })();
      if (!inTrigger && !inPanel) setOpenDropdown(null);
    };
    document.addEventListener("mousemove", handleMove, { passive: true });
    return () => document.removeEventListener("mousemove", handleMove);
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
          <Link to={ROUTES.HOME} className="hover:text-foreground transition-colors">Portfolio</Link>
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

      /* Ctrl+N / Cmd+N: Neues Objekt → Objekte mit Add-Dialog (nicht auf Kontakte-Seite, dort = neuer Kontakt) */
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "n") {
        if (!location.pathname.startsWith(ROUTES.CONTACTS)) {
          e.preventDefault();
          navigateTo(ROUTES.OBJEKTE + "?add=1");
          return;
        }
      }

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
        if (getGroupItems(entry).some(item => isRouteActive(item.path, location.pathname))) {
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

  const isInteractiveElement = (el: EventTarget | null): boolean => {
    if (!(el instanceof HTMLElement)) return false;
    const tag = el.tagName;
    if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || tag === "BUTTON") return true;
    if (el.isContentEditable) return true;
    return Boolean(el.closest("[data-swipe-ignore='true']"));
  };

  const isHorizontallyScrollable = (el: HTMLElement | null): boolean => {
    let cur: HTMLElement | null = el;
    for (let i = 0; i < 6 && cur; i++) {
      const style = window.getComputedStyle(cur);
      const canScrollX = (style.overflowX === "auto" || style.overflowX === "scroll") && cur.scrollWidth > cur.clientWidth + 5;
      if (canScrollX) return true;
      cur = cur.parentElement;
    }
    return false;
  };

  const getActiveTopLevelIndex = (): number => {
    for (let i = 0; i < navEntries.length; i++) {
      const entry = navEntries[i];
      if (isGroup(entry)) {
        if (getGroupItems(entry).some(item => isRouteActive(item.path, location.pathname))) return i;
      } else {
        if (isRouteActive(entry.path, location.pathname)) return i;
      }
    }
    return 0;
  };

  const activateTopLevelEntry = (idx: number) => {
    const entry = navEntries[idx];
    if (isGroup(entry)) {
      setMobileActiveGroup(entry.label);
      return;
    }
    setMobileActiveGroup(null);
    navigate(entry.path);
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    if (window.matchMedia("(min-width: 768px)").matches) return;
    if (isInteractiveElement(e.target)) return;
    if (isHorizontallyScrollable(e.target as HTMLElement)) return;
    const t = e.touches[0];
    touchStartRef.current = { x: t.clientX, y: t.clientY, t: Date.now() };
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (window.matchMedia("(min-width: 768px)").matches) return;
    const start = touchStartRef.current;
    if (!start) return;
    touchStartRef.current = null;

    const t = e.changedTouches[0];
    const dx = t.clientX - start.x;
    const dy = t.clientY - start.y;
    const dt = Date.now() - start.t;

    /* Ignore vertical scroll and slow drags */
    if (dt > 700) return;
    if (Math.abs(dx) < 80) return;
    if (Math.abs(dx) < Math.abs(dy) * 1.5) return;

    const curIdx = getActiveTopLevelIndex();
    const nextIdx = dx < 0
      ? Math.min(curIdx + 1, navEntries.length - 1)
      : Math.max(curIdx - 1, 0);
    if (nextIdx === curIdx) return;
    activateTopLevelEntry(nextIdx);
  };

  return (
    <div data-session-id={sessionIdRef.current} className="app-shell min-h-screen flex flex-col theme-transition-smooth dark-mode-contrast">
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
      {/* #11: Pull-to-refresh — ring fills → check when ready → spinner while refreshing */}
      <PullToRefreshIndicator
        rootRef={pullIndicatorRef}
        opacity={pullIndicator.opacity}
        translateY={pullIndicator.translateY}
        progress={pullIndicator.progress}
        ready={pullIndicator.ready}
        refreshing={pullIndicator.refreshing}
      />
      {/* UX-1: Page transition progress bar */}
      <PageProgressBar />
      <ScrollProgress />
      <KeyboardShortcuts />
      {/* UI-6/UI-27: glass-header + page-header */}
      <header
        className="sticky top-0 z-[150] border-b border-border/70 bg-background/85 backdrop-blur-xl glass-header page-header overflow-visible md:pt-0 shadow-[0_1px_0_hsl(var(--border)/0.5)]"
        style={{ paddingTop: "env(safe-area-inset-top, 0px)" }}
      >
        <div className="container flex h-14 items-center justify-between gap-2 min-w-0 overflow-hidden">
          <div className="flex items-center gap-3 min-w-0 shrink-0">
            <Link to={ROUTES.HOME} className="flex items-center gap-2 hover:opacity-80 transition-opacity shrink-0" aria-label="ImmoControl Home">
              <Building2 className="h-6 w-6 text-primary" />
              <span className="text-lg font-bold tracking-tight hidden sm:inline">ImmoControl</span>
              <span className="text-lg font-bold tracking-tight sm:hidden">IC</span>
            </Link>
            {breadcrumb}
          </div>
          <div className="flex items-center gap-1 min-w-0 flex-1 justify-end overflow-hidden">
            <div className="hidden md:block min-w-0 flex-1 overflow-x-auto overflow-y-hidden scrollbar-thin" aria-label="Navigation scrollbar">
              <nav ref={desktopNavRef} data-testid="sidebar" className="flex items-center gap-0.5 relative flex-nowrap py-1" role="navigation" aria-label={"Hauptnavigation (" + NAV_ITEM_COUNT + ")"}>
              {navEntries.map((entry) => {
                if (isGroup(entry)) {
                  const items = getGroupItems(entry);
                  const groupActive = items.some(i => isRouteActive(i.path, location.pathname));
                  return (
                    <div key={entry.label} className="relative">
                      <button
                        ref={openDropdown === entry.label ? openDropdownTriggerRef : undefined}
                        data-nav-top
                        onClick={(e) => { e.stopPropagation(); setOpenDropdown(openDropdown === entry.label ? null : entry.label); }}
                        className={`flex items-center gap-1.5 px-2.5 xl:px-3 py-2 rounded-lg text-xs xl:text-sm font-medium transition-all touch-target whitespace-nowrap shrink-0 ${
                          groupActive ? "bg-primary/10 text-primary" : "text-muted-foreground hover:text-foreground hover:bg-secondary"
                        }`}
                      >
                        <entry.icon className="h-4 w-4 shrink-0" />
                        {entry.label}
                        <ChevronDown className={`h-3 w-3 shrink-0 transition-transform duration-base ease-out-modern ${openDropdown === entry.label ? "rotate-180 opacity-100" : "opacity-50"}`} />
                      </button>
                      <div
                        ref={openDropdown === entry.label ? openDropdownPanelRef : undefined}
                        className={`absolute top-full left-0 z-[300] mt-1 min-w-[200px] overflow-hidden rounded-xl border border-border/80 bg-popover/95 text-popover-foreground shadow-md backdrop-blur-sm transition-all duration-base ease-out-modern ${
                          openDropdown === entry.label ? "opacity-100 visible translate-y-0" : "opacity-0 invisible -translate-y-1"
                        }`}
                      >
                        {items.map((item) => {
                          const isActive = isRouteActive(item.path, location.pathname);
                          const basePath = item.path.split("?")[0];
                          const navAttr = item.path === ROUTES.LOANS ? { "data-nav-loans": "" } : item.path === ROUTES.RENT ? { "data-nav-rent": "" } : item.path === ROUTES.CONTACTS ? { "data-nav-contacts": "" } : {};
                          return (
                            <Link
                              key={item.path}
                              to={item.path}
                              onMouseEnter={() => scheduleRoutePreload(basePath)}
                              onMouseLeave={cancelRoutePreload}
                              {...navAttr}
                              aria-current={isActive ? "page" : undefined}
                              className={`flex items-center gap-2 px-3 py-2 text-sm font-medium transition-colors ${
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
                        onMouseEnter={() => scheduleRoutePreload(entry.path.split("?")[0])}
                        onMouseLeave={cancelRoutePreload}
                        data-nav-top
                        data-nav-link
                        aria-current={isActive ? "page" : undefined}
                        className={`flex items-center gap-2 px-2.5 xl:px-3 py-2 rounded-lg text-xs xl:text-sm font-medium transition-all relative touch-target focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2 whitespace-nowrap shrink-0 ${
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
            </div>
            <div className="flex items-center gap-1.5 ml-2 min-w-0 shrink-0">
              <RecentPropertiesNav />
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-muted-foreground hover:text-foreground shrink-0"
                    onClick={() => window.dispatchEvent(new CustomEvent("open-command-palette"))}
                    aria-label="Schnellsuche öffnen (Strg+K)"
                  >
                    <Command className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="text-xs">Schnellsuche (Strg+K)</TooltipContent>
              </Tooltip>
              <GlobalSearch />
              <GamificationNavChip />
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
              {/* UX-2: Notification Center with History — uses NotificationBell for real notifications, Center removed to avoid duplicate bell icons */}
              <Tooltip>
                <TooltipTrigger asChild>
                  <Link to={ROUTES.SETTINGS} className="inline-flex items-center justify-center h-8 w-8 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors" aria-label="Einstellungen">
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
              <Button variant="ghost" size="icon" onClick={handleLogout} className="text-muted-foreground hover:text-foreground h-8 w-8" aria-label="Abmelden">
                <LogOut className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* FIX: Global Enter → next field handler for mobile keyboard navigation */}
      <main
        ref={mainContentRef}
        id="main-content"
        role="main"
        tabIndex={-1}
        className="flex-1 min-h-0 container py-6 md:py-8 lg:py-10 pb-[calc(7rem+env(safe-area-inset-bottom,0px))] md:pb-8 overflow-x-hidden overflow-y-auto min-w-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
        onKeyDown={enterToNextHandler}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
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
      <ActiveCallBar />
      <ImmoAIBubble mobileSubmenuExpanded={!!mobileActiveGroup} />

      {/* App update: neue Version (Railway/GitHub) — Jetzt aktualisieren / Später */}
      <MobileAppUpdateBanner />

      {/* MOB-11: Enhanced offline queue with action sync — mobile only */}
      <div className="md:hidden"><MobileOfflineQueue /></div>
      {/* UX-7: Desktop offline indicator (hidden on mobile where MobileOfflineQueue handles it) */}
      <div className="hidden md:flex md:items-center md:gap-2">
        <OfflineIndicator />
        {isFetching > 0 && (
          <span className="text-[10px] text-muted-foreground animate-pulse" role="status" aria-live="polite">
            Daten werden aktualisiert…
          </span>
        )}
      </div>

      {/* MOB-15: Mobile search overlay — close on backdrop tap; restore last expanded nav group */}
      <MobileSearchOverlay
        open={mobileSearchOpen}
        onClose={() => {
          setMobileSearchOpen(false);
          const prev = mobileActiveGroupBeforeSearchRef.current;
          if (prev != null) setMobileActiveGroup(prev);
        }}
      />

      {/* Mobile submenu backdrop — close submenu on outside click */}
      {mobileActiveGroup && (
        <div
          className="fixed inset-0 z-[199] md:hidden bg-black/20"
          onClick={() => setMobileActiveGroup(null)}
          aria-hidden
        />
      )}

      {/* Mobile nav — 5 grouped tabs with expandable sub-items */}
      {/* MOBILE-FIX-3: Added menu tab animation when switching between tabs */}
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
              <div className="border-b border-border bg-background/95 backdrop-blur-xl px-3 py-2 sub-nav-slide-in">
                <div className="grid grid-cols-3 gap-2 mobile-nav-sub-grid">
                  {getGroupItems(group).map((item, idx) => {
                    const isActive = isRouteActive(item.path, location.pathname);
                    const navAttr = item.path === ROUTES.LOANS ? { "data-nav-loans": "" } : item.path === ROUTES.RENT ? { "data-nav-rent": "" } : item.path === ROUTES.CONTACTS ? { "data-nav-contacts": "" } : {};
                    return (
                      <Link
                        key={item.path}
                        to={item.path}
                        {...navAttr}
                        onClick={() => setMobileActiveGroup(null)}
                        className={`flex flex-col items-center gap-1 px-2 py-2.5 rounded-xl nav-label-responsive font-medium transition-all duration-200 ${
                          isActive
                            ? "bg-primary/12 text-primary shadow-sm border border-primary/20"
                            : "text-muted-foreground hover:bg-secondary/60 hover:text-foreground border border-transparent"
                        }`}
                        style={{ animationDelay: `${idx * 30}ms` }}
                      >
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all shrink-0 ${
                          isActive ? "bg-primary/15 text-primary" : "bg-secondary/50 text-muted-foreground"
                        }`}>
                          <item.icon className="h-4 w-4" />
                        </div>
                        <span className="nav-label-wrap max-w-[72px] leading-tight">{item.label}</span>
                      </Link>
                    );
                  })}
                </div>
              </div>
            );
          })()}
        {/* MOBILE-FIX-2: Bottom tab bar — evenly spaced with proper sizing */}
        {/* MOB-15: Mobile search trigger button in bottom nav */}
        <div ref={mobileNavRef} className="flex items-center justify-around py-1 relative">
          <button
            onClick={() => {
              mobileActiveGroupBeforeSearchRef.current = mobileActiveGroup;
              setMobileSearchOpen(true);
            }}
            className="flex flex-col items-center justify-center gap-0.5 min-w-0 flex-1 py-1 rounded-lg nav-label-responsive font-medium transition-all duration-200 relative active:scale-95 text-muted-foreground"
            aria-label="Suche öffnen"
          >
            <Search className="h-4 w-4 shrink-0" />
            <span className="nav-label-wrap max-w-[56px] leading-tight">Suche</span>
          </button>
          {navEntries.map((entry) => {
            if (isGroup(entry)) {
              const groupActive = getGroupItems(entry).some(i => isRouteActive(i.path, location.pathname));
              const isExpanded = mobileActiveGroup === entry.label;
              return (
                <button
                  key={entry.label}
                  onClick={() => setMobileActiveGroup(isExpanded ? null : entry.label)}
                  className={`flex flex-col items-center justify-center gap-0.5 min-w-0 flex-1 py-1 rounded-lg nav-label-responsive font-medium transition-all duration-200 relative active:scale-95 ${
                    groupActive || isExpanded ? "text-primary scale-105" : "text-muted-foreground"
                  }`}
                >
                  <entry.icon className="h-4 w-4 shrink-0" />
                  <span className="nav-label-wrap max-w-[56px] leading-tight">{entry.label}</span>
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
                className={`flex flex-col items-center justify-center gap-0.5 min-w-0 flex-1 py-1 rounded-lg nav-label-responsive font-medium transition-all duration-200 relative active:scale-95 ${
                  isActive ? "text-primary scale-105" : "text-muted-foreground"
                }`}
              >
                <item.icon className="h-4 w-4 shrink-0" />
                <span className="nav-label-wrap max-w-[56px] leading-tight">{item.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
};

export default AppLayout;
