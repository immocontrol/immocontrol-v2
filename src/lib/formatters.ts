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

export const getISOWeek = (date: Date): number => {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
};
