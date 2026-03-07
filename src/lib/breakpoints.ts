/**
 * Centralized breakpoints — use consistently for responsive layout.
 * Matches Tailwind defaults: sm 640, md 768, lg 1024, xl 1280, 2xl 1536
 */
export const BREAKPOINTS = {
  sm: 640,
  md: 768,
  lg: 1024,
  xl: 1280,
  "2xl": 1536,
} as const;

/** Mobile-first: true when width < md (768px) */
export const MOBILE_MAX = BREAKPOINTS.md;
/** Tablet: md..lg */
export const TABLET_MAX = BREAKPOINTS.lg;
/** Desktop: lg+ */
export const DESKTOP_MIN = BREAKPOINTS.lg;
