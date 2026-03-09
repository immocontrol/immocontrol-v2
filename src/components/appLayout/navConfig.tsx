/**
 * AppLayout Nav-Konfiguration — ausgelagert für bessere Wartbarkeit (Refactor großer Dateien).
 * Pfade aus ROUTES (Single Source of Truth).
 */
import {
  LayoutDashboard,
  Building2,
  Sparkles,
  Landmark,
  Wallet,
  Receipt,
  Calculator,
  FileBarChart,
  TrendingUp,
  FileText,
  Users,
  CheckSquare,
  FolderOpen,
  Wrench,
  Target,
  Handshake,
  Newspaper,
  Camera,
  RefreshCw,
  ShieldAlert,
  PieChart,
  Scale,
  Bell,
} from "lucide-react";
import { ROUTES } from "@/lib/routes";

export interface NavItem {
  path: string;
  label: string;
  icon: typeof LayoutDashboard;
  shortcut: string;
}

export interface NavGroup {
  label: string;
  icon: typeof LayoutDashboard;
  items: NavItem[];
}

export type NavEntry = NavItem | NavGroup;

export const isGroup = (e: NavEntry): e is NavGroup => "items" in e;

export const navEntries: NavEntry[] = [
  { path: ROUTES.HOME, label: "Portfolio", icon: LayoutDashboard, shortcut: "1" },
  { path: ROUTES.PERSONAL_DASHBOARD, label: "Dashboard", icon: Sparkles, shortcut: "" },
  {
    label: "Finanzen",
    icon: Landmark,
    items: [
      { path: ROUTES.FINANZIERUNG, label: "Finanzierungs-Cockpit", icon: Wallet, shortcut: "" },
      { path: ROUTES.LOANS, label: "Darlehen", icon: Landmark, shortcut: "2" },
      { path: ROUTES.RENT, label: "Mieten", icon: Receipt, shortcut: "3" },
      { path: ROUTES.NK, label: "Nebenkosten", icon: Receipt, shortcut: "" },
      { path: ROUTES.FORECAST, label: "Cashflow-Prognose", icon: Calculator, shortcut: "" },
      { path: ROUTES.STEUER_COCKPIT, label: "Steuer-Cockpit", icon: Receipt, shortcut: "" },
      { path: ROUTES.REFINANZIERUNG, label: "Refinanzierung", icon: RefreshCw, shortcut: "" },
      { path: ROUTES.STRESS_TEST, label: "Stress-Test", icon: ShieldAlert, shortcut: "" },
      { path: ROUTES.DIVERSIFIKATION, label: "Diversifikation", icon: PieChart, shortcut: "" },
      { path: ROUTES.MIETSPIEGEL, label: "Mietspiegel-Check", icon: Scale, shortcut: "" },
      { path: ROUTES.KPI_ZEITREISE, label: "KPIs im Zeitverlauf", icon: TrendingUp, shortcut: "" },
      { path: ROUTES.REPORTS, label: "Berichte", icon: FileBarChart, shortcut: "7" },
      { path: ROUTES.ANALYSE, label: "Rechner", icon: Calculator, shortcut: "" },
      { path: ROUTES.HOCKEY_STICK, label: "Hockey Stick Simulator", icon: TrendingUp, shortcut: "" },
    ],
  },
  {
    label: "Verwaltung",
    icon: FileText,
    items: [
      { path: ROUTES.OBJEKTE, label: "Objekte", icon: Building2, shortcut: "" },
      { path: ROUTES.SYNDICATION, label: "Syndication", icon: Users, shortcut: "" },
      { path: ROUTES.BENACHRICHTIGUNGEN, label: "Benachrichtigungen", icon: Bell, shortcut: "" },
      { path: ROUTES.CONTRACTS, label: "Verträge", icon: FileText, shortcut: "4" },
      { path: ROUTES.CONTACTS, label: "Kontakte", icon: Users, shortcut: "5" },
      { path: ROUTES.TODOS, label: "Aufgaben", icon: CheckSquare, shortcut: "6" },
      { path: ROUTES.DOKUMENTE, label: "Dokumente", icon: FolderOpen, shortcut: "" },
      { path: ROUTES.WARTUNG, label: "Wartung", icon: Wrench, shortcut: "" },
    ],
  },
  {
    label: "Akquise",
    icon: Target,
    items: [
      { path: ROUTES.CRM, label: "CRM", icon: Target, shortcut: "8" },
      { path: ROUTES.DEALS, label: "Deals", icon: Handshake, shortcut: "0" },
      { path: ROUTES.DEAL_BENCHMARK, label: "Deal-Benchmark", icon: TrendingUp, shortcut: "" },
      { path: ROUTES.BESICHTIGUNGEN, label: "Besichtigungen", icon: Camera, shortcut: "" },
      { path: ROUTES.NEWSTICKER, label: "Newsticker", icon: Newspaper, shortcut: "" },
      { path: ROUTES.BEWERTUNG, label: "Schnellbewertung", icon: TrendingUp, shortcut: "" },
    ],
  },
];

export const navItems: NavItem[] = navEntries.flatMap((e) => (isGroup(e) ? e.items : [e]));

export const desktopTopLevelEntries = navEntries.map((entry, idx) => ({
  idx,
  isGroup: isGroup(entry),
  paths: isGroup(entry) ? entry.items.map((i) => i.path) : [(entry as NavItem).path],
}));

const DEFAULT_SHORTCUT_MAP: Record<string, string> = {};
navItems.forEach((n) => {
  if (n.shortcut) DEFAULT_SHORTCUT_MAP[`Alt+${n.shortcut}`] = n.path;
});

export const ACTION_TO_PATH: Record<string, string> = {
  "Navigation: Portfolio": ROUTES.HOME,
  "Navigation: Objekte": ROUTES.OBJEKTE,
  "Navigation: Dashboard": ROUTES.PERSONAL_DASHBOARD,
  "Navigation: Darlehen": ROUTES.LOANS,
  "Navigation: Mieten": ROUTES.RENT,
  "Navigation: Verträge": ROUTES.CONTRACTS,
  "Navigation: Kontakte": ROUTES.CONTACTS,
  "Navigation: Aufgaben": ROUTES.TODOS,
  "Navigation: Berichte": ROUTES.REPORTS,
  "Navigation: CRM": ROUTES.CRM,
  "Navigation: Deals": ROUTES.DEALS,
  "Navigation: Besichtigungen": ROUTES.BESICHTIGUNGEN,
  "Navigation: Hockey Stick Simulator": ROUTES.HOCKEY_STICK,
  "Navigation: Einstellungen": ROUTES.SETTINGS,
  "Navigation: Steuer-Cockpit": ROUTES.STEUER_COCKPIT,
  "Navigation: Refinanzierung": ROUTES.REFINANZIERUNG,
  "Navigation: Stress-Test": ROUTES.STRESS_TEST,
  "Navigation: Diversifikation": ROUTES.DIVERSIFIKATION,
  "Navigation: Mietspiegel-Check": ROUTES.MIETSPIEGEL,
  "Navigation: KPIs im Zeitverlauf": ROUTES.KPI_ZEITREISE,
  "Navigation: Benachrichtigungen": ROUTES.BENACHRICHTIGUNGEN,
  "Navigation: Syndication": ROUTES.SYNDICATION,
  "Navigation: Deal-Benchmark": ROUTES.DEAL_BENCHMARK,
};

export function getDefaultShortcutMap(): Record<string, string> {
  return { ...DEFAULT_SHORTCUT_MAP };
}

/** Route matching: root path exact, others prefix */
export const isRouteActive = (itemPath: string, currentPath: string): boolean =>
  itemPath === "/" ? currentPath === "/" : currentPath.startsWith(itemPath);

export const NAV_ITEM_COUNT = navItems.length;

/** Normalize combo string to canonical modifier order */
export function normalizeCombo(raw: string): string {
  const parts = raw.toLowerCase().replace(/\s/g, "").split("+");
  const modifiers: string[] = [];
  const keys: string[] = [];
  for (const p of parts) {
    if (p === "ctrl" || p === "meta") {
      if (!modifiers.includes("ctrl")) modifiers.push("ctrl");
    } else if (p === "alt") {
      if (!modifiers.includes("alt")) modifiers.push("alt");
    } else if (p === "shift") {
      if (!modifiers.includes("shift")) modifiers.push("shift");
    } else keys.push(p);
  }
  const ordered: string[] = [];
  if (modifiers.includes("ctrl")) ordered.push("ctrl");
  if (modifiers.includes("alt")) ordered.push("alt");
  if (modifiers.includes("shift")) ordered.push("shift");
  return [...ordered, ...keys].join("+");
}

/** Build combo→path map from localStorage custom shortcuts or defaults */
export function buildShortcutMap(): Record<string, string> {
  try {
    const stored = localStorage.getItem("immocontrol_shortcuts");
    if (stored) {
      const custom = JSON.parse(stored) as Record<string, string>;
      const map: Record<string, string> = {};
      for (const [action, combo] of Object.entries(custom)) {
        const path = ACTION_TO_PATH[action];
        if (path && combo) map[normalizeCombo(combo)] = path;
      }
      if (Object.keys(map).length > 0) return map;
    }
  } catch {
    /* ignore */
  }
  const map: Record<string, string> = {};
  for (const [combo, path] of Object.entries(DEFAULT_SHORTCUT_MAP)) {
    map[normalizeCombo(combo)] = path;
  }
  return map;
}
