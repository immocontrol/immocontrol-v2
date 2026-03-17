# UI-Checkliste: Browser, Web-App Handy, Native iOS

Kurze Checkliste für ein konsistentes UI auf **Desktop-Browser**, **Web-App auf dem Handy** und **native iOS-App** (Capacitor).

## Viewport & Meta

- **Viewport:** `viewport-fit=cover` in `index.html` für Notch/Home-Indicator (iOS).
- **PWA/Web-App:** `apple-mobile-web-app-capable`, `apple-mobile-web-app-status-bar-style`, `theme-color` (light/dark) gesetzt.
- **Zoom:** Aktuell `user-scalable=no` im Viewport – bei Bedarf für Barrierefreiheit prüfen/anpassen.

## Safe Area

- **Container:** `.container` und `#main-content` nutzen `env(safe-area-inset-left/right)`.
- **Header:** `paddingTop: env(safe-area-inset-top)` in AppLayout.
- **Main:** `pb-[calc(7rem+env(safe-area-inset-bottom,0px))]` auf Mobile.
- **Bottom-Tab-Bar / feste Footer:** `paddingBottom: env(safe-area-inset-bottom)` (AppLayout, MobileBottomTabBar, MobileImprovementsProvider).
- **Dialoge:** `max-height: min(90vh, …)`, `overflow-y: auto`, Breite auf kleinen Screens begrenzt.

## Touch & Interaktion

- **Touch-Targets:** Mindestens 44×44px (Desktop), auf Mobile 48px via `MobileImprovementsProvider`; Klasse `.touch-target` in `index.css`.
- **Tap-Highlight:** `-webkit-tap-highlight-color: transparent` und `tap-highlight-color: transparent` auf `body` (weniger störender Flash auf iOS/Android).
- **Tastatur:** `use-mobile` ignoriert Resize, wenn INPUT/TEXTAREA/SELECT fokussiert ist (verhindert Layout-Sprung/Fokusverlust).

## Breakpoints & Mobile

- **Breakpoint:** 768px (`use-mobile.tsx`).
- **Navigation:** Mobile Bottom-Tab-Bar; Labels mit `nav-label-responsive` / `nav-label-wrap` bei knappem Platz.
- **Text:** Kein unnötiges `truncate`/`line-clamp` in Inhaltsbereichen; `text-wrap-safe`, `word-break: break-word`, `min-width: 0` für Flex-Kinder.

## Native iOS (Capacitor)

- **Build:** `capacitor.config.ts` → `webDir: "dist"`, `appId: "com.immocontrol.app"`.
- **Safe Area:** Dieselben `env(safe-area-inset-*)` wie in der Web-App; kein zusätzlicher nativer Code nötig.
- **Dark Mode / OLED:** Über `MobileImprovementsProvider` und Theme-Farben abgedeckt.

## Relevante Dateien

| Bereich            | Dateien |
|--------------------|---------|
| Viewport/Safe Area | `index.html`, `src/index.css`, `src/components/AppLayout.tsx`, `src/components/mobile/MobileImprovementsProvider.tsx`, `src/components/mobile/MobileBottomTabBar.tsx` |
| Touch/Breakpoint   | `src/index.css` (`.touch-target`), `src/hooks/use-mobile.tsx` |
| iOS Build          | `capacitor.config.ts` |

Siehe auch: `.cursor/rules/text-no-clip.mdc`, `docs/MOBILE_BREAKPOINTS.md`, `docs/USABILITY_UND_MOBILE.md`.
