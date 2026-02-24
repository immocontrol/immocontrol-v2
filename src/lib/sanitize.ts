const ENTITY_MAP: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};

export const escapeHtml = (str: string | number): string =>
  String(str).replace(/[&<>"']/g, (c) => ENTITY_MAP[c] || c);
