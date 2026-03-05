/**
 * FUND-7: React.memo helpers — utilities for memoizing expensive components
 * and creating custom comparison functions for React.memo.
 */

/**
 * FUND-7: Shallow comparison that handles arrays and dates.
 * Use as the second argument to React.memo for components with
 * array/date props that change reference but not value.
 */
export function shallowPropsEqual<T extends Record<string, unknown>>(
  prevProps: Readonly<T>,
  nextProps: Readonly<T>,
): boolean {
  const prevKeys = Object.keys(prevProps);
  const nextKeys = Object.keys(nextProps);

  if (prevKeys.length !== nextKeys.length) return false;

  for (const key of prevKeys) {
    const prev = prevProps[key];
    const next = nextProps[key];

    if (prev === next) continue;

    // Handle Date comparison
    if (prev instanceof Date && next instanceof Date) {
      if (prev.getTime() !== next.getTime()) return false;
      continue;
    }

    // Handle shallow array comparison
    if (Array.isArray(prev) && Array.isArray(next)) {
      if (prev.length !== next.length) return false;
      if (prev.some((v, i) => v !== next[i])) return false;
      continue;
    }

    return false;
  }

  return true;
}

/**
 * FUND-7: Create a memo comparison function that only checks specific props.
 * Useful when a component receives many props but only re-renders for a few.
 */
export function createPropsComparator<T extends Record<string, unknown>>(
  keys: Array<keyof T>,
): (prev: Readonly<T>, next: Readonly<T>) => boolean {
  return (prev, next) => {
    for (const key of keys) {
      if (prev[key] !== next[key]) return false;
    }
    return true;
  };
}

/**
 * FUND-7: List of components that should be wrapped with React.memo.
 * This serves as documentation for the memoization strategy.
 *
 * Already memoized:
 * - StatCard (src/components/StatCard.tsx)
 * - PropertyCard (src/components/PropertyCard.tsx)
 * - VirtualList (src/components/VirtualList.tsx)
 *
 * Candidates for memoization:
 * - DashboardWidgetGrid children (chart components)
 * - CRM lead cards in list view
 * - Todo list items
 * - Contact list items
 * - Loan list items
 * - Deal pipeline cards
 * - Sidebar navigation items
 * - Chart tooltip components
 */
export const MEMO_CANDIDATES = [
  "DashboardWidgetGrid",
  "CrmLeadCard",
  "TodoItem",
  "ContactCard",
  "LoanCard",
  "DealCard",
  "SidebarNavItem",
  "ChartTooltip",
] as const;
