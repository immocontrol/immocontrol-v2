# Verbesserungen (März 2025)

Kurzüberblick der umgesetzten Änderungen in einem Durchgang: WGH-Scout, CRM, Synergien, AI, Doku.

## WGH-Scout

- **Lade-Skeleton:** Während „Ordne Gebäudegrößen zu“ (und bei Schritt „gewerbe“ ohne Ergebnisse) werden 6 Platzhalter-Karten angezeigt – kürere wahrgenommene Wartezeit.
- **Empty State:** Bei „Keine Treffer gefunden“ Link „Stattdessen Adresssuche im CRM“ → `/crm?tab=search`.
- **Als Deal:** Neuer Button „Deal“ pro Treffer; optionaler Callback `onAddAsDeal`. Im CRM wird er genutzt: Navigation zu Deals mit vorausgefülltem Formular (Name, Adresse, Telefon, E-Mail). Quelle im Deal: „WGH-Scout“.

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

## Dokumentation

- **SYNERGIEN.md:** Einträge für WGH-Scout → Deals, WGH-Scout → CRM Suche, PropertyDetail → Deal anlegen; CRM → Export und KI Nächster Schritt.
- **CHANGELOG.md:** Eintrag „WGH-Scout & CRM: Verbesserungen & Synergien“.

## Technik

- **GewerbeScout:** Neue Prop `onAddAsDeal`; Import `Link` (react-router-dom) und `Handshake` (lucide-react).
- **CRM:** Import `Link`, `CRMSkeleton`; `exportLeadsCsv`, `leadNextStepLoading`; Nutzung von `suggestLeadNextStep`.
- **Deals:** Erweiterung des location.state-Typs um `fromScout` und `fromProperty`; Vorlage-Logik für beide Fälle.
- **PropertyDetail:** Import `Handshake`; Button „Deal anlegen“ mit `navigate(ROUTES.DEALS, { state: { fromProperty: { title, address } } })`.
