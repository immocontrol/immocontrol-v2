/**
 * Deals page — shared helpers and constants (extracted for smaller Deals.tsx).
 */
import { formatCurrency } from "@/lib/formatters";
import type { DealRecord } from "./DealTypes";
import { emptyForm } from "./DealTypes";

/** UPD-11: Deal age color for list/card display */
export function getDealAgeColor(days: number): string {
  if (days <= 7) return "text-green-600";
  if (days <= 30) return "text-yellow-600";
  return "text-red-500";
}

/** UPD-12: Validate deal form before save */
export function isFormValid(form: typeof emptyForm): boolean {
  return form.title.trim().length > 0;
}

/** UPD-13: Shared currency formatter for deals */
export const formatDealCurrency = (n: number) => formatCurrency(n);

/** UPD-17: Sort options for list view */
export type SortKey = "created_at" | "title" | "purchase_price" | "stage";
export const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: "created_at", label: "Erstellt" },
  { key: "title", label: "Titel" },
  { key: "purchase_price", label: "Preis" },
  { key: "stage", label: "Stage" },
];

/** UPD-29: Filter and sort deals (pure, for useMemo in page) */
export function filterAndSortDeals(
  deals: DealRecord[],
  searchQuery: string,
  sortKey: SortKey,
  sortAsc: boolean,
): DealRecord[] {
  const list = Array.isArray(deals) ? deals : [];
  let result = [...list];
  if (searchQuery) {
    const q = searchQuery.toLowerCase();
    result = result.filter(d =>
      d.title.toLowerCase().includes(q) ||
      d.address?.toLowerCase().includes(q) ||
      d.contact_name?.toLowerCase().includes(q) ||
      d.source?.toLowerCase().includes(q),
    );
  }
  result.sort((a, b) => {
    const av = a[sortKey] ?? "";
    const bv = b[sortKey] ?? "";
    if (typeof av === "number" && typeof bv === "number") return sortAsc ? av - bv : bv - av;
    return sortAsc
      ? String(av).localeCompare(String(bv), "de")
      : String(bv).localeCompare(String(av), "de");
  });
  return result;
}
