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

/** IMP-44: Format currency in EUR (no decimals) */
export const formatCurrency = (value: number) => currencyFormatter.format(value);

export const formatCurrencyDecimals = (value: number) => currencyFormatterDecimals.format(value);

/** IMP-45: Format percentage with configurable decimals */
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

/** IMP-46: Format relative time in German (e.g. "vor 5 Min.") */
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

/** IMP-47: Format file size with appropriate unit (B, KB, MB) */
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
export const createDebounce = <T extends (...args: unknown[]) => void>(fn: T, delay: number) => {
  let timer: ReturnType<typeof setTimeout> | null = null;
  const debounced = (...args: Parameters<T>) => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => { fn(...args); timer = null; }, delay);
  };
  debounced.cancel = () => { if (timer) { clearTimeout(timer); timer = null; } };
  return debounced;
};

/* OPT-44: Throttle utility for scroll/resize events */
export const createThrottle = <T extends (...args: unknown[]) => void>(fn: T, limit: number) => {
  let inThrottle = false;
  let lastArgs: Parameters<T> | null = null;
  let timerId: ReturnType<typeof setTimeout> | null = null;
  const throttled = (...args: Parameters<T>) => {
    if (!inThrottle) {
      fn(...args);
      inThrottle = true;
      timerId = setTimeout(() => {
        inThrottle = false;
        if (lastArgs) { fn(...lastArgs); lastArgs = null; }
        timerId = null;
      }, limit);
    } else {
      lastArgs = args;
    }
  };
  throttled.cancel = () => { if (timerId) { clearTimeout(timerId); timerId = null; } inThrottle = false; lastArgs = null; };
  return throttled;
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

/* IMP-48: Format percentage with German locale (comma as decimal separator) */
export const formatPercentDE = (value: number, decimals = 1): string =>
  `${value.toFixed(decimals).replace(".", ",")}%`;

/* OPT-50: Group array by key */
export const groupBy = <T>(arr: T[], keyFn: (item: T) => string): Record<string, T[]> => {
  return arr.reduce((groups, item) => {
    const key = keyFn(item);
    if (!groups[key]) groups[key] = [];
    groups[key].push(item);
    return groups;
  }, {} as Record<string, T[]>);
};

/* IMPROVE-44: Format German phone number for display (e.g. +49 30 12345678) */
export const formatPhoneDE = (phone: string): string => {
  const cleaned = phone.replace(/[^\d+]/g, "");
  if (cleaned.startsWith("+49") && cleaned.length >= 12) {
    const area = cleaned.slice(3, 5);
    const rest = cleaned.slice(5);
    return `+49 ${area} ${rest}`;
  }
  if (cleaned.startsWith("0") && cleaned.length >= 10) {
    const area = cleaned.slice(0, cleaned.length <= 11 ? 4 : 3);
    const rest = cleaned.slice(area.length);
    return `${area} ${rest}`;
  }
  return phone;
};

/* IMPROVE-45: Validate German IBAN format */
export const isValidIBAN = (iban: string): boolean => {
  const cleaned = iban.replace(/\s/g, "").toUpperCase();
  return /^DE\d{20}$/.test(cleaned);
};

/* IMPROVE-46: Format German address for display (street, PLZ city) */
export const formatAddressDE = (street: string, plz: string, city: string): string =>
  [street, [plz, city].filter(Boolean).join(" ")].filter(Boolean).join(", ");

/* IMPROVE-47: Calculate annualized ROI from monthly cashflow and investment */
export const calculateROI = (monthlyCashflow: number, totalInvestment: number): number =>
  totalInvestment > 0 ? (monthlyCashflow * 12 / totalInvestment) * 100 : 0;

/* IMPROVE-48: Format days until a future date as German countdown string */
export const formatDaysUntil = (dateStr: string): string => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(dateStr);
  const days = Math.ceil((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  if (days < 0) return `${Math.abs(days)} Tage überfällig`;
  if (days === 0) return "Heute";
  if (days === 1) return "Morgen";
  if (days <= 7) return `in ${days} Tagen`;
  if (days <= 30) return `in ${Math.ceil(days / 7)} Wochen`;
  return `in ${Math.ceil(days / 30)} Monaten`;
};

/* IMPROVE-49: Normalize string for fuzzy search comparison (lowercase, no accents) */
export const normalizeString = (str: string): string =>
  str.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();

/* IMPROVE-50: Format price per square meter with German locale */
export const formatEuroPerSqm = (totalPrice: number, sqm: number): string =>
  sqm > 0 ? `${numberFormatterDE.format(Math.round(totalPrice / sqm))} €/m²` : "–";

/* NEW-51: Validate German postal code (PLZ) — 5 digits */
export const isValidPLZ = (plz: string): boolean => /^\d{5}$/.test(plz.trim());

/* NEW-52: Format large area values (m²) with appropriate unit */
export const formatArea = (sqm: number): string => {
  if (sqm >= 10_000) return `${(sqm / 10_000).toFixed(2).replace(".", ",")} ha`;
  return `${numberFormatterDE.format(Math.round(sqm))} m²`;
};

/* NEW-53: Calculate monthly mortgage payment (annuity formula) */
export const calcMonthlyPayment = (principal: number, annualRate: number, years: number): number => {
  if (annualRate <= 0 || years <= 0) return principal / (years * 12 || 1);
  const r = annualRate / 100 / 12;
  const n = years * 12;
  return principal * (r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1);
};

/* NEW-54: Format a date range in German locale */
export const formatDateRange = (start: string, end: string): string =>
  `${formatDate(start)} – ${formatDate(end)}`;

/* NEW-55: Calculate remaining loan term in months */
export const calcRemainingMonths = (balance: number, monthlyPayment: number, annualRate: number): number => {
  if (monthlyPayment <= 0 || balance <= 0) return 0;
  const r = annualRate / 100 / 12;
  if (r <= 0) return Math.ceil(balance / monthlyPayment);
  const months = -Math.log(1 - (balance * r) / monthlyPayment) / Math.log(1 + r);
  return Math.ceil(Math.max(0, isFinite(months) ? months : 0));
};

/* NEW-56: Capitalize first letter of each word (German-aware) */
export const capitalizeWords = (str: string): string =>
  str.replace(/\b\w/g, c => c.toUpperCase());

/* NEW-57: Check if a value is within a percentage tolerance of a target */
export const isWithinTolerance = (value: number, target: number, tolerancePct: number): boolean =>
  target > 0 ? Math.abs(value - target) / target * 100 <= tolerancePct : value === 0;

/* NEW-58: Format interest rate with German decimal separator */
export const formatInterestRate = (rate: number): string =>
  `${rate.toFixed(2).replace(".", ",")} %`;

/* NEW-59: Generate a color from a string (for consistent avatar/chart colors) */
export const stringToColor = (str: string): string => {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  const h = Math.abs(hash) % 360;
  return `hsl(${h}, 55%, 50%)`;
};

/* NEW-60: Format a number as a compact German string with sign */
export const formatSignedCompact = (value: number): string => {
  const sign = value >= 0 ? "+" : "";
  return `${sign}${formatCompactDE(value)}`;
};

/* STR-3: Format IBAN for display with spacing (DE89 3704 0044 0532 0130 00) */
export const formatIBAN = (iban: string): string => {
  const cleaned = iban.replace(/\s/g, "").toUpperCase();
  return cleaned.replace(/(.{4})/g, "$1 ").trim();
};

/* STR-4: Format relative timestamp for "last refreshed" display */
export const formatLastRefreshed = (): string => {
  return new Date().toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
};
