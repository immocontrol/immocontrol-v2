# Mobile Breakpoints und Dialog-Patterns (ImmoControl)

Wann welche UI-Komponenten genutzt werden (Vorschlag 19).

## Breakpoints

- **Mobile:** &lt; 640px (`sm` in Tailwind)
- **Tablet:** 640px–1024px (`md`/`lg`)
- **Desktop:** ≥ 1024px

Hooks: `useIsMobile()`, `useIsTablet()`, `useIsDesktop()` aus `@/hooks/useMediaQuery` (typisch 639px / 1024px).

## Dialoge vs. Bottom Sheet

- **Desktop:** Standard-`Dialog` (Radix) bzw. `ResponsiveDialog`.
- **Mobile:** Wo vorgesehen `MobileBottomSheet` oder `ResponsiveDialog`, das auf Mobil als Bottom-Sheet rendert, um Tastatur und Fokus zu schonen.

## Navigation

- **Desktop:** Sidebar mit Gruppen-Dropdowns.
- **Mobile:** Bottom-Tab-Leiste mit Sub-Nav (2 Spalten unter ~380px); Labels mit `nav-label-responsive` / `nav-label-wrap`.

## Neue Features

Bei neuen Seiten oder Dialogen: gleiche Breakpoints nutzen; auf Mobil prüfen, ob Bottom-Sheet oder Vollbild-Form sinnvoll ist (siehe z. B. `MobileFullscreenForm`).
