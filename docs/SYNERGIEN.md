# Synergien und Vernetzung (ImmoControl)

Übersicht der Verknüpfungen zwischen Modulen – die App wirkt dadurch „verdrahteter“.

## Übersicht

| Von | Zu | Verknüpfung |
|-----|-----|-------------|
| **CRM** | Deals | Button „Als Deal“ – Lead-Daten vorausgefüllt; KI-Button „Nächster Schritt“ (DeepSeek) |
| **CRM (Leads)** | WGH-Scout, Besichtigungen | Empty State: Buttons „WGH suchen“ (Tab Scout), „Zu Besichtigungen“; Export Leads als CSV |
| **WGH-Scout** | Deals | Button „Deal“ pro Treffer – Deal-Formular mit Name/Adresse/Telefon/E-Mail vorausgefüllt (fromScout) |
| **WGH-Scout** | CRM Suche | Empty State „Keine Treffer“: Link „Stattdessen Adresssuche im CRM“ → /crm?tab=search |
| **WGH-Scout** | Besichtigungen | Empty State „Keine Treffer“: Link „Besichtigung planen“ → ROUTES.BESICHTIGUNGEN |
| **Verträge** | Fristen | Kündigungsfrist-Rechner auf der Seite Verträge: gewünschtes Enddatum + Frist in Monaten → spätestes Kündigungsdatum |
| **Mietübersicht** | Verträge | Link „Verträge“ in der Kopfzeile (ROUTES.CONTRACTS); Leerstands-Kosten-Rechner im Tab Zahlungen |
| **PropertyDetail** | AI | Button „KI Kurzbewertung“ (suggestPropertySummary) – 1–2 Sätze Bewertung bei DeepSeek |
| **PropertyDetail** | Deals | Link „Deal anlegen“ neben „WGH in Umgebung“ – Deal mit Objektname/Adresse vorausgefüllt (fromProperty) |
| **CRM** | Besichtigungen | Empty State: Link „Zu Besichtigungen“ |
| **Deals** | CRM | Empty State: Link „Leads aus CRM übernehmen“; fromLead-Vorlage |
| **Deals** | Kontakte | Dropdown „Kontakt übernehmen“; fromContact-Vorlage beim „Als Deal“-Button |
| **Deals** | Besichtigungen | Bei Stage „Besichtigung“: automatischer Besichtigungseintrag; Picker „Besthende Besichtigung zuordnen“ |
| **Kontakte** | Deals | Button „Als Deal“ – Kontaktdaten als Deal-Vorlage; Badge „X Deals“ klickbar → filtert Deals nach Kontakt |
| **Deals** | Besichtigungen | Link „Zu Besichtigungen“ bei Stage Besichtigung |
| **Besichtigungen** | Deals | Deal-Badge verlinkt auf /deals; Empty State: Link „Zu Deals“ |
| **Besichtigungen** | Todos | Button „Todo erstellen“ – Projekt „Besichtigungen“ |
| **Besichtigungen** | Global | Deep-Link `?id=xxx`; Share-Button (native Share API + Fallback Kopieren) |
| **PropertyDetail** | Besichtigungen | Sektion „Besichtigungen“ wenn property_id verknüpft |
| **PropertyDetail** | Home, Nebenkosten, Besichtigungen | Links/Navigation über ROUTES |
| **PropertyDetail** | Darlehen | Link „Darlehen bearbeiten“ in Finanzierung |
| **Verträge** | Dokumente | Link „Dokumente hochladen“ in Kopfzeile |
| **Dokumente** | Verträge, Nebenkosten | Empty State: Links „Verträge verwalten“, „Nebenkostenabrechnung“ (ROUTES) |
| **Darlehen** | Objekte, Deals, Mietübersicht, Nebenkosten, Berichte, WGH-Scout | Kopfzeile: Link „Berichte“; Empty State: Buttons Objekt, Deals, Mietübersicht, Nebenkosten, Berichte, WGH finden (ROUTES.CRM_SCOUT) |
| **Objekte** | Deals, Besichtigungen, WGH-Scout | Empty State: Buttons Deals, Besichtigungen, WGH-Scout (ROUTES.CRM_SCOUT, aria-label) |
| **Berichte** | Objekte, Deals, Analyse, WGH-Scout | Empty State: Buttons Objekte, Zu Deals, Zur Analyse, WGH finden (ROUTES) |
| **Besichtigungen** | Deals, Dokumente | Empty State: Links „Zu Deals“, „Dokumente“ (ROUTES) |
| **Todos** | CRM, Deals, Berichte, WGH-Scout | Empty State: Buttons Zu CRM, Zu Deals, Berichte, WGH finden (ROUTES, Touch-Target) |
| **PropertyDetail** | Deals | Besichtigungen: Link zum Deal bei deal_id; Deep-Link ?id= zu Besichtigung |
| **Wartungsplaner** | Objekte, Berichte, WGH-Scout | Empty State: Buttons Objekte, Berichte, WGH finden (ROUTES, Touch-Target) |
| **DashboardActionCenter** | Mietübersicht | „Überfällig“-Kachel verlinkt bei überfälligen Zahlungen |
| **Nebenkosten** | Dokumente, WGH-Scout | Links Dokumente, WGH finden in Kopfzeile; Button „Als Dokument“ speichert Abrechnung als PDF in Objekt-Dokumente |
| **Nebenkosten** | Objekte | Link „Zum Objekt“ bei Abrechnungsdetail (zum PropertyDetail) |
| **Kontakte** | Deals, WGH-Scout | Empty State: Buttons „Zu Deals“, „WGH finden“ (ROUTES.CRM_SCOUT) |
| **Mietübersicht** | Nebenkosten, Berichte, WGH-Scout | Links NK-Abrechnung, Berichte, WGH finden in Kopfzeile (ROUTES) |
| **PropertyDetail** | Nebenkosten | Link „Nebenkostenabrechnung“ in Finanzierungs-Sektion |
| **DashboardActionCenter** | Nebenkosten | Kachel „X NK-Entwürfe“ wenn status=draft; verlinkt auf /nebenkosten |
| **GlobalSearch** | Kontakte, Deals, Besichtigungen, Nebenkosten, Dokumente | Suche und Navigation für alle Seiten; Deep-Links `?highlight=xxx`, `?id=xxx` |
| **Dashboard** | Deals, Besichtigungen | Links zu „Deals in Besichtigung“ und „Besichtigungen“ |
| **GlobalSearch** | Besichtigungen | Suche in property_viewings; Seiten-Navigation |
| **Immo-Chat** | Deals, Besichtigungen, Tickets | System-Kontext um Tickets erweitert; vorgeschlagene Frage „Wie viele offene Tickets?“ |
| **Tickets** | Kontakte | Link „Zu Kontakten“ wenn keine Handwerker vorhanden |
| **Nebenkosten** | Mietübersicht, Objekte | Empty State: Buttons „Mietübersicht“, „Objekte“ |
| **Verträge** | Mietübersicht, Berichte, Dokumente, WGH-Scout | Links Mietübersicht, Berichte, Dokumente, WGH finden in Kopfzeile (ROUTES, Touch-Target) |
| **Dashboard** | Deals, Analyse, WGH-Scout | Empty State (keine Objekte): Buttons Zu Deals, Zur Analyse, WGH finden (ROUTES.CRM_SCOUT) |
| **Dashboard** | Analyse | Link „Zur Analyse“ in Kopfzeile (Personal + Portfolio) |
| **Berichte** | Analyse | Link „Zur Analyse“ in der Kopfzeile; Empty State zusätzlich Button „Zur Analyse“ |
| **Analyse** | Berichte, WGH-Scout | Button „Berichte“ und „WGH finden“ in der Kopfzeile (ROUTES) |
| **Deals** | CRM, WGH-Scout | Empty State: Links „Leads aus CRM übernehmen“, „WGH finden“ (ROUTES.CRM_SCOUT) |
| **Newsticker** | — | Fehler beim Laden: handleError + toastErrorWithRetry (Retry = Aktualisieren) |
| **Dashboard** | Mietübersicht | StatCard „Mieteinnahmen“ verlinkt über ROUTES.RENT |
| **OnboardingBanner** | Home, Analyse | Schritte „Objekt hinzufügen“, „Zum Rechner“ nutzen ROUTES.HOME, ROUTES.ANALYSE |
| **PropertyMap** | Objekte | Popup-Link „Details →“ nutzt ROUTES.PROPERTY (Objekt-Detailseite) |
| **AddTenantDialog** | — | Fehler beim Anlegen: handleError + toastErrorWithRetry (Retry = handleSave) |
| **AddPropertyDialog** | — | Fehler beim Anlegen: handleError + toastErrorWithRetry (Retry = erneuter Submit) |
| **AddContactDialog** | — | Fehler beim Anlegen: handleError + toastErrorWithRetry (Retry = handleSave) |
| **DealToPropertyConverter** | Objekte | Deal→Immobilie: handleError + toastErrorWithRetry (Retry = handleConvert); Synergie Deals↔Objekte |
| **GlobalSearch** | Alle Seiten, Objekte | Nav- und Suchergebnis-Links nutzen ROUTES (Single Source of Truth) |
| **LoanPdfImport** | — | Fehler beim PDF-Lesen: handleError + toastErrorWithRetry (Retry mit letzter Datei) |
| **ContractManagement** | — | Fehler bei Vertrag-PDF-Extraktion: handleError + toastErrorWithRetry (Retry mit letzter Datei) |
| **QuickActions** | Besichtigungen, Deals, Mietübersicht, Nebenkosten, Immo-AI | Schnellaktionen nutzen ROUTES (BESICHTIGUNGEN, DEALS, RENT, NK, AI) |
| **DocumentOCR** | — | Fehler beim Datei/PDF-Lesen: handleError + toastErrorWithRetry (Retry mit letzter Datei) |
| **SpotlightSearch** | Alle Seiten, Objekte, Mieter | Nav, Quick Actions und Objekt-Links nutzen ROUTES (Cmd+K) |
| **MobileSearchOverlay** | Alle Seiten, Objekte | Mobile Suche: Seiten- und Objekt-Links über ROUTES (Usability) |
| **navConfig (AppLayout)** | Alle Bereiche | Sidebar-Navigation und Shortcut-Map nutzen ROUTES (Single Source of Truth) |
| **MobileBottomTabBar** | Alle Tabs | Mobile Tab-Navigation nutzt ROUTES (Finanzen, Verwaltung, Akquise, Mehr) |
| **GesellschaftSelector** | — | Fehler beim Hinzufügen/Löschen: handleError + toastErrorWithRetry (Retry mit letzter Aktion) |
| **Mietvertragsverwaltung** | — | Vertrag anlegen/löschen: handleError + toastErrorWithRetry (Retry ohne Formularverlust / mit lastDeletedIdRef) |
| **AutoTodoGenerator** | Todos | Todo aus Vorschlag erstellen: handleError + toastErrorWithRetry (Retry mit lastTodoRef) |
| **BulkRentAdjustment** | Mieter, Mietübersicht | Bulk-Mietanpassung: handleError + toastErrorWithRetry (Retry = applyAdjustments) |
| **MeterManagement** | — | Zähler anlegen, Ablesung erfassen, Zähler löschen: handleError + toastErrorWithRetry (Retry mit lastMeterIdRef/lastDeletedMeterIdRef) |
| **PropertyNotes** | — | Notiz anlegen/löschen: handleError + toastErrorWithRetry (Retry mit lastDeletedNoteIdRef) |
| **TenantManagement** | — | Mieter speichern/löschen: handleError + toastErrorWithRetry (Retry mit lastDeletedTenantIdRef) |
| **Nebenkosten** | — | Abrechnung/Position anlegen, Position/Abrechnung löschen: handleError + toastErrorWithRetry (Retry mit lastDeletedItemIdRef/lastDeletedBillingIdRef) |
| **CRM** | — | Lead speichern (Ort/manuel), Gespräch loggen, Gespräch bearbeiten: handleError + toastErrorWithRetry (Retry mit lastPlaceRef/lastEditCallLogRef) |
| **Deals** | Besichtigungen | Speichern, Löschen, Verschieben, Besichtigung zuordnen, Batch-Import: handleError + toastErrorWithRetry (Retry mit lastDeletedDealIdRef/lastMoveDealRef/lastBatchImportRef) |
| **Contacts** | — | Kontakt speichern/aktualisieren: handleError + toastErrorWithRetry (Retry = saveMutation.mutate) |
| **MaintenancePlanner** | — | Maßnahme planen: handleError + toastErrorWithRetry (Retry = addMutation.mutate) |
| **OwnerMeetings** | — | Eigentümerversammlung anlegen: handleError + toastErrorWithRetry (Retry = addMeeting.mutate) |
| **WGH-Scout** | CRM, Leads | Rebrand von Gewerbe-Scout (Wohn- und Geschäftshaus). Ort oder Umkreis (bis 10 km); Gebäudegröße aus OSM; Filter Typ/Mindestfläche/Nur mit Telefon/Web/E-Mail; Deduplizierung; CSV; „Auf Karte anzeigen“ (OSM), Öffnungszeiten, sessionStorage, KI „Anruf-Einstieg“, initialQuery. ROUTES.CRM_SCOUT. |
| **CRM** | URL-Tab, Scout | `?tab=scout` öffnet WGH-Scout; `?q=…` wird als initialQuery übergeben (Synergie Deals, Objekt, Besichtigung) |
| **Deals** | CRM (Scout) | Bei Adresse: „WGH in Umgebung“ / „Scout“; bei Kaufpreis + m²: Anzeige €/m² auf Karte |
| **PropertyDetail** | CRM (Scout), Analyse | Bei Adresse: „WGH in Umgebung“ → Scout; in Renditekennzahlen: „Rendite berechnen & Szenarien“ → Rechner & Analyse |
| **Besichtigungen** | CRM (Scout) | Im Bearbeitungs-Dialog: „WGH in Umgebung“ → CRM?tab=scout&q=Titel, Adresse |
| **Kontakte** | CRM (Scout), Deals | Bei Kontakt mit Adresse: Link „WGH in Umgebung“ → CRM?tab=scout&q=Adresse; Empty State: „WGH finden“ |
| **DashboardActionCenter** | CRM (Scout) | Link „WGH finden“ → ROUTES.CRM_SCOUT |
| **QuickActions** | CRM (Scout) | Schnellaktion „WGH-Scout“ → ROUTES.CRM_SCOUT |
| **SpotlightSearch / MobileSearchOverlay** | CRM (Scout) | Eintrag „WGH-Scout“ → ROUTES.CRM_SCOUT (Suche „wgh scout“) |
| **Immo-AI** | — | Vorschlagsfrage „Wo finde ich Wohn- und Geschäftshäuser (WGH) für die Akquise?“; weitere Vorschläge u. a. Brutto-Mietrendite, Zinsbindung |
| **EnergyCertificateTracker** | — | Energieausweis anlegen/löschen: handleError + toastErrorWithRetry (Retry mit lastDeletedCertIdRef) |
| **CrmFollowUpReminder** | Todos | Follow-Up-Todo erstellen: handleError + toastErrorWithRetry (Retry mit lastContactRef) |
| **InsuranceTracker** | — | Versicherung anlegen/löschen: handleError + toastErrorWithRetry (Retry mit lastDeletedInsuranceIdRef); Touch-Target für Löschen-Button (Mobile) |

## Technische Details

- **Deal → Besichtigung**: `moveDeal` Mutation legt `property_viewings`-Eintrag an, wenn `stage === "besichtigung"`.
- **Deep-Links**: `useSearchParams()` liest `?id=xxx` (Deals, Besichtigungen) bzw. `?highlight=xxx` (Kontakte). Kontakte scrollt zum hervorgehobenen Kontakt, Deals/Besichtigungen öffnen den Bearbeitungsdialog.
- **Share-Buttons**: Deals und Besichtigungen nutzen `useShare()` für native Share API (Mobile) oder Kopieren in Zwischenablage.
- **Todos**: `project: "Besichtigungen"`, `title: "Besichtigung nachbereiten: …"`.
- **WGH-Scout**: Modus „Ganzer Ort“ nutzt Nominatim-Boundingbox und durchsucht das gesamte Gebiet; Gebäudegröße aus Overpass (way["building"] + geom), POIs werden dem nächsten Gebäude zugeordnet; Sortierung nach geschätzter Bruttogeschossfläche. Overpass-Timeouts zentral in crmUtils (OVERPASS_TIMEOUT_BBOX/RADIUS). KI-Anruf-Einstieg über suggestColdCallOpening (DeepSeek) in integrations/ai/extractors. Route: ROUTES.CRM_SCOUT.
