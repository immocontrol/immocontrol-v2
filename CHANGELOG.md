# Changelog

Alle wichtigen Änderungen werden hier transparent dokumentiert.

Das Format basiert auf [Keep a Changelog](https://keepachangelog.com/de/1.1.0/).

## [Unreleased]

### Neu

- **MessageCenter: suggestReply** — KI-Button „Antwort vorschlagen“ für Vermieter-Nachrichten (DeepSeek)
- **QuickActions** — Nebenkosten und Immo-AI als Schnellaktionen (9 und 0)
- **Nebenkosten → Objekt** — Link „Zum Objekt“ bei Abrechnungsdetail
- **Contacts Empty State** — Button „Zu Deals“ + Touch-Targets
- **Deals: suggestDealNextStep** — KI-Button „Nächster Schritt“ bei Notizen: Vorschlag für nächsten Deal-Schritt (Stage, Titel, Adresse, Notizen)
- **Nebenkosten → Dokumente** — Button „Als Dokument“ speichert Nebenkostenabrechnung als PDF in Objekt-Dokumente (property_documents)
- **BerichteInProsa** — Monatsbericht/Jahresüberblick aus Portfolio-Kennzahlen per DeepSeek (Immo-AI → PDF-Tab)
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

- **Besichtigungen** — Empty State: Link „Zu Deals“ (Synergie); Touch-Target für Erste-Besichtigung-Button
- **AITipCard** — Touch-Target 44px für Aktualisieren-Button (Mobile)
- **CRM** — Touch-Target 44px für „Als Deal“-Button
- **Deals** — Touch-Target (44px) für Deal-anlegen-Button; Empty State: Link „Leads aus CRM übernehmen“ (Synergie)
- **PropertyDocuments** — Touch-Target 44px für Hochladen-Button (Mobile)
- **ImmoAI** — Vorgeschlagene Fragen um Deals/Besichtigungen/Tickets ergänzt; System-Kontext um Tickets erweitert
- **TicketSystem** — Link „Zu Kontakten“ wenn keine Handwerker; Synergie Tickets↔Kontakte
- **Besichtigungen** — Touch-Target (44px) für Schnell- und Neue-Besichtigung-Buttons
- **Besichtigungen**: Sortierung, Filter nach Bewertung, CSV-Export, Tastenkürzel `n`
- **PropertyDetail** — Zeigt verknüpfte Besichtigungen (wenn `property_id` gesetzt); verbindet Objekte mit Akquise
- **Besichtigungen**: Datum/Uhrzeit, Deal-Badge, Medien-Anzahl auf Karten
- **handleError**: Zentraler Fehler-Handler in UndoToast, DocumentExpiryTracker, PropertyValueHistory, PortfolioGoals, MobileDataExportSheet
- **Barrierefreiheit**: aria-labels für Suche (Todos, Mietuebersicht, Contacts, Besichtigungen)
- **KeyboardShortcutOverlay**: Neuer Shortcut `n` für Besichtigungen
- **React Query**: Query-Default für `viewings.all` (staleTime 2 min)
- **Dokumente** — Refactoring: `extractPdfText` aus exposeParser nutzen (layout-aware, weniger Code-Duplizierung)
- **CRM** — Empty State: Link „Zu Besichtigungen“ (Synergie); EmptyState-Komponente
- **PWA** — Shortcuts für Deals, Besichtigungen, Darlehen, Verträge, Dokumente, Kontakte, Immo-AI
- **Verträge** — Link „Dokumente hochladen“ in Kopfzeile; responsive Tabs (horizontal scroll auf Mobile)
- **Dokumente** — Empty State mit EmptyState-Komponente; Link „Verträge verwalten“
- **Darlehen** — Empty State: Links „Objekt anlegen“, „Deals“
- **PropertyDetail** — Link „Darlehen bearbeiten“ in Finanzierungs-Sektion
- **LoanPdfImport** — Refactoring: `extractPdfText` aus exposeParser; bei DeepSeek-Konfiguration AI-Extraktion (`extractLoanFromText`) wenn Regex wenig findet
- **DocumentOCR** — Refactoring: `extractPdfText` aus exposeParser statt eigener Implementierung
- **Objekte** — Empty State: Links Deals, Besichtigungen (Synergien)
- **Besichtigungen** — Empty State: Link Dokumente hochladen
- **Todos** — Empty State: Button „Zu CRM"
- **PWA** — Shortcuts um Objekte, Aufgaben, CRM erweitert
- **KeyboardShortcutOverlay** — Shortcut Q für Schnellaktion dokumentiert
- **analysis/PdfImport** — Refactoring: `extractPdfText` aus exposeParser statt eigener Implementierung
- **QuickActions** — Neue Aktion „Besichtigung erfassen" (navigiert zu /besichtigungen); touch-target für alle Buttons; onNavigate-Prop
- **PropertyDetail** — Besichtigungen: Deep-Link ?id= zur Besichtigung; Link zum Deal bei deal_id
- **MessageCenter** — Touch-Target für „KI zusammenfassen"; KI-Button „Antwort vorschlagen" (suggestReply)
- **Wartungsplaner** — Empty State: Link „Objekte öffnen" (Synergy zu Tickets)
- **AI: PropertyNotes** — Button „Zusammenfassen" (summarizeNotes) bei DeepSeek-Konfiguration
- **AI: TicketSystem** — Button „Vorschlag" für Beschreibung (suggestTicketDescription) aus Titel + Kategorie
- **DashboardActionCenter** — Überfällig-Kachel verlinkt auf /mietuebersicht bei überfälligen Zahlungen
- **Nebenkosten** — Link „Dokumente" in Kopfzeile (Synergy Nebenkosten↔Dokumente)
- **GlobalSearch** — Deep-Links: Kontakte ?highlight=, Deals ?id=, Besichtigungen ?id= für direkte Navigation
- **Kontakte** — Deep-Link ?highlight=: scrollt zum Kontakt und hebt ihn hervor
- **Deals** — Deep-Link ?id=: öffnet Deal-Bearbeitungsdialog; Share-Button im Bearbeitungsdialog; fromContact-Vorlage (Kontakte → „Als Deal“)
- **Kontakte** — Badge „X Deals“ pro Kontakt; Button „Als Deal“ (Briefcase) für Quick-Add Deal mit vorausgefüllten Kontaktdaten
- **Besichtigungen** — Share-Button ersetzt „Link kopieren“ (native Share API + Fallback)
- **IndexMietanpassung** — AI-Button „Begründung generieren“ (generateRentIncreaseJustification); Text wird in Zwischenablage kopiert
- **RentIncreaseLetter** — AI-Button „KI-Begründung“ neben Begründungsfeld
- **Kontakte** — Badge „X Deals“ klickbar: filtert Deals nach Kontakt (filterByContact)
- **Deals** — Besichtigungs-Picker: „Besthende Besichtigung zuordnen“ bei Stage Besichtigung; KI-Button „Nächster Schritt“ bei Notizen (suggestDealNextStep)
- **Deals** — Share-Icon auf Kanban-Karte (Share2)
- **PropertyDocuments** — AI-Kategorisierung: PDF-Upload mit suggestDocumentCategory
- **PropertyDetail** — Share-Button nutzt useShare (native Share API + Fallback)
- **QuickActions** — Deal erstellen, Mietübersicht, Nebenkosten, Immo-AI (navigate); Shortcuts 7–0
- **Immo-Chat** — Kontext um contacts + rent_payments erweitert
- **Mietübersicht** — Link "Index-Mietanpassung prüfen" zum Dashboard
- **StatCard** — optional href: Mieteinnahmen/M verlinkt auf /mietuebersicht
- **DashboardActionCenter** — Offene Tickets klickbar → Objekt; Ungelesen klickbar → Objekte
- **MobileQuickStats** — href-Support; Einbindung in Mietuebersicht (nur Mobile)

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
