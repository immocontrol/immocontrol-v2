/**
 * #10: i18n Hook — React hook for multi-language support.
 * Listens for locale changes and re-renders components.
 */
import { useState, useEffect, useCallback } from "react";
import { t, getLocale, setLocale, type Locale } from "@/lib/i18n";

export function useI18n() {
  const [locale, setLocaleState] = useState<Locale>(getLocale());

  useEffect(() => {
    const handler = () => setLocaleState(getLocale());
    window.addEventListener("locale-changed", handler);
    return () => window.removeEventListener("locale-changed", handler);
  }, []);

  const changeLocale = useCallback((newLocale: Locale) => {
    setLocale(newLocale);
    setLocaleState(newLocale);
  }, []);

  const translate = useCallback((key: string) => t(key, locale), [locale]);

  return { locale, changeLocale, t: translate };
}
