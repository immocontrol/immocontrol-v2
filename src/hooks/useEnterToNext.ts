import { useCallback } from "react";

/**
 * Hook that provides an onKeyDown handler to move focus to the next
 * input/textarea/select when Enter is pressed (not on textareas).
 * If the current field is the last focusable field, it submits the form
 * or clicks the nearest submit/primary button.
 */
export function useEnterToNext() {
  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLElement>) => {
    if (e.key !== "Enter") return;
    const target = e.target as HTMLElement;
    /* Don't intercept Enter in textareas (they need newlines) or buttons */
    if (target.tagName === "TEXTAREA" || target.tagName === "BUTTON") return;
    /* Don't intercept if submit button is focused */
    if ((target as HTMLInputElement).type === "submit") return;
    /* Don't intercept if inside a select/dropdown */
    if (target.closest("[role='listbox']") || target.closest("[role='menu']")) return;

    e.preventDefault();

    /* Look for a form first */
    const form = target.closest("form");
    if (form) {
      const focusable = Array.from(
        form.querySelectorAll<HTMLElement>(
          'input:not([type="hidden"]):not([disabled]):not([readonly]), textarea:not([disabled]), select:not([disabled]), button[type="submit"]'
        )
      );
      const idx = focusable.indexOf(target);
      if (idx >= 0 && idx < focusable.length - 1) {
        const next = focusable[idx + 1];
        /* If next element is a submit button, click it instead of focusing */
        if (next.tagName === "BUTTON" && (next as HTMLButtonElement).type === "submit") {
          (next as HTMLButtonElement).click();
        } else {
          next.focus();
        }
      } else if (idx === focusable.length - 1 || idx === -1) {
        /* Last field — submit the form */
        const submitBtn = form.querySelector<HTMLButtonElement>('button[type="submit"]:not([disabled])');
        if (submitBtn) submitBtn.click();
        else form.requestSubmit?.();
      }
      return;
    }

    /* No form — look for next focusable sibling in the dialog/section */
    const container = target.closest("[role='dialog']") || target.closest("section") || target.closest(".space-y-4") || document.body;
    const allFocusable = Array.from(
      container.querySelectorAll<HTMLElement>(
        'input:not([type="hidden"]):not([disabled]):not([readonly]), textarea:not([disabled]), select:not([disabled]), button:not([disabled])'
      )
    );
    const idx = allFocusable.indexOf(target);
    if (idx >= 0 && idx < allFocusable.length - 1) {
      allFocusable[idx + 1].focus();
    } else {
      /* Last element — try to find and click a primary/submit button */
      const primaryBtn = container.querySelector<HTMLButtonElement>('button[type="submit"]:not([disabled])') ||
        container.querySelector<HTMLButtonElement>('button.bg-primary:not([disabled])');
      if (primaryBtn) primaryBtn.click();
    }
  }, []);

  return { handleKeyDown };
}

export default useEnterToNext;
