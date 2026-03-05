/**
 * FUND-3: File splitting guide — documents which files exceed 500 lines
 * and provides a refactoring strategy for splitting them into smaller modules.
 *
 * This module provides utilities for component composition patterns
 * that help keep files under the 500-line threshold.
 */

/**
 * FUND-3: Large file inventory (>500 lines) and recommended splits.
 *
 * | File                      | Lines | Recommended Split                           |
 * |---------------------------|-------|---------------------------------------------|
 * | BankMatching.tsx          | 1040  | BankMatchingTable, BankMatchingFilters, BankMatchingImport |
 * | CRM.tsx                   |  952  | CrmLeadList, CrmLeadDetail, CrmFilters      |
 * | TicketSystem.tsx          |  950  | TicketList, TicketDetail, TicketForm         |
 * | Newsticker.tsx            |  920  | NewstickerFeed, NewstickerFilters, NewstickerBookmarks |
 * | ImmobilienBewertung.tsx   |  917  | BewertungForm, BewertungResult, BewertungPDF |
 * | Deals.tsx                 |  917  | DealList, DealDetail, DealForm, DealPipeline |
 * | Loans.tsx                 |  903  | LoanList, LoanDetail, LoanForm, LoanChart   |
 * | Dashboard.tsx             |  883  | DashboardStats, DashboardCharts, DashboardWidgets |
 * | AppLayout.tsx             |  843  | Sidebar, TopNav, MobileNav, LayoutShell     |
 * | HockeyStickSimulator.tsx  |  800  | SimulatorForm, SimulatorChart, SimulatorResults |
 * | Todos.tsx                 |  795  | TodoList, TodoForm, TodoFilters              |
 * | TenantPortal.tsx          |  736  | PortalDashboard, PortalDocuments, PortalChat |
 * | Auth.tsx                  |  682  | LoginForm, RegisterForm, ResetForm, TwoFactorForm |
 */

/**
 * FUND-3: Higher-order component pattern for splitting large components.
 * Composes multiple sub-components into a single page layout.
 */
export function composePageSections<T extends Record<string, React.ComponentType<Record<string, unknown>>>>(
  sections: T,
): T {
  return sections;
}

/**
 * FUND-3: Utility to create a section registry for large pages.
 * Allows dynamic rendering of sections based on active tab/view.
 */
export interface PageSection {
  id: string;
  label: string;
  component: React.ComponentType<Record<string, unknown>>;
  /** Only render when this condition is true */
  visible?: boolean;
  /** Icon name for tab navigation */
  icon?: string;
}

export function createSectionRegistry(sections: PageSection[]): {
  getSection: (id: string) => PageSection | undefined;
  getVisibleSections: () => PageSection[];
  getSectionIds: () => string[];
} {
  return {
    getSection: (id) => sections.find((s) => s.id === id),
    getVisibleSections: () => sections.filter((s) => s.visible !== false),
    getSectionIds: () => sections.map((s) => s.id),
  };
}

/**
 * FUND-3: Extract constants and types from large files into separate modules.
 * This is a documentation-only type showing the pattern.
 */
export type ExtractedModule = {
  /** Types/interfaces extracted to types.ts */
  types: string;
  /** Constants extracted to constants.ts */
  constants: string;
  /** Utility functions extracted to utils.ts */
  utils: string;
  /** Sub-components extracted to components/ directory */
  components: string[];
  /** Hooks extracted to hooks/ directory */
  hooks: string[];
};
