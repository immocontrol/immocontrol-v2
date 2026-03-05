/**
 * MOB5-4: Mobile Tab Switcher
 * Swipe-enabled tab view with horizontal scroll tab bar.
 * Touch-optimized with smooth transitions and indicator animation.
 */
import { useState, useRef, useCallback, useEffect, memo, type ReactNode } from "react";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";

export interface TabItem {
  /** Unique tab key */
  key: string;
  /** Tab label */
  label: string;
  /** Tab content */
  content: ReactNode;
  /** Optional icon */
  icon?: ReactNode;
  /** Badge count */
  badge?: number;
  /** Disabled state */
  disabled?: boolean;
}

interface MobileTabSwitcherProps {
  /** Tab definitions */
  tabs: TabItem[];
  /** Active tab key */
  activeTab?: string;
  /** Tab change handler */
  onTabChange?: (key: string) => void;
  /** Allow swipe between tabs on mobile */
  swipeable?: boolean;
  /** Additional class */
  className?: string;
}

export const MobileTabSwitcher = memo(function MobileTabSwitcher({
  tabs,
  activeTab,
  onTabChange,
  swipeable = true,
  className,
}: MobileTabSwitcherProps) {
  const isMobile = useIsMobile();
  const [currentTab, setCurrentTab] = useState(activeTab || tabs[0]?.key || "");
  const tabBarRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const touchStartX = useRef(0);
  const touchStartY = useRef(0);

  const activeIndex = tabs.findIndex(t => t.key === currentTab);

  // Sync external activeTab
  useEffect(() => {
    if (activeTab && activeTab !== currentTab) {
      setCurrentTab(activeTab);
    }
  }, [activeTab, currentTab]);

  // Auto-scroll tab bar to show active tab
  useEffect(() => {
    if (tabBarRef.current) {
      const activeBtn = tabBarRef.current.children[activeIndex] as HTMLElement;
      if (activeBtn) {
        const container = tabBarRef.current;
        const scrollLeft = activeBtn.offsetLeft - container.offsetWidth / 2 + activeBtn.offsetWidth / 2;
        container.scrollTo({ left: Math.max(0, scrollLeft), behavior: "smooth" });
      }
    }
  }, [activeIndex]);

  const switchTab = useCallback((key: string) => {
    const tab = tabs.find(t => t.key === key);
    if (tab && !tab.disabled) {
      setCurrentTab(key);
      onTabChange?.(key);
    }
  }, [tabs, onTabChange]);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (!swipeable || !isMobile) return;
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
  }, [swipeable, isMobile]);

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    if (!swipeable || !isMobile) return;
    const deltaX = e.changedTouches[0].clientX - touchStartX.current;
    const deltaY = e.changedTouches[0].clientY - touchStartY.current;

    // Only handle horizontal swipes (not vertical scrolls)
    if (Math.abs(deltaX) > 60 && Math.abs(deltaX) > Math.abs(deltaY) * 1.5) {
      if (deltaX < 0 && activeIndex < tabs.length - 1) {
        // Swipe left → next tab
        const nextTab = tabs[activeIndex + 1];
        if (nextTab && !nextTab.disabled) switchTab(nextTab.key);
      } else if (deltaX > 0 && activeIndex > 0) {
        // Swipe right → prev tab
        const prevTab = tabs[activeIndex - 1];
        if (prevTab && !prevTab.disabled) switchTab(prevTab.key);
      }
    }
  }, [swipeable, isMobile, activeIndex, tabs, switchTab]);

  const activeContent = tabs.find(t => t.key === currentTab)?.content;

  return (
    <div className={cn("w-full", className)}>
      {/* Tab bar */}
      <div
        ref={tabBarRef}
        className={cn(
          "flex border-b overflow-x-auto scrollbar-none",
          isMobile && "gap-0"
        )}
        role="tablist"
        style={{ WebkitOverflowScrolling: "touch" }}
      >
        {tabs.map(tab => {
          const isActive = tab.key === currentTab;
          return (
            <button
              key={tab.key}
              role="tab"
              aria-selected={isActive}
              aria-disabled={tab.disabled}
              onClick={() => switchTab(tab.key)}
              disabled={tab.disabled}
              className={cn(
                "relative flex items-center gap-1.5 px-3 py-2.5 text-xs font-medium shrink-0",
                "transition-colors whitespace-nowrap",
                isMobile && "min-h-[44px] px-4",
                isActive
                  ? "text-primary"
                  : "text-muted-foreground hover:text-foreground",
                tab.disabled && "opacity-40 cursor-not-allowed"
              )}
            >
              {tab.icon}
              <span>{tab.label}</span>
              {tab.badge !== undefined && tab.badge > 0 && (
                <span className={cn(
                  "ml-1 px-1.5 py-0.5 rounded-full text-[10px] font-semibold",
                  isActive
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground"
                )}>
                  {tab.badge > 99 ? "99+" : tab.badge}
                </span>
              )}
              {/* Active indicator */}
              {isActive && (
                <span className="absolute bottom-0 left-2 right-2 h-0.5 bg-primary rounded-full" />
              )}
            </button>
          );
        })}
      </div>

      {/* Content area */}
      <div
        ref={contentRef}
        className="w-full"
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        {activeContent}
      </div>
    </div>
  );
});
