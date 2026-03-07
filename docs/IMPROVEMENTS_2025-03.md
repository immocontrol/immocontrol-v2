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

## CRM

- **Leads laden:** Statt „Laden…“ wird das Skeleton `CRMSkeleton` aus den Mobile-Skeletons angezeigt.
- **Export:** Button „Export“ im Leads-Tab exportiert die aktuell gefilterten Leads als CSV (Name, Firma, Telefon, E-Mail, Adresse, Status, Notizen, Aktualisiert).
- **KI Nächster Schritt:** Bei ausgewähltem Lead erscheint (wenn DeepSeek konfiguriert) ein Button „KI“ – klicken liefert einen kurzen Vorschlag für den nächsten Schritt (z. B. „Heute anrufen und Besichtigung vorschlagen“). Implementierung: `suggestLeadNextStep()` in `@/integrations/ai/extractors`.

## Synergien

- **Scout → Deals:** Pro Scout-Treffer Button „Deal“; Deal-Formular wird mit Name/Adresse/Telefon/E-Mail und Quelle „WGH-Scout“ vorausgefüllt.
- **Objekt → Deals:** In PropertyDetail neben „WGH in Umgebung“ neuer Link „Deal anlegen“ – Deal mit Objektname und Adresse (Quelle „Objekt“) vorausgefüllt.
- **Deals:** State `fromScout` und `fromProperty` in der Vorlagen-Logik ergänzt; Toast-Meldungen angepasst.

## AI

- **suggestLeadNextStep:** Neue Funktion in `extractors.ts` für CRM-Leads (Name, Firma, Status, Notizen) → ein Satz Vorschlag für den nächsten Schritt.
- **suggestPropertySummary:** KI-Kurzbewertung für Objekte (Name, Adresse, Miete, Kaufpreis, m², Einheiten, Notizen) → 1–2 Sätze Bewertung. Button „KI Kurzbewertung“ (Sparkles) in PropertyDetail, nur wenn DeepSeek konfiguriert; Ergebnis im Toast (8 s).

## Dokumentation

- **SYNERGIEN.md:** Einträge für WGH-Scout → Deals, WGH-Scout → CRM Suche, PropertyDetail → Deal anlegen; CRM → Export und KI Nächster Schritt.
- **CHANGELOG.md:** Eintrag „WGH-Scout & CRM: Verbesserungen & Synergien“.

## Neue Funktionen (Investoren)

- **Kündigungsfrist-Rechner:** Auf der Seite Verträge & Verwaltung. Eingabe: Kündigungsfrist (Monate) und gewünschtes Vertragsende. Ausgabe: „Kündigung spätestens einreichen bis [Datum]“. Relevant für Mietverträge und Kündigungsplanung. Komponente: `KuendigungsfristRechner.tsx`.
- **Leerstands-Kosten-Rechner:** Auf der Mietübersicht (Tab Zahlungen). Eingabe: Tage Leerstand, Monatsmiete (€). Ausgabe: entgangene Miete. Komponente: `LeerstandskostenRechner.tsx`. Synergie: Mietübersicht verlinkt „Verträge“ (Kündigungsfrist) in der Kopfzeile.
- **Rendite-Schnellrechner:** Auf der Objektanalyse (Analyse-Seite). Eingabe: Kaufpreis (€), Monatsmiete (€). Ausgabe: Brutto-Mietrendite (%), Mietmultiplikator (Jahre). Komponente: `RenditeSchnellrechner.tsx`.

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
