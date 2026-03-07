# Changelog

Alle wichtigen Änderungen werden hier transparent dokumentiert.

Das Format basiert auf [Keep a Changelog](https://keepachangelog.com/de/1.1.0/).

## [Unreleased]

### Neu

- **Besichtigungen** — Neuer Bereich unter Akquise: Notizen, Bilder & Videos zu Immobilien-Besichtigungen
- **Deal → Besichtigung** — Beim Verschieben eines Deals in Stage „Besichtigung“ wird automatisch ein Besichtigungseintrag angelegt
- **CRM → Deal** — Lead kann direkt als Deal angelegt werden (Synergie)
- **Deals ↔ Kontakte** — Kontakt aus Kontaktliste kann beim Deal-Formular übernommen werden (Synergie)
- **GlobalSearch** — Suche in Besichtigungen; Besichtigungen als Seiten-Navigation
- **DashboardActionCenter** — Links zu „Deals in Besichtigung" und „Besichtigungen" (vernetzt Akquise mit Dashboard)
- **Besichtigung → Todo** — Button „Todo erstellen" bei Besichtigungen; Deep-Links (`?id=xxx`) zu einzelnen Besichtigungen
- **Besichtigungen: Schnellformular** — Nur Titel, Adresse, Bewertung für schnelles Erfassen unterwegs
- **Vergleichs-Score** — Berechnung aus Bewertung, Pro/Kontra-Länge (1–10)
- **Checkliste** — Heizung, Fenster, Elektrik, Bad, Küche, Dach (JSONB); Link kopieren; KI-Zusammenfassung
- **Immo-AI** — Chat-Kontext um Deals + Besichtigungen erweitert; Objektbeschreibung generieren; Exposé-Analyse + Bewertung
- **ViewingAISummary** — KI fasst Besichtigungsnotizen zusammen (DeepSeek)
- **PropertyDescriptionGenerator** — Objektbeschreibung aus Stammdaten (ImmoAI)
- **ViewingCard** — Ausgelagerte Komponente für bessere Wartbarkeit
- **touch-target** — CSS-Utility min 44×44px für mobile Usability

### Geändert

- **Besichtigungen**: Sortierung, Filter nach Bewertung, CSV-Export, Tastenkürzel `n`
- **PropertyDetail** — Zeigt verknüpfte Besichtigungen (wenn `property_id` gesetzt); verbindet Objekte mit Akquise
- **Besichtigungen**: Datum/Uhrzeit, Deal-Badge, Medien-Anzahl auf Karten
- **handleError**: Zentraler Fehler-Handler in UndoToast, DocumentExpiryTracker, PropertyValueHistory, PortfolioGoals, MobileDataExportSheet
- **Barrierefreiheit**: aria-labels für Suche (Todos, Mietuebersicht, Contacts, Besichtigungen)
- **KeyboardShortcutOverlay**: Neuer Shortcut `n` für Besichtigungen
- **React Query**: Query-Default für `viewings.all` (staleTime 2 min)

### Behoben

- MediaThumb: Korrektes Laden der signed URLs für Bilder/Videos

### Dokumentation

- **docs/DOKUMENTATION.md** — Dokumentationsrichtlinien (CHANGELOG, CONTRIBUTING, docs/)
- **docs/SYNERGIEN.md** — Vernetzung zwischen Modulen
- **docs/USABILITY_UND_MOBILE.md** — Usability, Touch-Targets, Mobile-Checkliste
- **docs/DEEPSEEK_NUTZUNG.md** — ViewingAISummary, PropertyDescriptionGenerator, Exposé-Analyse
- **README.md** — Link auf Dokumentation
- **KeyboardShortcutOverlay** — Cmd+K, Alt+I dokumentiert
- ResponsiveDialog: onOpenChange für Besichtigungen-Dialog
- viewings.media Query-Invalidierung bei Upload/Löschen

---

## Dokumentation & Transparenz

- **CHANGELOG.md** — Alle Änderungen werden hier dokumentiert (Version, Neu, Geändert, Behoben)
- **.github/CONTRIBUTING.md** — Commit-Konventionen für transparente Git-Historie

Für eine übersichtliche Git-Historie bitte **Conventional Commits** verwenden:

- `feat:` — Neue Funktion
- `fix:` — Bugfix
- `docs:` — Dokumentation
- `refactor:` — Refactoring
- `a11y:` — Barrierefreiheit
- `perf:` — Performance

Beispiel: `feat(besichtigungen): CSV-Export hinzugefügt`
