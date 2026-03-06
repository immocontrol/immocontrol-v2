/**
 * UX-7: Scroll zum ersten Formularfehler und Fokus setzen.
 * Nutzen: Auf Handy und Desktop sofort sichtbar, wo die Korrektur nötig ist.
 */
export function scrollToFirstError(formEl: HTMLFormElement | null): boolean {
  if (!formEl) return false;
  const firstInvalid = formEl.querySelector<HTMLElement>(
    "[data-invalid=true], .border-destructive, [aria-invalid=true]"
  );
  if (!firstInvalid) return false;
  firstInvalid.scrollIntoView({ behavior: "smooth", block: "center" });
  const focusable = firstInvalid.querySelector<HTMLElement>("input, select, textarea") ?? firstInvalid;
  focusable?.focus();
  return true;
}
