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
