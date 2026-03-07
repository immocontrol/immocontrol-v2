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
| **PropertyDetail** | Darlehen | Link „Darlehen bearbeiten“ in Finanzierung |
| **Verträge** | Dokumente | Link „Dokumente hochladen“ in Kopfzeile |
| **Dokumente** | Verträge | Empty State: Link „Verträge verwalten“ |
| **Darlehen** | Objekte, Deals | Empty State: Links „Objekt anlegen“, „Deals“ |
| **Objekte** | Deals, Besichtigungen | Empty State: Buttons Deals, Besichtigungen |
| **Besichtigungen** | Dokumente | Empty State: Link Dokumente hochladen |
| **Todos** | CRM | Empty State: Button „Zu CRM“ |
| **PropertyDetail** | Deals | Besichtigungen: Link zum Deal bei deal_id; Deep-Link ?id= zu Besichtigung |
| **Wartungsplaner** | Objekte | Empty State: Link „Objekte öffnen“ |
| **DashboardActionCenter** | Mietübersicht | „Überfällig“-Kachel verlinkt bei überfälligen Zahlungen |
| **Nebenkosten** | Dokumente | Link „Dokumente“ in Kopfzeile; Button „Als Dokument“ speichert Abrechnung als PDF in Objekt-Dokumente |
| **GlobalSearch** | Kontakte, Deals, Besichtigungen | Deep-Links `?highlight=xxx` (Kontakte scroll/highlight), `?id=xxx` (Deals/Besichtigungen öffnen Dialog) |
| **Dashboard** | Deals, Besichtigungen | Links zu „Deals in Besichtigung“ und „Besichtigungen“ |
| **GlobalSearch** | Besichtigungen | Suche in property_viewings; Seiten-Navigation |
| **Immo-Chat** | Deals, Besichtigungen, Tickets | System-Kontext um Tickets erweitert; vorgeschlagene Frage „Wie viele offene Tickets?“ |
| **Tickets** | Kontakte | Link „Zu Kontakten“ wenn keine Handwerker vorhanden |

## Technische Details

- **Deal → Besichtigung**: `moveDeal` Mutation legt `property_viewings`-Eintrag an, wenn `stage === "besichtigung"`.
- **Deep-Links**: `useSearchParams()` liest `?id=xxx` (Deals, Besichtigungen) bzw. `?highlight=xxx` (Kontakte). Kontakte scrollt zum hervorgehobenen Kontakt, Deals/Besichtigungen öffnen den Bearbeitungsdialog.
- **Share-Buttons**: Deals und Besichtigungen nutzen `useShare()` für native Share API (Mobile) oder Kopieren in Zwischenablage.
- **Todos**: `project: "Besichtigungen"`, `title: "Besichtigung nachbereiten: …"`.
