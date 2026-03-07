# Usability und Mobile/Browser-Optimierung

## Mobile

- **Breakpoints**: &lt;640px Mobile, 640–1024px Tablet, ≥1024px Desktop (Tailwind `sm`/`md`/`lg`).
- **Touch-Targets**: Mindestens 44×44 px für Buttons und Links (WCAG).
- **Dialoge**: `ResponsiveDialog` nutzt auf Mobile Bottom-Sheet-Pattern.
- **Navigation**: Bottom-Tab-Leiste auf Mobile; Sidebar auf Desktop.

## Browser

- **Viewport**: `width=device-width, initial-scale=1`; `viewport-fit=cover` für Safe-Area.
- **Lazy-Loading**: Bilder mit `loading="lazy"` wo sinnvoll.
- **Focus**: Sichtbare Fokus-Ringe für Tastatur-Navigation.

## Usability

- **Loading-States**: Spinner oder Skeleton bei asynchronen Aktionen.
- **Fehlermeldungen**: Klar, handlungsorientiert; keine technischen Stack-Traces.
- **Empty-States**: Freundliche Hinweise mit Call-to-Action („Erste Besichtigung anlegen“).
- **Tastenkürzel**: Überlay mit `?` oder `Alt+/`; siehe `KeyboardShortcutOverlay`.

## Checkliste für neue Features

- [ ] Mobile-Ansicht geprüft
- [ ] Touch-Targets ≥44px
- [ ] Loading-State vorhanden
- [ ] Fehler-Handling mit `handleError`
- [ ] aria-label für relevante Controls
