import { useEffect } from "react";

/** Feature 6: Reusable keyboard shortcut hook */
export const useKeyboardShortcut = (
  key: string,
  callback: () => void,
  options?: { ctrl?: boolean; alt?: boolean; meta?: boolean; shift?: boolean; enabled?: boolean }
) => {
  useEffect(() => {
    if (options?.enabled === false) return;
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      if (options?.ctrl && !e.ctrlKey) return;
      if (options?.alt && !e.altKey) return;
      if (options?.meta && !e.metaKey) return;
      if (options?.shift && !e.shiftKey) return;
      if (e.key.toLowerCase() === key.toLowerCase()) {
        e.preventDefault();
        callback();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [key, callback, options?.ctrl, options?.alt, options?.meta, options?.shift, options?.enabled]);
};
