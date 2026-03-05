/**
 * MOB3-17: Mobile PropertyDetail Bottom Navigation
 * Tab-based navigation between Overview/Tenants/Documents/Tickets on PropertyDetail.
 * Replaces long vertical scroll on mobile with horizontal tab switching.
 * Safari-safe: uses env(safe-area-inset-bottom) and CSS transforms.
 */
import { memo, useState, useCallback, type ReactNode } from "react";
import { Home, Users, FileText, Wrench } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";
import { useHaptic } from "@/hooks/useHaptic";
import { cn } from "@/lib/utils";

export interface PropertyTab {
  id: string;
  label: string;
  icon: ReactNode;
  badge?: number;
  content: ReactNode;
}

const DEFAULT_TABS: Pick<PropertyTab, "id" | "label" | "icon">[] = [
  { id: "overview", label: "Übersicht", icon: <Home className="h-4 w-4" /> },
  { id: "tenants", label: "Mieter", icon: <Users className="h-4 w-4" /> },
  { id: "documents", label: "Dokumente", icon: <FileText className="h-4 w-4" /> },
  { id: "maintenance", label: "Wartung", icon: <Wrench className="h-4 w-4" /> },
];

interface MobilePropertyDetailTabsProps {
  tabs?: PropertyTab[];
  /** Default tab IDs if not providing full tabs */
  defaultTabIds?: string[];
  /** Content per tab ID */
  tabContent?: Record<string, ReactNode>;
  /** Badge counts per tab ID */
  badges?: Record<string, number>;
  className?: string;
}

export const MobilePropertyDetailTabs = memo(function MobilePropertyDetailTabs({
  tabs, tabContent, badges, className,
}: MobilePropertyDetailTabsProps) {
  const isMobile = useIsMobile();
  const haptic = useHaptic();
  const [activeTab, setActiveTab] = useState(tabs?.[0]?.id || DEFAULT_TABS[0].id);

  const handleTabChange = useCallback((tabId: string) => {
    haptic.tap();
    setActiveTab(tabId);
  }, [haptic]);

  if (!isMobile) return null;

  const resolvedTabs = tabs || DEFAULT_TABS.map(t => ({
    ...t,
    badge: badges?.[t.id],
    content: tabContent?.[t.id] || null,
  }));

  const activeContent = resolvedTabs.find(t => t.id === activeTab)?.content;

  return (
    <div className={cn("flex flex-col min-h-0", className)}>
      {/* Tab content area */}
      <div className="flex-1 min-h-0 overflow-y-auto pb-16">
        {activeContent}
      </div>

      {/* Bottom tab bar */}
      <div
        className="fixed bottom-0 left-0 right-0 z-[190] bg-background/95 backdrop-blur-md border-t border-border"
        style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
        role="tablist"
        aria-label="Immobilien-Details Navigation"
      >
        <div className="flex items-center justify-around">
          {resolvedTabs.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => handleTabChange(tab.id)}
                className={cn(
                  "flex flex-col items-center gap-0.5 py-2 px-3 min-w-[60px] transition-colors",
                  "active:scale-95 transform-gpu",
                  isActive ? "text-primary" : "text-muted-foreground",
                )}
                role="tab"
                aria-selected={isActive}
                aria-controls={`tabpanel-${tab.id}`}
              >
                <div className="relative">
                  {tab.icon}
                  {tab.badge !== undefined && tab.badge > 0 && (
                    <span className="absolute -top-1 -right-1.5 min-w-[14px] h-3.5 px-0.5 rounded-full bg-destructive text-destructive-foreground text-[8px] font-bold flex items-center justify-center">
                      {tab.badge > 99 ? "99+" : tab.badge}
                    </span>
                  )}
                </div>
                <span className="text-[10px] font-medium">{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
});
