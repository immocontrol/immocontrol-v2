# Synergien und Vernetzung (ImmoControl)

Übersicht der Verknüpfungen zwischen Modulen – die App wirkt dadurch „verdrahteter“.

## Übersicht

| Von | Zu | Verknüpfung |
|-----|-----|-------------|
| **CRM** | Deals | Button „Als Deal“ – Lead-Daten vorausgefüllt |
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
| **Darlehen** | Objekte, Deals, Mietübersicht, Nebenkosten, Berichte | Kopfzeile: Link „Berichte“; Empty State: Buttons Objekt, Deals, Mietübersicht, Nebenkosten, Berichte (ROUTES)
| **Objekte** | Deals, Besichtigungen | Empty State: Buttons Deals, Besichtigungen (ROUTES, aria-label) |
| **Besichtigungen** | Deals, Dokumente | Empty State: Links „Zu Deals“, „Dokumente“ (ROUTES) |
| **Todos** | CRM, Deals, Berichte | Empty State: Buttons „Zu CRM“, „Zu Deals“, „Berichte“ (ROUTES, Touch-Target)
| **PropertyDetail** | Deals | Besichtigungen: Link zum Deal bei deal_id; Deep-Link ?id= zu Besichtigung |
| **Wartungsplaner** | Objekte, Berichte | Empty State: Buttons „Objekte öffnen“, „Berichte“ (ROUTES, Touch-Target)
| **DashboardActionCenter** | Mietübersicht | „Überfällig“-Kachel verlinkt bei überfälligen Zahlungen |
| **Nebenkosten** | Dokumente | Link „Dokumente“ in Kopfzeile; Button „Als Dokument“ speichert Abrechnung als PDF in Objekt-Dokumente |
| **Nebenkosten** | Objekte | Link „Zum Objekt“ bei Abrechnungsdetail (zum PropertyDetail) |
| **Kontakte** | Deals | Empty State: Button „Zu Deals“ für Synergie (Kontakte aus Deals übernehmen) |
| **Mietübersicht** | Nebenkosten | Link „Nebenkostenabrechnung“ in Kopfzeile |
| **Mietübersicht** | Berichte | Link „Berichte“ in Kopfzeile (Mietbericht, Steuerberichte) |
| **PropertyDetail** | Nebenkosten | Link „Nebenkostenabrechnung“ in Finanzierungs-Sektion |
| **DashboardActionCenter** | Nebenkosten | Kachel „X NK-Entwürfe“ wenn status=draft; verlinkt auf /nebenkosten |
| **GlobalSearch** | Kontakte, Deals, Besichtigungen, Nebenkosten, Dokumente | Suche und Navigation für alle Seiten; Deep-Links `?highlight=xxx`, `?id=xxx` |
| **Dashboard** | Deals, Besichtigungen | Links zu „Deals in Besichtigung“ und „Besichtigungen“ |
| **GlobalSearch** | Besichtigungen | Suche in property_viewings; Seiten-Navigation |
| **Immo-Chat** | Deals, Besichtigungen, Tickets | System-Kontext um Tickets erweitert; vorgeschlagene Frage „Wie viele offene Tickets?“ |
| **Tickets** | Kontakte | Link „Zu Kontakten“ wenn keine Handwerker vorhanden |
| **Nebenkosten** | Mietübersicht, Objekte | Empty State: Buttons „Mietübersicht“, „Objekte“ |
| **Verträge** | Mietübersicht, Berichte, Dokumente | Links „Mietübersicht“, „Berichte“, „Dokumente hochladen“ in Kopfzeile (ROUTES, Touch-Target 44px) |
| **Dashboard** | Deals | Empty State (keine Objekte): Button „Zu Deals“ |
| **Dashboard** | Analyse | Link „Zur Analyse“ in Kopfzeile (Personal + Portfolio); Empty State: Button „Zur Analyse“ |
| **Berichte** | Objekte, Deals | Empty State (keine Objekte): Buttons „Objekte“, „Zu Deals“ |
| **Berichte** | Analyse | Link „Zur Analyse“ in der Kopfzeile (Kennzahlen vertiefen) |
| **Analyse** | Berichte | Button „Berichte“ in der Kopfzeile (Miet-, Objekt-, Steuerberichte) |
| **Newsticker** | — | Fehler beim Laden: handleError + toastErrorWithRetry (Retry = Aktualisieren) |
| **Dashboard** | Mietübersicht | StatCard „Mieteinnahmen“ verlinkt über ROUTES.RENT |
| **OnboardingBanner** | Home, Analyse | Schritte „Objekt hinzufügen“, „Zum Rechner“ nutzen ROUTES.HOME, ROUTES.ANALYSE |
| **PropertyMap** | Objekte | Popup-Link „Details →“ nutzt ROUTES.PROPERTY (Objekt-Detailseite) |
| **AddTenantDialog** | — | Fehler beim Anlegen: handleError + toastErrorWithRetry (Retry = handleSave) |
| **AddPropertyDialog** | — | Fehler beim Anlegen: handleError + toastErrorWithRetry (Retry = erneuter Submit) |
| **AddContactDialog** | — | Fehler beim Anlegen: handleError + toastErrorWithRetry (Retry = handleSave) |
| **DealToPropertyConverter** | Objekte | Deal→Immobilie: handleError + toastErrorWithRetry (Retry = handleConvert); Synergie Deals↔Objekte |
| **GlobalSearch** | Alle Seiten, Objekte | Nav- und Suchergebnis-Links nutzen ROUTES (Single Source of Truth) |

## Technische Details

- **Deal → Besichtigung**: `moveDeal` Mutation legt `property_viewings`-Eintrag an, wenn `stage === "besichtigung"`.
- **Deep-Links**: `useSearchParams()` liest `?id=xxx` (Deals, Besichtigungen) bzw. `?highlight=xxx` (Kontakte). Kontakte scrollt zum hervorgehobenen Kontakt, Deals/Besichtigungen öffnen den Bearbeitungsdialog.
- **Share-Buttons**: Deals und Besichtigungen nutzen `useShare()` für native Share API (Mobile) oder Kopieren in Zwischenablage.
- **Todos**: `project: "Besichtigungen"`, `title: "Besichtigung nachbereiten: …"`.
