# Verbesserungen (März 2025)

Kurzüberblick der umgesetzten Änderungen in einem Durchgang: WGH-Scout, CRM, Synergien, AI, neue Funktionen, Doku.

## WGH-Scout

- **Lade-Skeleton:** Während „Ordne Gebäudegrößen zu“ (und bei Schritt „gewerbe“ ohne Ergebnisse) werden 6 Platzhalter-Karten angezeigt – kürere wahrgenommene Wartezeit.
- **Empty State:** Bei „Keine Treffer gefunden“ Link „Stattdessen Adresssuche im CRM“ → `/crm?tab=search`.
- **Als Deal:** Neuer Button „Deal“ pro Treffer; optionaler Callback `onAddAsDeal`. Im CRM wird er genutzt: Navigation zu Deals mit vorausgefülltem Formular (Name, Adresse, Telefon, E-Mail). Quelle im Deal: „WGH-Scout“.
- **Als Besichtigung:** Optionaler Callback `onAddAsViewing(business: { name, address })`. Im CRM: Button „Besichtigung“ pro Treffer → Navigation zu Besichtigungen mit vorausgefülltem Titel/Adresse (state `fromScout`); Besichtigungen öffnet den Anlege-Dialog und übernimmt die Vorlage.
- **Tastatur-Navigation:** In der Ergebnisliste: Pfeil hoch/runter wechseln den hervorgehobenen Treffer (roving tabindex), Enter fokussiert die erste Aktion (Anrufen/Web/Deal). Klick auf eine Zeile setzt die Hervorhebung. Verbesserte A11y (role="listbox", aria-selected, Fokus-Ring).
- **Mobile Touch:** Filter-Checkboxen (Nur mit Telefon/Web/E-Mail/Öffnungszeiten) haben auf Mobilgeräten größere Touch-Ziele (min-h 44px für die gesamte Label-Zeile).
- **Empty State:** Zusätzlicher Link „Besichtigung planen“ → ROUTES.BESICHTIGUNGEN (Synergie Scout ↔ Besichtigungen).
- **Header:** Nach Suche wird „X Treffer“ im Kartentitel angezeigt.
- **Scroll nach Suche:** Wenn die Suche mit Treffern abgeschlossen ist, scrollt die Ergebnis-Sektion automatisch in den Blick (resultsSectionRef, smooth).
- **Kopieren:** Pro Treffer Button „Kopieren“ – Name und Adresse (Zeilenumbruch) in die Zwischenablage; Toast „Kopiert“ / „Kopieren fehlgeschlagen“. A11y: Trefferanzahl-Überschrift mit `aria-live="polite"` für Screenreader.
- **Teilen:** Button „Teilen“ neben der Trefferüberschrift – kopiert Link zur aktuellen Scout-Suche (`/crm?tab=scout&q=…`) in die Zwischenablage (z. B. zum Verschicken an Kollegen).
- **Empty State:** Link „Deal anlegen“ (ROUTES.DEALS) ergänzt; Adresssuche nutzt ROUTES.CRM + `?tab=search`.
- **KI „Warum interessant?“:** Pro Treffer (wenn DeepSeek konfiguriert) Button „Warum interessant?“ – Popover mit Kurzbegründung, warum das Gewerbe für Akquise interessant sein könnte (Lage, Größe, Nutzung). Implementierung: `suggestScoutInterest()` in extractors, `ScoutInterestPopover` in GewerbeScout.
- **Tastatur:** Escape in der Ergebnisliste entfernt den Fokus und blur der Liste (bessere A11y).

## CRM

- **Leads laden:** Statt „Laden…“ wird das Skeleton `CRMSkeleton` aus den Mobile-Skeletons angezeigt.
- **Export:** Button „Export“ im Leads-Tab exportiert die aktuell gefilterten Leads als CSV (Name, Firma, Telefon, E-Mail, Adresse, Status, Notizen, Aktualisiert).
- **KI Nächster Schritt:** Bei ausgewähltem Lead erscheint (wenn DeepSeek konfiguriert) ein Button „KI“ – klicken liefert einen kurzen Vorschlag für den nächsten Schritt (z. B. „Heute anrufen und Besichtigung vorschlagen“). Implementierung: `suggestLeadNextStep()` in `@/integrations/ai/extractors`.

## Synergien

- **Scout → Deals:** Pro Scout-Treffer Button „Deal“; Deal-Formular wird mit Name/Adresse/Telefon/E-Mail und Quelle „WGH-Scout“ vorausgefüllt.
- **Objekt → Deals:** In PropertyDetail neben „WGH in Umgebung“ neuer Link „Deal anlegen“ – Deal mit Objektname und Adresse (Quelle „Objekt“) vorausgefüllt.
- **Deals:** State `fromScout` und `fromProperty` in der Vorlagen-Logik ergänzt; Toast-Meldungen angepasst. Empty State: zusätzlicher Link „Besichtigung planen“ → ROUTES.BESICHTIGUNGEN (CalendarCheck).
- **Loans:** Empty State um Button „Verträge“ (ROUTES.CONTRACTS, FileText) ergänzt.
- **Verträge:** Widget „Nächste Kündigungsfristen“ – zeigt die nächsten 3 Kündigungsfristen (Daten aus View `mietvertraege`, Frist = Vertragsende − notice_period_months). „Alle Fristen“ scrollt smooth zum Fristen-Tab.
- **Dashboard:** Karte „Nächste Besichtigung“ – wenn eine Besichtigung mit Datum ≥ heute existiert: Titel, Datum, Link zu Besichtigungen (Synergie Dashboard ↔ Besichtigungen).
- **PropertyDetail:** Link „Zur Mietübersicht“ (ROUTES.RENT?property=id) in der Finanzierungs-Sektion – Mietübersicht öffnet mit Objektfilter.
- **Mietübersicht:** URL-Parameter `?property=id` setzt den Objektfilter beim Laden; neue Komponente **Inflation-Mietrechner** im Tab Zahlungen (Miete heute, Jahre, Inflation % → Miete in X Jahren).
- **Todos:** Empty State um Button „Besichtigung planen“ (ROUTES.BESICHTIGUNGEN) ergänzt.
- **Darlehen:** Bei Zinsbindung ≤ 12 Monate: Anzeige „Zinsbindung endet in X Tagen“ (statt nur „bald“), wenn Restlaufzeit ≤ 365 Tage.
- **Wartungsplaner:** Empty State um Button „Besichtigung planen“ (ROUTES.BESICHTIGUNGEN) ergänzt.
- **Nebenkosten:** Empty State um Link „Verträge“ (ROUTES.CONTRACTS) ergänzt.
- **Dokumente:** Empty State um Button „Besichtigungen“ (ROUTES.BESICHTIGUNGEN) ergänzt.
- **Kontakte:** Empty State um Button „Besichtigung planen“ (ROUTES.BESICHTIGUNGEN) ergänzt.
- **Besichtigungen:** Empty State Link „WGH finden“ (ROUTES.CRM_SCOUT) ergänzt.
- **ObjekteList:** Empty State Button „Verträge“ (ROUTES.CONTRACTS) ergänzt.
- **Loans:** Empty State Button „Besichtigung planen“ (ROUTES.BESICHTIGUNGEN) ergänzt.
- **Berichte:** Empty State Button „Verträge“ (ROUTES.CONTRACTS) ergänzt.

## AI

- **suggestLeadNextStep:** Neue Funktion in `extractors.ts` für CRM-Leads (Name, Firma, Status, Notizen) → ein Satz Vorschlag für den nächsten Schritt.
- **suggestPropertySummary:** KI-Kurzbewertung für Objekte (Name, Adresse, Miete, Kaufpreis, m², Einheiten, Notizen) → 1–2 Sätze Bewertung. Button „KI Kurzbewertung“ (Sparkles) in PropertyDetail, nur wenn DeepSeek konfiguriert; Ergebnis im Toast (8 s).
- **suggestScoutInterest:** Kurze Begründung, warum ein WGH-Scout-Treffer für Akquise interessant sein könnte (Lage, Größe, Nutzung). Pro Scout-Treffer Button „Warum interessant?“ (ScoutInterestPopover), nur wenn DeepSeek konfiguriert.

## Dokumentation

- **SYNERGIEN.md:** Einträge für WGH-Scout → Deals, WGH-Scout → CRM Suche, PropertyDetail → Deal anlegen; CRM → Export und KI Nächster Schritt.
- **CHANGELOG.md:** Eintrag „WGH-Scout & CRM: Verbesserungen & Synergien“.

## Neue Funktionen (Investoren)

- **Kündigungsfrist-Rechner:** Auf der Seite Verträge & Verwaltung. Eingabe: Kündigungsfrist (Monate) und gewünschtes Vertragsende. Ausgabe: „Kündigung spätestens einreichen bis [Datum]“. Relevant für Mietverträge und Kündigungsplanung. Komponente: `KuendigungsfristRechner.tsx`.
- **Leerstands-Kosten-Rechner:** Auf der Mietübersicht (Tab Zahlungen). Eingabe: Tage Leerstand, Monatsmiete (€). Ausgabe: entgangene Miete. Komponente: `LeerstandskostenRechner.tsx`. Synergie: Mietübersicht verlinkt „Verträge“ (Kündigungsfrist) in der Kopfzeile.
- **Rendite-Schnellrechner:** Auf der Objektanalyse (Analyse-Seite). Eingabe: Kaufpreis (€), Monatsmiete (€). Ausgabe: Brutto-Mietrendite (%), Mietmultiplikator (Jahre). Komponente: `RenditeSchnellrechner.tsx`.
- **Inflation-Mietrechner:** Auf der Mietübersicht (Tab Zahlungen). Eingabe: aktuelle Monatsmiete (€), Jahre (1–30), Inflation (% p.a.). Ausgabe: geschätzte Miete in X Jahren. Komponente: `InflationMietrechner.tsx`. Relevant für Indexmiete und langfristige Planung.
- **AfA-Schnellrechner:** Auf der Seite Verträge & Verwaltung. Eingabe: Kaufpreis (€), Gebäudeanteil (%), Nutzungsdauer (Jahre). Ausgabe: jährliche AfA (Absetzung für Abnutzung) in €. Komponente: `AfASchnellrechner.tsx`. Relevant für Steuerplanung (Anlage V).

## Technik

- **GewerbeScout:** Props `onAddAsDeal`, `onAddAsViewing`; Import `Link` (react-router-dom), `Handshake`, `CalendarCheck` (lucide-react). Roving tabindex (`focusedResultIndex`, `resultsListRef`, `visibleResults`); `role="listbox"`/`role="option"`; Touch-Target-Klassen für Filter-Labels.
- **CRM:** Import `Link`, `CRMSkeleton`; `exportLeadsCsv`, `leadNextStepLoading`; Nutzung von `suggestLeadNextStep`.
- **Deals:** Erweiterung des location.state-Typs um `fromScout` und `fromProperty`; Vorlage-Logik für beide Fälle.
- **PropertyDetail:** Import `Handshake`; Button „Deal anlegen“ mit `navigate(ROUTES.DEALS, { state: { fromProperty: { title, address } } })`.
- **Verträge:** Import und Einbindung `KuendigungsfristRechner` oberhalb der Tabs.
- **GewerbeScout:** ROUTES.BESICHTIGUNGEN für Empty-State-Link „Besichtigung planen“; Trefferanzahl im CardTitle wenn `searchLabel && results.length > 0`.
- **Mietübersicht:** Import `LeerstandskostenRechner`, `FileSignature`; Link „Verträge“ in Kopfzeile (ROUTES.CONTRACTS); LeerstandskostenRechner im Tab Zahlungen unter den KPI-Karten.
- **PropertyDetail:** `suggestPropertySummary`, `isDeepSeekConfigured`, `handleError`; Button „KI Kurzbewertung“ (Sparkles) mit Toast-Ausgabe.
- **extractors.ts:** Neue Funktion `suggestPropertySummary(property)`.
- **GewerbeScout:** resultsSectionRef + prevLoadingRef; Scroll-into-View der Ergebnis-Sektion wenn Suche mit Treffern endet.
- **Analyse:** RenditeSchnellrechner oben auf der Seite eingebunden.
- **Dashboard:** Empty State (keine Objekte) um Button „Verträge“ (ROUTES.CONTRACTS, FileText) ergänzt.
- **ViewingCard:** Bei Adresse Link „WGH in Umgebung“ → ROUTES.CRM_SCOUT mit ?q=Adresse (Synergie Besichtigungen ↔ Scout).
- **Besichtigungen:** useLocation/useNavigate; useEffect bei location.state.fromScout → Form vorausgefüllt, setAddOpen(true), Toast, navigate replace (State leeren). CRM: onAddAsViewing an GewerbeScout übergeben.
- **GewerbeScout:** Copy-Button (lucide Copy), Toast bei Kopieren; Ergebnis-Überschrift mit aria-live.
- **Deals:** CalendarCheck-Import; Empty-State-Link „Besichtigung planen“.
- **Loans:** FileText-Import; Empty-State-Button „Verträge“.
- **Vertraege:** useRef(tabsRef), useQuery „vertraege_notice_deadlines“ (mietvertraege: id, tenant_name, unit_number, contract_end, notice_period_months, is_indefinite); formatDate, formatDaysUntil; Widget nur wenn noticeDeadlines.length > 0; „Alle Fristen“-Button scrollt zu tabsRef.
- **GewerbeScout:** Share2-Button „Teilen“ kopiert `/crm?tab=scout&q=…` in Zwischenablage.
- **Mietuebersicht:** useSearchParams, propertyFromUrl für initialen Objektfilter; InflationMietrechner unter LeerstandskostenRechner.
- **PropertyDetail:** Link „Mietübersicht →“ mit ROUTES.RENT + ?property=id.
- **Dashboard:** useQuery „dashboard_next_viewing“ (property_viewings, visited_at >= heute), Link-Karte „Nächste Besichtigung“.
- **Todos:** CalendarCheck, Button „Besichtigung planen“ im Empty State.
- **Loans:** daysUntilFixedEnd, Anzeige „Zinsbindung endet in X Tagen“ wenn ≤ 365 Tage.
- **GewerbeScout:** Empty State Link „Deal anlegen“ (ROUTES.DEALS); Adresssuche-Link über ROUTES.CRM + ?tab=search; suggestScoutInterest, ScoutInterestPopover.
- **extractors.ts:** suggestScoutInterest(business) für WGH-Scout.
- **Wartungsplaner:** CalendarCheck-Import; Empty-State-Button „Besichtigung planen“. **Nebenkosten:** Empty-State-Link „Verträge“. **Dokumente:** CalendarCheck-Import; Empty-State-Button „Besichtigungen“. **Contacts:** CalendarCheck-Import; Empty-State-Button „Besichtigung planen“.
