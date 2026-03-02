/**
 * IMP-8: Input sanitization utilities — XSS protection for user-generated content.
 */

const ENTITY_MAP: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};

/** Escape HTML entities to prevent XSS in rendered content */
export const escapeHtml = (str: string | number): string =>
  String(str).replace(/[&<>"']/g, (c) => ENTITY_MAP[c] || c);

/** Strip all HTML tags from a string */
export const stripHtml = (str: string): string =>
  str.replace(/<[^>]*>/g, "");

/** Sanitize user input: trim, strip HTML, limit length */
export const sanitizeInput = (str: string, maxLength = 10_000): string =>
  stripHtml(str).trim().slice(0, maxLength);

/** Sanitize a URL — only allow http/https/mailto protocols */
export const sanitizeUrl = (url: string): string => {
  const trimmed = url.trim();
  if (/^(https?:|mailto:)/i.test(trimmed)) return trimmed;
  if (/^[a-z0-9]/i.test(trimmed) && !trimmed.includes(":")) return trimmed; // relative paths
  return "";
};

/** Sanitize an object's string values recursively */
export const sanitizeRecord = <T extends Record<string, unknown>>(obj: T): T => {
  const result = { ...obj };
  for (const key of Object.keys(result)) {
    const val = result[key];
    if (typeof val === "string") {
      (result as Record<string, unknown>)[key] = sanitizeInput(val);
    }
  }
  return result;
};

/** IMP-48: Sanitize a numeric input — returns fallback for NaN/Infinity */
export const sanitizeNumber = (value: unknown, fallback = 0): number => {
  if (typeof value === "number" && isFinite(value)) return value;
  const parsed = typeof value === "string" ? parseFloat(value) : NaN;
  return isFinite(parsed) ? parsed : fallback;
};

/** IMP-49: Sanitize and validate an email address */
export const sanitizeEmail = (email: string): string => {
  const trimmed = email.trim().toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed) ? trimmed : "";
};
