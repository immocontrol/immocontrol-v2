/**
 * AppLayout Nav-Konfiguration — ausgelagert für bessere Wartbarkeit (Refactor großer Dateien).
 */
import {
  LayoutDashboard,
  Building2,
  Sparkles,
  Landmark,
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
} from "lucide-react";

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
  { path: "/", label: "Portfolio", icon: LayoutDashboard, shortcut: "1" },
  { path: "/dashboard", label: "Dashboard", icon: Sparkles, shortcut: "" },
  {
    label: "Finanzen",
    icon: Landmark,
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
    label: "Verwaltung",
    icon: FileText,
    items: [
      { path: "/objekte", label: "Objekte", icon: Building2, shortcut: "" },
      { path: "/vertraege", label: "Verträge", icon: FileText, shortcut: "4" },
      { path: "/kontakte", label: "Kontakte", icon: Users, shortcut: "5" },
      { path: "/aufgaben", label: "Aufgaben", icon: CheckSquare, shortcut: "6" },
      { path: "/dokumente", label: "Dokumente", icon: FolderOpen, shortcut: "" },
      { path: "/wartungsplaner", label: "Wartung", icon: Wrench, shortcut: "" },
    ],
  },
  {
    label: "Akquise",
    icon: Target,
    items: [
      { path: "/crm", label: "CRM", icon: Target, shortcut: "8" },
      { path: "/deals", label: "Deals", icon: Handshake, shortcut: "0" },
      { path: "/newsticker", label: "Newsticker", icon: Newspaper, shortcut: "" },
      { path: "/bewertung", label: "Schnellbewertung", icon: TrendingUp, shortcut: "" },
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
  "Navigation: Portfolio": "/",
  "Navigation: Objekte": "/objekte",
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
