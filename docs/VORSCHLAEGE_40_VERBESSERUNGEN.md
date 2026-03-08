# 40 Verbesserungsvorschläge – Technik, Usability, Bestehende & Neue Funktionen

Vier Kategorien à 10 Vorschläge für ImmoControl. Priorisierung und Umsetzung je nach Ressourcen.

---

# A. Technik (10 große Verbesserungen)

## A1. React Query + Supabase: Einheitliches Caching und Invalidierung
**Was:** Zentrale `queryKeys`, konsistente `staleTime`/`gcTime` pro Ressource (Objekte, Darlehen, Kontakte, …), einheitliche Invalidierung nach Mutations (insert/update/delete). Optional: Persist Layer (IndexedDB) für React Query.
**Nutzen:** Weniger doppelte Requests, vorhersehbares Verhalten, bessere Offline-Nutzung.

## A2. API-Schicht vor Supabase
**Was:** Dünne App-seitige API-Schicht (z. B. `src/api/` oder Services), die alle Supabase-Calls kapselt. Keine direkten `supabase.from(...)` in Seiten/Komponenten, sondern z. B. `api.properties.list()`, `api.tenants.create(...)`.
**Nutzen:** Einfacherer Wechsel/Test des Backends, zentrale Fehlerbehandlung und Logging.

## A3. TypeScript: Strikte Typen aus Supabase durchgängig nutzen
**Was:** Generierte oder gepflegte Typen aus `integrations/supabase/types.ts` überall verwenden; `as any`/`as unknown` schrittweise entfernen; eigene DTOs nur wo nötig (z. B. für Formulare).
**Nutzen:** Weniger Laufzeitfehler, bessere Refactorings und IDE-Unterstützung.

## A4. Error Boundary pro Bereich + zentrale Fehlerbehandlung
**Was:** Error Boundaries pro Hauptbereich (Dashboard, Objekte, Deals, Einstellungen …) mit Fallback-UI und „Erneut laden“. Alle API-Fehler über einen zentralen Handler (z. B. `handleError`), einheitliche Toasts und optional Sentry.
**Nutzen:** Ein Fehler in einem Modul legt nicht die ganze App lahm; Nutzer kann weiterarbeiten.

## A5. Bundle-Analyse und Code-Splitting
**Was:** Regelmäßig `vite-bundle-visualizer` oder `rollup-plugin-visualizer` nutzen; schwere Module (Recharts, PDF, Immo-AI) lazy laden; Route-based Code-Splitting konsequent (bereits teilweise vorhanden).
**Nutzen:** Schnellerer First Load, besonders auf Mobilgeräten.

## A6. E2E- und Integrations-Tests ausbauen
**Was:** Playwright-E2E für kritische Flows (Login, Objekt anlegen, Deal → Objekt, Miete erfassen); optional Supabase Local oder Mock für Integrationstests; CI-Pipeline für Tests.
**Nutzen:** Regressionssicherheit, sichere Refactorings.

## A7. Sicherheit: RLS, Input-Validierung, CSP
**Was:** RLS-Policies dokumentieren und reviewen; alle nutzerbeeinflussbaren Eingaben (Formulare, URLs) mit Zod o. ä. validieren; CSP in `index.html` schrittweise verschärfen (report-only zuerst).
**Nutzen:** Weniger Risiko durch Fehlkonfiguration oder XSS.

## A8. Logging und Observability
**Was:** Strukturiertes Logging (bereits `logger.ts`) konsequent nutzen; bei Fehlern Kontext (Seite, Aktion, User-ID) mitschicken; optional: Performance-Marks für langsame Queries oder Render-Zeiten.
**Nutzen:** Schnellere Fehlersuche und Performance-Optimierung.

## A9. Umgebungs- und Feature-Flags
**Was:** Feature-Flags (z. B. über Env oder Supabase Config) für experimentelle Features (neue Berichte, Beta-UI); klare Trennung Dev/Staging/Prod (URLs, Keys).
**Nutzen:** Sichere Rollouts und A/B-Ideen ohne großen Branch-Aufwand.

## A10. Datenbank: Migrationen und Schema as Code
**Was:** Supabase-Migrationen (SQL-Dateien) versioniert im Repo; bei Schema-Änderungen Migration anlegen und dokumentieren; ggf. Typen aus DB generieren (Supabase CLI).
**Nutzen:** Nachvollziehbare DB-Entwicklung, weniger Drift zwischen Lokal und Produktion.

---

# B. Usability – Handy und Browser (10 Vorschläge)

## B1. Einheitliche Touch-Targets (min 44×44 px)
**Was:** Alle klickbaren Elemente (Buttons, Links, Icons) auf Mobilgeräten mindestens 44×44 px; bestehende `touch-target`-Klassen prüfen und ergänzen; Abstände in Listen/Karten so, dass versehentliche Klicks vermieden werden.
**Nutzen:** Bessere Bedienbarkeit auf dem Smartphone.

## B2. Sticky Actions und FAB auf langen Seiten
**Was:** Auf Objekt-Detail, Darlehen, Deals etc.: Wichtige Aktionen („Speichern“, „Neues Ticket“) sticky am unteren Rand oder als FAB, damit sie beim Scrollen sichtbar bleiben.
**Nutzen:** Weniger Scrollen zum Absenden; klare Handlungsaufforderung.

## B3. Pull-to-Refresh und Skeleton-Loading
**Was:** Pull-to-Refresh auf Listen-Seiten (Objekte, Kontakte, Deals) wo sinnvoll; beim Nachladen Skeleton statt Spinner für bessere Wahrnehmung.
**Nutzen:** Vertrautes Mobil-Pattern; subjektiv schnellere Wahrnehmung.

## B4. Konsistente Bottom Sheets / Responsive Dialoge
**Was:** Auf Mobile: schwere Formulare (Objekt anlegen, Deal bearbeiten) als Bottom Sheet statt zentrierter Dialog; einheitliches Verhalten über ResponsiveDialog/Bottom Sheet.
**Nutzen:** Mehr Platz für Inhalt, weniger „kleines Fenster“-Gefühl.

## B5. Such- und Filter-UI vereinheitlichen
**Was:** Einheitliches Muster für Suche (z. B. immer oben, gleiche Platzhalter) und Filter (Chips, Dropdowns) über Objekte, Kontakte, Deals, Aufgaben; auf schmalen Screens Filter als Sheet/Overlay.
**Nutzen:** Weniger kognitive Last, schnelleres Finden.

## B6. Tastatur-Navigation und Shortcuts (Browser)
**Was:** Wichtige Aktionen per Tastatur erreichbar (z. B. Strg+S speichern, Esc schließen); Fokus-Management in Dialogen (Trap, Rückkehr); Shortcut-Übersicht in Einstellungen beibehalten/erweitern.
**Nutzen:** Power-User arbeiten schneller; A11y.

## B7. Lesbarkeit: Schriftgrößen und Kontrast
**Was:** Auf kleinen Viewports Mindest-Schriftgrößen (z. B. 14px Body); Kontrast-Checks für Texte und Buttons; „Große Schrift“-Option in Einstellungen respektieren.
**Nutzen:** Nutzbarkeit für mehr Nutzer (inkl. Ältere, Sehbehinderte).

## B8. Keine horizontalen Scrolls in Hauptinhalten
**Was:** In #main-content und Karten/Listen: `min-width: 0`, `overflow-wrap`, `word-break` so setzen, dass kein ungewollter horizontaler Scroll entsteht; Tabellen auf Mobile als Karten oder horizontal scrollbar nur wo nötig.
**Nutzen:** Kein „Verlaufen“ auf dem Bildschirm.

## B9. Feedback bei allen Aktionen
**Was:** Jede Mutation (Speichern, Löschen, Status ändern) mit sofortigem Feedback: Toast + optional Haptic auf Mobile; bei längeren Aktionen Fortschritt oder „Wird gespeichert…“.
**Nutzen:** Nutzer weiß, dass etwas passiert; weniger Doppelklicks.

## B10. PWA-Installation und App-ähnliches Verhalten
**Was:** Install-Prompt und Hinweis „Als App installieren“; nach Installation: eigenes Fenster, keine Browser-Leiste; Offline-Fallback-Seite und ggf. App-Update-Hinweis (bereits teilweise vorhanden).
**Nutzen:** ImmoControl fühlt sich wie eine native App an.

---

# C. Bestehende Funktionen verbessern (10 Vorschläge)

## C1. Objekte: Kartenansicht und Vergleich
**Was:** Optionale Kartenansicht (Map) für Objekte; Vergleichsmodus (2–3 Objekte nebeneinander) mit Kennzahlen; Export der Vergleichsdaten.
**Nutzen:** Bessere räumliche Einordnung und Entscheidungsunterstützung.

## C2. Darlehen: Tilgungsplan und Sondertilgungen
**Was:** Tilgungsplan als Tabelle/Chart (bereits Ansätze); explizite Sondertilgungen pro Jahr modellieren und in Prognose einrechnen; Hinweis auf Zinsbindungsende prominenter.
**Nutzen:** Realistischere Planung und Refinanzierungs-Timing.

## C3. Deals: Pipeline-View und Konvertierung
**Was:** Kanban- oder Pipeline-Ansicht (Stages) mit Drag & Drop; „Deal in Objekt umwandeln“ mit Übernahme aller relevanten Felder und optionalem Archivieren des Deals.
**Nutzen:** Klarere Deal-Verwaltung und nahtloser Übergang zu Objekt.

## C4. Mietübersicht und Zahlungserfassung
**Was:** Kalender- oder Monatsansicht der Fälligkeiten; schnelle Erfassung „bezahlt“/„teilbezahlt“ mit Datum; Filter nach Objekt/Mieter; Hinweis auf überfällige Beträge.
**Nutzen:** Weniger Klicks, bessere Übersicht.

## C5. Kontakte: Verknüpfungen und Historie
**Was:** Anzeige, wo ein Kontakt vorkommt (Tickets, Deals, Objekte); optional Timeline „wann wurde Kontakt zuletzt genutzt“; Duplikat-Erkennung (bereits angedacht) ausbauen.
**Nutzen:** Ein Kontext pro Kontakt, weniger Doppelpflege.

## C6. Tickets: Status-Workflow und Erinnerungen
**Was:** Klare Status-Übergänge (z. B. offen → in Bearbeitung → erledigt) mit optionalen Kommentaren; Erinnerung „Ticket seit X Tagen offen“; Zuweisung an Handwerker mit Benachrichtigung.
**Nutzen:** Weniger vergessene Tickets, bessere Nachverfolgung.

## C7. Berichte und Exporte
**Was:** PDF-Berichte (Rendite, Cashflow, Steuer) mit einheitlichem Layout und Datum; DATEV/Anlage-V prüfen und dokumentieren; Export-Felder an DB-Schema angebunden halten (bereits angestoßen).
**Nutzen:** Vertrauen in Zahlen, steuerlich nutzbar.

## C8. Einstellungen: Übersicht und Suche
**Was:** Einstellungen in klare Gruppen (Konto, Benachrichtigungen, Darstellung, Daten, Gefahrenzone); optional Suchfeld „Einstellung finden“; Tooltips zu sensiblen Optionen.
**Nutzen:** Schneller die richtige Option finden.

## C9. Dashboard: Widgets anpassbar und speicherbar
**Was:** Reihenfolge und Sichtbarkeit der Widgets pro Nutzer speichern (bereits Ansätze); Auswahl „Welche Widgets anzeigen“; sinnvolle Defaults für neue Nutzer.
**Nutzen:** Dashboard passt sich dem Nutzer an.

## C10. Verträge und Dokumente
**Was:** Vertragslebenszyklus (Laufzeit, Kündigungsfrist) klar anzeigen; Dokumente einem Vertrag/Objekt/Mieter zuordnen; Ablaufdatum-Erinnerungen (bereits teils vorhanden) konsistent nutzen.
**Nutzen:** Nichts verpassen bei Fristen und Ablagen.

---

# D. Neue Funktionen (10 Vorschläge)

## D1. Mieter-Selbstauskunft und digitale Unterschrift
**Was:** Link zur Selbstauskunft (bereits Bausteine) mit optionaler digitaler Unterschrift (z. B. Signature Pad); Speicherung als Dokument am Objekt/Mieter.
**Nutzen:** Weniger Papier, schnellerer Abschluss.

## D2. Nebenkostenabrechnung pro Objekt/Jahr
**Was:** Modul für NK-Abrechnung: Verbrauch/Umlage erfassen, Abrechnungs-PDF erzeugen, Versand an Mieter (E-Mail/Link); Vorlagen für gängige Verteilerschlüssel.
**Nutzen:** Kernaufgabe Vermieter abgedeckt.

## D3. Kündigungsfristen-Rechner und Schreiben
**Was:** Fristen-Rechner (bereits vorhanden) mit Generierung eines Kündigungsschreibens (Vorlage); Speicherung im Dokumente-Bereich.
**Nutzen:** Rechtssichere Fristen und Nachweis.

## D4. Immobilien-Steuer-Check (AfA, Anlage V)
**Was:** Übersicht „Welche Objekte in Anlage V“, AfA-Sätze, Hinweise auf Sonder-AfA; Export für Steuerberater (bereits Ansätze) erweitern.
**Nutzen:** Steueroptimierung und Vorbereitung Steuererklärung.

## D5. Einladungen und Team-Zugang
**Was:** Eigentümer/Partner einladen (E-Mail), Rolle „nur Lesezeit“ oder „Bearbeiten“; gemeinsame Sicht auf Portfolio; Audit-Log wer was geändert hat (bereits teils vorhanden).
**Nutzen:** Nutzung mit Partnern oder Steuerberater.

## D6. Marktpreis- und Mietspiegel-Anbindung
**Was:** Optional Preise/Mietspiegel von externen Quellen (z. B. offene APIs, Manus) anzeigen; Vergleich „eigene Miete vs. Mietspiegel“ pro Objekt.
**Nutzen:** bessere Preiseinschätzung bei Neuvermietung oder Anpassung.

## D7. Wartungs- und Instandhaltungsplan
**Was:** Geplante Maßnahmen pro Objekt (Fassade, Heizung, Dach …) mit Zeitraum und groben Kosten; Erinnerungen; Verknüpfung mit Tickets.
**Nutzen:** Langfristige Planung und Budgetierung.

## D8. Cashflow-Szenarien (Was-wäre-wenn)
**Was:** Szenarien „Leerstand 3 Monate“, „Zinserhöhung“, „NK-Nachzahlung“ durchspielen; Auswirkung auf Jahres-Cashflow und Reserve.
**Nutzen:** Risiko und Puffer besser einschätzen.

## D9. Kalender-Integration (iCal/Google)
**Was:** Export von Fristen (Mietzahlung, Vertragsende, Tickets) als Kalender-Feed; optional Sync mit Google Calendar (read-only Feed).
**Nutzen:** Alles an einem Ort im gewohnten Kalender.

## D10. Mehrsprachigkeit (i18n)
**Was:** Texte in Keys auslagern (z. B. react-i18next); zunächst DE (Standard) und EN; Einstellung „Sprache“ in den Einstellungen.
**Nutzen:** Nutzung im Ausland oder durch internationale Nutzer.

---

# Priorisierung (Empfehlung)

- **Schnell umsetzbar & hoher Nutzen:** B1, B9, C4, C8, A3 (schrittweise).
- **Mittelfristig:** A1, A2, B2, B4, C1, C3, D1, D2.
- **Größere Projekte:** A6, A10, B10, C9, D5, D10.

Die bestehenden Docs (`VORSCHLAEGE_FUNKTIONSVERBESSERUNGEN.md`, `IMPROVEMENTS_10_FUNDAMENTAL.md`) bleiben ergänzend gültig.
