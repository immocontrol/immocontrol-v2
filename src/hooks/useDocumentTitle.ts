import { useEffect } from "react";

/** IMP-137: Hook for managing document title with cleanup */
export function useDocumentTitle(title: string): void {
  useEffect(() => {
    const prev = document.title;
    document.title = `${title} \u2013 ImmoControl`;
    return () => { document.title = prev; };
  }, [title]);
}
