import { useCallback } from "react";

/**
 * Hook that provides an onKeyDown handler to move focus to the next
 * input/textarea/select when Enter is pressed (not on textareas).
 * This improves form UX especially on mobile where users expect
 * Enter to advance to the next field.
 */
export function useEnterToNext() {
  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLElement>) => {
    if (e.key !== "Enter") return;
    const target = e.target as HTMLElement;
    /* Don't intercept Enter in textareas (they need newlines) or buttons */
    if (target.tagName === "TEXTAREA" || target.tagName === "BUTTON") return;
    /* Don't intercept if submit button is focused */
    if ((target as HTMLInputElement).type === "submit") return;

    e.preventDefault();
    const form = target.closest("form");
    if (!form) return;

    const focusable = Array.from(
      form.querySelectorAll<HTMLElement>(
        'input:not([type="hidden"]):not([disabled]), textarea:not([disabled]), select:not([disabled]), button[type="submit"]'
      )
    );
    const idx = focusable.indexOf(target);
    if (idx >= 0 && idx < focusable.length - 1) {
      focusable[idx + 1].focus();
    } else if (idx === focusable.length - 1) {
      /* Last field — submit the form */
      const submitBtn = form.querySelector<HTMLButtonElement>('button[type="submit"]');
      if (submitBtn) submitBtn.click();
    }
  }, []);

  return { handleKeyDown };
}

export default useEnterToNext;
