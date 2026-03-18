# Gamification-Konzept für ImmoControl

Vorschläge für mehr Gamification: Einheiten-Zähler, Achievements und optionale Erweiterungen.

---

## 1. Einheiten-Zähler (prominent + Historie) ✅ umgesetzt

**Idee:** Die Anzahl **Mieteinheiten** sichtbar und motivierend machen, mit Verlauf über die Zeit.

- **Widget „Meine Einheiten“:** Große Zahl (totalUnits), „X Einheiten in Y Objekten“, im Dashboard (Widget „Einheiten-Zähler“).
- **Verlauf:** Tabelle `user_stats_snapshots` speichert täglich einen Snapshot (total_units, property_count, equity, total_cashflow, total_value, total_rent). Beim Anzeigen des Widgets wird der aktuelle Stand für heute upserted.
- **Anzeige:** „Vor X Monaten: Y Einheiten → heute Z“ (letzter von heute verschiedener Snapshot); Mini-Sparkline der letzten ~30 Einträge.
- **Technik:** Migration `20260317120000_user_stats_snapshots.sql`, Hook `useStatsSnapshots`, Widget `EinheitenZaehler` (im Widget-Grid).

---

## 2. Achievements (Erweiterung der Meilensteine)

**Bestehend:** `PortfolioMilestones` = feste Liste (1/5/10 Objekte, EK, Cashflow, Rendite). Das ist bereits eine Art Achievement-System.

**Erweiterung – mehr Achievements:**

| Kategorie   | Beispiele (Achievement | Bedingung) |
|------------|--------------------------|------------|
| **Portfolio** | Erstes Objekt | `propertyCount >= 1` |
|             | 5 / 10 / 25 / 50 Einheiten | `totalUnits >= X` |
|             | Erstes MFH / ETW | Objekt mit `type` MFH/ETW angelegt |
| **Deals**   | Erster Deal abgeschlossen | Deal in „Kauf“ o.ä. |
|             | 10 Deals in der Pipeline | Anzahl Deals (Recherche → Kauf) |
| **Mieter**  | Erster Mieter erfasst | Mind. 1 aktiver Tenant |
|             | 100 % Belegung | Belegung = 100 % (bereits Daten da) |
| **Finanzen**| Positiver Cashflow | `totalCashflow > 0` |
|             | €1.000 / €5.000 / €10.000 Cashflow/Monat | wie Meilensteine |
|             | €100k / €500k / €1M Eigenkapital | wie Meilensteine |
| **Nutzung** | Erste Woche aktiv | 7 Tage mit Login (optional) |
|             | Dokument hochgeladen | Mind. 1 Dokument |
|             | Erste Besichtigung erfasst | Mind. 1 Eintrag in `property_viewings` |

**Technik:** Achievements als **definierte Liste** (z. B. in `src/lib/achievements.ts`): `id`, `title`, `description`, `icon`, `category`, `check: (context) => boolean`. Beim Rendern alle durchgehen und „erreicht“ anzeigen; optional in DB speichern (`user_achievements`: `user_id`, `achievement_id`, `unlocked_at`) für Entlock-Datum und um Toast nur einmal zu zeigen.

---

## 3. Einheitliches „Erfolgs“-Modul (Einheiten + Achievements)

- **Eine Sektion im Dashboard oder eigene Unterseite „Erfolge“ / „Meine Meilensteine“:**
  - **Einheiten-Zähler** oben (große Zahl + „X Einheiten in Y Objekten“).
  - **Achievements** darunter: Grid von Badges (erreicht = farbig/ausgefüllt, nicht erreicht = ausgegraut mit Fortschrittstext).
- **Optional:** Kurze Toast-Benachrichtigung beim ersten Erreichen eines Achievements („Achievement freigeschaltet: 10 Einheiten“).

---

## 4. Optionale Erweiterungen (später)

- **Streaks:** „X Tage in Folge eingeloggt“ – erfordert tägliches Tracking (z. B. `user_activity` mit `last_active_date` und Logik für „consecutive days“).
- **Punkte/Level:** Pro Achievement oder pro Einheit Punkte; Level nach Punkteschwellen. Kann rein im Frontend aus Achievements + Einheiten abgeleitet werden, ohne sofort neue DB-Felder.
- **Vergleich (anonym):** „Du hast mehr Einheiten als 60 % der Nutzer“ – erfordert aggregierte Statistiken (z. B. anonymisierte Summen pro Nutzer und Perzentil-Berechnung).

---

## 5. Weitere Gamification-Vorschläge

### 5.1 Streaks & Aktivität

| Idee | Beschreibung | Aufwand |
|------|--------------|--------|
| **Login-Streak** | „7 Tage in Folge aktiv“ – z. B. `user_activity.last_active_date` und Zählung aufeinanderfolgender Tage. | Mittel (Backend/Edge oder Client + Sync) |
| **Wochen-Challenge** | „Diese Woche: 1 neues Objekt angelegt“ oder „Mieteingang dokumentiert“. | Mittel |
| **Monats-Bilanz** | Am Monatsende kurzer Recap: „Du hast X Einheiten, Y € Cashflow, Z Deals bewertet.“ | Niedrig (aus Snapshots + Deals) |

### 5.2 Level & Punkte

| Idee | Beschreibung | Aufwand |
|------|--------------|--------|
| **Punkte pro Aktion** | +10 für neues Objekt, +5 für Mieter, +3 für Dokument, +1 für Deal in Pipeline. Optional in `user_stats` oder nur abgeleitet. | Niedrig (Frontend) bis Mittel (DB) |
| **Level-Stufen** | Stufe 1–10 z. B. nach Gesamtpunkten; Titel wie „Starter“, „Portfolio-Builder“, „Multi-Unit“. | Niedrig |
| **Fortschrittsring** | Ring um Avatar oder in der Nav: „Level 4 – 60 % bis Level 5“. | Niedrig |

### 5.3 Challenges & Ziele

| Idee | Beschreibung | Aufwand |
|------|--------------|--------|
| **Vordefinierte Challenges** | „Erreiche 10 Einheiten“, „Erster positiver Cashflow“, „3 Besichtigungen diesen Monat“. | Mittel (ähnlich Achievements) |
| **Eigene Ziele mit Deadline** | Bereits teilweise: PortfolioGoals. Erweiterung: Belohnung/Animation beim Erreichen. | Niedrig |
| **Quartals-Ziel** | „Q2: +5 Einheiten“ – Vergleich Snapshot Anfang vs. Ende Quartal. | Mittel (aus Snapshots) |

### 5.4 Social & Teilen (optional)

| Idee | Beschreibung | Aufwand |
|------|--------------|--------|
| **Meilenstein teilen** | „Ich habe 10 Einheiten erreicht“ als Share-Text oder Bild (OG-Card). | Niedrig |
| **Anonyme Benchmark** | „Du liegst über dem Durchschnitt bei Einheiten“ (ohne echte Nutzerdaten zu zeigen). | Hoch (Aggregation) |

### 5.5 Visuelle Belohnungen

| Idee | Beschreibung | Aufwand |
|------|--------------|--------|
| **Confetti / Animation** | Beim Erreichen eines Achievements oder Ziels kurze Animation. | Niedrig |
| **Badge-Galerie** | Eigene Seite „Erfolge“ mit allen Badges (erreicht/gesperrt). | Mittel |
| **Jahres-Rückblick** | Ende Jahr: „Dein 2025: Von X auf Y Einheiten, Z € Cashflow.“ Aus Snapshots. | Mittel |

### 5.6 Konkrete Metriken aus Verlauf (bereits Snapshots)

- **„Wachstum letzte 30 Tage“:** Differenz `total_units` (heute vs. vor 30 Tagen) aus `user_stats_snapshots`.
- **„Cashflow-Trend“:** Sparkline für `total_cashflow` wie bei Einheiten.
- **„Eigenkapital-Verlauf“:** Gleiche Tabelle, Sparkline für `equity`.

---

## 6. Priorisierung & Roadmap „Weiter in Richtung Gamification“

### Bereits umgesetzt
- Einheiten-Zähler mit Verlauf (Sparkline, „Vor X Monaten“)
- SMART-Ziele (5 Schritte, „Relevant“ gespeichert)
- Ziele mit „Noch X bis Ziel“, Deadline-Hinweis „In X Tagen“
- Einheiten-Widget: Fortschritt zu Einheiten-Ziel, Link „Einheiten-Ziel setzen“, Öffnen mit Preset
- Meilensteine-Widget (PortfolioMilestones)

### Nächste Schritte (priorisiert)

| Priorität | Maßnahme | Aufwand | Beschreibung |
|----------|----------|---------|--------------|
| **1** | Wachstum aus Verlauf sichtbar machen | Niedrig | Im Einheiten-Zähler „+X Einheiten in 30 Tagen“ aus Snapshots anzeigen (bereits Daten da). |
| **2** | Achievements ausbauen | Mittel | Meilensteine um Einheiten 5/10/25/50, „Erster Mieter“, „Erste Besichtigung“, „Dokument hochgeladen“, „10 Deals“ erweitern; optional Badge-Grid. |
| **3** | Belohnung beim Ziel erreichen | Niedrig | Beim Erreichen eines Ziels (100 %) einmalig Toast + kurze Animation (z. B. Confetti oder „Ziel erreicht!“-Highlight). |
| **4** | Level / Punkte (abgeleitet) | Niedrig | Einfache Formel: z. B. Punkte = Einheiten + 2×Objekte + 1×Ziele erreicht; Level 1–5 mit Titeln (Starter → Multi-Unit); im Header oder Erfolge-Widget. |
| **5** | Eigene Seite „Erfolge“ | Mittel | Route `/erfolge`: Einheiten-Zähler, Ziele-Kurzüberblick, Meilensteine, ggf. Badge-Galerie und „Wachstum 30 Tage“. |
| **6** | Login-Streak | Mittel | Tabelle `user_activity` (last_active_date), bei jedem Login aktualisieren; Anzeige „X Tage in Folge aktiv“. |
| **7** | Monats-/Jahres-Rückblick | Mittel | „Dein März: +2 Einheiten, Cashflow +200 €“ aus Snapshots; Jahres-Rückblick-Karte im Dezember. |
| **8** | Meilenstein teilen | Niedrig | Share-Button bei erreichtem Meilenstein (Web Share API oder Kopier-Text). |

---

## 7. Datenbasis (bereits vorhanden)

- **PropertyContext:** `stats.totalUnits`, `stats.propertyCount`, `stats.equity`, `stats.totalCashflow`, `stats.avgRendite`.
- **PortfolioGoals:** nutzerdefinierte Ziele (inkl. Einheiten).
- **PortfolioMilestones:** feste Meilensteine mit Fortschrittsbalken.
- **user_stats_snapshots:** tägliche Snapshots (total_units, property_count, equity, total_cashflow, total_value, total_rent, snapshot_date) für Verlauf und Sparklines. Siehe Migration `20260317120000_user_stats_snapshots.sql`, Hook `useStatsSnapshots`, Widget `EinheitenZaehler`.
- Für erweiterte Achievements: Abfragen auf `tenants`, `deals`, `documents`, `property_viewings` (je nach Feature bereits im Projekt vorhanden).
