/**
 * Experimentelle Features per Env ein-/ausschalten (siehe docs/FEATURE_FLAGS.md).
 * Nur nicht-sensible Schalter — VITE_* ist im Client sichtbar.
 */

function envKeyForFeatureName(name: string): string {
  const normalized = name.replace(/[^a-zA-Z0-9]+/g, "_").toUpperCase();
  return `VITE_FEATURE_${normalized}`;
}

/** @param name z. B. "NEW_DEALS_UI" → liest VITE_FEATURE_NEW_DEALS_UI */
export function isFeatureEnabled(name: string): boolean {
  const key = envKeyForFeatureName(name);
  const v = (import.meta.env as Record<string, string | boolean | undefined>)[key];
  return v === true || v === "true" || v === "1";
}
