const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const isValidEmail = (email: string): boolean =>
  EMAIL_REGEX.test(email.trim());

export const validateEmail = (email: string): string | null => {
  if (!email.trim()) return null;
  if (!isValidEmail(email)) return "Bitte eine gueltige E-Mail-Adresse eingeben";
  return null;
};

/** IMP-166: Type guard for string values */
export const isString = (val: unknown): val is string => typeof val === "string";

/** IMP-167: Type guard for number values */  
export const isNumber = (val: unknown): val is number => typeof val === "number" && !isNaN(val);

/** IMP-168: Type guard for non-null values */
export const isNotNull = <T>(val: T | null | undefined): val is T => val != null;

/** IMP-143: Check if a string is non-empty after trimming */
export const isNonEmpty = (val: unknown): boolean =>
  typeof val === "string" && val.trim().length > 0;

/** IMP-143: Check if a number is positive */
export const isPositive = (val: unknown): boolean =>
  typeof val === "number" && val > 0;

/** IMP-143: Check if a string is a valid date */
export const isValidDate = (val: unknown): boolean => {
  if (typeof val !== "string") return false;
  const d = new Date(val);
  return !isNaN(d.getTime()) && val.length >= 8;
};

/** IMP20-12: Validate German phone numbers — landline & mobile (+49, 0xxx) */
export const isValidPhoneDE = (phone: string): boolean => {
  const cleaned = phone.replace(/[\s\-\/().]/g, "");
  // +49 followed by 2-4 digit area code + 4-8 digit subscriber
  if (/^\+49\d{8,12}$/.test(cleaned)) return true;
  // 0 followed by area code + subscriber (10-14 digits total)
  if (/^0\d{9,13}$/.test(cleaned)) return true;
  return false;
};
