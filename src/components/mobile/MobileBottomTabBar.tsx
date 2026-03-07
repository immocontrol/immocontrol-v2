/**
 * MOB-1: Bottom Tab Bar Redesign
 * Native-style bottom tab bar with 5 main tabs, animated indicator,
 * haptic feedback, and badge counters for open tasks.
 */
import { memo, useState, useCallback, useEffect, useRef } from "react";
import { Link, useLocation } from "react-router-dom";
import { LayoutDashboard, Sparkles, Landmark, FileText, Target, Settings, ChevronUp, X, Camera } from "lucide-react";
import { useHaptic } from "@/hooks/useHaptic";
import { cn } from "@/lib/utils";

interface TabItem {
  path: string;
  label: string;
  icon: typeof LayoutDashboard;
  /** Sub-items for expandable groups */
  children?: { path: string; label: string; icon: typeof LayoutDashboard }[];
}

const TABS: TabItem[] = [
  { path: "/", label: "Portfolio", icon: LayoutDashboard },
  { path: "/dashboard", label: "Dashboard", icon: Sparkles },
  {
    path: "/darlehen", label: "Finanzen", icon: Landmark,
    children: [
      { path: "/darlehen", label: "Darlehen", icon: Landmark },
      { path: "/mietuebersicht", label: "Mieten", icon: Landmark },
      { path: "/nebenkosten", label: "Nebenkosten", icon: Landmark },
      { path: "/forecast", label: "Cashflow", icon: Landmark },
      { path: "/berichte", label: "Berichte", icon: Landmark },
      { path: "/analyse", label: "Rechner", icon: Landmark },
    ],
  },
  {
    path: "/vertraege", label: "Verwaltung", icon: FileText,
    children: [
      { path: "/vertraege", label: "Verträge", icon: FileText },
      { path: "/kontakte", label: "Kontakte", icon: FileText },
      { path: "/aufgaben", label: "Aufgaben", icon: FileText },
      { path: "/dokumente", label: "Dokumente", icon: FileText },
      { path: "/wartungsplaner", label: "Wartung", icon: FileText },
    ],
  },
  {
    path: "/crm", label: "Akquise", icon: Target,
    children: [
      { path: "/crm", label: "CRM", icon: Target },
      { path: "/deals", label: "Deals", icon: Target },
      { path: "/besichtigungen", label: "Besichtigungen", icon: Camera },
      { path: "/newsticker", label: "Newsticker", icon: Target },
      { path: "/bewertung", label: "Bewertung", icon: Target },
      { path: "/immo-ai", label: "ImmoAI", icon: Target },
    ],
  },
  {
    path: "/einstellungen", label: "Mehr", icon: Settings,
    children: [
      { path: "/einstellungen", label: "Einstellungen", icon: Settings },
      { path: "/analyse", label: "Rechner", icon: Settings },
      { path: "/berichte", label: "Berichte", icon: Settings },
    ],
  },
];

const isActive = (tabPath: string, currentPath: string, children?: TabItem["children"]): boolean => {
  if (children) {
    return children.some(c => currentPath === c.path || (c.path !== "/" && currentPath.startsWith(c.path)));
  }
  return tabPath === "/" ? currentPath === "/" : currentPath.startsWith(tabPath);
};

interface MobileBottomTabBarProps {
  visible: boolean;
  taskCount?: number;
}

export const MobileBottomTabBar = memo(function MobileBottomTabBar({ visible, taskCount = 0 }: MobileBottomTabBarProps) {
  const location = useLocation();
  const haptic = useHaptic();
  const [expandedGroup, setExpandedGroup] = useState<string | null>(null);
  const indicatorRef = useRef<HTMLDivElement>(null);
  const tabsRef = useRef<HTMLDivElement>(null);

  // Close expanded group on route change
  useEffect(() => {
    setExpandedGroup(null);
  }, [location.pathname]);

  // Update sliding indicator position
  useEffect(() => {
    if (!tabsRef.current || !indicatorRef.current) return;
    const activeIdx = TABS.findIndex(t => isActive(t.path, location.pathname, t.children));
    if (activeIdx < 0) return;
    const tabEls = tabsRef.current.querySelectorAll("[data-tab-item]");
    const el = tabEls[activeIdx] as HTMLElement | undefined;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const parentRect = tabsRef.current.getBoundingClientRect();
    indicatorRef.current.style.left = `${rect.left - parentRect.left + rect.width / 2 - 10}px`;
    indicatorRef.current.style.opacity = "1";
  }, [location.pathname]);

  const handleTabClick = useCallback((tab: TabItem) => {
    haptic.tap();
    if (tab.children) {
      setExpandedGroup(prev => prev === tab.label ? null : tab.label);
    } else {
      setExpandedGroup(null);
    }
  }, [haptic]);

  const handleSubItemClick = useCallback(() => {
    haptic.tap();
    setExpandedGroup(null);
  }, [haptic]);

  return (
    <nav
      className={cn(
        "fixed bottom-0 left-0 right-0 z-[200] md:hidden transition-all duration-300",
        visible ? "translate-y-0 opacity-100" : "translate-y-full opacity-0",
      )}
      role="navigation"
      aria-label="Mobile Navigation"
      style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
    >
      {/* Expanded group sub-items */}
      {expandedGroup && (() => {
        const group = TABS.find(t => t.label === expandedGroup);
        if (!group?.children) return null;
        return (
          <div className="bg-background/98 backdrop-blur-xl border-t border-border px-3 py-2 animate-fade-in">
            <div className="flex items-center justify-between mb-2 px-1">
              <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">{expandedGroup}</span>
              <button onClick={() => setExpandedGroup(null)} className="p-1 rounded-md hover:bg-secondary">
                <X className="h-3 w-3 text-muted-foreground" />
              </button>
            </div>
            <div className="grid grid-cols-3 gap-1.5">
              {group.children.map((child, idx) => {
                const childActive = location.pathname === child.path;
                return (
                  <Link
                    key={child.path}
                    to={child.path}
                    onClick={handleSubItemClick}
                    className={cn(
                      "flex flex-col items-center gap-1 px-2 py-2.5 rounded-xl text-[10px] font-medium transition-all",
                      childActive
                        ? "bg-primary/12 text-primary shadow-sm border border-primary/20"
                        : "text-muted-foreground hover:bg-secondary/60 border border-transparent",
                    )}
                    style={{ animationDelay: `${idx * 30}ms` }}
                  >
                    <child.icon className="h-4 w-4" />
                    <span className="truncate max-w-full leading-tight">{child.label}</span>
                  </Link>
                );
              })}
            </div>
          </div>
        );
      })()}

      {/* Main tab bar */}
      <div className="bg-background/95 backdrop-blur-xl border-t border-border">
        <div ref={tabsRef} className="flex items-center justify-around py-1.5 relative">
          {/* Sliding indicator */}
          <div
            ref={indicatorRef}
            className="absolute -top-[1px] w-5 h-[3px] rounded-full bg-primary transition-all duration-300 ease-out"
            style={{ opacity: 0 }}
          />

          {TABS.map((tab) => {
            const active = isActive(tab.path, location.pathname, tab.children);
            const isExpanded = expandedGroup === tab.label;

            if (tab.children) {
              return (
                <button
                  key={tab.label}
                  data-tab-item
                  onClick={() => handleTabClick(tab)}
                  className={cn(
                    "flex flex-col items-center justify-center gap-0.5 min-w-0 flex-1 py-1 text-[10px] font-medium transition-all duration-200 relative active:scale-95",
                    active || isExpanded ? "text-primary" : "text-muted-foreground",
                  )}
                >
                  <div className="relative">
                    <tab.icon className={cn("h-5 w-5 transition-transform", active && "scale-110")} />
                    {tab.label === "Verwaltung" && taskCount > 0 && (
                      <span className="absolute -top-1.5 -right-2 min-w-[16px] h-4 px-1 rounded-full bg-primary text-primary-foreground text-[9px] font-bold flex items-center justify-center">
                        {taskCount > 99 ? "99+" : taskCount}
                      </span>
                    )}
                  </div>
                  <span className="truncate max-w-[52px] leading-tight">{tab.label}</span>
                  {isExpanded && (
                    <ChevronUp className="absolute -top-1 h-2.5 w-2.5 text-primary animate-pulse" />
                  )}
                </button>
              );
            }

            return (
              <Link
                key={tab.path}
                to={tab.path}
                data-tab-item
                onClick={() => handleTabClick(tab)}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex flex-col items-center justify-center gap-0.5 min-w-0 flex-1 py-1 text-[10px] font-medium transition-all duration-200 relative active:scale-95",
                  active ? "text-primary" : "text-muted-foreground",
                )}
              >
                <tab.icon className={cn("h-5 w-5 transition-transform", active && "scale-110")} />
                <span className="truncate max-w-[52px] leading-tight">{tab.label}</span>
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
});
