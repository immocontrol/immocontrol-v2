// Shared formatters — single Intl instances for performance

const currencyFormatter = new Intl.NumberFormat("de-DE", {
  style: "currency",
  currency: "EUR",
  maximumFractionDigits: 0,
});

const currencyFormatterDecimals = new Intl.NumberFormat("de-DE", {
  style: "currency",
  currency: "EUR",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export const formatCurrency = (value: number) => currencyFormatter.format(value);

export const formatCurrencyDecimals = (value: number) => currencyFormatterDecimals.format(value);

export const formatPercent = (value: number, decimals = 1) =>
  `${value.toFixed(decimals)}%`;

export const formatDate = (dateStr: string) =>
  new Date(dateStr).toLocaleDateString("de-DE");

export const formatDateLong = (dateStr: string) =>
  new Date(dateStr).toLocaleDateString("de-DE", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });

export const formatMonthYear = (dateStr: string) =>
  new Date(dateStr).toLocaleDateString("de-DE", {
    month: "long",
    year: "numeric",
  });

export const formatTime = (dateStr: string) =>
  new Date(dateStr).toLocaleTimeString("de-DE", {
    hour: "2-digit",
    minute: "2-digit",
  });

export const relativeTime = (dateStr: string): string => {
  const now = Date.now();
  const diff = now - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "gerade eben";
  if (mins < 60) return `vor ${mins} Min.`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `vor ${hours} Std.`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `vor ${days} Tag${days > 1 ? "en" : ""}`;
  return formatDate(dateStr);
};

export const formatFileSize = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

export const formatCurrencyCompact = (value: number): string => {
  const abs = Math.abs(value);
  const sign = value < 0 ? "-" : "";
  if (abs >= 1_000_000) return `${sign}${(abs / 1_000_000).toFixed(1)} Mio. €`;
  if (abs >= 1_000) return `${sign}${(abs / 1_000).toFixed(0)} T€`;
  return currencyFormatter.format(value);
};

/** Format a number with German thousand separators (1.000, 10.000 etc.) */
export const formatNumberDE = (value: number | string): string => {
  const num = typeof value === "string" ? parseFloat(value.replace(/\./g, "").replace(",", ".")) : value;
  if (isNaN(num)) return "";
  return new Intl.NumberFormat("de-DE", { maximumFractionDigits: 2 }).format(num);
};

/** Parse a German-formatted number string back to a number */
export const parseNumberDE = (value: string): number => {
  if (!value) return 0;
  const cleaned = value.replace(/\./g, "").replace(",", ".");
  const num = parseFloat(cleaned);
  return isNaN(num) ? 0 : num;
};

export const getISOWeek = (date: Date): number => {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
};

/* OPT-1: Memoized number formatter instance for performance */
const numberFormatterDE = new Intl.NumberFormat("de-DE", { maximumFractionDigits: 0 });

/* OPT-2: Cached date formatter for repeated use */
const dateFormatterDE = new Intl.DateTimeFormat("de-DE");
const dateFormatterLongDE = new Intl.DateTimeFormat("de-DE", {
  day: "2-digit",
  month: "long",
  year: "numeric",
});

/* OPT-3: Format number with thousand separators (integer) */
export const formatNumberInt = (value: number): string => numberFormatterDE.format(value);

/* OPT-4: Format square meters with unit */
export const formatSqm = (value: number): string => `${numberFormatterDE.format(value)} m²`;

/* OPT-5: Calculate and format percentage change */
export const formatChange = (current: number, previous: number): string => {
  if (previous === 0) return "–";
  const pct = ((current - previous) / previous) * 100;
  const sign = pct >= 0 ? "+" : "";
  return `${sign}${pct.toFixed(1)}%`;
};

/* OPT-6: Format duration in months to human-readable German string */
export const formatDurationMonths = (months: number): string => {
  if (months <= 0) return "abgelaufen";
  if (months < 12) return `${months} Monat${months > 1 ? "e" : ""}`;
  const years = Math.floor(months / 12);
  const rem = months % 12;
  if (rem === 0) return `${years} Jahr${years > 1 ? "e" : ""}`;
  return `${years}J ${rem}M`;
};

/* OPT-7: Clamp a number between min and max */
export const clamp = (value: number, min: number, max: number): number =>
  Math.min(Math.max(value, min), max);

/* OPT-8: Safe division avoiding NaN/Infinity */
export const safeDivide = (numerator: number, denominator: number, fallback = 0): number =>
  denominator !== 0 ? numerator / denominator : fallback;

/* OPT-9: Format large numbers compactly (1.2M, 350K) */
export const formatCompactDE = (value: number): string => {
  const abs = Math.abs(value);
  const sign = value < 0 ? "-" : "";
  if (abs >= 1_000_000) return `${sign}${(abs / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `${sign}${(abs / 1_000).toFixed(0)}K`;
  return `${sign}${abs}`;
};

/* OPT-10: Pluralize German words */
export const pluralDE = (count: number, singular: string, plural: string): string =>
  `${count} ${count === 1 ? singular : plural}`;

/* OPT-43: Debounce utility for search inputs */
export const createDebounce = <T extends (...args: any[]) => void>(fn: T, delay: number) => {
  let timer: ReturnType<typeof setTimeout>;
  return (...args: Parameters<T>) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
};

/* OPT-44: Throttle utility for scroll/resize events */
export const createThrottle = <T extends (...args: any[]) => void>(fn: T, limit: number) => {
  let inThrottle = false;
  return (...args: Parameters<T>) => {
    if (!inThrottle) {
      fn(...args);
      inThrottle = true;
      setTimeout(() => { inThrottle = false; }, limit);
    }
  };
};

/* OPT-45: Deep equality check for objects */
export const isEqual = (a: unknown, b: unknown): boolean => {
  if (a === b) return true;
  if (typeof a !== typeof b) return false;
  if (typeof a !== "object" || a === null || b === null) return false;
  const keysA = Object.keys(a as Record<string, unknown>);
  const keysB = Object.keys(b as Record<string, unknown>);
  if (keysA.length !== keysB.length) return false;
  return keysA.every(key => isEqual((a as Record<string, unknown>)[key], (b as Record<string, unknown>)[key]));
};

/* OPT-46: Generate unique ID for temporary items */
export const generateTempId = (): string =>
  `temp_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;

/* OPT-47: Truncate text with ellipsis */
export const truncate = (text: string, maxLength: number): string =>
  text.length > maxLength ? text.slice(0, maxLength - 1) + "…" : text;

/* OPT-48: Convert HSL string to CSS variable reference */
export const hslVar = (name: string, alpha?: number): string =>
  alpha !== undefined ? `hsl(var(--${name}) / ${alpha})` : `hsl(var(--${name}))`;

/* OPT-49: Sort array by key with direction */
export const sortByKey = <T>(arr: T[], key: keyof T, desc = false): T[] =>
  [...arr].sort((a, b) => {
    const valA = a[key];
    const valB = b[key];
    if (typeof valA === "number" && typeof valB === "number") return desc ? valB - valA : valA - valB;
    return desc ? String(valB).localeCompare(String(valA)) : String(valA).localeCompare(String(valB));
  });

/* OPT-50: Group array by key */
export const groupBy = <T>(arr: T[], keyFn: (item: T) => string): Record<string, T[]> => {
  return arr.reduce((groups, item) => {
    const key = keyFn(item);
    if (!groups[key]) groups[key] = [];
    groups[key].push(item);
    return groups;
  }, {} as Record<string, T[]>);
};
