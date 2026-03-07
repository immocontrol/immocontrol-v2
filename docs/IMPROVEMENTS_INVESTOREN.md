# Verbesserungen für Immo-Investoren (Stand März 2025)

Umsetzung der vorgeschlagenen Funktions- und Feature-Verbesserungen für Immobilieninvestoren.

---

## 1. Deal-Kalkulation in Deal-Karten

**Umsetzung:** In der Kanban-Ansicht zeigt jede Deal-Karte automatisch:
- **Brutto-Rendite** (berechnet aus Kaufpreis und erwarteter Miete, falls beide vorhanden)
- **Kaufpreis/m²** (wenn Kaufpreis und m² vorhanden)
- **Jahresmiete** (wenn erwartete Miete aber kein m² vorhanden)

**Datei:** `src/pages/Deals.tsx` (DealCard)

---

## 2. Zinsbindungs-Countdown

**Umsetzung:** Bei Darlehen mit Zinsbindung ≤12 Monate:
- Anzeige „Zinsbindung endet in X Tagen“
- Bei ≤90 Tagen: zusätzlicher Hinweis „· Anschluss prüfen!“ und Tooltip „Anschlussfinanzierung prüfen“

**Datei:** `src/pages/Loans.tsx`

---

## 3. Index-Mietanpassung in Mietübersicht

**Umsetzung:** Widget IndexMietanpassung direkt in der Mietübersicht (Tab Zahlungen) integriert. Berechnet mögliche Mieterhöhungen nach Verbraucherpreisindex und zeigt Anpassungspfade pro Objekt.

**Dateien:** `src/pages/Mietuebersicht.tsx`, `src/components/IndexMietanpassung.tsx`

---

## 4. Offene Posten Gruppierung (Mietübersicht)

**Umsetzung:** Offene Zahlungen (pending/overdue) werden nach Fälligkeit gruppiert:
- **Überfällig** (fällig vor heute)
- **In 7 Tagen** (fällig in den nächsten 7 Tagen)
- **In 30 Tagen** (fällig in 8–30 Tagen)

Filter-Badges ermöglichen die Fokussierung auf eine Gruppe.

**Datei:** `src/pages/Mietuebersicht.tsx`

---

## 5. Rendite-Ranking & Portfolio-Benchmark (ObjekteList)

**Umsetzung:**
- Neue Sortierung **Netto-Rendite** neben Brutto-Rendite
- Anzeige **Ø Brutto-Rendite** und **Ø Netto-Rendite** des Portfolios über der Objektliste

**Datei:** `src/pages/ObjekteList.tsx`

---

## 6. Cashflow Szenario „Mietanpassung“

**Umsetzung:** Neues Szenario im Cashforecast: **„Mietanpassung (+3% ab Monat 6)“** – simuliert eine Index-/Staffelmietanpassung ab ca. der 24. Woche.

**Datei:** `src/pages/CashForecast.tsx`

---

## 7. AfA-Berechnung pro Objekt (Berichte)

**Umsetzung:** AfA-Übersicht (AfACalculator) im Berichte-Center integriert. Zeigt pro Objekt: Gebäudeanteil, AfA-Satz, Jahres-AfA, Steuerersparnis, Rest-AfA.

**Dateien:** `src/pages/Berichte.tsx`, `src/components/AfACalculator.tsx`

---

## 8. Fristen-Zentrale (Verträge)

**Umsetzung:** FristenZentrale direkt auf der Verträge-Seite integriert. Bündelt: Mietvertragsende, Kündigungsfrist, Zinsbindung, Dokumentenfristen, Versicherungen, Dienstleisterverträge.

**Dateien:** `src/pages/Vertraege.tsx`, `src/components/FristenZentrale.tsx`

---

## 9. Dokumentfristen-Link (Dokumente)

**Umsetzung:** Link „Dokumentfristen & Verträge“ im Dokumenten-Management → führt zur Verträge-Seite (FristenZentrale).

**Datei:** `src/pages/Dokumente.tsx`

---

## 10. Portfolio-Benchmark

**Umsetzung:** In ObjekteList werden die Durchschnitts-Renditen (Brutto und Netto) des Portfolios angezeigt, sofern Objekte vorhanden sind.

**Datei:** `src/pages/ObjekteList.tsx`

---

*Stand: März 2025*
