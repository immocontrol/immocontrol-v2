# Synergien und Vernetzung (ImmoControl)

Übersicht der Verknüpfungen zwischen Modulen – die App wirkt dadurch „verdrahteter“.

## Übersicht

| Von | Zu | Verknüpfung |
|-----|-----|-------------|
| **CRM** | Deals | Button „Als Deal“ – Lead-Daten vorausgefüllt |
| **CRM** | Besichtigungen | Empty State: Link „Zu Besichtigungen“ |
| **Deals** | CRM | Empty State: Link „Leads aus CRM übernehmen“ |
| **Deals** | Besichtigungen | Bei Stage „Besichtigung“ wird automatisch ein Besichtigungseintrag angelegt |
| **Deals** | Kontakte | Dropdown „Kontakt übernehmen“ – Name, Tel, E-Mail |
| **Deals** | Besichtigungen | Link „Zu Besichtigungen“ bei Stage Besichtigung |
| **Besichtigungen** | Deals | Deal-Badge verlinkt auf /deals; Empty State: Link „Zu Deals“ |
| **Besichtigungen** | Todos | Button „Todo erstellen“ – Projekt „Besichtigungen“ |
| **Besichtigungen** | Global | Deep-Link `?id=xxx`; Link kopieren |
| **PropertyDetail** | Besichtigungen | Sektion „Besichtigungen“ wenn property_id verknüpft |
| **PropertyDetail** | Darlehen | Link „Darlehen bearbeiten“ in Finanzierung |
| **Verträge** | Dokumente | Link „Dokumente hochladen“ in Kopfzeile |
| **Dokumente** | Verträge | Empty State: Link „Verträge verwalten“ |
| **Darlehen** | Objekte, Deals | Empty State: Links „Objekt anlegen“, „Deals“ |
| **Objekte** | Deals, Besichtigungen | Empty State: Buttons Deals, Besichtigungen |
| **Besichtigungen** | Dokumente | Empty State: Link Dokumente hochladen |
| **Todos** | CRM | Empty State: Button „Zu CRM“ |
| **Dashboard** | Deals, Besichtigungen | Links zu „Deals in Besichtigung“ und „Besichtigungen“ |
| **GlobalSearch** | Besichtigungen | Suche in property_viewings; Seiten-Navigation |
| **Immo-Chat** | Deals, Besichtigungen, Tickets | System-Kontext um Tickets erweitert; vorgeschlagene Frage „Wie viele offene Tickets?“ |
| **Tickets** | Kontakte | Link „Zu Kontakten“ wenn keine Handwerker vorhanden |

## Technische Details

- **Deal → Besichtigung**: `moveDeal` Mutation legt `property_viewings`-Eintrag an, wenn `stage === "besichtigung"`.
- **Deep-Links**: `useSearchParams()` liest `?id=xxx`; Besichtigung öffnet sich automatisch.
- **Todos**: `project: "Besichtigungen"`, `title: "Besichtigung nachbereiten: …"`.
