const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const isValidEmail = (email: string): boolean =>
  EMAIL_REGEX.test(email.trim());

export const validateEmail = (email: string): string | null => {
  if (!email.trim()) return null;
  if (!isValidEmail(email)) return "Bitte eine gueltige E-Mail-Adresse eingeben";
  return null;
};
